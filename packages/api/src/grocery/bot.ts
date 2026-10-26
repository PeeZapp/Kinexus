import { createHash, randomBytes } from 'node:crypto';

import { mondayWeekStart, trolleyOrder, trolleyShopUrl, type StoredGroceryQuote, type TrolleyOrder } from '@kinexus/domain';

import { createServiceClient } from '../supabase-admin.js';
import { isPublicHttps } from './public-origin.js';

const HANDOFF_MS = 30 * 60 * 1000;

export type GroceryConnectorRow = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function newGroceryToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashGroceryToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function shopPageUrl(chainId: string, token: string, apiOrigin: string): string {
  return trolleyShopUrl(chainId, token, apiOrigin);
}

export function reviewPageUrl(token: string, siteOrigin?: string): string {
  const site = siteOrigin?.replace(/\/$/, '') ?? '';
  const web = (site && isPublicHttps(site) ? site : process.env.EXPO_PUBLIC_WEB_URL || process.env.WEB_URL || 'http://localhost:5300').replace(
    /\/$/,
    '',
  );
  return `${web}/share/trolley?token=${encodeURIComponent(token)}`;
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function asWeekStart(value: unknown): string {
  const text = asText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : mondayWeekStart();
}

function asHouseholdId(value: unknown): string {
  const text = asText(value, 40);
  return /^[0-9a-f-]{36}$/i.test(text) ? text : '';
}

function quoteFromJson(value: unknown): StoredGroceryQuote | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.name !== 'string' || !Array.isArray(rec.quotes)) return null;
  const quotes: StoredGroceryQuote['quotes'] = [];
  for (const row of rec.quotes) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const quote = row as Record<string, unknown>;
    if (typeof quote.chainId !== 'string' || typeof quote.productName !== 'string') return null;
    if (typeof quote.price !== 'number' || typeof quote.packs !== 'number') return null;
    quotes.push({
      chainId: quote.chainId,
      chainName: typeof quote.chainName === 'string' ? quote.chainName : quote.chainId,
      storeId: typeof quote.storeId === 'string' ? quote.storeId : quote.chainId,
      storeName: typeof quote.storeName === 'string' ? quote.storeName : quote.chainId,
      productId: typeof quote.productId === 'string' ? quote.productId : String(quote.productName),
      productName: quote.productName,
      price: quote.price,
      packs: quote.packs,
    });
  }
  return { name: rec.name, amount: typeof rec.amount === 'string' ? rec.amount : null, quotes };
}

async function memberOf(userId: string, householdId: string): Promise<boolean> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function preferredChain(householdId: string): Promise<string | null> {
  const admin = createServiceClient();
  const { data, error } = await admin.from('households').select('preferred_grocery_chain').eq('id', householdId).maybeSingle();
  if (error) throw new Error(error.message);
  const chain = data?.preferred_grocery_chain;
  return typeof chain === 'string' && chain ? chain : null;
}

export async function loadTrolleyOrder(householdId: string, weekStart: string): Promise<TrolleyOrder | { error: string }> {
  const chainId = await preferredChain(householdId);
  if (!chainId) return { error: 'Choose a preferred shop in Kinexus first.' };
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('shopping_items')
    .select('id, name, amount, checked, grocery_quote')
    .eq('household_id', householdId)
    .eq('week_start', weekStart);
  if (error) throw new Error(error.message);
  const order = trolleyOrder(
    (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      amount: typeof row.amount === 'string' ? row.amount : null,
      checked: row.checked === true,
      quote: quoteFromJson(row.grocery_quote),
    })),
    chainId,
  );
  if (!order) return { error: 'That shop cannot take a trolley yet.' };
  return order;
}

export async function createGroceryConnector(userId: string, body: { householdId?: unknown; label?: unknown }): Promise<
  { ok: true; connector: GroceryConnectorRow; token: string } | { ok: false; error: string; status: number }
