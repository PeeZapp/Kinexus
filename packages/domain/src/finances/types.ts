export type FinanceAccountClass = 'asset' | 'liability';

export const ASSET_KINDS = [
  'cash',
  'bank',
  'investment',
  'super',
  'property',
  'vehicle',
  'other_asset',
] as const;

export const LIABILITY_KINDS = ['credit', 'loan', 'mortgage', 'other_liability'] as const;

export type FinanceAssetKind = (typeof ASSET_KINDS)[number];
export type FinanceLiabilityKind = (typeof LIABILITY_KINDS)[number];
export type FinanceAccountKind = FinanceAssetKind | FinanceLiabilityKind;

export type FinanceAccount = {
  id: string;
  householdId: string;
  createdBy: string | null;
  name: string;
  kind: FinanceAccountKind;
  institution: string | null;
  value: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceBudgetLineKind = 'income' | 'expense';

export type FinanceBudget = {
  id: string;
  householdId: string;
  notes: string | null;
  setupCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceBudgetLine = {
  id: string;
  householdId: string;
  budgetId: string;
  kind: FinanceBudgetLineKind;
  name: string;
  planned: number;
  spent: number;
  position: number;
};

export type FinanceBudgetTxn = {
  id: string;
  householdId: string;
  budgetId: string;
  lineId: string | null;
  date: string;
  description: string;
  merchantKey: string;
  amount: number;
  ignored: boolean;
};

export type FinanceGroupKind = FinanceAccountKind | 'shares' | 'collectibles';

export type FinanceKindGroup = {
  kind: FinanceGroupKind;
  class: FinanceAccountClass;
  label: string;
  total: number;
  accounts: FinanceAccount[];
};

export type FinanceHolderKind = 'hin' | 'srn';

export type FinanceSharePortfolio = {
  id: string;
  householdId: string;
  createdBy: string | null;
  name: string;
  broker: string | null;
  holderKind: FinanceHolderKind | null;
  holderId: string | null;
  postcode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceShareHolding = {
  id: string;
  householdId: string;
  portfolioId: string;
  symbol: string;
  name: string | null;
  units: number;
  costPerUnit: number | null;
  lastPrice: number | null;
  pricedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceShareQuote = {
  symbol: string;
  price: number;
  currency: string;
  name: string | null;
};

export type FinancePortfolioTotals = {
  marketValue: number;
  cost: number;
  gain: number;
  pricedCount: number;
  unpricedCount: number;
};

export type FinanceNetWorth = {
  assets: number;
  liabilities: number;
  netWorth: number;
  groups: FinanceKindGroup[];
};

export type FinanceBudgetTotals = {
  incomePlanned: number;
  incomeSpent: number;
  expensePlanned: number;
  expenseSpent: number;
  leftoverPlanned: number;
  leftoverActual: number;
  expenseProgress: number;
};

export const COLLECTIBLE_KINDS = [
  'lego',
  'minifig',
  'trading_card',
  'video_game',
  'comic',
  'funko',
  'coin',
  'vinyl',
  'sneaker',
  'watch',
  'other',
] as const;
export const COLLECTIBLE_CONDITIONS = ['new', 'used'] as const;
export const COLLECTIBLE_SOURCES = ['brickeconomy', 'brickset', 'pricecharting', 'discogs', 'stockx', 'chrono24', 'manual'] as const;

export type CollectibleKind = (typeof COLLECTIBLE_KINDS)[number];
export type CollectibleCondition = (typeof COLLECTIBLE_CONDITIONS)[number];
export type CollectibleSource = (typeof COLLECTIBLE_SOURCES)[number];

export type FinanceCollectible = {
  id: string;
  householdId: string;
  createdBy: string | null;
  name: string;
  kind: CollectibleKind;
  condition: CollectibleCondition;
  quantity: number;
  catalogId: string | null;
  source: CollectibleSource;
  sourceUrl: string | null;
  imageUrl: string | null;
  purchasedValue: number | null;
  marketValue: number;
  notes: string | null;
  valuedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CollectibleSearchHit = {
  kind: CollectibleKind;
  source: CollectibleSource;
  catalogId: string;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  currency: string;
  valueNew: number | null;
  valueUsed: number | null;
  retailValue: number | null;
};

export type CollectibleKindGroup = {
  kind: CollectibleKind;
  label: string;
  total: number;
  items: FinanceCollectible[];
};
