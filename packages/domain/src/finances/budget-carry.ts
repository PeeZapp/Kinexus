import { roundMoney } from '../stash/money';
import {
  isSurplusCaptureLine,
  linesForMonth,
  monthLabel,
  monthStartIso,
  parentLineIds,
  plannedForMonth,
  shiftMonth,
  txnsInMonth,
} from './budget';
import type { FinanceBudgetLine, FinanceBudgetTxn } from './types';

export const BUDGET_CARRY_EVENT_KINDS = ['accrue', 'apply', 'transfer', 'clear'] as const;
export type BudgetCarryEventKind = (typeof BUDGET_CARRY_EVENT_KINDS)[number];

export type FinanceBudgetCarry = {
  id: string;
  householdId: string;
  budgetId: string;
  lineId: string;
  /** Positive = underspend credit. Negative = overspend debt. */
  balance: number;
  lastAccruedMonth: string | null;
  updatedAt: string;
};

export type FinanceBudgetCarryEvent = {
  id: string;
  householdId: string;
  budgetId: string;
  lineId: string;
  kind: BudgetCarryEventKind;
  amount: number;
  sourceMonth: string | null;
  targetLineId: string | null;
  targetMonth: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type BudgetCarryDashboardRow = {
  lineId: string;
  name: string;
  balance: number;
  under: boolean;
  over: boolean;
  lastAccruedMonth: string | null;
  lastAccruedLabel: string | null;
};

export type CarryAccrueAction = {
  lineId: string;
  monthStart: string;
  amount: number;
  nextBalance: number;
  previousBalance: number;
  lastAccruedMonth: string | null;
};

export type CarryMonthApply = {
  lineId: string;
  amount: number;
};

/** Month variance: planned − spent. Positive = under, negative = over. */
export function monthCarryVariance(planned: number, spent: number): number {
  return roundMoney(Math.max(0, planned) - spent);
}

export function isAccruableCarryLine(
  line: Pick<FinanceBudgetLine, 'id' | 'kind' | 'parentId' | 'captureSurplus'>,
  parents: ReadonlySet<string>,
): boolean {
  if (line.kind !== 'expense') return false;
  if (isSurplusCaptureLine(line)) return false;
  if (parents.has(line.id)) return false;
  return true;
}

export function carryBalanceByLine(rows: readonly FinanceBudgetCarry[]): Map<string, FinanceBudgetCarry> {
  const map = new Map<string, FinanceBudgetCarry>();
  for (const row of rows) map.set(row.lineId, row);
  return map;
}

/** Applied carry adjustments that change effective planned for a month. */
export function appliedCarryByLine(
  events: readonly Pick<FinanceBudgetCarryEvent, 'kind' | 'targetLineId' | 'targetMonth' | 'amount'>[],
  monthStart: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== 'apply') continue;
    if (event.targetMonth !== monthStart || !event.targetLineId) continue;
    out.set(event.targetLineId, roundMoney((out.get(event.targetLineId) ?? 0) + event.amount));
  }
  return out;
}

export function plannedWithCarry(
  line: Pick<FinanceBudgetLine, 'id' | 'planned' | 'cadence' | 'anchorMonth'>,
  monthStart: string,
  applied: ReadonlyMap<string, number>,
  view?: { spreadPeriodical?: boolean },
): number {
  return roundMoney(plannedForMonth(line, monthStart, view) + (applied.get(line.id) ?? 0));
}

/**
 * Accrue closed months into cumulative balances.
 * Only months strictly before `asOfMonth` are accrued, and each month at most once per line.
 */
