import { budgetCategoryOptions, isWatchlistMediaType, isWatchlistScore, normalizeCountryCode, normalizeStreamingProviderIds, type BudgetCategoryOption, type FinanceBudgetLineKind, type WatchlistMediaType, type WatchlistRecommendSeed } from '@kinexus/domain';

import {
  extractRecipeFromPhoto,
  extractRecipeFromText,
  extractRecipeFromUrlHint,
  generateRecipeFromName,
} from './ai/extract.js';
import { estimateRecipeNutritionWithAi } from './ai/nutrition.js';
import { classifyBudgetMerchantsWithAi, type BudgetClassifyMerchant } from './ai/classify-budget.js';
import { readBankScreenshotsWithAi } from './ai/read-bank-screenshots.js';
import type { AiImageInput } from './ai/provider.js';
import {
  AiBlockedError,
  aiBlockedHttp,
  resolveAiClient,
  resolveVisionAiClient,
  type AiFeature,
} from './ai/resolve.js';
import { scrubErrorMessage } from './ai/scrub.js';
import { fetchImageFile } from './recipes/source-image.js';
import { scrapeLinkUrl } from './scrape/link.js';
import { scrapeProductUrl } from './scrape/product.js';
import { fetchReaderDocument } from './scrape/reader.js';
import { fetchArchiveFrameHtml } from './scrape/archive-frame.js';
import { lookupCollectible, parseCollectibleKind, searchCollectibles } from './scrape/collectibles.js';
import { scrapeRecipeSource } from './scrape/recipe-source.js';
import {
  discoverWatchlistTitles,
  listStreamingServices,
  lookupWatchlistTitle,
  matchWatchlistImportRows,
  recommendWatchlistTitles,
  resolveWatchlistUrl,
  searchWatchlistPeople,
  searchWatchlistTitles,
  WATCHLIST_IMPORT_MATCH_BATCH_CAP,
  watchlistPersonMovies,
  watchlistTitleCast,
  type WatchlistImportMatchRow,
} from './watchlist.js';
import { assertWatchlistImportMatchRateLimit } from './watchlist-import-rate-limit.js';
import { loadWatchlistWatchingContext, parsePersonIds } from './watchlist-watching.js';
import type { RecipeDraft } from './recipe-draft.js';

export type AiTask =
  | 'extract_recipe'
  | 'extract_recipe_from_url'
  | 'extract_recipe_from_photo'
  | 'generate_recipe_from_name'
  | 'estimate_recipe_nutrition';

