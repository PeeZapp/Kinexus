import { investmentAlertTriggered, normalizeAsxSymbol, yahooAsxSymbol } from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { cronAuthorized } from '../prices.js';
import { parseYahooChart } from '../quotes.js';
import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';

const MAX_ALERTS = 200;

type AlertRow = {
  id: string;
  household_id: string;
  item_id: string;
  kind: 'above' | 'below' | 'pct_move';
  threshold: number;
  last_triggered_at: string | null;
};

type ItemRow = {
  id: string;
  symbol: string | null;
  title: string;
  last_price: number | null;
  created_by: string;
};

async function fetchPrice(symbol: string): Promise<number | null> {
  const ticker = yahooAsxSymbol(normalizeAsxSymbol(symbol));
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Kinexus/1.0 (investment alerts)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const raw = await res.json().catch(() => null);
  const quote = parseYahooChart(symbol, raw);
  return quote?.price ?? null;
}

async function notifyUser(
  client: SupabaseClient,
  opts: { userId: string; householdId: string; title: string; body: string; itemId: string },
): Promise<void> {
  await client.from('user_alerts').insert({
    user_id: opts.userId,
    household_id: opts.householdId,
    actor_user_id: null,
    segment: 'investment_alert',
    title: opts.title.slice(0, 160),
    body: opts.body.slice(0, 400),
    href: `/finances/invest/${opts.itemId}`,
    payload: { itemId: opts.itemId },
  });
}

export async function handleInvestmentAlertsCheck(
  request: Request,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!cronAuthorized(request)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }
  if (!isServiceRoleConfigured()) {
    return { status: 200, body: { ok: true, skipped: 'service_role_missing' } };
  }

  const client = createServiceClient();
  const { data: alerts, error } = await client
    .from('finance_investment_alerts')
    .select('id, household_id, item_id, kind, threshold, last_triggered_at')
    .eq('active', true)
    .limit(MAX_ALERTS);
  if (error) return { status: 500, body: { error: error.message } };

  const itemIds = [...new Set((alerts ?? []).map((row) => String((row as AlertRow).item_id)))];
  const { data: items } = itemIds.length
    ? await client.from('finance_investment_items').select('id, symbol, title, last_price, created_by').in('id', itemIds)
    : { data: [] as ItemRow[] };
  const itemById = new Map((items ?? []).map((row) => [String((row as ItemRow).id), row as ItemRow]));

  let triggered = 0;
  let priced = 0;
  const now = new Date().toISOString();

  for (const raw of alerts ?? []) {
    const alert = raw as AlertRow;
    const item = itemById.get(alert.item_id);
    if (!item?.symbol) continue;
    const previous = typeof item.last_price === 'number' ? item.last_price : null;
    const price = await fetchPrice(item.symbol);
    if (price == null) continue;
    priced += 1;
    await client
      .from('finance_investment_items')
      .update({ last_price: price, last_price_at: now })
      .eq('id', item.id);

    if (!investmentAlertTriggered(alert.kind, Number(alert.threshold), price, previous)) continue;
    // Cool-down: skip if triggered in last 12h
    if (alert.last_triggered_at) {
      const last = Date.parse(alert.last_triggered_at);
      if (Number.isFinite(last) && Date.now() - last < 12 * 60 * 60 * 1000) continue;
    }

    await notifyUser(client, {
      userId: item.created_by,
      householdId: alert.household_id,
      title: `${item.symbol ?? item.title} alert`,
      body: `${item.title}: ${price} (${alert.kind} ${alert.threshold})`,
      itemId: item.id,
    });
    await client
      .from('finance_investment_alerts')
      .update({ last_triggered_at: now })
      .eq('id', alert.id);
    triggered += 1;
  }

  return {
    status: 200,
    body: { ok: true, checked: (alerts ?? []).length, priced, triggered },
  };
}
