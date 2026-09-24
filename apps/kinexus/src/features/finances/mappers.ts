import type { Database } from '@kinexus/db';
import {
  formatHolderId,
  holderIdKind,
  isCollectibleCondition,
  isCollectibleKind,
  isCollectibleSource,
  isFinanceAccountKind,
  normalizeAnchorMonth,
  normalizeBudgetCadence,
  normalizeAsxSymbol,
  normalizeCryptoSymbol,
  type FinanceAccount,
  type FinanceBudget,
  type FinanceBudgetLine,
  type FinanceBudgetTxn,
  type FinanceCollectible,
  type FinanceCryptoHolding,
  type FinanceShareHolding,
  type FinanceSharePortfolio,
} from '@kinexus/domain';

type AccountRow = Database['public']['Tables']['finance_accounts']['Row'];
type BudgetRow = Database['public']['Tables']['finance_budgets']['Row'];
type LineRow = Database['public']['Tables']['finance_budget_lines']['Row'];
type TxnRow = Database['public']['Tables']['finance_budget_txns']['Row'];
type PortfolioRow = Database['public']['Tables']['finance_share_portfolios']['Row'];
type HoldingRow = Database['public']['Tables']['finance_share_holdings']['Row'];
type CryptoHoldingRow = Database['public']['Tables']['finance_crypto_holdings']['Row'];
type CollectibleRow = Database['public']['Tables']['finance_collectibles']['Row'];

function asNum(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function accountFromRow(row: AccountRow): FinanceAccount {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    name: row.name,
    kind: isFinanceAccountKind(row.kind) ? row.kind : 'other_asset',
    institution: row.institution,
    value: Math.max(0, asNum(row.value)),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function budgetFromRow(row: BudgetRow): FinanceBudget {
  return {
    id: row.id,
    householdId: row.household_id,
    notes: row.notes,
    setupCompletedAt: row.setup_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function lineFromRow(row: LineRow): FinanceBudgetLine {
  return {
    id: row.id,
    householdId: row.household_id,
    budgetId: row.budget_id,
    kind: row.kind === 'income' ? 'income' : 'expense',
    name: row.name,
    planned: Math.max(0, asNum(row.planned)),
    spent: Math.max(0, asNum(row.spent)),
    position: row.position,
    cadence: normalizeBudgetCadence(row.cadence),
    anchorMonth: normalizeAnchorMonth(row.anchor_month),
    parentId: row.parent_id,
    autoApply: Boolean(row.auto_apply),
    autoAppliedMonth: row.auto_applied_month,
    captureSurplus: Boolean(row.capture_surplus),
  };
}

export function txnFromRow(row: TxnRow): FinanceBudgetTxn {
  return {
    id: row.id,
    householdId: row.household_id,
    budgetId: row.budget_id,
    lineId: row.line_id,
    date: row.txn_date.slice(0, 10),
    description: row.description,
    merchantKey: row.merchant_key,
    amount: asNum(row.amount),
    ignored: row.ignored,
    source: row.source === 'import' || row.source === 'auto' ? row.source : 'manual',
  };
}

function asNullableNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function portfolioFromRow(row: PortfolioRow): FinanceSharePortfolio {
  const holderId = formatHolderId(row.holder_id);
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    name: row.name,
    broker: row.broker,
    holderKind: row.holder_kind ?? holderIdKind(holderId),
    holderId,
    postcode: row.postcode,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function holdingFromRow(row: HoldingRow): FinanceShareHolding {
  return {
    id: row.id,
    householdId: row.household_id,
    portfolioId: row.portfolio_id,
    symbol: normalizeAsxSymbol(row.symbol),
    name: row.name,
    units: Math.max(0, asNum(row.units)),
    costPerUnit: asNullableNum(row.cost_per_unit),
    lastPrice: asNullableNum(row.last_price),
    pricedAt: row.priced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function cryptoHoldingFromRow(row: CryptoHoldingRow): FinanceCryptoHolding {
  return {
    id: row.id,
    householdId: row.household_id,
    symbol: normalizeCryptoSymbol(row.symbol),
    name: row.name,
    units: Math.max(0, asNum(row.units)),
    costPerUnit: asNullableNum(row.cost_per_unit),
    lastPrice: asNullableNum(row.last_price),
    pricedAt: row.priced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function collectibleFromRow(row: CollectibleRow): FinanceCollectible {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    name: row.name,
    kind: isCollectibleKind(row.kind) ? row.kind : 'other',
    condition: isCollectibleCondition(row.condition) ? row.condition : 'new',
    quantity: Math.max(1, Math.floor(asNum(row.quantity) || 1)),
    catalogId: row.catalog_id,
    source: isCollectibleSource(row.source) ? row.source : 'manual',
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
    purchasedValue: asNullableNum(row.purchased_value),
    marketValue: Math.max(0, asNum(row.market_value)),
    notes: row.notes,
    valuedAt: row.valued_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
