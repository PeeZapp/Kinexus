import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUDGET_SEED,
  budgetTotals,
  isMonthStart,
  lineProgress,
  lineRemaining,
  spendStatus,
  monthStartIso,
  nextLinePosition,
  shiftMonth,
  budgetMonthCount,
  budgetMonthStarts,
  defaultTxnDateForMonth,
  isBudgetSet,
  lineSpendTotals,
  linesForMonth,
  merchantsForBudgetLine,
  monthLineSpend,
  monthSummaries,
  txnsForMerchant,
  txnsInMonth,
} from './budget';
import type { FinanceBudgetLine } from './types';

function line(
  partial: Partial<FinanceBudgetLine> & Pick<FinanceBudgetLine, 'id' | 'kind' | 'name' | 'planned' | 'spent'>,
): FinanceBudgetLine {
  return {
    householdId: 'h1',
    budgetId: 'b1',
    position: 0,
    ...partial,
  };
}

describe('finance budget', () => {
  it('uses the first of the local month', () => {
    expect(monthStartIso(new Date(2026, 8, 7))).toBe('2026-09-01');
    expect(isMonthStart('2026-09-01')).toBe(true);
    expect(isMonthStart('2026-09-07')).toBe(false);
    expect(shiftMonth('2026-09-01', -1)).toBe('2026-08-01');
    expect(shiftMonth('2026-01-01', 1)).toBe('2026-02-01');
  });

  it('seeds default income and expense categories', () => {
    expect(DEFAULT_BUDGET_SEED.some((item) => item.kind === 'income' && item.name === 'Salary')).toBe(true);
    expect(DEFAULT_BUDGET_SEED.filter((item) => item.kind === 'expense').length).toBeGreaterThan(5);
  });

  it('totals leftover and progress', () => {
    const totals = budgetTotals([
      line({ id: '1', kind: 'income', name: 'Salary', planned: 8000, spent: 8000 }),
      line({ id: '2', kind: 'expense', name: 'Housing', planned: 2500, spent: 2500 }),
      line({ id: '3', kind: 'expense', name: 'Food', planned: 1000, spent: 400 }),
    ]);
    expect(totals.incomePlanned).toBe(8000);
    expect(totals.expensePlanned).toBe(3500);
    expect(totals.leftoverPlanned).toBe(4500);
    expect(totals.expenseSpent).toBe(2900);
    expect(totals.expenseProgress).toBeCloseTo(2900 / 3500);
    expect(lineRemaining({ planned: 1000, spent: 400 })).toBe(600);
    expect(lineProgress({ planned: 1000, spent: 400 })).toBeCloseTo(0.4);
    expect(spendStatus(1000, 400)).toEqual({ budget: 1000, spent: 400, over: false, overBy: 0, left: 600 });
    expect(spendStatus(800, 1200)).toEqual({ budget: 800, spent: 1200, over: true, overBy: 400, left: 0 });
  });

  it('places new lines after the current kind', () => {
    const lines = [
      line({ id: '1', kind: 'income', name: 'Salary', planned: 0, spent: 0, position: 0 }),
      line({ id: '2', kind: 'expense', name: 'Rent', planned: 0, spent: 0, position: 4 }),
    ];
    expect(nextLinePosition(lines, 'income')).toBe(1);
    expect(nextLinePosition(lines, 'expense')).toBe(5);
  });

  it('averages persisted transactions back onto budget lines', () => {
    const groceries = line({ id: 'g', kind: 'expense', name: 'Groceries', planned: 0, spent: 0 });
    const other = line({ id: 'o', kind: 'expense', name: 'Other', planned: 0, spent: 0 });
    const txns = [
      { id: '1', householdId: 'h1', budgetId: 'b1', lineId: 'g', date: '2026-01-15', description: 'WOOLWORTHS', merchantKey: 'WOOLWORTHS', amount: -120, ignored: false },
      { id: '2', householdId: 'h1', budgetId: 'b1', lineId: 'g', date: '2026-02-15', description: 'WOOLWORTHS', merchantKey: 'WOOLWORTHS', amount: -180, ignored: false },
      { id: '3', householdId: 'h1', budgetId: 'b1', lineId: 'o', date: '2026-01-20', description: 'MYSTERY CAFE', merchantKey: 'MYSTERY CAFE', amount: -48, ignored: false },
    ];
    const spent = lineSpendTotals([groceries, other], txns);
    expect(budgetMonthCount(txns)).toBe(2);
    expect(spent.get('g')).toBe(150);
    expect(spent.get('o')).toBe(24);
    expect(merchantsForBudgetLine(txns, 'g')[0]?.count).toBe(2);
    expect(txnsForMerchant(txns, 'WOOLWORTHS', 'merchant')).toHaveLength(2);
    expect(txnsForMerchant(txns, 'WOOLWORTHS', 'one', '1')).toHaveLength(1);
  });

  it('treats a budget as unset until planned amounts or transactions exist', () => {
    const empty = [line({ id: '1', kind: 'expense', name: 'Groceries', planned: 0, spent: 0 })];
    expect(isBudgetSet(empty, [])).toBe(false);
    expect(isBudgetSet(empty, [], '2026-09-01T00:00:00Z')).toBe(true);
    expect(isBudgetSet([line({ id: '1', kind: 'expense', name: 'Groceries', planned: 400, spent: 0 })], [])).toBe(true);
    expect(
      isBudgetSet(empty, [
        { id: '1', householdId: 'h1', budgetId: 'b1', lineId: '1', date: '2026-09-02', description: 'Woolworths', merchantKey: 'WOOLWORTHS', amount: -50, ignored: false },
      ]),
    ).toBe(true);
  });

  it('keeps spend and over/under per calendar month', () => {
    const groceries = line({ id: 'g', kind: 'expense', name: 'Groceries', planned: 200, spent: 0 });
    const salary = line({ id: 's', kind: 'income', name: 'Salary', planned: 8000, spent: 0 });
    const txns = [
      { id: '1', householdId: 'h1', budgetId: 'b1', lineId: 'g', date: '2026-01-15', description: 'Woolworths food shop', merchantKey: 'WOOLWORTHS', amount: -500, ignored: false },
      { id: '2', householdId: 'h1', budgetId: 'b1', lineId: 'g', date: '2026-02-04', description: 'Coles', merchantKey: 'COLES', amount: -80, ignored: false },
      { id: '3', householdId: 'h1', budgetId: 'b1', lineId: 's', date: '2026-01-31', description: 'Pay', merchantKey: 'PAY', amount: 8000, ignored: false },
    ];
    expect(txnsInMonth(txns, '2026-01-01')).toHaveLength(2);
    expect(monthLineSpend(txns, '2026-01-01').get('g')).toBe(500);
    expect(linesForMonth([groceries], txns, '2026-01-01')[0]?.spent).toBe(500);
    expect(linesForMonth([groceries], txns, '2026-02-01')[0]?.spent).toBe(80);
    expect(linesForMonth([groceries], txns, '2026-03-01')[0]?.spent).toBe(0);
    expect(budgetMonthStarts(txns, new Date(2026, 2, 1))).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(budgetMonthStarts(txns, new Date(2026, 3, 1))).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]);
    const history = monthSummaries([salary, groceries], txns, new Date(2026, 1, 1));
    const january = history.find((item) => item.monthStart === '2026-01-01');
    const february = history.find((item) => item.monthStart === '2026-02-01');
    expect(january?.over).toBe(true);
    expect(january?.overBy).toBe(300);
    expect(january?.expenseSpent).toBe(500);
    expect(february?.over).toBe(false);
    expect(february?.left).toBe(120);
    expect(defaultTxnDateForMonth('2026-01-01', new Date(2026, 8, 18))).toBe('2026-01-01');
    expect(defaultTxnDateForMonth('2026-09-01', new Date(2026, 8, 18))).toBe('2026-09-18');
  });
});
