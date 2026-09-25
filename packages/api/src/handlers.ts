import { budgetCategoryOptions, isWatchlistMediaType, normalizeCountryCode, type BudgetCategoryOption, type FinanceBudgetLineKind } from '@kinexus/domain';

import { extractRecipeFromText, extractRecipeFromUrlHint } from './ai/extract.js';
import { estimateRecipeNutritionWithAi } from './ai/nutrition.js';
import { classifyBudgetMerchantsWithAi, type BudgetClassifyMerchant } from './ai/classify-budget.js';
import { createAiClient } from './ai/provider.js';
import { scrapeLinkUrl } from './scrape/link.js';
import { scrapeProductUrl } from './scrape/product.js';
import { fetchReaderDocument } from './scrape/reader.js';
import { fetchArchiveFrameHtml } from './scrape/archive-frame.js';
import { lookupCollectible, parseCollectibleKind, searchCollectibles } from './scrape/collectibles.js';
import { scrapeRecipeSource } from './scrape/recipe-source.js';
import { lookupWatchlistTitle, resolveWatchlistUrl, searchWatchlistTitles } from './watchlist.js';
import type { RecipeDraft } from './recipe-draft.js';

export type AiTask = 'extract_recipe' | 'extract_recipe_from_url' | 'estimate_recipe_nutrition';

export type AiRequestBody = {
  task?: string;
  content?: string;
  url?: string;
  name?: string;
  servings?: number;
  ingredients?: { name?: string; amount?: string }[];
};

export type ScrapeRequestBody = {
  url?: string;
};

export async function handleScrape(body: ScrapeRequestBody) {
  const url = body.url?.trim() ?? '';
  if (!url) {
    return { status: 400 as const, body: { error: 'A valid http/https URL is required' } };
  }
  try {
    const result = await scrapeRecipeSource(url);
    return { status: 200 as const, body: result };
  } catch (err) {
    return scrapeError(err, 'Try pasting the recipe text instead.');
  }
}

export async function handleScrapeProduct(body: ScrapeRequestBody) {
  const url = body.url?.trim() ?? '';
  if (!url) {
    return { status: 400 as const, body: { error: 'A valid http/https URL is required' } };
  }
  try {
    const result = await scrapeProductUrl(url);
    return { status: 200 as const, body: result };
  } catch (err) {
    return scrapeError(err, 'You can still save the URL and fill in the details.');
  }
}

export async function handleScrapeLink(body: ScrapeRequestBody) {
  const url = body.url?.trim() ?? '';
  if (!url) {
    return { status: 400 as const, body: { error: 'A valid http/https URL is required' } };
  }
  try {
    const result = await scrapeLinkUrl(url);
    return { status: 200 as const, body: result };
  } catch (err) {
    return scrapeError(err, 'You can still save the URL and fill in the details.');
  }
}

export async function handleScrapeReader(body: ScrapeRequestBody) {
  const url = body.url?.trim() ?? '';
  if (!url) {
    return { status: 400 as const, body: { error: 'A valid http/https URL is required' } };
  }
  try {
    const document = await fetchReaderDocument(url);
    return { status: 200 as const, body: { document } };
  } catch (err) {
    return scrapeError(err, 'Try another URL, or open the original page instead.');
  }
}

