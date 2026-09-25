import type { HouseholdRole } from '../household/types';
import { roundMoney } from '../stash/money';
import {
  ASSET_KINDS,
  LIABILITY_KINDS,
  type FinanceAccount,
  type FinanceAccountClass,
  type FinanceAccountKind,
  type FinanceAssetKind,
  type FinanceGroupKind,
  type FinanceKindGroup,
  type FinanceLiabilityKind,
  type FinanceNetWorth,
} from './types';

const ASSET_SET = new Set<string>(ASSET_KINDS);
const LIABILITY_SET = new Set<string>(LIABILITY_KINDS);

const KIND_LABELS: Record<FinanceAccountKind, string> = {
  cash: 'Cash',
  bank: 'Bank',
  investment: 'Investments',
  super: 'Super',
  property: 'Property',
  vehicle: 'Vehicles',
  other_asset: 'Other assets',
  credit: 'Credit cards',
  loan: 'Loans',
  mortgage: 'Mortgage',
  other_liability: 'Other debts',
};

export function isFinanceAccountKind(value: string | null | undefined): value is FinanceAccountKind {
  return Boolean(value && (ASSET_SET.has(value) || LIABILITY_SET.has(value)));
}

export function isAssetKind(kind: FinanceAccountKind): kind is FinanceAssetKind {
  return ASSET_SET.has(kind);
}

export function isLiabilityKind(kind: FinanceAccountKind): kind is FinanceLiabilityKind {
  return LIABILITY_SET.has(kind);
}

export function accountClass(kind: FinanceAccountKind): FinanceAccountClass {
  return isAssetKind(kind) ? 'asset' : 'liability';
}

export function accountKindLabel(kind: FinanceAccountKind): string {
  return KIND_LABELS[kind];
}

export function canManageFinances(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function signedAccountValue(account: Pick<FinanceAccount, 'kind' | 'value'>): number {
  const amount = roundMoney(Math.max(0, account.value));
  return isAssetKind(account.kind) ? amount : -amount;
}

export function groupAccounts(accounts: readonly FinanceAccount[]): FinanceKindGroup[] {
  const order: FinanceAccountKind[] = [...ASSET_KINDS, ...LIABILITY_KINDS];
  const byKind = new Map<FinanceAccountKind, FinanceAccount[]>();
  for (const account of accounts) {
    const bucket = byKind.get(account.kind) ?? [];
    bucket.push(account);
    byKind.set(account.kind, bucket);
  }
  return order
    .map((kind) => {
      const items = (byKind.get(kind) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      const total = roundMoney(items.reduce((sum, item) => sum + Math.max(0, item.value), 0));
      return {
        kind,
        class: accountClass(kind),
        label: accountKindLabel(kind),
        total,
        accounts: items,
      };
    })
    .filter((group) => group.accounts.length > 0);
}

export function netWorth(accounts: readonly FinanceAccount[]): FinanceNetWorth {
  const groups = groupAccounts(accounts);
  let assets = 0;
  let liabilities = 0;
  for (const group of groups) {
    if (group.class === 'asset') assets += group.total;
    else liabilities += group.total;
  }
  return {
    assets: roundMoney(assets),
    liabilities: roundMoney(liabilities),
    netWorth: roundMoney(assets - liabilities),
    groups,
  };
}

function assetAnchor(groups: readonly FinanceKindGroup[], kinds: readonly FinanceGroupKind[]): FinanceGroupKind {
  return kinds.find((kind) => groups.some((group) => group.kind === kind)) ?? kinds[kinds.length - 1] ?? 'shares';
}

function insertAssetGroup(groups: FinanceKindGroup[], group: FinanceKindGroup, afterKind: FinanceGroupKind) {
  const existing = groups.findIndex((item) => item.kind === group.kind);
  if (existing >= 0) groups.splice(existing, 1);
  const after = groups.findIndex((item) => item.kind === afterKind);
  const firstLiability = groups.findIndex((item) => item.class === 'liability');
  if (after >= 0) groups.splice(after + 1, 0, group);
  else if (firstLiability >= 0) groups.splice(firstLiability, 0, group);
  else groups.push(group);
}

export function withListedShares(summary: FinanceNetWorth, listedShares: number): FinanceNetWorth {
  const shares = roundMoney(Math.max(0, listedShares));
  const groups = summary.groups.filter((group) => group.kind !== 'shares');
  if (shares > 0) {
    insertAssetGroup(groups, {
      kind: 'shares',
      class: 'asset',
      label: 'Listed shares',
      total: shares,
      accounts: [],
    }, 'investment');
  }
  const assets = roundMoney(summary.assets + shares);
  return {
    assets,
    liabilities: summary.liabilities,
    netWorth: roundMoney(assets - summary.liabilities),
    groups,
  };
}

export function withCrypto(summary: FinanceNetWorth, cryptoValue: number): FinanceNetWorth {
  const extra = roundMoney(Math.max(0, cryptoValue));
  const groups = summary.groups.filter((group) => group.kind !== 'crypto');
  if (extra > 0) {
    insertAssetGroup(groups, {
      kind: 'crypto',
      class: 'asset',
      label: 'Crypto',
      total: extra,
      accounts: [],
    }, 'shares');
  }
  const assets = roundMoney(summary.assets + extra);
  return {
    assets,
    liabilities: summary.liabilities,
    netWorth: roundMoney(assets - summary.liabilities),
    groups,
  };
}

export function withMetals(summary: FinanceNetWorth, metalsValue: number): FinanceNetWorth {
  const extra = roundMoney(Math.max(0, metalsValue));
  const groups = summary.groups.filter((group) => group.kind !== 'metals');
  if (extra > 0) {
    insertAssetGroup(groups, {
      kind: 'metals',
      class: 'asset',
      label: 'Metals',
      total: extra,
      accounts: [],
    }, assetAnchor(groups, ['crypto', 'shares']));
  }
  const assets = roundMoney(summary.assets + extra);
  return {
    assets,
    liabilities: summary.liabilities,
    netWorth: roundMoney(assets - summary.liabilities),
    groups,
  };
}

export function withCollectibles(summary: FinanceNetWorth, collectiblesValue: number): FinanceNetWorth {
  const extra = roundMoney(Math.max(0, collectiblesValue));
  const groups = summary.groups.filter((group) => group.kind !== 'collectibles');
  if (extra > 0) {
    const afterKind = assetAnchor(groups, ['metals', 'crypto', 'shares']);
    insertAssetGroup(groups, {
      kind: 'collectibles',
      class: 'asset',
      label: 'Collectibles',
      total: extra,
      accounts: [],
    }, afterKind);
  }
  const assets = roundMoney(summary.assets + extra);
  return {
    assets,
    liabilities: summary.liabilities,
    netWorth: roundMoney(assets - summary.liabilities),
    groups,
  };
}

export function accountsOfClass(
  accounts: readonly FinanceAccount[],
  klass: FinanceAccountClass,
): FinanceAccount[] {
  return accounts
    .filter((account) => accountClass(account.kind) === klass)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}
