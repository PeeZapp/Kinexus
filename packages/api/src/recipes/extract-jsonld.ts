import { isCompleteCleanRecipe } from '@kinexus/domain';

import { decodeEntities } from '../scrape/index.js';
import {
  asText,
  createIdFactory,
  imageFromSchema,
  ingredientFromLine,
  parseIsoDurationMinutes,
  servingsFromYield,
  type ExtractedRecipeCore,
} from './parse.js';

export function extractJsonLdRecipe(
  html: string,
  options?: { complete?: boolean },
): ExtractedRecipeCore | null {
  const requireComplete = options?.complete !== false;
  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    const raw = (match[1] ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw) as unknown;
      const items = flattenLd(data);
      for (const item of items) {
        if (!isLdRecipe(item)) continue;
        const extracted = mapJsonLdRecipe(item);
        if (!extracted) continue;
        if (!requireComplete || isCompleteCleanRecipe(extracted)) return extracted;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function flattenLd(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap((item) => flattenLd(item));
  if (!data || typeof data !== 'object') return [];
  const rec = data as Record<string, unknown>;
  const graph = rec['@graph'];
  if (Array.isArray(graph)) return graph.flatMap((item) => flattenLd(item));
  return [rec];
}

function isLdRecipe(item: Record<string, unknown>): boolean {
  const type = item['@type'];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === 'string' && t.toLowerCase().includes('recipe'));
}

function mapJsonLdRecipe(ld: Record<string, unknown>): ExtractedRecipeCore | null {
  const id = createIdFactory();
  const title = asText(ld.name);
  if (!title) return null;

  const rawIngredients = Array.isArray(ld.recipeIngredient) ? ld.recipeIngredient : [];
  const ingredients = rawIngredients
    .map((line) => ingredientFromLine(decodeEntities(String(line)), id('ing')))
    .filter((line): line is NonNullable<typeof line> => line != null);

  const method = instructionsToBlocks(ld.recipeInstructions, id);
  const nutrition = (ld.nutrition as Record<string, unknown> | undefined) ?? {};
  void nutrition;

  return {
    title,
    ingredients,
    method,
    imageUrl: imageFromSchema(ld.image),
    originalServings: servingsFromYield(ld.recipeYield),
    cookTimeMinutes: parseIsoDurationMinutes(asText(ld.cookTime) ?? asText(ld.totalTime)),
    cuisine: asText(ld.recipeCuisine),
    vegetarian: String(ld.suitableForDiet ?? '')
      .toLowerCase()
      .includes('vegetarian'),
    authorName: asText((ld.author as { name?: unknown } | undefined)?.name) ?? asText(ld.author),
  };
}

function instructionsToBlocks(raw: unknown, id: (prefix: string) => string): ExtractedRecipeCore['method'] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return raw
      .split(/\n+/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ id: id('step'), type: 'step' as const, text: decodeEntities(text) }));
  }
  if (!Array.isArray(raw)) return [];

  const blocks: ExtractedRecipeCore['method'] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = decodeEntities(item.trim());
      if (text) blocks.push({ id: id('step'), type: 'step', text });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const type = String(rec['@type'] ?? '');
    if (type.toLowerCase().includes('howtosection')) {
      const heading = asText(rec.name);
      if (heading) blocks.push({ id: id('heading'), type: 'heading', text: decodeEntities(heading) });
      blocks.push(...instructionsToBlocks(rec.itemListElement ?? rec.steps, id));
      continue;
    }
    const text = asText(rec.text) ?? asText(rec.name);
    if (text) blocks.push({ id: id('step'), type: 'step', text: decodeEntities(text) });
  }
  return blocks;
}
