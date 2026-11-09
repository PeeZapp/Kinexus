import {
  catalogueQuery,
  pickCanonicalShoppingName,
  shoppingMergeKey,
} from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { cronAuthorized } from '../prices.js';
import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';

export const CATALOGUE_TOP_N = 1000;
export const CATALOGUE_REQUEST_CAP = 200;
export const CATALOGUE_BATCH_DAYS = 7;

export type RankedIngredient = {
  ingredientKey: string;
  displayName: string;
  searchQuery: string;
  recipeCount: number;
  rank: number;
};

export type CatalogueRequestSeed = {
  ingredientKey: string;
  searchQuery: string;
  requestCount: number;
};

export type SelectedCatalogueItem = RankedIngredient & {
  weekStart: string;
  batchDay: number;
};

/** Perth (AWST, UTC+8, no DST). */
export function perthDateParts(now = new Date()): { y: number; m: number; d: number; dow: number } {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
  };
}

/** Monday (YYYY-MM-DD) of the current Perth week. */
export function weekStartPerth(now = new Date()): string {
  const p = perthDateParts(now);
  const mondayOffset = (p.dow + 6) % 7;
  const monday = new Date(Date.UTC(p.y, p.m, p.d - mondayOffset));
  return monday.toISOString().slice(0, 10);
}

/** Mon=0 … Sun=6 in Perth. */
export function batchDayPerth(now = new Date()): number {
  return (perthDateParts(now).dow + 6) % 7;
}

function asIngredientNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const name = typeof (item as { name?: unknown }).name === 'string' ? (item as { name: string }).name.trim() : '';
    if (name) names.push(name);
  }
  return names;
}

/** Rank ingredients by how many recipes mention them (after merge-key normalisation). */
export function rankIngredientsFromRecipes(
  recipeIngredients: readonly unknown[],
): Omit<RankedIngredient, 'rank'>[] {
  const counts = new Map<string, { names: string[]; recipeCount: number }>();
  for (const ingredients of recipeIngredients) {
    const seen = new Set<string>();
    for (const name of asIngredientNames(ingredients)) {
      const key = shoppingMergeKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const row = counts.get(key);
      if (row) {
        row.recipeCount += 1;
        row.names.push(name);
      } else {
        counts.set(key, { names: [name], recipeCount: 1 });
      }
    }
  }

  const ranked = [...counts.entries()].map(([ingredientKey, row]) => {
    const displayName = pickCanonicalShoppingName(row.names) || ingredientKey;
    return {
      ingredientKey,
      displayName,
      searchQuery: catalogueQuery(displayName) || catalogueQuery(ingredientKey),
      recipeCount: row.recipeCount,
    };
  });
  ranked.sort(
    (a, b) =>
      b.recipeCount - a.recipeCount ||
      a.ingredientKey.localeCompare(b.ingredientKey),
  );
  return ranked;
}

/**
 * Keep top N by frequency, then up to `requestCap` queued requests not already selected
 * (highest request_count first).
 */
export function selectWeeklyCatalogue(
  ranked: readonly Omit<RankedIngredient, 'rank'>[],
  requests: readonly CatalogueRequestSeed[],
  topN = CATALOGUE_TOP_N,
  requestCap = CATALOGUE_REQUEST_CAP,
): RankedIngredient[] {
  const selected: RankedIngredient[] = [];
  const seen = new Set<string>();
  for (const row of ranked.slice(0, topN)) {
    if (!row.ingredientKey || seen.has(row.ingredientKey)) continue;
    seen.add(row.ingredientKey);
    selected.push({ ...row, rank: selected.length + 1 });
  }

  const queued = [...requests].sort(
    (a, b) => b.requestCount - a.requestCount || a.ingredientKey.localeCompare(b.ingredientKey),
  );
  let added = 0;
  for (const req of queued) {
    if (added >= requestCap) break;
    const key = req.ingredientKey.trim();
    if (!key || seen.has(key)) continue;
    const query = (req.searchQuery || catalogueQuery(key)).trim().slice(0, 60);
    if (!query) continue;
    seen.add(key);
    selected.push({
      ingredientKey: key,
      displayName: key,
      searchQuery: query,
      recipeCount: 0,
      rank: selected.length + 1,
    });
    added += 1;
  }
  return selected;
}

/** Round-robin by rank so each day mixes popular and long-tail items (~150/day). */
export function balanceCatalogueBatches(
  items: readonly RankedIngredient[],
  weekStart: string,
  days = CATALOGUE_BATCH_DAYS,
): SelectedCatalogueItem[] {
  const safeDays = Math.max(1, days);
  return items.map((item, index) => ({
    ...item,
    weekStart,
    batchDay: index % safeDays,
  }));
}

export type SelectResult = {
  ok: boolean;
  weekStart: string;
  selected: number;
  fromRecipes: number;
  fromRequests: number;
  skipped?: string;
};

async function loadRecipeIngredientLists(admin: SupabaseClient): Promise<unknown[]> {
  const lists: unknown[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('recipes')
      .select('ingredients')
      .eq('removed', false)
      .or('is_public.eq.true,household_id.not.is.null')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) lists.push(row.ingredients);
    if (rows.length < pageSize) break;
  }
  return lists;
}

async function loadCatalogueRequests(admin: SupabaseClient): Promise<CatalogueRequestSeed[]> {
  const { data, error } = await admin
    .from('grocery_catalogue_requests')
    .select('ingredient_key, search_query, request_count')
    .order('request_count', { ascending: false })
    .limit(CATALOGUE_REQUEST_CAP * 3);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ingredientKey: row.ingredient_key,
    searchQuery: row.search_query,
    requestCount: row.request_count,
  }));
}

export async function runWeeklyCatalogueSelection(
  admin: SupabaseClient,
  now = new Date(),
): Promise<SelectResult> {
  const weekStart = weekStartPerth(now);
  const recipeLists = await loadRecipeIngredientLists(admin);
  const ranked = rankIngredientsFromRecipes(recipeLists);
  const requests = await loadCatalogueRequests(admin);
  const selected = selectWeeklyCatalogue(ranked, requests);
  const rows = balanceCatalogueBatches(selected, weekStart).map((item) => ({
    ingredient_key: item.ingredientKey,
    display_name: item.displayName,
    search_query: item.searchQuery,
    rank: item.rank,
    recipe_count: item.recipeCount,
    week_start: item.weekStart,
    batch_day: item.batchDay,
  }));

  const { error: clearError } = await admin.from('grocery_catalogue_items').delete().eq('week_start', weekStart);
  if (clearError) throw clearError;

  if (rows.length > 0) {
    const { error: insertError } = await admin.from('grocery_catalogue_items').insert(rows);
    if (insertError) throw insertError;
  }

  const fromRecipes = selected.filter((row) => row.recipeCount > 0).length;
  return {
    ok: true,
    weekStart,
    selected: selected.length,
    fromRecipes,
    fromRequests: selected.length - fromRecipes,
  };
}

export async function handleWeeklyCatalogueSelection(
  request: Request,
): Promise<{ status: number; body: SelectResult | { error: string } }> {
  if (!cronAuthorized(request)) return { status: 401, body: { error: 'Unauthorized' } };
  if (!isServiceRoleConfigured()) {
    return { status: 503, body: { error: 'Grocery catalogue selection is not configured' } };
  }
  try {
    const admin = createServiceClient();
    const result = await runWeeklyCatalogueSelection(admin);
    return { status: 200, body: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Catalogue selection failed';
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
}
