import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canViewInvestmentItem,
  canViewTradeEntry,
  tradeJournalSummary,
  type FinanceInvestmentAlert,
  type FinanceInvestmentItem,
  type FinanceTradeJournalEntry,
  type HouseholdRole,
} from '@kinexus/domain';

import {
  asHouseholdRole,
  assertCanViewFinances,
  resolveCallerHousehold,
} from './shared.js';

export const INVESTMENT_NOT_FOUND = 'Investment idea not found';
export const TRADE_NOT_FOUND = 'Trade journal entry not found';

function asNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapInvestmentItem(row: Record<string, unknown>): FinanceInvestmentItem {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    createdBy: String(row.created_by),
    visibility: row.visibility === 'private' ? 'private' : 'household',
    symbol: typeof row.symbol === 'string' ? row.symbol : null,
    title: String(row.title ?? ''),
    thesis: String(row.thesis ?? ''),
    notes: String(row.notes ?? ''),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    status:
      row.status === 'idea' || row.status === 'holding' || row.status === 'closed'
        ? row.status
        : 'watching',
    targetPrice: asNum(row.target_price),
    stopPrice: asNum(row.stop_price),
    alertAbove: asNum(row.alert_above),
    alertBelow: asNum(row.alert_below),
    alertPctMove: asNum(row.alert_pct_move),
    lastPrice: asNum(row.last_price),
    lastPriceAt: typeof row.last_price_at === 'string' ? row.last_price_at : null,
    currency: typeof row.currency === 'string' ? row.currency : 'AUD',
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapTrade(row: Record<string, unknown>): FinanceTradeJournalEntry {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    createdBy: String(row.created_by),
    visibility: row.visibility === 'private' ? 'private' : 'household',
    itemId: typeof row.item_id === 'string' ? row.item_id : null,
    symbol: typeof row.symbol === 'string' ? row.symbol : null,
    side: row.side === 'sell' ? 'sell' : 'buy',
    qty: asNum(row.qty) ?? 0,
    price: asNum(row.price) ?? 0,
    fees: asNum(row.fees) ?? 0,
    tradedOn: String(row.traded_on ?? '').slice(0, 10),
    thesis: String(row.thesis ?? ''),
    emotions: String(row.emotions ?? ''),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapAlert(row: Record<string, unknown>): FinanceInvestmentAlert {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    itemId: String(row.item_id),
    kind: row.kind === 'below' || row.kind === 'pct_move' ? row.kind : 'above',
    threshold: asNum(row.threshold) ?? 0,
    active: Boolean(row.active),
    lastTriggeredAt: typeof row.last_triggered_at === 'string' ? row.last_triggered_at : null,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function accessOpts(role: string, userId: string): { role: HouseholdRole | null; userId: string } {
  return { role: asHouseholdRole(role), userId };
}

export async function listInvestmentWatchlist(
  client: SupabaseClient,
  userId: string,
  opts: { status?: string } = {},
): Promise<{ householdId: string; items: FinanceInvestmentItem[] }> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  assertCanViewFinances(role);
  const { data, error } = await client
    .from('finance_investment_items')
    .select('*')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  const optsAccess = accessOpts(role, userId);
  let items = (data ?? [])
    .map((row) => mapInvestmentItem(row as Record<string, unknown>))
    .filter((item) => canViewInvestmentItem(item, optsAccess));
  if (opts.status) items = items.filter((item) => item.status === opts.status);
  return { householdId, items };
}

export async function getInvestmentItem(
  client: SupabaseClient,
  userId: string,
  itemId: string,
): Promise<{ householdId: string; item: FinanceInvestmentItem }> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  assertCanViewFinances(role);
  const { data, error } = await client
    .from('finance_investment_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(INVESTMENT_NOT_FOUND);
  const item = mapInvestmentItem(data as Record<string, unknown>);
  if (item.householdId !== householdId) throw new Error(INVESTMENT_NOT_FOUND);
  if (!canViewInvestmentItem(item, accessOpts(role, userId))) throw new Error(INVESTMENT_NOT_FOUND);
  return { householdId, item };
}

export async function listTradeJournal(
  client: SupabaseClient,
  userId: string,
  opts: { symbol?: string; itemId?: string; limit?: number } = {},
): Promise<{
  householdId: string;
  entries: FinanceTradeJournalEntry[];
  summary: { buys: number; sells: number; fees: number; realizedPnl: number | null };
}> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  assertCanViewFinances(role);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let builder = client
    .from('finance_trade_journal')
    .select('*')
    .eq('household_id', householdId)
    .order('traded_on', { ascending: false })
    .limit(limit);
  if (opts.symbol) builder = builder.eq('symbol', opts.symbol.trim().toUpperCase());
  if (opts.itemId) builder = builder.eq('item_id', opts.itemId);
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  const optsAccess = accessOpts(role, userId);
  const entries = (data ?? [])
    .map((row) => mapTrade(row as Record<string, unknown>))
    .filter((entry) => canViewTradeEntry(entry, optsAccess));
  return { householdId, entries, summary: tradeJournalSummary(entries) };
}

export async function listInvestmentAlerts(
  client: SupabaseClient,
  userId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<{ householdId: string; alerts: FinanceInvestmentAlert[] }> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  assertCanViewFinances(role);
  let builder = client
    .from('finance_investment_alerts')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  if (opts.activeOnly !== false) builder = builder.eq('active', true);
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return {
    householdId,
    alerts: (data ?? []).map((row) => mapAlert(row as Record<string, unknown>)),
  };
}
