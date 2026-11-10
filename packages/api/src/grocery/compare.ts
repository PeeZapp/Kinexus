import {
  catalogueChoices,
  catalogueQuery,
  compareShoppingList,
  lookupChainsForCountry,
  parsePackSize,
  shoppingMergeKey,
  type CatalogueChoice,
  type CatalogueOffer,
  type GroceryComparison,
  type GroceryProductPin,
  type GroceryShopOffers,
} from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { searchColesProducts } from './coles.js';
import { searchWoolworthsProducts } from './woolworths.js';

/** Live-miss only — catalogue hits come from grocery_prices and must not use this cache. */
const LIVE_CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_ITEMS = 40;
const DEFAULT_STATE = 'WA';

type CacheEntry = { at: number; ttl: number; offers: CatalogueOffer[] };

const liveCache = new Map<string, CacheEntry>();
const liveInflight = new Map<string, Promise<CatalogueOffer[]>>();

export type GroceryCompareRequest = {
  country?: unknown;
  state?: unknown;
  householdId?: unknown;
  items?: unknown;
  fresh?: unknown;
};

export type GroceryCatalogRequest = {
  country?: unknown;
  state?: unknown;
  householdId?: unknown;
  name?: unknown;
  amount?: unknown;
  query?: unknown;
};

export type GroceryCatalogChain = {
  chainId: string;
  chainName: string;
  choices: CatalogueChoice[];
  unavailable?: boolean;
};

type PriceRow = {
  ingredient_key: string;
  store: string;
  product_id: string;
  name: string;
  brand: string | null;
  price: number | string;
  pack_size: string | null;
  unit_price: number | string | null;
  by_weight: boolean;
  in_stock: boolean;
  fetched_at: string;
};

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseState(value: unknown): string {
  const state = asText(value, 3).toUpperCase();
  return /^[A-Z]{2,3}$/.test(state) ? state : DEFAULT_STATE;
}

function parsePins(value: unknown): GroceryProductPin[] {
  if (!Array.isArray(value)) return [];
  const pins: GroceryProductPin[] = [];
  for (const row of value.slice(0, 6)) {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const chainId = asText(rec.chainId, 40);
    const productId = asText(rec.productId, 80);
    if (!chainId || !productId) continue;
    pins.push({ chainId, productId });
  }
  return pins;
}

function parseCompareInput(body: GroceryCompareRequest): {
  country: string;
  stateHint: string | null;
  householdId: string | null;
  items: { id: string; name: string; amount: string | null; pins: GroceryProductPin[] }[];
} | null {
  if (!Array.isArray(body.items)) return null;
  const country = asText(body.country, 2).toUpperCase();
  const stateRaw = asText(body.state, 3).toUpperCase();
  const stateHint = /^[A-Z]{2,3}$/.test(stateRaw) ? stateRaw : null;
  const householdId = asText(body.householdId, 40) || null;
  const items: { id: string; name: string; amount: string | null; pins: GroceryProductPin[] }[] = [];
  for (const row of body.items.slice(0, MAX_ITEMS)) {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const id = asText(rec.id, 80);
    const name = asText(rec.name, 80);
    const amount = asText(rec.amount, 40);
    if (!id || !name) continue;
    items.push({ id, name, amount: amount || null, pins: parsePins(rec.pins) });
  }
  if (items.length === 0) return null;
  return { country, stateHint, householdId, items };
}

function adminClient(): SupabaseClient | null {
  if (!isServiceRoleConfigured()) return null;
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

async function resolveState(
  admin: SupabaseClient | null,
  stateHint: string | null,
  householdId: string | null,
): Promise<string> {
  if (stateHint) return stateHint;
  if (!admin || !householdId) return DEFAULT_STATE;
  const { data, error } = await admin.from('households').select('state').eq('id', householdId).maybeSingle();
  if (error || !data) return DEFAULT_STATE;
  return parseState((data as { state?: unknown }).state);
}

async function loadStoreIds(
  admin: SupabaseClient | null,
  state: string,
): Promise<Record<string, string>> {
  if (!admin) return {};
  const { data, error } = await admin
    .from('grocery_store_regions')
    .select('store, store_id')
    .eq('state', state);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    out[row.store] = row.store_id;
  }
  return out;
}

