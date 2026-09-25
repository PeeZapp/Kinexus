import { normalizeRecipeDraft, type RecipeDraft } from '../recipe-draft.js';
import { fetchPublicHtmlDirect, fetchPublicHtmlHardened, type HardenedFetchOptions } from './hardened-fetch.js';

export { SsrfError, assertPublicHttpUrl, assertResolvedPublicHost, isPrivateHost, isPrivateIp } from './ssrf.js';
export type { HostnameLookup } from './ssrf.js';
export { scrapeTransportStatus } from './hardened-fetch.js';

export type ScrapeResult =
  | { source: 'json-ld'; recipe: RecipeDraft }
  | { source: 'text'; content: string }
  | { source: 'blocked'; blocked: true };

export type FetchPublicHtmlOptions = HardenedFetchOptions;

export async function fetchPublicHtml(url: string, options: FetchPublicHtmlOptions = {}): Promise<Response> {
  if (options.fetch) return fetchPublicHtmlDirect(url, options);
  return fetchPublicHtmlHardened(url, options);
}

export function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => fromCodePoint(Number(code)));
}

function fromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  return String.fromCodePoint(code);
}

export function stripHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  text = text.replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function extractJsonLdRecipe(html: string): Record<string, unknown> | null {
  const scriptMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    try {
      const data = JSON.parse((match[1] ?? '').trim()) as Record<string, unknown>;
      const items: unknown[] = Array.isArray(data) ? data : data['@graph'] ? (data['@graph'] as unknown[]) : [data];
      for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const obj = item as Record<string, unknown>;
        const type = obj['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t) => typeof t === 'string' && t.toLowerCase().includes('recipe'))) return obj;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function parseDuration(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const hours = Number(iso.match(/(\d+)H/i)?.[1] ?? '0');
  const minutes = Number(iso.match(/(\d+)M/i)?.[1] ?? '0');
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

function mapJsonLdToRecipe(ld: Record<string, unknown>): RecipeDraft {
  const rawIngredients = (ld.recipeIngredient as unknown[]) ?? [];
  const ingredients = rawIngredients.map((line) => {
    const text = String(line);
    const m = text.match(
      /^([\d\s½¼¾⅓⅔.,/]+(?:g|kg|ml|l|oz|lb|cup|cups|tbsp|tsp|tablespoon|teaspoon|piece|pieces|can|cans|clove|cloves|sprig|sprigs|bunch|slice|slices)?\.?)\s+(.+)$/i,
    );
    if (m?.[1] && m[2]) return { amount: m[1].trim(), name: m[2].trim() };
    return { name: text.trim() };
  });

  const rawInstructions = ld.recipeInstructions ?? [];
  let method: string[] = [];
  if (Array.isArray(rawInstructions)) {
    method = rawInstructions
      .map((step) => {
        if (typeof step === 'string') return step;
        if (step && typeof step === 'object') {
          const rec = step as Record<string, unknown>;
          return String(rec.text ?? rec.name ?? '');
        }
        return String(step);
      })
      .filter(Boolean);
  } else if (typeof rawInstructions === 'string') {
    method = rawInstructions.split('\n').filter(Boolean);
  }

  const nutrition = (ld.nutrition as Record<string, string> | undefined) ?? {};
  const image = (() => {
    const img = ld.image;
    if (!img) return undefined;
    if (typeof img === 'string') return img;
    if (Array.isArray(img)) {
      const first = img[0];
      return typeof first === 'string' ? first : first && typeof first === 'object' ? String((first as { url?: string }).url ?? '') : undefined;
    }
    if (typeof img === 'object') return String((img as { url?: string }).url ?? '') || undefined;
    return undefined;
  })();

  const yieldRaw = ld.recipeYield;
  const servingsSource = Array.isArray(yieldRaw) ? yieldRaw[0] : yieldRaw;

  return normalizeRecipeDraft({
    name: ld.name,
    cuisine: ld.recipeCuisine,
    cook_time: parseDuration(String(ld.cookTime ?? ld.totalTime ?? '')),
    servings: servingsSource,
    calories: nutrition.calories,
    protein: nutrition.proteinContent,
    carbs: nutrition.carbohydrateContent,
    fat: nutrition.fatContent,
    ingredients,
    method,
    vegetarian: String(ld.suitableForDiet ?? '').toLowerCase().includes('vegetarian'),
    image_url: image,
  });
}

export async function scrapeRecipeUrl(url: string, options: FetchPublicHtmlOptions = {}): Promise<ScrapeResult> {
  const response = await fetchPublicHtml(url, options);

  if ([401, 402, 403, 429].includes(response.status)) {
    return { blocked: true, source: 'blocked' };
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Could not fetch that URL (HTTP ${response.status})`), { status: 422 });
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    throw Object.assign(new Error('URL does not appear to be a webpage'), { status: 422 });
  }

  const html = (await response.text()).slice(0, 2_000_000);
  const jsonLd = extractJsonLdRecipe(html);
  if (jsonLd) return { recipe: mapJsonLdToRecipe(jsonLd), source: 'json-ld' };

  const text = stripHtml(html);
  const trimmed = text.length > 6000 ? `${text.slice(0, 6000)}\n[content truncated]` : text;
  return { content: trimmed, source: 'text' };
}
