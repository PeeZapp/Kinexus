import { pickCatalogueOffer, type CatalogueOffer } from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { cronAuthorized } from '../prices.js';
import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { residentialProxyConfigured } from '../scrape/residential-proxy.js';
import { searchColesProducts } from './coles.js';
import { searchWoolworthsProducts } from './woolworths.js';
import { batchDayPerth, weekStartPerth } from './catalogue-select.js';

const RUN_BUDGET_MS = 160_000;
/** ~150 items × 2 stores fit across a few night invocations at this pace. */
export const MAX_SEARCHES_PER_RUN = 50;
const CONCURRENCY = 2;
const JITTER_MS = { min: 250, max: 900 };
const BACKOFF_MS = { start: 2_000, max: 20_000 };

export type GroceryStore = 'woolworths' | 'coles';

export type StoreRegion = {
  state: string;
  store: GroceryStore;
  storeId: string;
};

export type CatalogueItemRow = {
  ingredientKey: string;
  displayName: string;
  searchQuery: string;
  rank: number;
  batchDay: number;
};

export type WorkUnit = {
  ingredientKey: string;
  displayName: string;
  searchQuery: string;
  store: GroceryStore;
  state: string;
  storeId: string;
};

export type RefreshResult = {
  ok: boolean;
  weekStart: string;
  batchDay: number;
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  continued: boolean;
  rolledForward: number;
  skipped?: string;
  lastError?: string;
};

export type SearchStoreFn = (store: GroceryStore, query: string, storeId: string) => Promise<CatalogueOffer[]>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(): number {
  return JITTER_MS.min + Math.floor(Math.random() * (JITTER_MS.max - JITTER_MS.min + 1));
}

function isBlockError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(403|401|block|blocked|502)\b/i.test(message);
}

export function packSizeLabel(offer: CatalogueOffer): string | null {
  if (offer.packGrams != null && offer.packGrams > 0) {
    return offer.packGrams >= 1000 ? `${offer.packGrams / 1000}kg` : `${offer.packGrams}g`;
  }
  if (offer.packMl != null && offer.packMl > 0) {
    return offer.packMl >= 1000 ? `${offer.packMl / 1000}L` : `${offer.packMl}ml`;
  }
  if (offer.packCount != null && offer.packCount > 0) return `${offer.packCount} pack`;
  return null;
}

export function unitPriceValue(offer: CatalogueOffer): number | null {
  if (offer.perGram != null && offer.perGram > 0) return offer.perGram;
  if (offer.perMl != null && offer.perMl > 0) return offer.perMl;
  if (offer.perEach != null && offer.perEach > 0) return offer.perEach;
  return null;
}

/** States with ≥1 household that still has members. */
export async function loadActiveStates(admin: SupabaseClient): Promise<string[]> {
  const { data: memberships, error: memberError } = await admin.from('household_members').select('household_id');
  if (memberError) throw memberError;
  const ids = [...new Set((memberships ?? []).map((row) => row.household_id))];
  if (ids.length === 0) return ['WA'];
  const { data, error } = await admin.from('households').select('state').in('id', ids);
  if (error) throw error;
  const states = [...new Set((data ?? []).map((row) => (row.state || 'WA').toUpperCase()).filter(Boolean))];
  return states.length > 0 ? states.sort() : ['WA'];
}

export async function loadStoreRegions(admin: SupabaseClient, states: readonly string[]): Promise<StoreRegion[]> {
  if (states.length === 0) return [];
  const { data, error } = await admin
    .from('grocery_store_regions')
    .select('state, store, store_id')
    .in('state', [...states]);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    if (row.store !== 'woolworths' && row.store !== 'coles') return [];
    return [{ state: row.state, store: row.store, storeId: row.store_id }];
  });
}

/** Region lookup used by refresh (and tests). */
export function regionsForStates(
  regions: readonly StoreRegion[],
  states: readonly string[],
): StoreRegion[] {
  const want = new Set(states.map((s) => s.toUpperCase()));
  return regions.filter((row) => want.has(row.state.toUpperCase()));
}

export function buildWorkUnits(
  items: readonly CatalogueItemRow[],
  regions: readonly StoreRegion[],
): WorkUnit[] {
  const units: WorkUnit[] = [];
  for (const item of items) {
    for (const region of regions) {
      units.push({
        ingredientKey: item.ingredientKey,
        displayName: item.displayName,
        searchQuery: item.searchQuery,
        store: region.store,
        state: region.state,
        storeId: region.storeId,
      });
    }
  }
  return units;
}

export function filterPendingWork(
  units: readonly WorkUnit[],
  priced: ReadonlySet<string>,
): WorkUnit[] {
  return units.filter((unit) => !priced.has(`${unit.ingredientKey}|${unit.store}|${unit.state}`));
}

/**
 * Move incomplete items from earlier batch days into today.
 * Sunday leftovers stay put so next week's selection picks them up again.
 */