export type AiRequestBody = {
  task?: string;
  content?: string;
  url?: string;
  /** Public https image URL for photo extract (preferred). */
  imageUrl?: string;
  name?: string;
  servings?: number;
  ingredients?: { name?: string; amount?: string }[];
  householdId?: string;
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

export async function handleAi(
  userId: string,
  body: AiRequestBody,
): Promise<{
  status: number;
  body:
    | { recipe: RecipeDraft; provider: string; resultsMayVary?: boolean }
    | {
        nutrition: { calories?: number; protein?: number; carbs?: number; fat?: number };
        provider: string;
        resultsMayVary?: boolean;
      }
    | { error: string; code?: string };
}> {
  const task = body.task;
  if (
    task !== 'extract_recipe' &&
    task !== 'extract_recipe_from_url' &&
    task !== 'extract_recipe_from_photo' &&
    task !== 'generate_recipe_from_name' &&
    task !== 'estimate_recipe_nutrition'
  ) {
    return {
      status: 400,
      body: {
        error:
          'task must be extract_recipe, extract_recipe_from_url, extract_recipe_from_photo, generate_recipe_from_name, or estimate_recipe_nutrition',
      },
    };
  }

  const householdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
  if (!householdId) return { status: 400, body: { error: 'householdId is required' } };

  try {
    const feature = task as AiFeature;
    if (task === 'extract_recipe_from_photo') {
      const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
      if (!imageUrl) return { status: 400, body: { error: 'Upload a recipe photo first' } };
      if (!/^https:\/\//i.test(imageUrl)) {
        return { status: 400, body: { error: 'Photo URL must be https' } };
      }
      const file = await fetchImageFile(imageUrl);
      if (!file) return { status: 400, body: { error: 'Could not read that photo. Try a clearer JPEG, PNG, or WebP.' } };
      const mime = file.mime as AiImageInput['mime'];
      if (mime !== 'image/jpeg' && mime !== 'image/png' && mime !== 'image/webp') {
        return { status: 400, body: { error: 'Use a JPEG, PNG, or WebP photo' } };
      }
      const resolved = await resolveVisionAiClient({ userId, householdId, feature });
      const image: AiImageInput = {
        mime,
        base64: Buffer.from(file.bytes).toString('base64'),
      };
      const result = await extractRecipeFromPhoto(resolved, [image]);
      const recipe = {
        ...result.value,
        imageUrl: result.value.imageUrl || imageUrl,
        imageCandidates: result.value.imageCandidates?.length
          ? result.value.imageCandidates
          : [imageUrl],
      };
      return {
        status: 200,
        body: {
          recipe,
          provider: result.provider,
          ...(result.resultsMayVary ? { resultsMayVary: true } : {}),
        },
      };
    }
    const resolved = await resolveAiClient({ userId, householdId, feature });
    if (task === 'extract_recipe') {
      const content = body.content?.trim() ?? '';
      if (content.length < 20) return { status: 400, body: { error: 'Paste more of the recipe text' } };
      if (content.length > 20_000) return { status: 400, body: { error: 'Recipe text is too long' } };
      const result = await extractRecipeFromText(resolved, content);
      return {
        status: 200,
        body: {
          recipe: result.value,
          provider: result.provider,
          ...(result.resultsMayVary ? { resultsMayVary: true } : {}),
        },
      };
    }
    if (task === 'generate_recipe_from_name') {
      const name = body.name?.trim() ?? '';
      if (name.length < 2) return { status: 400, body: { error: 'Enter the dish name' } };
      if (name.length > 80) return { status: 400, body: { error: 'That dish name is too long' } };
      const result = await generateRecipeFromName(resolved, name);
      return {
        status: 200,
        body: {
          recipe: result.value,
          provider: result.provider,
          ...(result.resultsMayVary ? { resultsMayVary: true } : {}),
        },
      };
    }
    if (task === 'estimate_recipe_nutrition') {
      const ingredients = (body.ingredients ?? [])
        .map((item) => ({
          name: String(item?.name ?? '').trim(),
          amount: String(item?.amount ?? '').trim() || undefined,
        }))
        .filter((item) => item.name);
      if (ingredients.length === 0) return { status: 400, body: { error: 'Add at least one ingredient' } };
      const result = await estimateRecipeNutritionWithAi(resolved, {
        name: body.name?.trim(),
        servings: body.servings,
        ingredients,
      });
      return {
        status: 200,
        body: {
          nutrition: result.value,
          provider: result.provider,
          ...(result.resultsMayVary ? { resultsMayVary: true } : {}),
        },
      };
    }
    const url = body.url?.trim() ?? '';
    if (!url) return { status: 400, body: { error: 'url is required' } };
    if (isSocialVideoUrl(url)) {
      return {
        status: 422,
        body: { error: 'That video doesn’t include a recipe we can read. Paste the recipe text instead.' },
      };
    }
    const result = await extractRecipeFromUrlHint(resolved, url);
    return {
      status: 200,
      body: {
        recipe: result.value,
        provider: result.provider,
        ...(result.resultsMayVary ? { resultsMayVary: true } : {}),
      },
    };
  } catch (err) {
    if (err instanceof AiBlockedError) return aiBlockedHttp(err);
    const message = scrubErrorMessage(err);
    if (message.includes('is not set')) return { status: 503, body: { error: 'AI provider is not configured' } };
    if (message.includes('Not a member')) return { status: 403, body: { error: message } };
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
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

export async function handleBudgetClassify(
  userId: string,
  body: {
    merchants?: unknown;
    categories?: unknown;
    householdId?: unknown;
  },
) {
  const merchants = parseClassifyMerchants(body.merchants);
  if (merchants.length === 0) return { status: 400 as const, body: { error: 'No merchants to classify' } };
  if (merchants.length > 40) return { status: 400 as const, body: { error: 'Too many merchants in one request' } };
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
  if (!householdId) return { status: 400 as const, body: { error: 'householdId is required' } };
  const categories = parseClassifyCategories(body.categories);
  try {
    const resolved = await resolveAiClient({ userId, householdId, feature: 'classify_budget' });
    const result = await classifyBudgetMerchantsWithAi(resolved, merchants, categories);
    return {
      status: 200 as const,
      body: {
        assignments: result.value,
        provider: result.provider,
        ...(result.resultsMayVary ? { resultsMayVary: true } : {}),
      },
    };
  } catch (err) {
    if (err instanceof AiBlockedError) return aiBlockedHttp(err);
    const message = scrubErrorMessage(err);
    if (message.includes('is not set')) return { status: 503 as const, body: { error: 'AI provider is not configured' } };
    if (message.includes('Not a member')) return { status: 403 as const, body: { error: message } };
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

const MAX_SCREENSHOTS = 6;
const MAX_SCREENSHOT_BODY_CHARS = 5_500_000;

function parseScreenshotImages(value: unknown): AiImageInput[] {
  if (!Array.isArray(value)) return [];
  const out: AiImageInput[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const mimeRaw = String(rec.mime ?? rec.contentType ?? 'image/jpeg').toLowerCase();
    const mime =
      mimeRaw === 'image/png' || mimeRaw === 'image/webp' || mimeRaw === 'image/jpeg'
        ? (mimeRaw as AiImageInput['mime'])
        : null;
    const base64 = String(rec.base64 ?? '').replace(/^data:[^;]+;base64,/, '').trim();
    if (!mime || !base64) continue;
    out.push({ mime, base64 });
    if (out.length >= MAX_SCREENSHOTS) break;
  }
  return out;
}

export async function handleBudgetTransactionsRead(
  userId: string,
  body: {
    householdId?: unknown;
    localDate?: unknown;
    images?: unknown;
  },
) {
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
  if (!householdId) return { status: 400 as const, body: { error: 'householdId is required' } };
  const localDate =
    typeof body.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate.trim())
      ? body.localDate.trim()
      : new Date().toISOString().slice(0, 10);
  const images = parseScreenshotImages(body.images);
  if (images.length === 0) return { status: 400 as const, body: { error: 'Add at least one screenshot' } };
  if (images.length > MAX_SCREENSHOTS) {
    return { status: 400 as const, body: { error: 'Up to 6 screenshots at a time' } };
  }
  const bodyChars = images.reduce((sum, image) => sum + image.base64.length, 0);
  if (bodyChars > MAX_SCREENSHOT_BODY_CHARS) {
    return { status: 400 as const, body: { error: 'Screenshots are too large. Try fewer or smaller images.' } };
  }
  try {
    const resolved = await resolveVisionAiClient({
      userId,
      householdId,
      feature: 'read_bank_screenshots',
    });
    const result = await readBankScreenshotsWithAi(resolved, images, localDate);
    return {
      status: 200 as const,
      body: {
        transactions: result.value.transactions,
        skipped: result.value.skipped,
        provider: result.provider,
        ...(result.resultsMayVary ? { resultsMayVary: true } : {}),
      },
    };
  } catch (err) {
    if (err instanceof AiBlockedError) return aiBlockedHttp(err);
    const message = scrubErrorMessage(err);
    if (message.includes('is not set')) return { status: 503 as const, body: { error: 'AI provider is not configured' } };
    if (message.includes('Not a member')) return { status: 403 as const, body: { error: message } };
    return { status: 500 as const, body: { error: message.slice(0, 300) } };
  }
}

function tmdbError(err: unknown, fallback: string): { status: number; body: { error: string; errorCode?: string } } {
  const message = err instanceof Error ? err.message : fallback;
  const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
  const code = typeof (err as { code?: unknown }).code === 'string' ? (err as { code: string }).code : undefined;
  if (code === 'rate_limited' || status === 429) {
    return { status: 429, body: { error: message, errorCode: 'rate_limited' } };
  }
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

function parseRecommendSeeds(value: unknown): WatchlistRecommendSeed[] {
  if (!Array.isArray(value)) return [];
  const seeds: WatchlistRecommendSeed[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { tmdbId?: unknown; mediaType?: unknown; title?: unknown; userScore?: unknown };
    const tmdbId = Number(record.tmdbId);
    const mediaType = typeof record.mediaType === 'string' ? record.mediaType : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    if (!isWatchlistMediaType(mediaType) || !Number.isInteger(tmdbId) || tmdbId <= 0 || !title) continue;
    const userScore = record.userScore == null ? null : Number(record.userScore);
    if (userScore != null && !isWatchlistScore(userScore)) continue;
    seeds.push({ tmdbId, mediaType, title: title.slice(0, 200), userScore });
    if (seeds.length >= 8) break;
  }
  return seeds;
}

function parseExclude(value: unknown): { tmdbId: number; mediaType: WatchlistMediaType }[] {
  if (!Array.isArray(value)) return [];
  const rows: { tmdbId: number; mediaType: WatchlistMediaType }[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { tmdbId?: unknown; mediaType?: unknown };
    const tmdbId = Number(record.tmdbId);
    const mediaType = typeof record.mediaType === 'string' ? record.mediaType : '';
    if (!isWatchlistMediaType(mediaType) || !Number.isInteger(tmdbId) || tmdbId <= 0) continue;
    rows.push({ tmdbId, mediaType });
    if (rows.length >= 300) break;
  }
  return rows;
}

function parseProviderIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return normalizeStreamingProviderIds(value);
}

export async function handleWatchlistServices(body: { country?: unknown }) {
  try {
    const country = normalizeCountryCode(typeof body.country === 'string' ? body.country : 'AU');
    const services = await listStreamingServices(country);
    return { status: 200 as const, body: { services } };
  } catch (err) {
    return tmdbError(err, 'Could not load streaming services');
  }
}

export async function handleWatchlistRecommend(
  body: {
    seeds?: unknown;
    exclude?: unknown;
    country?: unknown;
    providerIds?: unknown;
    personIds?: unknown;
  },
  request?: Request,
) {
  try {
    const personIds = parsePersonIds(body.personIds);
    let watching = null;
    if (personIds.length > 0) {
      if (!request) return { status: 401 as const, body: { error: 'Sign in required' } };
      const loaded = await loadWatchlistWatchingContext(request, personIds);
      if ('error' in loaded) return { status: loaded.status, body: { error: loaded.error } };
      watching = loaded;
    }
    const seeds = parseRecommendSeeds(body.seeds);
    if (seeds.length === 0 && !(watching && watching.taste.likedTitles.length > 0)) {
      return { status: 400 as const, body: { error: 'Rate a few titles you liked first' } };
    }
    const result = await recommendWatchlistTitles({
      seeds,
      exclude: parseExclude(body.exclude),
      country: typeof body.country === 'string' ? body.country : 'AU',
      providerIds: parseProviderIds(body.providerIds),
      watching,
    });
    return { status: 200 as const, body: result };
  } catch (err) {
    return tmdbError(err, 'Could not build recommendations');
  }
}

export async function handleWatchlistDiscover(
  body: {
    mediaType?: unknown;
    genreId?: unknown;
    mode?: unknown;
    country?: unknown;
    providerIds?: unknown;
    personIds?: unknown;
  },
  request?: Request,
) {
  try {
    const mediaType = typeof body.mediaType === 'string' ? body.mediaType : '';
    if (!isWatchlistMediaType(mediaType)) return { status: 400 as const, body: { error: 'mediaType must be movie or tv' } };
    const mode = body.mode === 'surprise' ? 'surprise' : 'browse';
    const genreId = body.genreId == null || body.genreId === '' ? null : Number(body.genreId);
    if (genreId != null && !Number.isInteger(genreId)) {
      return { status: 400 as const, body: { error: 'genreId must be a number' } };
    }
    const personIds = parsePersonIds(body.personIds);
    let watching = null;
    if (personIds.length > 0) {
      if (!request) return { status: 401 as const, body: { error: 'Sign in required' } };
      const loaded = await loadWatchlistWatchingContext(request, personIds);
      if ('error' in loaded) return { status: loaded.status, body: { error: loaded.error } };
      watching = loaded;
    }
    const results = await discoverWatchlistTitles({
      mediaType,
      genreId,
      mode,
      country: typeof body.country === 'string' ? body.country : 'AU',
      providerIds: parseProviderIds(body.providerIds),
      watching,
    });
    return { status: 200 as const, body: { results } };
  } catch (err) {
    return tmdbError(err, 'Could not load titles');
  }
}

export async function handleWatchlistPeople(body: { query?: unknown }) {
  try {
    const query = typeof body.query === 'string' ? body.query : '';
    const people = await searchWatchlistPeople(query);
    return { status: 200 as const, body: { people } };
  } catch (err) {
    return tmdbError(err, 'Could not search people');
  }
}

export async function handleWatchlistCast(body: { tmdbId?: unknown; mediaType?: unknown }) {
  try {
    const tmdbId = Number(body.tmdbId);
    const mediaType = typeof body.mediaType === 'string' ? body.mediaType : '';
    if (!isWatchlistMediaType(mediaType)) return { status: 400 as const, body: { error: 'mediaType must be movie or tv' } };
    const cast = await watchlistTitleCast({ tmdbId, mediaType });
    return { status: 200 as const, body: { cast } };
  } catch (err) {
    return tmdbError(err, 'Could not load the cast');
  }
}

export async function handleWatchlistPersonMovies(body: { personId?: unknown }) {
  try {
    const personId = Number(body.personId);
    const filmography = await watchlistPersonMovies(personId);
    return { status: 200 as const, body: filmography };
  } catch (err) {
    return tmdbError(err, 'Could not load that filmography');
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

function parseImportMatchRows(value: unknown): WatchlistImportMatchRow[] {
  if (!Array.isArray(value)) return [];
  const rows: WatchlistImportMatchRow[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { key?: unknown; imdbId?: unknown; title?: unknown; year?: unknown };
    const key = typeof record.key === 'string' ? record.key : '';
    if (!key) continue;
    const yearRaw = record.year;
    const year =
      yearRaw == null || yearRaw === ''
        ? null
        : Number.isFinite(Number(yearRaw))
          ? Math.trunc(Number(yearRaw))
          : null;
    rows.push({
      key: key.slice(0, 64),
      imdbId: typeof record.imdbId === 'string' ? record.imdbId : null,
      title: typeof record.title === 'string' ? record.title.slice(0, 200) : null,
      year,
    });
    if (rows.length >= WATCHLIST_IMPORT_MATCH_BATCH_CAP) break;
  }
  return rows;
}

export async function handleWatchlistImportMatch(
  userId: string,
  body: { rows?: unknown; country?: unknown },
) {
  try {
    assertWatchlistImportMatchRateLimit(userId);
    const rows = parseImportMatchRows(body.rows);
    if (rows.length === 0) return { status: 400 as const, body: { error: 'At least one row is required' } };
    if (Array.isArray(body.rows) && body.rows.length > WATCHLIST_IMPORT_MATCH_BATCH_CAP) {
      return {
        status: 400 as const,
        body: { error: `Match at most ${WATCHLIST_IMPORT_MATCH_BATCH_CAP} rows per request` },
      };
    }
    const results = await matchWatchlistImportRows({
      rows,
      country: typeof body.country === 'string' ? body.country : 'AU',
    });
    return { status: 200 as const, body: { results } };
  } catch (err) {
    return tmdbError(err, 'Could not match titles');
  }
}
