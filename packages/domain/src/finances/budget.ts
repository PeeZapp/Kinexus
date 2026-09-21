import { roundMoney } from '../stash/money';
import {
  BUDGET_CADENCES,
  type FinanceBudgetLine,
  type FinanceBudgetLineCadence,
  type FinanceBudgetLineKind,
  type FinanceBudgetTotals,
  type FinanceBudgetTxn,
  type FinanceBudgetTxnSource,
} from './types';

export { BUDGET_CADENCES };
export type { FinanceBudgetLineCadence };

export const MONTH_LONG_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

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
  'Savings & Investments',
  'Other',
] as const;

export const SURPLUS_CAPTURE_NAME = 'Savings & Investments';

export type DefaultBudgetSeed = {
  kind: FinanceBudgetLineKind;
  name: string;
  position: number;
  captureSurplus?: boolean;
};

export const DEFAULT_BUDGET_SEED: readonly DefaultBudgetSeed[] = [
  ...DEFAULT_INCOME_LINES.map((name, index) => ({ kind: 'income' as const, name, position: index })),
  ...DEFAULT_EXPENSE_LINES.map((name, index) => ({
    kind: 'expense' as const,
    name,
    position: DEFAULT_INCOME_LINES.length + index,
    captureSurplus: name === SURPLUS_CAPTURE_NAME,
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

export function isBudgetCadence(value: unknown): value is FinanceBudgetLineCadence {
  return typeof value === 'string' && (BUDGET_CADENCES as readonly string[]).includes(value);
}

export function normalizeBudgetCadence(value: unknown): FinanceBudgetLineCadence {
  return isBudgetCadence(value) ? value : 'monthly';
}

export function normalizeAnchorMonth(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 12) return 1;
  return n;
}

export function calendarMonthNumber(now: Date = new Date()): number {
  return now.getMonth() + 1;
}

export function monthNumber(monthStart: string): number {
  const match = MONTH_START.exec(monthStart);
  return match ? Number(match[2]) : calendarMonthNumber();
}

export type BudgetMonthView = {
  spreadPeriodical?: boolean;
};

export function cadenceInterval(cadence: FinanceBudgetLineCadence): number {
  if (cadence === 'bimonthly') return 2;
  if (cadence === 'quarterly') return 3;
  if (cadence === 'half_yearly') return 6;
  if (cadence === 'yearly') return 12;
  return 1;
}

export function monthlyEquivalent(planned: number, cadence: FinanceBudgetLineCadence): number {
  return roundMoney(Math.max(0, planned) / cadenceInterval(normalizeBudgetCadence(cadence)));
}

export function cadenceDueMonths(cadence: FinanceBudgetLineCadence, anchorMonth: number): number[] {
  const interval = cadenceInterval(normalizeBudgetCadence(cadence));
  const anchor = normalizeAnchorMonth(anchorMonth);
  if (interval === 1) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const months: number[] = [];
  for (let offset = 0; offset < 12; offset += interval) {
    months.push(((anchor - 1 + offset) % 12) + 1);
  }
  return months;
}

export function cadenceHitsMonth(
  cadence: FinanceBudgetLineCadence,
  anchorMonth: number,
  month: number,
): boolean {
  return cadenceDueMonths(cadence, anchorMonth).includes(month);
}

export function isPeriodicalCadence(cadence: FinanceBudgetLineCadence): boolean {
  return normalizeBudgetCadence(cadence) !== 'monthly';
}

export function lineDueInMonth(
  line: Pick<FinanceBudgetLine, 'cadence' | 'anchorMonth'>,
  monthStart: string,
): boolean {
  return cadenceHitsMonth(normalizeBudgetCadence(line.cadence), line.anchorMonth, monthNumber(monthStart));
}

export function lineVisibleInMonth(
  line: Pick<FinanceBudgetLine, 'cadence' | 'anchorMonth' | 'spent' | 'planned'>,
  monthStart: string,
  view?: BudgetMonthView,
): boolean {
  if (view?.spreadPeriodical) return Math.max(0, line.planned) > 0 || Math.max(0, line.spent) > 0;
  return lineDueInMonth(line, monthStart) || Math.max(0, line.spent) > 0;
}

export function periodicalLines(lines: readonly FinanceBudgetLine[]): FinanceBudgetLine[] {
  return lines
    .filter((line) => isPeriodicalCadence(line.cadence))
    .slice()
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position || a.name.localeCompare(b.name));
}

export function plannedForMonth(
  line: Pick<FinanceBudgetLine, 'planned' | 'cadence' | 'anchorMonth'>,
  monthStart: string,
  view?: BudgetMonthView,
): number {
  const cadence = normalizeBudgetCadence(line.cadence);
  const planned = Math.max(0, line.planned);
  if (view?.spreadPeriodical && cadence !== 'monthly') return monthlyEquivalent(planned, cadence);
  if (!cadenceHitsMonth(cadence, line.anchorMonth, monthNumber(monthStart))) return 0;
  return roundMoney(planned);
}

export function cadenceLabel(cadence: FinanceBudgetLineCadence): string {
  if (cadence === 'bimonthly') return 'Every 2 months';
  if (cadence === 'quarterly') return 'Quarterly';
  if (cadence === 'half_yearly') return 'Twice a year';
  if (cadence === 'yearly') return 'Yearly';
  return 'Monthly';
}

export function cadenceAmountLabel(cadence: FinanceBudgetLineCadence): string {
  if (cadence === 'bimonthly') return 'Amount every two months';
  if (cadence === 'quarterly') return 'Amount each quarter';
  if (cadence === 'half_yearly') return 'Amount every six months';
  if (cadence === 'yearly') return 'Amount each year';
  return 'Amount each month';
}

export function cadenceDueLabel(cadence: FinanceBudgetLineCadence, anchorMonth: number): string {
  if (normalizeBudgetCadence(cadence) === 'monthly') return 'every month';
  return cadenceDueMonths(cadence, anchorMonth)
    .map((month) => MONTH_LONG_NAMES[month - 1])
    .join(', ');
}

export function linesOfKind(
  lines: readonly FinanceBudgetLine[],
  kind: FinanceBudgetLineKind,
): FinanceBudgetLine[] {
  return lines.filter((line) => line.kind === kind).slice().sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function parentLineIds(lines: readonly Pick<FinanceBudgetLine, 'parentId'>[]): Set<string> {
  const ids = new Set<string>();
  for (const line of lines) {
    if (line.parentId) ids.add(line.parentId);
  }
  return ids;
}

export function childrenOf(
  lines: readonly FinanceBudgetLine[],
  parentId: string,
): FinanceBudgetLine[] {
  return lines
    .filter((line) => line.parentId === parentId)
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function hasChildLines(lines: readonly Pick<FinanceBudgetLine, 'parentId'>[], parentId: string): boolean {
  return lines.some((line) => line.parentId === parentId);
}

export function linePathName(
  line: Pick<FinanceBudgetLine, 'id' | 'name' | 'parentId'>,
  lines: readonly Pick<FinanceBudgetLine, 'id' | 'name'>[],
): string {
  if (!line.parentId) return line.name;
  const parent = lines.find((item) => item.id === line.parentId);
  return parent ? `${parent.name} · ${line.name}` : line.name;
}

export function eligibleParentLines(
  lines: readonly FinanceBudgetLine[],
  kind: FinanceBudgetLineKind,
  lineId?: string | null,
): FinanceBudgetLine[] {
  return lines
    .filter((line) => line.kind === kind && !line.parentId && line.id !== lineId)
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export type BudgetLineGroup = {
  parent: FinanceBudgetLine;
  children: FinanceBudgetLine[];
};

export function budgetLineGroups(lines: readonly FinanceBudgetLine[]): BudgetLineGroup[] {
  const ids = new Set(lines.map((line) => line.id));
  const grouped = new Map<string, FinanceBudgetLine[]>();
  for (const line of lines) {
    if (!line.parentId || !ids.has(line.parentId)) continue;
    const current = grouped.get(line.parentId) ?? [];
    current.push(line);
    grouped.set(line.parentId, current);
  }
  return lines
    .filter((line) => !line.parentId || !ids.has(line.parentId))
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((parent) => ({
      parent,
      children: (grouped.get(parent.id) ?? [])
        .slice()
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    }));
}

export function rollupLine(
  line: FinanceBudgetLine,
  lines: readonly FinanceBudgetLine[],
): Pick<FinanceBudgetLine, 'planned' | 'spent'> {
  const children = childrenOf(lines, line.id);
  if (children.length === 0) return { planned: line.planned, spent: line.spent };
  return {
    planned: roundMoney(children.reduce((sum, child) => sum + Math.max(0, child.planned), 0)),
    spent: roundMoney(Math.max(0, line.spent) + children.reduce((sum, child) => sum + Math.max(0, child.spent), 0)),
  };
}

export function visibleLinesForMonth(
  monthLines: readonly FinanceBudgetLine[],
  monthStart: string,
  view?: BudgetMonthView,
): FinanceBudgetLine[] {
  const visible = new Set<string>();
  for (const line of monthLines) {
    if (lineVisibleInMonth(line, monthStart, view)) visible.add(line.id);
  }
  for (const line of monthLines) {
    if (visible.has(line.id) && line.parentId) visible.add(line.parentId);
  }
  return monthLines.filter((line) => visible.has(line.id));
}

export function deferredPeriodicalLines(
  standing: readonly FinanceBudgetLine[],
  monthLines: readonly FinanceBudgetLine[],
  monthStart: string,
  view?: BudgetMonthView,
): FinanceBudgetLine[] {
  if (view?.spreadPeriodical) return [];
  const visible = new Set(visibleLinesForMonth(monthLines, monthStart, view).map((line) => line.id));
  return periodicalLines(standing).filter((line) => !visible.has(line.id));
}

export const AUTO_APPLY_DESCRIPTION = 'Direct debit';
export const AUTO_APPLY_MERCHANT_KEY = 'DIRECT-DEBIT';
export const SURPLUS_ALLOCATE_DESCRIPTION = 'Surplus allocated';
export const SURPLUS_ALLOCATE_MERCHANT_KEY = 'SURPLUS-ALLOCATION';

export function looksLikeSurplusCaptureName(name: string): boolean {
  const value = name.trim().toLowerCase();
  return value === 'savings' || value === 'savings & investments' || value === 'savings and investments';
}

export function isSurplusCaptureLine(line: Pick<FinanceBudgetLine, 'captureSurplus' | 'kind' | 'parentId'>): boolean {
  return Boolean(line.captureSurplus) && line.kind === 'expense' && !line.parentId;
}

export function surplusCaptureLine(lines: readonly FinanceBudgetLine[]): FinanceBudgetLine | undefined {
  return lines.find((line) => isSurplusCaptureLine(line));
}

export function isSurplusAllocateTxn(txn: Pick<FinanceBudgetTxn, 'source' | 'merchantKey' | 'ignored'>): boolean {
  return !txn.ignored && budgetTxnSource(txn) === 'auto' && txn.merchantKey === SURPLUS_ALLOCATE_MERCHANT_KEY;
}

export function budgetTxnSource(
  txn: Pick<FinanceBudgetTxn, 'source' | 'merchantKey'>,
): FinanceBudgetTxnSource {
  if (txn.source === 'import' || txn.source === 'auto') return txn.source;
  if (txn.merchantKey === AUTO_APPLY_MERCHANT_KEY) return 'auto';
  return 'manual';
}

export function isAutoApplyTxn(txn: Pick<FinanceBudgetTxn, 'source' | 'merchantKey' | 'ignored'>): boolean {
  return !txn.ignored && budgetTxnSource(txn) === 'auto';
}

export type AutoApplyDraft = {
  lineId: string;
  amount: number;
  date: string;
  description: string;
  merchantKey: string;
};

export function missingAutoApplyTxns(
  lines: readonly FinanceBudgetLine[],
  txns: readonly FinanceBudgetTxn[],
  monthStart: string,
  now: Date = new Date(),
): AutoApplyDraft[] {
  if (monthStart > monthStartIso(now)) return [];
  const monthTxns = txnsInMonth(txns, monthStart);
  const parents = parentLineIds(lines);
  const drafts: AutoApplyDraft[] = [];
  for (const line of lines) {
    if (!line.autoApply) continue;
    if (line.captureSurplus) continue;
    if (parents.has(line.id)) continue;
    const planned = plannedForMonth(line, monthStart);
    if (planned <= 0) continue;
    if (line.autoAppliedMonth === monthStart) continue;
    const already = monthTxns.some((txn) => txn.lineId === line.id && isAutoApplyTxn(txn));
    if (already) continue;
    drafts.push({
      lineId: line.id,
      amount: planned,
      date: monthStart,
      description: AUTO_APPLY_DESCRIPTION,
      merchantKey: AUTO_APPLY_MERCHANT_KEY,
    });
  }
  return drafts;
}

export function budgetTotals(lines: readonly FinanceBudgetLine[]): FinanceBudgetTotals {
  const parents = parentLineIds(lines);
  let incomePlanned = 0;
  let incomeSpent = 0;
  let expensePlanned = 0;
  let expenseSpent = 0;
  for (const line of lines) {
    if (isSurplusCaptureLine(line)) continue;
    const planned = parents.has(line.id) ? 0 : Math.max(0, line.planned);
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

export function surplusToAllocate(
  monthLines: readonly FinanceBudgetLine[],
  monthTxns: readonly FinanceBudgetTxn[],
  sinkId: string,
): number {
  const totals = budgetTotals(monthLines);
  const income = Math.max(totals.incomeSpent, totals.incomePlanned);
  const otherSink = monthTxns.reduce((sum, txn) => {
    if (txn.ignored || txn.lineId !== sinkId || isSurplusAllocateTxn(txn)) return sum;
    return sum + Math.abs(txn.amount);
  }, 0);
  return roundMoney(Math.max(0, income - totals.expenseSpent - otherSink));
}

export type SurplusAllocateAction = {
  lineId: string;
  monthStart: string;
  amount: number;
  txnId?: string;
  action: 'insert' | 'update' | 'delete';
};

export function surplusAllocateActions(
  lines: readonly FinanceBudgetLine[],
  txns: readonly FinanceBudgetTxn[],
  now: Date = new Date(),
): SurplusAllocateAction[] {
  const sink = surplusCaptureLine(lines);
  if (!sink) return [];
  const current = monthStartIso(now);
  const months = budgetMonthStarts(txns, now);
  const actions: SurplusAllocateAction[] = [];
  for (const monthStart of months) {
    if (monthStart > current) continue;
    const monthLines = linesForMonth(lines, txns, monthStart);
    const monthTxns = txnsInMonth(txns, monthStart);
    const existing = monthTxns.find((txn) => txn.lineId === sink.id && isSurplusAllocateTxn(txn));
    const amount = surplusToAllocate(monthLines, monthTxns, sink.id);
    if (amount <= 0) {
      if (existing) {
        actions.push({ lineId: sink.id, monthStart, amount: 0, txnId: existing.id, action: 'delete' });
      }
      continue;
    }
    if (existing) {
      if (roundMoney(Math.abs(existing.amount)) !== amount) {
        actions.push({ lineId: sink.id, monthStart, amount, txnId: existing.id, action: 'update' });
      }
      continue;
    }
    actions.push({ lineId: sink.id, monthStart, amount, action: 'insert' });
  }
  return actions;
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

export function siblingBudgetLines(
  lines: readonly FinanceBudgetLine[],
  line: Pick<FinanceBudgetLine, 'id' | 'kind' | 'parentId'>,
): FinanceBudgetLine[] {
  return lines
    .filter((item) => item.kind === line.kind && (item.parentId ?? null) === (line.parentId ?? null))
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export type BudgetLinePosition = {
  id: string;
  position: number;
};

export function movedBudgetLinePositions(
  lines: readonly FinanceBudgetLine[],
  id: string,
  direction: -1 | 1,
  amongIds?: readonly string[],
): BudgetLinePosition[] {
  const current = lines.find((line) => line.id === id);
  if (!current || (direction !== -1 && direction !== 1)) return [];
  const siblings = siblingBudgetLines(lines, current);
  const allowed = amongIds ? new Set(amongIds) : null;
  const movable = siblings
    .map((line, index) => ({ line, index }))
    .filter((item) => !allowed || allowed.has(item.line.id));
  const from = movable.findIndex((item) => item.line.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= movable.length) return [];
  const next = siblings.slice();
  const fromIndex = movable[from]!.index;
  const toIndex = movable[to]!.index;
  const swap = next[fromIndex]!;
  next[fromIndex] = next[toIndex]!;
  next[toIndex] = swap;
  return next.flatMap((line, position) => (line.position === position ? [] : [{ id: line.id, position }]));
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
  view?: BudgetMonthView,
): FinanceBudgetLine[] {
  const spent = monthLineSpend(txns, monthStart);
  return lines.map((line) => ({
    ...line,
    planned: plannedForMonth(line, monthStart, view),
    spent: spent.get(line.id) ?? 0,
  }));
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