export function rolloverBatchDays(
  items: readonly CatalogueItemRow[],
  todayBatchDay: number,
  completeKeys: ReadonlySet<string>,
): { next: CatalogueItemRow[]; rolledKeys: string[] } {
  if (todayBatchDay <= 0) return { next: [...items], rolledKeys: [] };
  const rolledKeys: string[] = [];
  const next = items.map((item) => {
    if (item.batchDay >= todayBatchDay) return item;
    if (completeKeys.has(item.ingredientKey)) return item;
    rolledKeys.push(item.ingredientKey);
    return { ...item, batchDay: todayBatchDay };
  });
  return { next, rolledKeys };
}

async function defaultSearch(store: GroceryStore, query: string, storeId: string): Promise<CatalogueOffer[]> {
  if (store === 'coles') return searchColesProducts(query, storeId);
  return searchWoolworthsProducts(query, storeId);
}

async function searchWithBackoff(
  search: SearchStoreFn,
  unit: WorkUnit,
): Promise<CatalogueOffer[]> {
  let delay = BACKOFF_MS.start;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await search(unit.store, unit.searchQuery, unit.storeId);
    } catch (err) {
      lastError = err;
      if (!isBlockError(err) || attempt === 2) throw err;
      await sleep(delay + jitter());
      delay = Math.min(BACKOFF_MS.max, delay * 2);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Catalogue search failed');
}

function priceRow(unit: WorkUnit, offer: CatalogueOffer, fetchedAt: string) {
  return {
    ingredient_key: unit.ingredientKey,
    store: unit.store,
    state: unit.state,
    product_id: offer.productId,
    name: offer.name,
    brand: offer.brand,
    price: offer.shelfPrice,
    pack_size: packSizeLabel(offer),
    unit_price: unitPriceValue(offer),
    by_weight: offer.weighted,
    in_stock: offer.inStock,
    fetched_at: fetchedAt,
  };
}

async function loadWeekItems(admin: SupabaseClient, weekStart: string): Promise<CatalogueItemRow[]> {
  const { data, error } = await admin
    .from('grocery_catalogue_items')
    .select('ingredient_key, display_name, search_query, rank, batch_day')
    .eq('week_start', weekStart)
    .order('rank', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ingredientKey: row.ingredient_key,
    displayName: row.display_name,
    searchQuery: row.search_query,
    rank: row.rank,
    batchDay: row.batch_day,
  }));
}

async function loadPricedKeys(
  admin: SupabaseClient,
  weekStart: string,
  keys: readonly string[],
): Promise<Set<string>> {
  const priced = new Set<string>();
  if (keys.length === 0) return priced;
  const chunk = 200;
  for (let i = 0; i < keys.length; i += chunk) {
    const slice = keys.slice(i, i + chunk);
    const { data, error } = await admin
      .from('grocery_prices')
      .select('ingredient_key, store, state, fetched_at')
      .in('ingredient_key', slice)
      .gte('fetched_at', `${weekStart}T00:00:00.000Z`);
    if (error) throw error;
    for (const row of data ?? []) {
      priced.add(`${row.ingredient_key}|${row.store}|${row.state}`);
    }
  }
  return priced;
}

function completeIngredientKeys(
  items: readonly CatalogueItemRow[],
  regions: readonly StoreRegion[],
  priced: ReadonlySet<string>,
): Set<string> {
  const needed = regions.length;
  if (needed === 0) return new Set(items.map((item) => item.ingredientKey));
  const complete = new Set<string>();
  for (const item of items) {
    let ok = 0;
    for (const region of regions) {
      if (priced.has(`${item.ingredientKey}|${region.store}|${region.state}`)) ok += 1;
    }
    if (ok >= needed) complete.add(item.ingredientKey);
  }
  return complete;
}

async function persistRolledBatchDays(
  admin: SupabaseClient,
  weekStart: string,
  todayBatchDay: number,
  rolledKeys: readonly string[],
): Promise<void> {
  if (rolledKeys.length === 0) return;
  const { error } = await admin
    .from('grocery_catalogue_items')
    .update({ batch_day: todayBatchDay })
    .eq('week_start', weekStart)
    .in('ingredient_key', [...rolledKeys]);
  if (error) throw error;
}

