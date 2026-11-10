import { Platform } from 'react-native';

import type { CatalogueChoice, GroceryComparison } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

export type ImportedRecipe = {
  name: string;
  emoji?: string;
  cuisine?: string;
  cookTime?: number;
  servings?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  vegetarian?: boolean;
  ingredients: { name: string; amount?: string; category?: string }[];
  method: string[];
  chefTip?: string;
  mealSlots: string[];
  imageUrl?: string;
  imageCandidates?: string[];
};

export type ScrapeResponse =
  | { source: 'json-ld'; recipe: ImportedRecipe }
  | { source: 'text'; content: string; imageUrl?: string; imageCandidates?: string[] }
  | { source: 'blocked'; blocked: true }
  | { source: 'not-found'; url: string; recipeUrl: string; dishName?: string };

export type ImportSource =
  | 'json-ld'
  | 'text-scraped'
  | 'blocked-ai'
  | 'text-paste'
  | 'photo'
  | 'generated-name';

export type MissingRecipe = {
  url: string;
  recipeUrl: string;
  dishName: string;
};

export type ImportResult =
  | { recipe: ImportedRecipe; source: ImportSource }
  | { source: 'not-found'; missing: MissingRecipe };

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export function isMealsApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

function apiBase(): string {
  return configuredUrl();
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!isMealsApiConfigured()) {
    throw new Error('Recipe API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export async function scrapeRecipe(url: string): Promise<ScrapeResponse> {
  return post<ScrapeResponse>('/scrape', { url });
}

export async function verifyCreatorLinks(urls: string[]): Promise<{ ok: true }> {
  return post<{ ok: true }>('/creators/verify-links', { urls });
}

export type AiCallResult<T> = { value: T; resultsMayVary?: boolean };

export async function extractRecipeFromText(
  content: string,
  householdId: string,
): Promise<AiCallResult<ImportedRecipe>> {
  const data = await post<{ recipe: ImportedRecipe; resultsMayVary?: boolean }>('/ai', {
    task: 'extract_recipe',
    content,
    householdId,
  });
  return { value: data.recipe, resultsMayVary: data.resultsMayVary };
}

export async function extractRecipeFromPhoto(
  imageUrl: string,
  householdId: string,
): Promise<AiCallResult<ImportedRecipe>> {
  const data = await post<{ recipe: ImportedRecipe; resultsMayVary?: boolean }>('/ai', {
    task: 'extract_recipe_from_photo',
    imageUrl,
    householdId,
  });
  return { value: data.recipe, resultsMayVary: data.resultsMayVary };
}

export async function estimateRecipeNutritionFromApi(input: {
  name?: string;
  servings?: number;
  ingredients: { name: string; amount?: string }[];
  householdId: string;
}): Promise<AiCallResult<{ calories?: number; protein?: number; carbs?: number; fat?: number }>> {
  const data = await post<{
    nutrition: { calories?: number; protein?: number; carbs?: number; fat?: number };
    resultsMayVary?: boolean;
  }>('/ai', {
    task: 'estimate_recipe_nutrition',
    name: input.name,
    servings: input.servings,
    ingredients: input.ingredients,
    householdId: input.householdId,
  });
  return { value: data.nutrition, resultsMayVary: data.resultsMayVary };
}

export async function refreshRecipePrices(householdId?: string): Promise<{
  processed: number;
  remaining: number;
  failed: number;
  continued: boolean;
}> {
  return post('/prices/refresh', { householdId });
}

export async function extractRecipeFromUrlHint(
  url: string,
  householdId: string,
): Promise<AiCallResult<ImportedRecipe>> {
  const data = await post<{ recipe: ImportedRecipe; resultsMayVary?: boolean }>('/ai', {
    task: 'extract_recipe_from_url',
    url,
    householdId,
  });
  return { value: data.recipe, resultsMayVary: data.resultsMayVary };
}

export async function generateRecipeFromName(
  name: string,
  householdId: string,
): Promise<AiCallResult<ImportedRecipe>> {
  const data = await post<{ recipe: ImportedRecipe; resultsMayVary?: boolean }>('/ai', {
    task: 'generate_recipe_from_name',
    name,
    householdId,
  });
  return { value: data.recipe, resultsMayVary: data.resultsMayVary };
}

export async function mirrorRecipeImage(
  recipeId: string,
  imageUrl?: string,
): Promise<{ imageUrl: string | null }> {
  return post<{ imageUrl: string | null }>('/recipes/mirror-image', {
    recipeId,
    ...(imageUrl ? { imageUrl } : {}),
  });
}

export function isRecipeImagesBucketUrl(url: string | null | undefined): boolean {
  return Boolean(url?.includes('/storage/v1/object/public/recipe-images/'));
}

export async function importRecipeFromUrl(url: string, householdId: string): Promise<ImportResult & { resultsMayVary?: boolean }> {
  const scraped = await scrapeRecipe(url);
  if (scraped.source === 'json-ld') return { recipe: scraped.recipe, source: 'json-ld' };
  if (scraped.source === 'text') {
    const result = await extractRecipeFromText(scraped.content, householdId);
    return {
      recipe: {
        ...result.value,
        imageUrl: result.value.imageUrl ?? scraped.imageUrl,
        imageCandidates: scraped.imageCandidates ?? result.value.imageCandidates,
      },
      source: 'text-scraped',
      resultsMayVary: result.resultsMayVary,
    };
  }
  if (scraped.source === 'not-found') {
    return {
      source: 'not-found',
      missing: {
        url: scraped.url,
        recipeUrl: scraped.recipeUrl || scraped.url,
        dishName: scraped.dishName ?? '',
      },
    };
  }
  if (isSocialVideoUrl(url)) {
    return { source: 'not-found', missing: { url, recipeUrl: url, dishName: '' } };
  }
  const result = await extractRecipeFromUrlHint(url, householdId);
  return { recipe: result.value, source: 'blocked-ai', resultsMayVary: result.resultsMayVary };
}

export async function compareGroceryPrices(input: {
  country: string | null;
  householdId?: string | null;
  state?: string | null;
  fresh?: boolean;
  items: { id: string; name: string; amount: string | null; pins?: { chainId: string; productId: string }[] }[];
}): Promise<{
  comparison: GroceryComparison;
  warnings: { chainId: string; message: string }[];
  pricesAsOf: string | null;
}> {
  return post('/grocery/compare', input);
}

export async function searchGroceryCatalog(input: {
  country: string | null;
  householdId?: string | null;
  state?: string | null;
  name: string;
  amount: string | null;
  query?: string;
}): Promise<{
  query: string;
  chains: { chainId: string; chainName: string; choices: CatalogueChoice[]; unavailable?: boolean }[];
  pricesAsOf: string | null;
}> {
  return post('/grocery/catalog', input);
}

export type GroceryConnector = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export async function createGroceryConnector(householdId: string): Promise<{ token: string; mcpUrl: string; connector: GroceryConnector }> {
  return post('/grocery/connectors', { householdId, label: 'Grok Bot' });
}

export async function listGroceryConnectors(householdId: string): Promise<{ connectors: GroceryConnector[] }> {
  const res = await fetch(`${apiBase()}/grocery/connectors?householdId=${encodeURIComponent(householdId)}`, {
    headers: await authHeader(),
  });
  const data = (await res.json().catch(() => ({}))) as { connectors?: GroceryConnector[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return { connectors: data.connectors ?? [] };
}

export async function revokeGroceryConnector(connectorId: string): Promise<void> {
  await post('/grocery/connectors/revoke', { connectorId });
}

export async function createGroceryHandoff(input: {
  householdId: string;
  weekStart: string;
}): Promise<{
  reviewUrl: string;
  shopUrl: string;
  order: {
    chainId: string;
    chainName: string;
    lines: { name: string; productName: string; productId: string; packs: number }[];
    skipped: { name: string }[];
  };
}> {
  return post('/grocery/handoff', input);
}

function isSocialVideoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    return (
      host === 'youtu.be' ||
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.watch' ||
      host === 'fb.com'
    );
  } catch {
    return false;
  }
}