/** Rebuild a CatalogueOffer from a shared grocery_prices row. */
export function offerFromPriceRow(row: {
  product_id: string;
  name: string;
  brand: string | null;
  price: number | string;
  pack_size: string | null;
  unit_price: number | string | null;
  by_weight: boolean;
  in_stock: boolean;
}): CatalogueOffer {
  const shelf = Number(row.price);
  const pack = parsePackSize(row.pack_size ?? '');
  const unit = row.unit_price == null ? NaN : Number(row.unit_price);
  let perGram: number | null = null;
  let perMl: number | null = null;
  let perEach: number | null = null;
  if (Number.isFinite(unit) && unit > 0) {
    if (pack.grams != null) perGram = unit;
    else if (pack.ml != null) perMl = unit;
    else if (pack.count != null) perEach = unit;
    else if (row.by_weight) perGram = unit;
  }
  return {
    productId: row.product_id,
    name: row.name,
    brand: row.brand,
    shelfPrice: shelf,
    packGrams: pack.grams,
    packMl: pack.ml,
    packCount: pack.count,
    perGram,
    perMl,
    perEach,
    weighted: row.by_weight,
    inStock: row.in_stock,
  };
}

async function loadCataloguePrices(
  admin: SupabaseClient | null,
  keys: readonly string[],
  state: string,
): Promise<{ offers: Map<string, CatalogueOffer>; fetchedAt: Map<string, string> }> {
  const offers = new Map<string, CatalogueOffer>();
  const fetchedAt = new Map<string, string>();
  if (!admin || keys.length === 0) return { offers, fetchedAt };

  const unique = [...new Set(keys.filter(Boolean))];
  const chunk = 200;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    const { data, error } = await admin
      .from('grocery_prices')
      .select(
        'ingredient_key, store, product_id, name, brand, price, pack_size, unit_price, by_weight, in_stock, fetched_at',
      )
      .eq('state', state)
      .in('ingredient_key', slice);
    if (error) throw error;
    for (const row of (data ?? []) as PriceRow[]) {
      const shelf = Number(row.price);
      if (!Number.isFinite(shelf) || shelf <= 0) continue;
      const mapKey = `${row.ingredient_key}|${row.store}`;
      offers.set(mapKey, offerFromPriceRow(row));
      fetchedAt.set(mapKey, row.fetched_at);
    }
  }
  return { offers, fetchedAt };
}

async function queueCatalogueRequest(
  admin: SupabaseClient | null,
  ingredientKey: string,
  searchQuery: string,
): Promise<void> {
  if (!admin || !ingredientKey || !searchQuery) return;
  const { error } = await admin.rpc('queue_grocery_catalogue_request', {
    p_ingredient_key: ingredientKey.slice(0, 80),
    p_search_query: searchQuery.slice(0, 60),
  });
  if (error) {
    // Fallback if the RPC migration is not imported yet.
    const { data } = await admin
      .from('grocery_catalogue_requests')
      .select('request_count')
      .eq('ingredient_key', ingredientKey)
      .maybeSingle();
    if (data) {
      await admin
        .from('grocery_catalogue_requests')
        .update({
          request_count: (data.request_count ?? 1) + 1,
          last_requested_at: new Date().toISOString(),
          search_query: searchQuery.slice(0, 60),
        })
        .eq('ingredient_key', ingredientKey);
    } else {
      await admin.from('grocery_catalogue_requests').insert({
        ingredient_key: ingredientKey.slice(0, 80),
        search_query: searchQuery.slice(0, 60),
        request_count: 1,
      });
    }
  }
}

