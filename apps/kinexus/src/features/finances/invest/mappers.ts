import type { Database } from '@kinexus/db';
import {
  isInvestmentStatus,
  isTradeSide,
  INVESTMENT_ALERT_KINDS,
  type FinanceInvestmentAlert,
  type FinanceInvestmentItem,
  type FinanceTradeJournalEntry,
  type InvestmentAlertKind,
} from '@kinexus/domain';

type ItemRow = Database['public']['Tables']['finance_investment_items']['Row'];
type AlertRow = Database['public']['Tables']['finance_investment_alerts']['Row'];
type TradeRow = Database['public']['Tables']['finance_trade_journal']['Row'];

function asNum(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNumOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isAlertKind(value: string): value is InvestmentAlertKind {
  return (INVESTMENT_ALERT_KINDS as readonly string[]).includes(value);
}

export function investItemFromRow(row: ItemRow): FinanceInvestmentItem {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    visibility: row.visibility === 'private' ? 'private' : 'household',
    symbol: row.symbol,
    title: row.title,
    thesis: row.thesis ?? '',
    notes: row.notes ?? '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    status: isInvestmentStatus(row.status) ? row.status : 'watching',
    targetPrice: asNumOrNull(row.target_price),
    stopPrice: asNumOrNull(row.stop_price),
    alertAbove: asNumOrNull(row.alert_above),
    alertBelow: asNumOrNull(row.alert_below),
    alertPctMove: asNumOrNull(row.alert_pct_move),
    lastPrice: asNumOrNull(row.last_price),
    lastPriceAt: row.last_price_at,
    currency: row.currency || 'AUD',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function investAlertFromRow(row: AlertRow): FinanceInvestmentAlert {
  return {
    id: row.id,
    householdId: row.household_id,
    itemId: row.item_id,
    kind: isAlertKind(row.kind) ? row.kind : 'above',
    threshold: asNum(row.threshold),
    active: Boolean(row.active),
    lastTriggeredAt: row.last_triggered_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function tradeFromRow(row: TradeRow): FinanceTradeJournalEntry {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    visibility: row.visibility === 'private' ? 'private' : 'household',
    itemId: row.item_id,
    symbol: row.symbol,
    side: isTradeSide(row.side) ? row.side : 'buy',
    qty: asNum(row.qty),
    price: asNum(row.price),
    fees: asNum(row.fees),
    tradedOn: row.traded_on,
    thesis: row.thesis ?? '',
    emotions: row.emotions ?? '',
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
