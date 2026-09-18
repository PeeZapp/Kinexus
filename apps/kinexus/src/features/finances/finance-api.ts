import { Platform } from 'react-native';

import type { AiMerchantGuess, CollectibleKind, CollectibleSearchHit, FinanceShareQuote } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export function isQuotesApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!isQuotesApiConfigured()) {
    throw new Error('Quotes API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  let res: Response;
  try {
    res = await fetch(`${configuredUrl()}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && /failed to fetch|networkerror|econnrefused/i.test(err.message))) {
      throw new Error('Could not reach the catalog API. Restart with npm run dev so the API on port 5301 is running.');
    }
    throw err;
  }
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}

export async function fetchShareQuotes(symbols: string[]): Promise<{ quotes: FinanceShareQuote[]; missing: string[] }> {
  return post('/quotes', { symbols });
}

export async function searchCollectibleCatalog(
  kind: CollectibleKind,
  query: string,
  currency: string,
): Promise<CollectibleSearchHit[]> {
  const payload = await post<{ results?: CollectibleSearchHit[] }>('/collectibles/search', { kind, query, currency });
  return payload.results ?? [];
}

export async function lookupCollectibleCatalog(input: {
  kind: CollectibleKind;
  catalogId: string;
  sourceUrl?: string | null;
  currency: string;
}): Promise<CollectibleSearchHit> {
  const payload = await post<{ result?: CollectibleSearchHit }>('/collectibles/lookup', input);
  if (!payload.result) throw new Error('No catalog match for that item');
  return payload.result;
}

export async function classifyBudgetMerchants(input: {
  merchants: Array<{ merchantKey: string; sample: string; count: number; total: number; kind: 'income' | 'expense' }>;
  categories: Array<{ kind: 'income' | 'expense'; name: string }>;
}): Promise<AiMerchantGuess[]> {
  if (input.merchants.length === 0) return [];
  const payload = await post<{ assignments?: AiMerchantGuess[] }>('/budget/classify', input);
  return payload.assignments ?? [];
}
