import { describe, expect, it } from 'vitest';

import {
  appliedCarryByLine,
  carryAccrueActions,
  carryDashboardRows,
  clampApplyAmount,
  monthCarryVariance,
} from './budget-carry';
import { linesForMonth, monthLineSpend } from './budget';
import type { FinanceBudgetLine, FinanceBudgetTxn } from './types';

function line(partial: Partial<FinanceBudgetLine> & Pick<FinanceBudgetLine, 'id' | 'kind' | 'name'>): FinanceBudgetLine {
  return {
    householdId: 'h1',
    budgetId: 'b1',
    planned: 0,
    spent: 0,
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

function txn(partial: Partial<FinanceBudgetTxn> & Pick<FinanceBudgetTxn, 'id' | 'lineId' | 'date' | 'amount'>): FinanceBudgetTxn {
  return {
    householdId: 'h1',
    budgetId: 'b1',
    description: 'x',
    merchantKey: 'X',
    ignored: false,
    ...partial,
  };
}

describe('budget carry', () => {
  it('nets refunds against expense spend', () => {
    const groceries = line({ id: 'g', kind: 'expense', name: 'Groceries', planned: 200 });
    const txns = [
      txn({ id: '1', lineId: 'g', date: '2026-01-10', amount: -80 }),
      txn({ id: '2', lineId: 'g', date: '2026-01-12', amount: 20 }),
    ];
    expect(monthLineSpend(txns, '2026-01-01', [groceries]).get('g')).toBe(60);
    expect(linesForMonth([groceries], txns, '2026-01-01')[0]?.spent).toBe(60);
  });

  it('accrues under and over across closed months cumulatively', () => {
    const medical = line({ id: 'm', kind: 'expense', name: 'Medical', planned: 100 });
    const clothing = line({ id: 'c', kind: 'expense', name: 'Clothing', planned: 50 });
    const txns = [
      txn({ id: '1', lineId: 'm', date: '2026-01-05', amount: -40 }),
      txn({ id: '2', lineId: 'm', date: '2026-02-05', amount: -40 }),
      txn({ id: '3', lineId: 'c', date: '2026-01-08', amount: -80 }),
    ];
    const actions = carryAccrueActions({
      lines: [medical, clothing],
      txns,
      carries: [],
      asOfMonth: '2026-03-01',
    });
    const medicalTotal = actions.filter((a) => a.lineId === 'm').reduce((sum, a) => sum + a.amount, 0);
    const clothingTotal = actions.filter((a) => a.lineId === 'c').reduce((sum, a) => sum + a.amount, 0);
    // Medical: Jan +60, Feb +60. Clothing: Jan −30, Feb +50 (no spend).
    expect(medicalTotal).toBe(120);
    expect(clothingTotal).toBe(20);
    expect(monthCarryVariance(100, 40)).toBe(60);
  });

  it('builds dashboard rows and clamps apply amounts', () => {
    const medical = line({ id: 'm', kind: 'expense', name: 'Medical' });
    const rows = carryDashboardRows([medical], [
      {
        id: '1',
        householdId: 'h1',
        budgetId: 'b1',
        lineId: 'm',
        balance: 100,
        lastAccruedMonth: '2026-02-01',
        updatedAt: '2026-03-01',
      },
    ]);
    expect(rows[0]?.under).toBe(true);
    expect(clampApplyAmount(100, 40)).toBe(40);
    expect(clampApplyAmount(-80, 40)).toBe(-40);
    expect(clampApplyAmount(100, 200)).toBe(100);
  });

  it('applies carry adjustments into planned for a month', () => {
    const medical = line({ id: 'm', kind: 'expense', name: 'Medical', planned: 100 });
    const applied = appliedCarryByLine(
      [{ kind: 'apply', targetLineId: 'm', targetMonth: '2026-03-01', amount: 50 }],
      '2026-03-01',
    );
    expect(linesForMonth([medical], [], '2026-03-01', undefined, applied)[0]?.planned).toBe(150);
  });
});
