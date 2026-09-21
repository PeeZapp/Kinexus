import { isCompleteCleanRecipe } from '@kinexus/domain';

import { decodeEntities } from '../scrape/index.js';
import {
  createIdFactory,
  ingredientFromLine,
  parseIsoDurationMinutes,
  servingsFromYield,
  type ExtractedRecipeCore,
} from './parse.js';

export function extractMicrodataRecipe(html: string): ExtractedRecipeCore | null {
  const chunks = html.split(/itemscope/i);
  for (const chunk of chunks) {
    if (!/itemtype=["'][^"']*recipe["']/i.test(chunk)) continue;
    const extracted = mapMicrodataChunk(chunk);
    if (extracted && isCompleteCleanRecipe(extracted)) return extracted;
  }
  return null;
}

function mapMicrodataChunk(chunk: string): ExtractedRecipeCore | null {
  const id = createIdFactory();
  const title = itemprop(chunk, 'name');
  if (!title) return null;

  const ingredients = allItemprop(chunk, 'recipeIngredient')
    .map((line) => ingredientFromLine(line, id('ing')))
    .filter((line): line is NonNullable<typeof line> => line != null);

  const instructionNodes = allItemprop(chunk, 'recipeInstructions');
  const method = instructionNodes.flatMap((text) =>
    text
      .split(/\n+/)
      .map((step) => step.trim())
      .filter(Boolean)
      .map((step) => ({ id: id('step'), type: 'step' as const, text: step })),
  );

  const howToSteps = allItemprop(chunk, 'text');
  if (method.length === 0 && howToSteps.length > 0) {
    for (const step of howToSteps) {
      method.push({ id: id('step'), type: 'step', text: step });
    }
  }

  return {
    title,
    ingredients,
    method,
    imageUrl: itemprop(chunk, 'image') ?? metaContent(chunk, 'image'),
    originalServings: servingsFromYield(itemprop(chunk, 'recipeYield')),
    cookTimeMinutes: parseIsoDurationMinutes(itemprop(chunk, 'cookTime') ?? itemprop(chunk, 'totalTime')),
    cuisine: itemprop(chunk, 'recipeCuisine'),
    authorName: itemprop(chunk, 'author'),
  };
}

function itemprop(html: string, name: string): string | undefined {
  return allItemprop(html, name)[0];
}

function allItemprop(html: string, name: string): string[] {
  const values: string[] = [];
  const attr = new RegExp(
    `<[^>]+itemprop=["']${name}["'][^>]*(?:content=["']([^"']+)["'][^>]*)?>([\\s\\S]*?)</[^>]+>`,
    'gi',
  );
  for (const match of html.matchAll(attr)) {
    const content = match[1]?.trim();
    const inner = stripTags(match[2] ?? '').trim();
    const value = decodeEntities(content || inner);
    if (value) values.push(value);
  }
  const meta = new RegExp(`<(?:meta|link)[^>]+itemprop=["']${name}["'][^>]*(?:content|href)=["']([^"']+)["'][^>]*>`, 'gi');
  for (const match of html.matchAll(meta)) {
    const value = decodeEntities((match[1] ?? '').trim());
    if (value) values.push(value);
  }
  return values;
}

function metaContent(html: string, name: string): string | undefined {
  return allItemprop(html, name)[0];
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}
