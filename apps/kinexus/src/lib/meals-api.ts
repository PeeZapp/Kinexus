import { Platform } from 'react-native';

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
};

export type ScrapeResponse =
  | { source: 'json-ld'; recipe: ImportedRecipe }
  | { source: 'text'; content: string }
  | { source: 'blocked'; blocked: true };

export type ImportSource = 'json-ld' | 'text-scraped' | 'blocked-ai' | 'text-paste';

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

export async function extractRecipeFromText(content: string): Promise<ImportedRecipe> {
  const data = await post<{ recipe: ImportedRecipe }>('/ai', { task: 'extract_recipe', content });
  return data.recipe;
}

export async function extractRecipeFromUrlHint(url: string): Promise<ImportedRecipe> {
  const data = await post<{ recipe: ImportedRecipe }>('/ai', { task: 'extract_recipe_from_url', url });
  return data.recipe;
}

export async function refreshRecipePrices(householdId?: string): Promise<{
  processed: number;
  remaining: number;
  failed: number;
  continued: boolean;
}> {
  return post('/prices/refresh', { householdId });
}

export async function importRecipeFromUrl(url: string): Promise<{ recipe: ImportedRecipe; source: ImportSource }> {
  const scraped = await scrapeRecipe(url);
  if (scraped.source === 'json-ld') return { recipe: scraped.recipe, source: 'json-ld' };
  if (scraped.source === 'text') {
    const recipe = await extractRecipeFromText(scraped.content);
    return { recipe, source: 'text-scraped' };
  }
  const recipe = await extractRecipeFromUrlHint(url);
  return { recipe, source: 'blocked-ai' };
}