export async function handleArchiveFrame(urlParam: string | null | undefined) {
  const url = urlParam?.trim() ?? '';
  if (!url) {
    return { status: 400 as const, body: 'A valid archive URL is required', contentType: 'text/plain; charset=utf-8' as const };
  }
  try {
    const { html } = await fetchArchiveFrameHtml(url);
    return { status: 200 as const, body: html, contentType: 'text/html; charset=utf-8' as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load archive page';
    const status =
      typeof (err as { status?: number }).status === 'number'
        ? (err as { status: number }).status
        : message.includes('not allowed') || message.includes('valid http')
          ? 400
          : 502;
    return {
      status: status as 400 | 401 | 422 | 502 | 504,
      body: `<!DOCTYPE html><html><body style="font:14px system-ui;padding:24px;color:#333"><p>${message.replace(/[<>&]/g, '')}</p></body></html>`,
      contentType: 'text/html; charset=utf-8' as const,
    };
  }
}

export async function handleAi(body: AiRequestBody): Promise<{
  status: number;
  body:
    | { recipe: RecipeDraft; provider: string }
    | { nutrition: { calories?: number; protein?: number; carbs?: number; fat?: number }; provider: string }
    | { error: string };
}> {
  const task = body.task;
  if (task !== 'extract_recipe' && task !== 'extract_recipe_from_url' && task !== 'estimate_recipe_nutrition') {
    return { status: 400, body: { error: 'task must be extract_recipe, extract_recipe_from_url, or estimate_recipe_nutrition' } };
  }

  try {
    const client = createAiClient();
    if (task === 'extract_recipe') {
      const content = body.content?.trim() ?? '';
      if (content.length < 20) return { status: 400, body: { error: 'Paste more of the recipe text' } };
      if (content.length > 20_000) return { status: 400, body: { error: 'Recipe text is too long' } };
      const recipe = await extractRecipeFromText(client, content);
      return { status: 200, body: { recipe, provider: client.provider } };
    }
    if (task === 'estimate_recipe_nutrition') {
      const ingredients = (body.ingredients ?? [])
        .map((item) => ({
          name: String(item?.name ?? '').trim(),
          amount: String(item?.amount ?? '').trim() || undefined,
        }))
        .filter((item) => item.name);
      if (ingredients.length === 0) return { status: 400, body: { error: 'Add at least one ingredient' } };
      const nutrition = await estimateRecipeNutritionWithAi(client, {
        name: body.name?.trim(),
        servings: body.servings,
        ingredients,
      });
      return { status: 200, body: { nutrition, provider: client.provider } };
    }
    const url = body.url?.trim() ?? '';
    if (!url) return { status: 400, body: { error: 'url is required' } };
    const recipe = await extractRecipeFromUrlHint(client, url);
    return { status: 200, body: { recipe, provider: client.provider } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    if (message.includes('is not set')) return { status: 503, body: { error: 'AI provider is not configured' } };
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
}

function scrapeError(err: unknown, fallbackHint: string): { status: number; body: { error: string } } {
  const message = err instanceof Error ? err.message : 'Could not reach that URL';
  const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
  if (message.includes('timeout') || message.includes('abort') || message.includes('Timeout')) {
    return { status: 504, body: { error: `The page took too long to load. ${fallbackHint}` } };
  }
  if (message.includes('not allowed') || message.includes('valid http')) {
    return { status: 400, body: { error: message } };
  }
  if (status === 422 || status === 400) return { status: status === 400 ? 400 : 422, body: { error: message } };
  return { status: 500, body: { error: `Could not reach that URL. ${fallbackHint}` } };
}

export async function handleCollectibleSearch(body: { kind?: unknown; query?: unknown; currency?: unknown }) {
  try {
    const kind = parseCollectibleKind(body.kind);
    const query = typeof body.query === 'string' ? body.query : '';
    const currency = typeof body.currency === 'string' ? body.currency : 'AUD';
    const results = await searchCollectibles(kind, query, currency);
    return { status: 200 as const, body: { results } };
  } catch (err) {
    return scrapeError(err, 'You can still save a name and value yourself.');
  }
}

export async function handleCollectibleLookup(body: {
  kind?: unknown;
  catalogId?: unknown;
  sourceUrl?: unknown;
  currency?: unknown;
}) {
  try {
    const kind = parseCollectibleKind(body.kind);
    const catalogId = typeof body.catalogId === 'string' ? body.catalogId : '';
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl : null;
    const currency = typeof body.currency === 'string' ? body.currency : 'AUD';
    const result = await lookupCollectible({ kind, catalogId, sourceUrl, currency });
    if (!result) return { status: 404 as const, body: { error: 'No catalog match for that item' } };
    return { status: 200 as const, body: { result } };
  } catch (err) {
    return scrapeError(err, 'You can still save a manual value.');
  }
}

const LINE_KINDS = new Set<FinanceBudgetLineKind>(['income', 'expense']);

export async function handleBudgetClassify(body: {
  merchants?: unknown;
  categories?: unknown;
}) {
  const merchants = parseClassifyMerchants(body.merchants);
  if (merchants.length === 0) return { status: 400 as const, body: { error: 'No merchants to classify' } };
  if (merchants.length > 40) return { status: 400 as const, body: { error: 'Too many merchants in one request' } };
  const categories = parseClassifyCategories(body.categories);
  try {
    const client = createAiClient();
    const assignments = await classifyBudgetMerchantsWithAi(client, merchants, categories);
    return { status: 200 as const, body: { assignments, provider: client.provider } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    if (message.includes('is not set')) return { status: 503 as const, body: { error: 'AI provider is not configured' } };
    return { status: 500 as const, body: { error: message.slice(0, 300) } };
  }
}

function parseClassifyMerchants(value: unknown): BudgetClassifyMerchant[] {
  if (!Array.isArray(value)) return [];
  const out: BudgetClassifyMerchant[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const merchantKey = String(rec.merchantKey ?? '').trim();
    const kindRaw = String(rec.kind ?? 'expense');
    const kind = LINE_KINDS.has(kindRaw as FinanceBudgetLineKind) ? (kindRaw as FinanceBudgetLineKind) : 'expense';
    if (!merchantKey) continue;
    const total = Number(rec.total);
    const count = Number(rec.count);
    out.push({
      merchantKey,
      sample: String(rec.sample ?? merchantKey).slice(0, 180),
      count: Number.isFinite(count) && count > 0 ? Math.min(999, Math.floor(count)) : 1,
      total: Number.isFinite(total) ? total : 0,
      kind,
    });
  }
  return out.slice(0, 40);
}

function parseClassifyCategories(value: unknown): BudgetCategoryOption[] {
  if (!Array.isArray(value)) return budgetCategoryOptions();
  const rows: BudgetCategoryOption[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? '').trim();
    const kindRaw = String(rec.kind ?? '');
    if (!name || !LINE_KINDS.has(kindRaw as FinanceBudgetLineKind)) continue;
    rows.push({ kind: kindRaw as FinanceBudgetLineKind, name: name.slice(0, 40) });
  }
  return budgetCategoryOptions(rows);
}

function tmdbError(err: unknown, fallback: string): { status: number; body: { error: string } } {
  const message = err instanceof Error ? err.message : fallback;
  const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
  if (message.includes('not configured') || message.includes('is not set')) {
    return { status: 503, body: { error: message } };
  }
  if (message.includes('rejected the API key')) return { status: 503, body: { error: message } };
  if (status === 400 || status === 404 || status === 422) return { status, body: { error: message } };
  if (message.includes('Type at least') || message.includes('too long') || message.includes('required')) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: message.slice(0, 300) } };
}

export async function handleWatchlistSearch(body: { query?: unknown; country?: unknown }) {
  try {
    const query = typeof body.query === 'string' ? body.query : '';
    const country = typeof body.country === 'string' ? body.country : 'AU';
    const results = await searchWatchlistTitles(query, country);
    return { status: 200 as const, body: { results } };
  } catch (err) {
    return tmdbError(err, 'Could not search titles');
  }
}

export async function handleWatchlistLookup(body: {
  tmdbId?: unknown;
  mediaType?: unknown;
  country?: unknown;
  sourceUrl?: unknown;
}) {
  try {
    const tmdbId = Number(body.tmdbId);
    const mediaType = typeof body.mediaType === 'string' ? body.mediaType : '';
    if (!isWatchlistMediaType(mediaType)) return { status: 400 as const, body: { error: 'mediaType must be movie or tv' } };
    const country = typeof body.country === 'string' ? body.country : 'AU';
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl : null;
    const title = await lookupWatchlistTitle({ tmdbId, mediaType, country, sourceUrl });
    return { status: 200 as const, body: { title } };
  } catch (err) {
    return tmdbError(err, 'Could not load that title');
  }
}

export async function handleWatchlistResolve(body: { url?: unknown; country?: unknown }) {
  try {
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return { status: 400 as const, body: { error: 'A URL is required' } };
    const country = typeof body.country === 'string' ? body.country : 'AU';
    const results = await resolveWatchlistUrl(url, normalizeCountryCode(country));
    return { status: 200 as const, body: { results } };
  } catch (err) {
    return tmdbError(err, 'Could not resolve that link');
  }
}
