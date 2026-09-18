import { roundMoney } from '../stash/money';
import type { FinanceBudgetLine, FinanceBudgetLineKind, FinanceBudgetTotals, FinanceBudgetTxn } from './types';

export const DEFAULT_INCOME_LINES = ['Salary', 'Other income'] as const;
export const DEFAULT_EXPENSE_LINES = [
  'Housing',
  'Groceries',
  'Transport',
  'Utilities',
  'Insurance',
  'Healthcare',
  'Childcare',
  'Entertainment',
  'Subscriptions',
  'Savings',
  'Other',
] as const;

export type DefaultBudgetSeed = {
  kind: FinanceBudgetLineKind;
  name: string;
  position: number;
};

export const DEFAULT_BUDGET_SEED: readonly DefaultBudgetSeed[] = [
  ...DEFAULT_INCOME_LINES.map((name, index) => ({ kind: 'income' as const, name, position: index })),
  ...DEFAULT_EXPENSE_LINES.map((name, index) => ({
    kind: 'expense' as const,
    name,
    position: DEFAULT_INCOME_LINES.length + index,
  })),
];

const MONTH_START = /^(\d{4})-(\d{2})-01$/;

export function monthStartIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function isMonthStart(value: string | null | undefined): boolean {
  return Boolean(value && MONTH_START.test(value));
}

export function shiftMonth(monthStart: string, delta: number): string {
  const match = MONTH_START.exec(monthStart);
  if (!match) return monthStartIso();
  const year = Number(match[1]);
  const month = Number(match[2]);
  return monthStartIso(new Date(year, month - 1 + delta, 1));
}