async function searchChain(chainId: string, query: string, storeId?: string): Promise<CatalogueOffer[]> {
  if (chainId === 'coles') return searchColesProducts(query, storeId);
  if (chainId === 'woolworths') return searchWoolworthsProducts(query, storeId);
  return [];
}

/** Live store search only — used for catalogue misses. Keeps a short in-memory cache. */
async function liveProductsFor(
  chainId: string,
  query: string,
  storeId: string | undefined,
  fresh: boolean,
): Promise<CatalogueOffer[]> {
  const key = `${chainId}|${storeId ?? ''}|${query}`;
  const cached = liveCache.get(key);
  if (!fresh && cached && Date.now() - cached.at < cached.ttl) return cached.offers;
  const running = liveInflight.get(key);
  if (running) return running;
  const loading = (async () => {
    const offers = await searchChain(chainId, query, storeId);
    liveCache.set(key, { at: Date.now(), ttl: LIVE_CACHE_MS, offers });
    return offers;
  })().finally(() => liveInflight.delete(key));
  liveInflight.set(key, loading);
  return loading;
}

async function mapPool<T, R>(rows: readonly T[], limit: number, run: (row: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(rows.length);
  let next = 0;
  async function worker() {
    while (next < rows.length) {
      const index = next;
      next += 1;
      const row = rows[index];
      if (row === undefined) return;
      out[index] = await run(row);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, () => worker()));
  return out;
}

function oldestFetchedAt(dates: readonly string[]): string | null {
  let oldest: string | null = null;
  for (const at of dates) {
    if (!at) continue;
    if (!oldest || at < oldest) oldest = at;
  }
  return oldest;
}

export async function compareGroceryList(body: GroceryCompareRequest): Promise<
  | {
      ok: true;
      comparison: GroceryComparison;
      warnings: { chainId: string; message: string }[];
      pricesAsOf: string | null;
    }
  | { ok: false; error: string }
> {
  const parsed = parseCompareInput(body);
  if (!parsed) return { ok: false, error: 'Add at least one item to compare.' };
  const fresh = body.fresh === true;
  const admin = adminClient();
  const state = await resolveState(admin, parsed.stateHint, parsed.householdId);
  const storeIds = await loadStoreIds(admin, state);

  const warnings: { chainId: string; message: string }[] = [];
  const shops: GroceryShopOffers[] = [];
  const chains = lookupChainsForCountry(parsed.country);
  const fetchedDates: string[] = [];

  const itemMeta = parsed.items.map((item) => {
    const ingredientKey = shoppingMergeKey(item.name);
    const query = catalogueQuery(item.name);
    return { item, ingredientKey, query };
  });

  const catalogueKeys = itemMeta.map((row) => row.ingredientKey).filter(Boolean);
  const priced = await loadCataloguePrices(admin, catalogueKeys, state);
  const queuedMisses = new Map<string, string>();

  for (const chain of chains) {
    const offersByItemId: Record<string, CatalogueOffer[]> = {};
    let failed = false;

    const misses: { itemId: string; ingredientKey: string; query: string }[] = [];
    for (const row of itemMeta) {
      if (!row.query) continue;
      const hit = row.ingredientKey ? priced.offers.get(`${row.ingredientKey}|${chain.id}`) : undefined;
      if (hit) {
        offersByItemId[row.item.id] = [hit];
        const at = priced.fetchedAt.get(`${row.ingredientKey}|${chain.id}`);
        if (at) fetchedDates.push(at);
        continue;
      }
      if (row.ingredientKey) {
        misses.push({ itemId: row.item.id, ingredientKey: row.ingredientKey, query: row.query });
      }
    }

    const uniqueMissQueries = new Map<string, { ingredientKey: string; itemIds: string[] }>();
    for (const miss of misses) {
      const existing = uniqueMissQueries.get(miss.query);
      if (existing) {
        existing.itemIds.push(miss.itemId);
      } else {
        uniqueMissQueries.set(miss.query, { ingredientKey: miss.ingredientKey, itemIds: [miss.itemId] });
      }
      if (!queuedMisses.has(miss.ingredientKey)) queuedMisses.set(miss.ingredientKey, miss.query);
    }

    await mapPool([...uniqueMissQueries.entries()], 4, async ([query, group]) => {
      try {
        const offers = await liveProductsFor(chain.id, query, storeIds[chain.id], fresh);
        const now = new Date().toISOString();
        for (const id of group.itemIds) {
          offersByItemId[id] = offers;
          fetchedDates.push(now);
        }
      } catch {
        failed = true;
      }
    });

    if (failed) warnings.push({ chainId: chain.id, message: `${chain.name} prices are unavailable right now.` });
    shops.push({
      chainId: chain.id,
      chainName: chain.name,
      storeId: chain.id,
      storeName: chain.name,
      offersByItemId,
    });
  }

  await Promise.all(
    [...queuedMisses.entries()].map(([ingredientKey, query]) => queueCatalogueRequest(admin, ingredientKey, query)),
  )

  const currency = chains[0]?.currency ?? 'AUD';
  return {
    ok: true,
    warnings,
    pricesAsOf: oldestFetchedAt(fetchedDates),
    comparison: compareShoppingList({ currency, items: parsed.items, shops }),
  };
}

export async function searchGroceryCatalog(body: GroceryCatalogRequest): Promise<
  | { ok: true; query: string; chains: GroceryCatalogChain[]; pricesAsOf: string | null }
  | { ok: false; error: string }
> {
  const name = asText(body.name, 80);
  const amount = asText(body.amount, 40) || null;
  const defaultQuery = catalogueQuery(name);
  const query = asText(body.query, 60) || defaultQuery;
  if (!name || !query) return { ok: false, error: 'Name a product to search for.' };
  const country = asText(body.country, 2).toUpperCase();
  const stateRaw = asText(body.state, 3).toUpperCase();
  const stateHint = /^[A-Z]{2,3}$/.test(stateRaw) ? stateRaw : null;
  const householdId = asText(body.householdId, 40) || null;
  const admin = adminClient();
  const state = await resolveState(admin, stateHint, householdId);
  const storeIds = await loadStoreIds(admin, state);
  const ingredientKey = shoppingMergeKey(name);
  const useCatalogue = Boolean(ingredientKey) && query === defaultQuery;
  const priced = await loadCataloguePrices(admin, useCatalogue && ingredientKey ? [ingredientKey] : [], state);
  const chains = lookupChainsForCountry(country);
  const fetchedDates: string[] = [];

  let anyMiss = false;
  const results = await Promise.all(
    chains.map(async (chain) => {
      try {
        const hit = useCatalogue && ingredientKey ? priced.offers.get(`${ingredientKey}|${chain.id}`) : undefined;
        if (hit) {
          const at = priced.fetchedAt.get(`${ingredientKey}|${chain.id}`);
          if (at) fetchedDates.push(at);
          return { chainId: chain.id, chainName: chain.name, choices: catalogueChoices(name, amount, [hit]) };
        }
        anyMiss = true;
        const offers = await liveProductsFor(chain.id, query, storeIds[chain.id], false);
        fetchedDates.push(new Date().toISOString());
        return { chainId: chain.id, chainName: chain.name, choices: catalogueChoices(name, amount, offers) };
      } catch {
        anyMiss = true;
        return { chainId: chain.id, chainName: chain.name, choices: [] as CatalogueChoice[], unavailable: true };
      }
    }),
  );
  if (anyMiss && ingredientKey) await queueCatalogueRequest(admin, ingredientKey, query);
  return { ok: true, query, chains: results, pricesAsOf: oldestFetchedAt(fetchedDates) };
}