export async function runDailyCatalogueRefresh(
  admin: SupabaseClient,
  options: {
    now?: Date;
    search?: SearchStoreFn;
    maxSearches?: number;
    budgetMs?: number;
  } = {},
): Promise<RefreshResult> {
  const now = options.now ?? new Date();
  const weekStart = weekStartPerth(now);
  const batchDay = batchDayPerth(now);
  const maxSearches = options.maxSearches ?? MAX_SEARCHES_PER_RUN;
  const budgetMs = options.budgetMs ?? RUN_BUDGET_MS;
  const search = options.search ?? defaultSearch;

  if (!residentialProxyConfigured() && process.env.VERCEL === '1') {
    return {
      ok: true,
      weekStart,
      batchDay,
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
      continued: false,
      rolledForward: 0,
      skipped: 'RESIDENTIAL_PROXY is not configured',
    };
  }

  const states = await loadActiveStates(admin);
  const regions = regionsForStates(await loadStoreRegions(admin, states), states);
  if (regions.length === 0) {
    return {
      ok: true,
      weekStart,
      batchDay,
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
      continued: false,
      rolledForward: 0,
      skipped: 'No grocery_store_regions for active states',
    };
  }

  let items = await loadWeekItems(admin, weekStart);
  if (items.length === 0) {
    return {
      ok: true,
      weekStart,
      batchDay,
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
      continued: false,
      rolledForward: 0,
      skipped: 'No catalogue items for this week',
    };
  }

  const pricedAll = await loadPricedKeys(
    admin,
    weekStart,
    items.map((item) => item.ingredientKey),
  );
  const complete = completeIngredientKeys(items, regions, pricedAll);
  const rolled = rolloverBatchDays(items, batchDay, complete);
  items = rolled.next;
  await persistRolledBatchDays(admin, weekStart, batchDay, rolled.rolledKeys);

  const todayItems = items.filter((item) => item.batchDay === batchDay);
  const work = filterPendingWork(buildWorkUnits(todayItems, regions), pricedAll);

  const started = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let lastError: string | undefined;
  const failedKeys: string[] = [];
  const fetchedAt = now.toISOString();
  const pendingBefore = work.length;

  for (let i = 0; i < work.length && processed < maxSearches; ) {
    if (Date.now() - started > budgetMs) break;
    const slice = work.slice(i, i + CONCURRENCY);
    i += slice.length;

    const results = await Promise.all(
      slice.map(async (unit) => {
        await sleep(jitter());
        try {
          const offers = await searchWithBackoff(search, unit);
          const picked = pickCatalogueOffer(unit.displayName, null, offers);
          if (!picked) {
            return { unit, ok: false as const, error: 'No matching offer' };
          }
          return { unit, ok: true as const, offer: picked.offer };
        } catch (err) {
          return {
            unit,
            ok: false as const,
            error: err instanceof Error ? err.message : 'Search failed',
          };
        }
      }),
    );

    const upserts = [];
    for (const result of results) {
      processed += 1;
      if (result.ok) {
        succeeded += 1;
        upserts.push(priceRow(result.unit, result.offer, fetchedAt));
      } else {
        failed += 1;
        failedKeys.push(result.unit.ingredientKey);
        lastError = result.error;
      }
    }
    if (upserts.length > 0) {
      const { error } = await admin.from('grocery_prices').upsert(upserts, {
        onConflict: 'ingredient_key,store,state',
      });
      if (error) throw error;
    }
  }

  // Failures stay pending for the next same-day invocation; unprocessed work too.
  const remaining = Math.max(0, pendingBefore - succeeded);
  const continued = remaining > 0;

  // Sunday: queue still-failing keys into requests so next week can pick them up.
  if (batchDay === 6 && failedKeys.length > 0 && remaining === 0) {
    const unique = [...new Set(failedKeys)];
    for (const key of unique) {
      const item = todayItems.find((row) => row.ingredientKey === key);
      if (!item) continue;
      const { data: existing } = await admin
        .from('grocery_catalogue_requests')
        .select('request_count')
        .eq('ingredient_key', key)
        .maybeSingle();
      const { error } = await admin.from('grocery_catalogue_requests').upsert(
        {
          ingredient_key: key,
          search_query: item.searchQuery,
          request_count: (existing?.request_count ?? 0) + 1,
          last_requested_at: fetchedAt,
        },
        { onConflict: 'ingredient_key' },
      );
      if (error) throw error;
    }
  }

  const stats = {
    processed,
    succeeded,
    failed,
    remaining,
    continued,
    rolledForward: rolled.rolledKeys.length,
    states,
    regions: regions.map((r) => `${r.state}:${r.store}:${r.storeId}`),
    failedKeys: [...new Set(failedKeys)].slice(0, 50),
    lastError: lastError?.slice(0, 300),
  };

  const { error: runError } = await admin.from('grocery_refresh_runs').insert({
    week_start: weekStart,
    batch_day: batchDay,
    finished_at: new Date().toISOString(),
    continued,
    stats,
  });
  if (runError) throw runError;

  return {
    ok: failed === 0 || succeeded > 0,
    weekStart,
    batchDay,
    processed,
    succeeded,
    failed,
    remaining,
    continued,
    rolledForward: rolled.rolledKeys.length,
    lastError,
  };
}

export async function handleDailyCatalogueRefresh(
  request: Request,
): Promise<{ status: number; body: RefreshResult | { error: string } }> {
  if (!cronAuthorized(request)) return { status: 401, body: { error: 'Unauthorized' } };
  if (!isServiceRoleConfigured()) {
    return { status: 503, body: { error: 'Grocery catalogue refresh is not configured' } };
  }
  try {
    const admin = createServiceClient();
    const result = await runDailyCatalogueRefresh(admin);
    return { status: result.ok ? 200 : 200, body: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Catalogue refresh failed';
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
}