> {
  const householdId = asHouseholdId(body.householdId);
  if (!householdId) return { ok: false, error: 'Choose a household.', status: 400 };
  if (!(await memberOf(userId, householdId))) return { ok: false, error: 'You are not in that household.', status: 403 };
  const token = newGroceryToken();
  const label = asText(body.label, 40) || 'Grok';
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('grocery_connectors')
    .insert({ household_id: householdId, user_id: userId, token_hash: hashGroceryToken(token), label })
    .select('id, label, created_at')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not create a connector.', status: 400 };
  return {
    ok: true,
    token,
    connector: { id: data.id, label: data.label, createdAt: data.created_at, lastUsedAt: null, revokedAt: null },
  };
}

export async function listGroceryConnectors(userId: string, householdId: string): Promise<GroceryConnectorRow[]> {
  if (!asHouseholdId(householdId) || !(await memberOf(userId, householdId))) return [];
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('grocery_connectors')
    .select('id, label, created_at, last_used_at, revoked_at')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }));
}

export async function revokeGroceryConnector(userId: string, connectorId: string): Promise<boolean> {
  if (!asHouseholdId(connectorId)) return false;
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('grocery_connectors')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', connectorId)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

type ConnectorHit = { householdId: string; connectorId: string };

export async function connectorFromToken(token: string): Promise<ConnectorHit | null> {
  const hashed = hashGroceryToken(token);
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('grocery_connectors')
    .select('id, household_id, user_id')
    .eq('token_hash', hashed)
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !data) return null;
  if (!(await memberOf(data.user_id, data.household_id))) return null;
  await admin.from('grocery_connectors').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return { householdId: data.household_id, connectorId: data.id };
}

async function insertHandoff(
  householdId: string,
  weekStart: string,
  apiOrigin: string,
): Promise<{ ok: true; reviewUrl: string; shopUrl: string; order: TrolleyOrder } | { ok: false; error: string; status: number }> {
  const order = await loadTrolleyOrder(householdId, weekStart);
  if ('error' in order) return { ok: false, error: order.error, status: 400 };
  if (order.lines.length === 0) return { ok: false, error: 'No matched products to add for that shop.', status: 400 };
  const token = newGroceryToken();
  const admin = createServiceClient();
  const { error } = await admin.from('grocery_handoffs').insert({
    household_id: householdId,
    token_hash: hashGroceryToken(token),
    chain_id: order.chainId,
    lines: order.lines,
    skipped: order.skipped,
    expires_at: new Date(Date.now() + HANDOFF_MS).toISOString(),
  });
  if (error) return { ok: false, error: error.message, status: 400 };
  return { ok: true, reviewUrl: reviewPageUrl(token, apiOrigin), shopUrl: shopPageUrl(order.chainId, token, apiOrigin), order };
}

export async function createGroceryHandoff(
  userId: string,
  householdId: string,
  weekStart: string,
  apiOrigin: string,
): Promise<{ ok: true; reviewUrl: string; shopUrl: string; order: TrolleyOrder } | { ok: false; error: string; status: number }> {
  if (!asHouseholdId(householdId)) return { ok: false, error: 'Choose a household.', status: 400 };
  if (!(await memberOf(userId, householdId))) return { ok: false, error: 'You are not in that household.', status: 403 };
  return insertHandoff(householdId, weekStart, apiOrigin);
}

export async function createConnectorHandoff(householdId: string, weekStart: string, apiOrigin: string) {
  return insertHandoff(householdId, weekStart, apiOrigin);
}

export async function readGroceryHandoff(token: string): Promise<
  | { ok: true; chainId: string; lines: unknown; skipped: unknown }
  | { ok: false; error: string; status: number }
> {
  if (!token || token.length > 200) return { ok: false, error: 'That trolley link is not valid.', status: 404 };
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('grocery_handoffs')
    .select('id, chain_id, lines, skipped, expires_at')
    .eq('token_hash', hashGroceryToken(token))
    .maybeSingle();
  if (error || !data) return { ok: false, error: 'That trolley link is not valid.', status: 404 };
  if (new Date(data.expires_at).getTime() < Date.now()) return { ok: false, error: 'That trolley link has expired.', status: 410 };
  await admin.from('grocery_handoffs').update({ opened_at: new Date().toISOString() }).eq('id', data.id);
  return { ok: true, chainId: data.chain_id, lines: data.lines, skipped: data.skipped };
}

export function bearerToken(header: string | null): string {
  return asText(header?.replace(/^Bearer\s+/i, '') ?? '', 200);
}
