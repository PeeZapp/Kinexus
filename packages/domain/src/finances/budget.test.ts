import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUDGET_SEED,
  budgetTotals,
  isMonthStart,
  lineProgress,
  lineRemaining,
  spendStatus,
  monthStartIso,
  movedBudgetLinePositions,
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
  cadenceDueLabel,
  cadenceDueMonths,
  cadenceLabel,
  lineVisibleInMonth,
  monthlyEquivalent,
  plannedForMonth,
  visibleLinesForMonth,
  deferredPeriodicalLines,
  surplusToAllocate,
  surplusAllocateActions,
  budgetLineGroups,
  rollupLine,
  linePathName,
  missingAutoApplyTxns,
} from './budget';
import type { FinanceBudgetLine } from './types';

function line(
  partial: Partial<FinanceBudgetLine> & Pick<FinanceBudgetLine, 'id' | 'kind' | 'name' | 'planned' | 'spent'>,
): FinanceBudgetLine {
  return {
    householdId: 'h1',
    budgetId: 'b1',
    position: 0,
    cadence: 'monthly',
    anchorMonth: 1,
    parentId: null,
    autoApply: false,
    autoAppliedMonth: null,
    captureSurplus: false,
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

  it('puts yearly and quarterly planned amounts in the months they land', () => {
    const insurance = line({
      id: 'i',
      kind: 'expense',
      name: 'Car insurance',
      planned: 800,
      spent: 0,
      cadence: 'yearly',
      anchorMonth: 3,
    });
    const rates = line({
      id: 'r',
      kind: 'expense',
      name: 'Council rates',
      planned: 450,
      spent: 0,
      cadence: 'quarterly',
      anchorMonth: 2,
    });
    const groceries = line({ id: 'g', kind: 'expense', name: 'Groceries', planned: 200, spent: 0 });
    expect(plannedForMonth(insurance, '2026-03-01')).toBe(800);
    expect(plannedForMonth(insurance, '2026-04-01')).toBe(0);
    expect(cadenceDueMonths('quarterly', 2)).toEqual([2, 5, 8, 11]);
    expect(plannedForMonth(rates, '2026-02-01')).toBe(450);
    expect(plannedForMonth(rates, '2026-03-01')).toBe(0);
    expect(plannedForMonth(rates, '2026-05-01')).toBe(450);
    expect(linesForMonth([insurance, groceries], [], '2026-03-01').map((item) => item.planned)).toEqual([800, 200]);
    expect(linesForMonth([insurance, groceries], [], '2026-04-01').map((item) => item.planned)).toEqual([0, 200]);
    const history = monthSummaries(
      [insurance, groceries],
      [
        {
          id: '1',
          householdId: 'h1',
          budgetId: 'b1',
          lineId: 'g',
          date: '2026-03-02',
          description: 'Woolworths',
          merchantKey: 'WOOLWORTHS',
          amount: -10,
          ignored: false,
        },
      ],
      new Date(2026, 3, 1),
    );
    expect(history.find((item) => item.monthStart === '2026-03-01')?.expensePlanned).toBe(1000);
    expect(history.find((item) => item.monthStart === '2026-04-01')?.expensePlanned).toBe(200);
    expect(cadenceDueLabel('yearly', 3)).toBe('March');
    expect(cadenceDueLabel('half_yearly', 3)).toBe('March, September');
  });

  it('hides periodical lines from the month until they are due', () => {
    const insurance = line({
      id: 'i',
      kind: 'expense',
      name: 'Car insurance',
      planned: 800,
      spent: 0,
      cadence: 'yearly',
      anchorMonth: 3,
    });
    const groceries = line({ id: 'g', kind: 'expense', name: 'Groceries', planned: 200, spent: 0 });
    const march = linesForMonth([insurance, groceries], [], '2026-03-01');
    const april = linesForMonth([insurance, groceries], [], '2026-04-01');
    expect(visibleLinesForMonth(march, '2026-03-01').map((item) => item.id)).toEqual(['i', 'g']);
    expect(visibleLinesForMonth(april, '2026-04-01').map((item) => item.id)).toEqual(['g']);
    expect(deferredPeriodicalLines([insurance, groceries], april, '2026-04-01').map((item) => item.id)).toEqual(['i']);
    expect(lineVisibleInMonth({ ...april[0]!, spent: 40 }, '2026-04-01')).toBe(true);
  });

  it('rolls subcategories up under the parent without double-counting the plan', () => {
    const subscriptions = line({ id: 's', kind: 'expense', name: 'Subscriptions', planned: 80, spent: 0 });
    const netflix = line({ id: 'n', kind: 'expense', name: 'Netflix', planned: 17, spent: 17, parentId: 's', position: 1 });
    const disney = line({ id: 'd', kind: 'expense', name: 'Disney+', planned: 15, spent: 0, parentId: 's', position: 2 });
    const groups = budgetLineGroups([subscriptions, netflix, disney]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.children.map((item) => item.id)).toEqual(['n', 'd']);
    expect(rollupLine(subscriptions, [subscriptions, netflix, disney])).toEqual({ planned: 32, spent: 17 });
    expect(budgetTotals([subscriptions, netflix, disney]).expensePlanned).toBe(32);
    expect(linePathName(netflix, [subscriptions, netflix, disney])).toBe('Subscriptions · Netflix');
  });

  it('applies direct debit amounts once at the start of a due month', () => {
    const netflix = line({
      id: 'n',
      kind: 'expense',
      name: 'Netflix',
      planned: 17,
      spent: 0,
      autoApply: true,
    });
    const insurance = line({
      id: 'i',
      kind: 'expense',
      name: 'Insurance',
      planned: 800,
      spent: 0,
      cadence: 'yearly',
      anchorMonth: 3,
      autoApply: true,
    });
    const parent = line({ id: 's', kind: 'expense', name: 'Subscriptions', planned: 50, spent: 0, autoApply: true });
    const child = line({ id: 'c', kind: 'expense', name: 'Netflix', planned: 17, spent: 0, parentId: 's', autoApply: true });
    expect(missingAutoApplyTxns([netflix], [], '2026-09-01', new Date(2026, 8, 21))).toEqual([
      { lineId: 'n', amount: 17, date: '2026-09-01', description: 'Direct debit', merchantKey: 'DIRECT-DEBIT' },
    ]);
    expect(missingAutoApplyTxns([netflix], [], '2026-10-01', new Date(2026, 8, 21))).toEqual([]);
    expect(missingAutoApplyTxns([{ ...netflix, autoAppliedMonth: '2026-09-01' }], [], '2026-09-01', new Date(2026, 8, 21))).toEqual([]);
    expect(missingAutoApplyTxns([insurance], [], '2026-09-01', new Date(2026, 8, 21))).toEqual([]);
    expect(missingAutoApplyTxns([insurance], [], '2026-03-01', new Date(2026, 2, 4))[0]?.amount).toBe(800);
    expect(missingAutoApplyTxns([parent, child], [], '2026-09-01', new Date(2026, 8, 21)).map((item) => item.lineId)).toEqual(['c']);
  });

  it('moves categories among siblings and skips hidden ones', () => {
    const housing = line({ id: 'h', kind: 'expense', name: 'Housing', planned: 2000, spent: 0, position: 0 });
    const insurance = line({ id: 'i', kind: 'expense', name: 'Insurance', planned: 800, spent: 0, position: 1 });
    const groceries = line({ id: 'g', kind: 'expense', name: 'Groceries', planned: 200, spent: 0, position: 2 });
    const salary = line({ id: 's', kind: 'income', name: 'Salary', planned: 8000, spent: 0, position: 0 });
    expect(movedBudgetLinePositions([housing, insurance, groceries, salary], 'g', -1).map((item) => `${item.id}:${item.position}`)).toEqual([
      'g:1',
      'i:2',
    ]);
    expect(movedBudgetLinePositions([housing, insurance, groceries], 'h', -1)).toEqual([]);
    expect(
      movedBudgetLinePositions([housing, insurance, groceries], 'g', -1, ['h', 'g']).map((item) => `${item.id}:${item.position}`),
    ).toEqual(['g:0', 'h:2']);
    const netflix = line({ id: 'n', kind: 'expense', name: 'Netflix', planned: 17, spent: 0, parentId: 'sub', position: 0 });
    const disney = line({ id: 'd', kind: 'expense', name: 'Disney+', planned: 15, spent: 0, parentId: 'sub', position: 1 });
    expect(movedBudgetLinePositions([housing, netflix, disney], 'd', -1).map((item) => `${item.id}:${item.position}`)).toEqual([
      'd:0',
      'n:1',
    ]);
  });

  it('dues every second month and can spread periodical bills into monthly amounts', () => {
    const water = line({
      id: 'w',
      kind: 'expense',
      name: 'Water',
      planned: 200,
      spent: 0,
      cadence: 'bimonthly',
      anchorMonth: 1,
    });
    const insurance = line({
      id: 'i',
      kind: 'expense',
      name: 'Car insurance',
      planned: 800,
      spent: 0,
      cadence: 'yearly',
      anchorMonth: 3,
    });
    const groceries = line({ id: 'g', kind: 'expense', name: 'Groceries', planned: 200, spent: 0 });
    const spread = { spreadPeriodical: true };
    expect(cadenceLabel('bimonthly')).toBe('Every 2 months');
    expect(cadenceDueMonths('bimonthly', 1)).toEqual([1, 3, 5, 7, 9, 11]);
    expect(plannedForMonth(water, '2026-01-01')).toBe(200);
    expect(plannedForMonth(water, '2026-02-01')).toBe(0);
    expect(plannedForMonth(water, '2026-03-01')).toBe(200);
    expect(monthlyEquivalent(200, 'bimonthly')).toBe(100);
    expect(plannedForMonth(water, '2026-02-01', spread)).toBe(100);
    expect(plannedForMonth(insurance, '2026-04-01', spread)).toBe(66.67);
    const april = linesForMonth([water, insurance, groceries], [], '2026-04-01', spread);
    expect(visibleLinesForMonth(april, '2026-04-01', spread).map((item) => item.id)).toEqual(['w', 'i', 'g']);
    expect(deferredPeriodicalLines([water, insurance, groceries], april, '2026-04-01', spread)).toEqual([]);
    expect(budgetTotals(april)).toMatchObject({ expensePlanned: 366.67, leftoverPlanned: -366.67 });
    expect(missingAutoApplyTxns([{ ...water, autoApply: true }], [], '2026-02-01', new Date(2026, 1, 4))).toEqual([]);
    expect(missingAutoApplyTxns([{ ...water, autoApply: true }], [], '2026-01-01', new Date(2026, 0, 4))[0]?.amount).toBe(200);
  });

  it('allocates leftover after actual spending into savings and investments', () => {
    const salary = line({ id: 's', kind: 'income', name: 'Salary', planned: 8000, spent: 0 });
    const groceries = line({ id: 'g', kind: 'expense', name: 'Groceries', planned: 200, spent: 0 });
    const savings = line({
      id: 'save',
      kind: 'expense',
      name: 'Savings & Investments',
      planned: 500,
      spent: 0,
      captureSurplus: true,
    });
    const txns = [
      {
        id: 'pay',
        householdId: 'h1',
        budgetId: 'b1',
        lineId: 's',
        date: '2026-09-15',
        description: 'Pay',
        merchantKey: 'PAY',
        amount: 8000,
        ignored: false,
      },
      {
        id: 'food',
        householdId: 'h1',
        budgetId: 'b1',
        lineId: 'g',
        date: '2026-09-04',
        description: 'Woolworths',
        merchantKey: 'WOOLWORTHS',
        amount: -150,
        ignored: false,
      },
    ];
    const monthLines = linesForMonth([salary, groceries, savings], txns, '2026-09-01');
    expect(budgetTotals(monthLines)).toMatchObject({
      incomePlanned: 8000,
      expensePlanned: 200,
      leftoverPlanned: 7800,
      leftoverActual: 7850,
    });
    expect(surplusToAllocate(monthLines, txns, 'save')).toBe(7850);
    expect(surplusAllocateActions([salary, groceries, savings], txns, new Date(2026, 8, 21))).toEqual([
      { lineId: 'save', monthStart: '2026-09-01', amount: 7850, action: 'insert' },
    ]);
    expect(
      surplusAllocateActions(
        [salary, groceries, savings],
        [
          ...txns,
          {
            id: 't1',
            householdId: 'h1',
            budgetId: 'b1',
            lineId: 'save',
            date: '2026-09-01',
            description: 'Surplus allocated',
            merchantKey: 'SURPLUS-ALLOCATION',
            amount: -7850,
            ignored: false,
            source: 'auto',
          },
        ],
        new Date(2026, 8, 21),
      ),
    ).toEqual([]);
    expect(
      surplusToAllocate(monthLines, [
        ...txns,
        {
          id: 'm1',
          householdId: 'h1',
          budgetId: 'b1',
          lineId: 'save',
          date: '2026-09-04',
          description: 'Emergency fund',
          merchantKey: 'EMERGENCY FUND',
          amount: -200,
          ignored: false,
        },
      ], 'save'),
    ).toBe(7650);
  });
});