export function carryAccrueActions(input: {
  lines: readonly FinanceBudgetLine[];
  txns: readonly FinanceBudgetTxn[];
  carries: readonly FinanceBudgetCarry[];
  asOfMonth?: string;
  now?: Date;
}): CarryAccrueAction[] {
  const asOf = input.asOfMonth ?? monthStartIso(input.now);
  const parents = parentLineIds(input.lines);
  const byLine = carryBalanceByLine(input.carries);
  const actions: CarryAccrueAction[] = [];

  for (const line of input.lines) {
    if (!isAccruableCarryLine(line, parents)) continue;
    const existing = byLine.get(line.id);
    let last = existing?.lastAccruedMonth ?? null;
    let balance = existing?.balance ?? 0;

    // Start from the month after last accrued, or the earliest txn/plan month, capped reasonably.
    let cursor = last ? shiftMonth(last, 1) : earliestCarryMonth(input.txns, asOf);
    for (let guard = 0; guard < 240 && cursor < asOf; cursor = shiftMonth(cursor, 1), guard += 1) {
      const monthLines = linesForMonth(input.lines, input.txns, cursor);
      const monthLine = monthLines.find((item) => item.id === line.id);
      if (!monthLine) continue;
      const amount = monthCarryVariance(monthLine.planned, monthLine.spent);
      if (amount === 0) {
        last = cursor;
        continue;
      }
      const previousBalance = balance;
      balance = roundMoney(balance + amount);
      actions.push({
        lineId: line.id,
        monthStart: cursor,
        amount,
        nextBalance: balance,
        previousBalance,
        lastAccruedMonth: last,
      });
      last = cursor;
    }
  }

  return actions;
}

function earliestCarryMonth(txns: readonly { date: string }[], asOf: string): string {
  let first = shiftMonth(asOf, -1);
  for (const txn of txns) {
    if (txn.date.length < 7) continue;
    const month = `${txn.date.slice(0, 7)}-01`;
    if (month < first) first = month;
  }
  // Don't walk more than 24 months back from asOf for first accrual.
  const floor = shiftMonth(asOf, -24);
  return first < floor ? floor : first;
}

export function carryDashboardRows(
  lines: readonly FinanceBudgetLine[],
  carries: readonly FinanceBudgetCarry[],
): BudgetCarryDashboardRow[] {
  const byId = new Map(lines.map((line) => [line.id, line]));
  return carries
    .filter((row) => roundMoney(row.balance) !== 0)
    .map((row) => {
      const line = byId.get(row.lineId);
      const balance = roundMoney(row.balance);
      return {
        lineId: row.lineId,
        name: line?.name ?? 'Category',
        balance,
        under: balance > 0,
        over: balance < 0,
        lastAccruedMonth: row.lastAccruedMonth,
        lastAccruedLabel: row.lastAccruedMonth ? monthLabel(row.lastAccruedMonth) : null,
      };
    })
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name));
}

export function formatCarryBalance(balance: number, currencyFormat: (n: number) => string): string {
  const abs = currencyFormat(Math.abs(balance));
  if (balance > 0) return `${abs} under`;
  if (balance < 0) return `${abs} over`;
  return 'cleared';
}

/** Net spent for a line in a month using signed txns (refunds reduce expense spend). */
export function signedMonthLineSpend(
  txns: readonly FinanceBudgetTxn[],
  monthStart: string,
  lines: readonly Pick<FinanceBudgetLine, 'id' | 'kind'>[],
): Map<string, number> {
  const kindById = new Map(lines.map((line) => [line.id, line.kind]));
  const sums = new Map<string, number>();
  for (const txn of txnsInMonth(txns, monthStart)) {
    if (txn.ignored || !txn.lineId) continue;
    const kind = kindById.get(txn.lineId) ?? 'expense';
    const delta = kind === 'income' ? txn.amount : -txn.amount;
    sums.set(txn.lineId, roundMoney((sums.get(txn.lineId) ?? 0) + delta));
  }
  return sums;
}

export function clampApplyAmount(balance: number, requested: number): number {
  const amount = roundMoney(Math.abs(requested));
  if (amount <= 0) return 0;
  if (balance === 0) return 0;
  if (balance > 0) return roundMoney(Math.min(balance, amount));
  return roundMoney(-Math.min(Math.abs(balance), amount));
}
