import {
  estimateRecipeCostForMarket,
  isCostCurrent,
  marketForHousehold,
  parsePriceOverrideMap,
  type GroceryMarket,
  type Ingredient,
  type IngredientPriceBook,
  type PriceOverrideMap,
  type Recipe,
  type RecipeCostEstimate,
} from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAiClient } from './ai/provider.js';
import { refreshIngredientCatalogWithAi } from './ai/price-recipe.js';
import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';

type HouseholdRow = {
  id: string;
  country: string | null;
  currency: string | null;
};

type RecipeRow = {
  id: string;
  name: string;
  household_id: string | null;
  servings: number | null;
  ingredients: unknown;
  removed: boolean | null;
};

export type EstimateRequestBody = {
  recipeId?: string;
  householdId?: string;
};

export type RefreshRequestBody = {
  householdId?: string;
  force?: boolean;
};

export type RefreshResult = {
  processed: number;
  remaining: number;
  failed: number;
  continued: boolean;
  refreshedAt?: string;
  lastError?: string;
};

function marketKey(market: GroceryMarket): string {
  return `${market.country}:${market.currency}`;
}

function asIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name) return [];
    return [
      {
        name,
        amount: typeof rec.amount === 'string' ? rec.amount : undefined,
        category: typeof rec.category === 'string' ? rec.category : undefined,
      },
    ];
  });
}

export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (secret) return token === secret;
  return process.env.VERCEL !== '1';
}

async function assertHouseholdMember(
  admin: SupabaseClient,
  userId: string,
  householdId: string,
): Promise<HouseholdRow> {
  const { data: member, error: memberError } = await admin
    .from('household_members')
    .select('household_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) {
    const err = new Error('Not a member of this household');
    (err as { status?: number }).status = 403;
    throw err;
  }
  const { data: household, error } = await admin
    .from('households')
    .select('id, country, currency')
    .eq('id', householdId)
    .maybeSingle();
  if (error) throw error;
  if (!household) {
    const err = new Error('Household not found');
    (err as { status?: number }).status = 404;
    throw err;
  }
  return household;
}

async function loadPriceBook(admin: SupabaseClient, market: GroceryMarket): Promise<IngredientPriceBook | null> {
  const { data, error } = await admin
    .from('ingredient_price_overrides')
    .select('prices, priced_at')
    .eq('country', market.country)
    .eq('currency', market.currency)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    prices: parsePriceOverrideMap(data.prices),
    pricedAt: data.priced_at,
  };
}

async function savePriceBook(
  admin: SupabaseClient,
  market: GroceryMarket,
  prices: PriceOverrideMap,
  pricedAt: string,
): Promise<void> {
  const { error } = await admin.from('ingredient_price_overrides').upsert(
    {
      country: market.country,
      currency: market.currency,
      prices,
      priced_at: pricedAt,
    },
    { onConflict: 'country,currency' },
  );
  if (error) throw error;
}

async function loadRecipe(admin: SupabaseClient, recipeId: string): Promise<RecipeRow> {
  const { data, error } = await admin
    .from('recipes')
    .select('id, name, household_id, servings, ingredients, removed')
    .eq('id', recipeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = new Error('Recipe not found');
    (err as { status?: number }).status = 404;
    throw err;
  }
  return data;
}

function recipeFromRow(row: RecipeRow): Pick<Recipe, 'id' | 'name' | 'householdId' | 'servings' | 'ingredients'> {
  return {
    id: row.id,
    name: row.name,
    householdId: row.household_id,
    servings: row.servings ?? undefined,
    ingredients: asIngredients(row.ingredients),
  };
}

