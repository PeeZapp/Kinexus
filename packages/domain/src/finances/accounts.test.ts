import { describe, expect, it } from 'vitest';

import {
  accountClass,
  accountKindLabel,
  accountsOfClass,
  canManageFinances,
  isAssetKind,
  netWorth,
  signedAccountValue,
  withCollectibles,
  withListedShares,
} from './accounts';
import type { FinanceAccount } from './types';

function account(partial: Partial<FinanceAccount> & Pick<FinanceAccount, 'id' | 'name' | 'kind' | 'value'>): FinanceAccount {
  return {
    householdId: 'h1',
    createdBy: 'u1',
    institution: null,
    notes: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    ...partial,
  };
}

describe('finance accounts', () => {
  it('classifies kinds and signed values', () => {
    expect(isAssetKind('property')).toBe(true);
    expect(accountClass('mortgage')).toBe('liability');
    expect(accountKindLabel('super')).toBe('Super');
    expect(signedAccountValue({ kind: 'bank', value: 1200 })).toBe(1200);
    expect(signedAccountValue({ kind: 'loan', value: 400 })).toBe(-400);
  });

  it('only owners and admins can manage finances', () => {
    expect(canManageFinances('owner')).toBe(true);
    expect(canManageFinances('admin')).toBe(true);
    expect(canManageFinances('member')).toBe(false);
    expect(canManageFinances(null)).toBe(false);
  });

  it('sums household net worth by class', () => {
    const accounts = [
      account({ id: 'a', name: 'Offset', kind: 'bank', value: 20_000 }),
      account({ id: 'b', name: 'House', kind: 'property', value: 800_000 }),
      account({ id: 'c', name: 'Home loan', kind: 'mortgage', value: 420_000 }),
      account({ id: 'd', name: 'Visa', kind: 'credit', value: 1_200 }),
    ];
    const summary = netWorth(accounts);
    expect(summary.assets).toBe(820_000);
    expect(summary.liabilities).toBe(421_200);
    expect(summary.netWorth).toBe(398_800);
    expect(accountsOfClass(accounts, 'liability').map((item) => item.name)).toEqual(['Home loan', 'Visa']);
    const withShares = withListedShares(summary, 12_000);
    expect(withShares.assets).toBe(832_000);
    expect(withShares.netWorth).toBe(410_800);
    expect(withShares.groups.some((group) => group.kind === 'shares')).toBe(true);
    const withToys = withCollectibles(withShares, 1_790.4);
    expect(withToys.assets).toBe(833_790.4);
    expect(withToys.groups.some((group) => group.kind === 'collectibles')).toBe(true);
  });
});