export function monthLabel(monthStart: string): string {
  const match = MONTH_START.exec(monthStart);
  if (!match) return monthStart;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function linesOfKind(
  lines: readonly FinanceBudgetLine[],
  kind: FinanceBudgetLineKind,
): FinanceBudgetLine[] {
  return lines.filter((line) => line.kind === kind).slice().sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function budgetTotals(lines: readonly FinanceBudgetLine[]): FinanceBudgetTotals {
  let incomePlanned = 0;
  let incomeSpent = 0;
  let expensePlanned = 0;
  let expenseSpent = 0;
  for (const line of lines) {
    const planned = Math.max(0, line.planned);
    const spent = Math.max(0, line.spent);
    if (line.kind === 'income') {
      incomePlanned += planned;
      incomeSpent += spent;
    } else {
      expensePlanned += planned;
      expenseSpent += spent;
    }
  }
  const expenseProgress = expensePlanned > 0 ? Math.min(1, expenseSpent / expensePlanned) : expenseSpent > 0 ? 1 : 0;
  return {
    incomePlanned: roundMoney(incomePlanned),
    incomeSpent: roundMoney(incomeSpent),
    expensePlanned: roundMoney(expensePlanned),
    expenseSpent: roundMoney(expenseSpent),
    leftoverPlanned: roundMoney(incomePlanned - expensePlanned),
    leftoverActual: roundMoney(incomeSpent - expenseSpent),
    expenseProgress,
  };
}

export function lineRemaining(line: Pick<FinanceBudgetLine, 'planned' | 'spent'>): number {
  return roundMoney(Math.max(0, line.planned) - Math.max(0, line.spent));
}

export function lineProgress(line: Pick<FinanceBudgetLine, 'planned' | 'spent'>): number {
  const planned = Math.max(0, line.planned);
  const spent = Math.max(0, line.spent);
  if (planned <= 0) return spent > 0 ? 1 : 0;
  return Math.min(1, spent / planned);
}

export type SpendStatus = {
  budget: number;
  spent: number;
  over: boolean;
  overBy: number;
  left: number;
};

export function spendStatus(planned: number, spent: number): SpendStatus {
  const budget = Math.max(0, planned);
  const actual = Math.max(0, spent);
  return {
    budget,
    spent: actual,
    over: actual > budget && budget > 0,
    overBy: roundMoney(Math.max(0, actual - budget)),
    left: roundMoney(Math.max(0, budget - actual)),
  };
}

export function nextLinePosition(lines: readonly FinanceBudgetLine[], kind: FinanceBudgetLineKind): number {
  const same = lines.filter((line) => line.kind === kind);
  if (same.length === 0) return kind === 'income' ? 0 : DEFAULT_INCOME_LINES.length;
  return Math.max(...same.map((line) => line.position)) + 1;
}

export type BudgetLineMerchant = {
  merchantKey: string;
  sample: string;
  count: number;
  total: number;
  transactions: FinanceBudgetTxn[];
};

export function budgetMonthCount(txns: readonly { date: string }[]): number {
  const months = new Set<string>();
  for (const txn of txns) {
    if (txn.date.length >= 7) months.add(txn.date.slice(0, 7));
  }
  return Math.max(1, months.size);
}

export function txnsForBudgetLine(txns: readonly FinanceBudgetTxn[], lineId: string): FinanceBudgetTxn[] {
  return txns
    .filter((txn) => !txn.ignored && txn.lineId === lineId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.amount) - Math.abs(a.amount) || a.description.localeCompare(b.description));
}

export function ignoredBudgetTxns(txns: readonly FinanceBudgetTxn[]): FinanceBudgetTxn[] {
  return txns
    .filter((txn) => txn.ignored)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
}

export function merchantsForBudgetLine(txns: readonly FinanceBudgetTxn[], lineId: string): BudgetLineMerchant[] {
  return groupBudgetTxns(txnsForBudgetLine(txns, lineId));
}

export function merchantsForIgnoredTxns(txns: readonly FinanceBudgetTxn[]): BudgetLineMerchant[] {
  return groupBudgetTxns(ignoredBudgetTxns(txns));
}

export function txnsForMerchant(
  txns: readonly FinanceBudgetTxn[],
  merchantKey: string,
  scope: 'merchant' | 'one',
  txnId?: string,
): FinanceBudgetTxn[] {
  if (scope === 'one') return txns.filter((txn) => txn.id === txnId);
  return txns.filter((txn) => txn.merchantKey === merchantKey);
}

export function lineSpendTotals(
  lines: readonly Pick<FinanceBudgetLine, 'id'>[],
  txns: readonly FinanceBudgetTxn[],
): Map<string, number> {
  const months = budgetMonthCount(txns);
  const sums = new Map<string, number>();
  for (const txn of txns) {
    if (txn.ignored || !txn.lineId) continue;
    sums.set(txn.lineId, roundMoney((sums.get(txn.lineId) ?? 0) + Math.abs(txn.amount)));
  }
  const out = new Map<string, number>();
  for (const line of lines) {
    out.set(line.id, roundMoney((sums.get(line.id) ?? 0) / months));
  }
  return out;
}

export function isBudgetSet(
  lines: readonly Pick<FinanceBudgetLine, 'planned'>[],
  txns: readonly unknown[],
  setupCompletedAt?: string | null,
): boolean {
  return Boolean(setupCompletedAt) || txns.length > 0 || lines.some((line) => line.planned > 0);
}

export function txnMonthStart(date: string): string {
  return date.length >= 7 ? `${date.slice(0, 7)}-01` : monthStartIso();
}

export function txnsInMonth<T extends { date: string }>(txns: readonly T[], monthStart: string): T[] {
  const prefix = monthStart.slice(0, 7);
  return txns.filter((txn) => txn.date.startsWith(prefix));
}

export function budgetMonthStarts(txns: readonly { date: string }[], now: Date = new Date()): string[] {
  const current = monthStartIso(now);
  const seen = new Set<string>([current]);
  for (const txn of txns) seen.add(txnMonthStart(txn.date));
  const first = [...seen].sort()[0] ?? current;
  const out: string[] = [];
  for (let cursor = first, guard = 0; guard < 240; cursor = shiftMonth(cursor, 1), guard += 1) {
    out.push(cursor);
    if (cursor >= current && !seen.has(shiftMonth(cursor, 1))) break;
  }
  return out;
}

export function monthLineSpend(txns: readonly FinanceBudgetTxn[], monthStart: string): Map<string, number> {
  const sums = new Map<string, number>();
  for (const txn of txnsInMonth(txns, monthStart)) {
    if (txn.ignored || !txn.lineId) continue;
    sums.set(txn.lineId, roundMoney((sums.get(txn.lineId) ?? 0) + Math.abs(txn.amount)));
  }
  return sums;
}

export function linesForMonth(
  lines: readonly FinanceBudgetLine[],
  txns: readonly FinanceBudgetTxn[],
  monthStart: string,
): FinanceBudgetLine[] {
  const spent = monthLineSpend(txns, monthStart);
  return lines.map((line) => ({ ...line, spent: spent.get(line.id) ?? 0 }));
}

export type BudgetMonthSummary = {
  monthStart: string;
  label: string;
  incomePlanned: number;
  incomeSpent: number;
  expensePlanned: number;
  expenseSpent: number;
  leftoverPlanned: number;
  leftoverActual: number;
  over: boolean;
  overBy: number;
  left: number;
};

export function monthSummaries(
  lines: readonly FinanceBudgetLine[],
  txns: readonly FinanceBudgetTxn[],
  now: Date = new Date(),
): BudgetMonthSummary[] {
  return budgetMonthStarts(txns, now).map((monthStart) => {
    const totals = budgetTotals(linesForMonth(lines, txns, monthStart));
    const status = spendStatus(totals.expensePlanned, totals.expenseSpent);
    return {
      monthStart,
      label: monthLabel(monthStart),
      incomePlanned: totals.incomePlanned,
      incomeSpent: totals.incomeSpent,
      expensePlanned: totals.expensePlanned,
      expenseSpent: totals.expenseSpent,
      leftoverPlanned: totals.leftoverPlanned,
      leftoverActual: totals.leftoverActual,
      over: status.over,
      overBy: status.overBy,
      left: status.left,
    };
  });
}

export function defaultTxnDateForMonth(monthStart: string, now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;
  if (today.startsWith(monthStart.slice(0, 7))) return today;
  return monthStart;
}

function groupBudgetTxns(txns: readonly FinanceBudgetTxn[]): BudgetLineMerchant[] {
  const groups = new Map<string, BudgetLineMerchant>();
  for (const txn of txns) {
    const current = groups.get(txn.merchantKey) ?? {
      merchantKey: txn.merchantKey,
      sample: txn.description,
      count: 0,
      total: 0,
      transactions: [],
    };
    current.count += 1;
    current.total = roundMoney(current.total + Math.abs(txn.amount));
    current.transactions.push(txn);
    groups.set(txn.merchantKey, current);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.merchantKey.localeCompare(b.merchantKey));
}