export async function handleEstimateRecipeCost(
  userId: string,
  body: EstimateRequestBody,
): Promise<{ status: number; body: { cost: RecipeCostEstimate } | { error: string } }> {
  const recipeId = body.recipeId?.trim() ?? '';
  const householdId = body.householdId?.trim() ?? '';
  if (!recipeId) return { status: 400, body: { error: 'recipeId is required' } };
  if (!householdId) return { status: 400, body: { error: 'householdId is required' } };
  if (!isServiceRoleConfigured()) {
    return { status: 503, body: { error: 'Recipe pricing is not configured' } };
  }

  try {
    const admin = createServiceClient();
    const household = await assertHouseholdMember(admin, userId, householdId);
    const recipe = recipeFromRow(await loadRecipe(admin, recipeId));
    if (recipe.householdId && recipe.householdId !== householdId) {
      return { status: 403, body: { error: 'Recipe is not in this household' } };
    }
    const market = marketForHousehold(household);
    const book = await loadPriceBook(admin, market);
    const cost = estimateRecipeCostForMarket(recipe, market, book);
    if (!cost) return { status: 422, body: { error: 'Recipe has no ingredients we can price' } };
    return { status: 200, body: { cost } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not estimate recipe cost';
    const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
    return { status, body: { error: message.slice(0, 300) } };
  }
}

async function householdMarketsForUser(admin: SupabaseClient, userId: string): Promise<GroceryMarket[]> {
  const { data: memberships, error: memberError } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId);
  if (memberError) throw memberError;
  const ids = (memberships ?? []).map((row) => row.household_id);
  if (ids.length === 0) return [marketForHousehold({})];
  const { data, error } = await admin.from('households').select('id, country, currency').in('id', ids);
  if (error) throw error;
  const markets = new Map<string, GroceryMarket>();
  for (const row of data ?? []) {
    const market = marketForHousehold(row);
    markets.set(marketKey(market), market);
  }
  return [...markets.values()];
}

async function allHouseholdMarkets(admin: SupabaseClient): Promise<GroceryMarket[]> {
  const { data, error } = await admin.from('households').select('id, country, currency');
  if (error) throw error;
  const markets = new Map<string, GroceryMarket>();
  for (const row of data ?? []) {
    const market = marketForHousehold(row);
    markets.set(marketKey(market), market);
  }
  if (markets.size === 0) {
    const fallback = marketForHousehold({});
    markets.set(marketKey(fallback), fallback);
  }
  return [...markets.values()];
}

async function refreshMarket(
  admin: SupabaseClient,
  market: GroceryMarket,
  force: boolean,
): Promise<{ skipped: boolean; pricedAt: string }> {
  if (!force) {
    const existing = await loadPriceBook(admin, market);
    if (existing?.pricedAt && isCostCurrent(existing.pricedAt)) {
      return { skipped: true, pricedAt: existing.pricedAt };
    }
  }
  const client = createAiClient();
  const prices = await refreshIngredientCatalogWithAi(client, market);
  const pricedAt = new Date().toISOString();
  await savePriceBook(admin, market, prices, pricedAt);
  return { skipped: false, pricedAt };
}

export async function handleRefreshRecipeCosts(
  _request: Request,
  userId?: string,
  body?: RefreshRequestBody,
): Promise<{ status: number; body: RefreshResult | { error: string } }> {
  if (!isServiceRoleConfigured()) {
    return { status: 503, body: { error: 'Recipe pricing is not configured' } };
  }

  try {
    const admin = createServiceClient();
    const force = Boolean(userId) || Boolean(body?.force);
    let markets: GroceryMarket[];
    if (userId && body?.householdId?.trim()) {
      const household = await assertHouseholdMember(admin, userId, body.householdId.trim());
      markets = [marketForHousehold(household)];
    } else if (userId) {
      markets = await householdMarketsForUser(admin, userId);
    } else {
      markets = await allHouseholdMarkets(admin);
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let lastError: string | undefined;
    let refreshedAt: string | undefined;
    for (const market of markets) {
      try {
        const result = await refreshMarket(admin, market, force);
        if (result.skipped) skipped += 1;
        else {
          processed += 1;
          refreshedAt = result.pricedAt;
        }
      } catch (err) {
        failed += 1;
        lastError = err instanceof Error ? err.message : 'Price refresh failed';
        console.error(`Ingredient catalog refresh failed (${market.country}):`, lastError);
      }
    }

    return {
      status: failed > 0 && processed === 0 ? 500 : 200,
      body: {
        processed,
        remaining: 0,
        failed,
        continued: false,
        refreshedAt,
        lastError,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Price refresh failed';
    if (message.includes('is not set')) return { status: 503, body: { error: message } };
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
}
