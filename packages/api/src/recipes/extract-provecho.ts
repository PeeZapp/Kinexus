import type { CleanIngredient, CleanMethodBlock } from '@kinexus/domain';

import { createIdFactory, ingredientFromLine, type ExtractedRecipeCore } from './parse.js';

/** Key shipped in Provecho's public recipe page script. It only unwraps the JSON already in the HTML. */
const PROVECHO_KEY = 'lkdsoisadfgkljnsdfglaish';

export function extractProvechoRecipe(html: string): ExtractedRecipeCore | null {
  const encoded = encodedRecipeFromHtml(html);
  if (!encoded) return null;
  const recipe = decodeProvechoRecipe(encoded);
  if (!recipe) return null;
  return coreFromProvecho(recipe);
}

export function encodeProvechoRecipe(recipe: unknown): string {
  const json = JSON.stringify(recipe);
  let mixed = '';
  for (let i = 0; i < json.length; i += 1) {
    mixed += String.fromCharCode(json.charCodeAt(i) ^ PROVECHO_KEY.charCodeAt(i % PROVECHO_KEY.length));
  }
  return Buffer.from(mixed, 'latin1').toString('base64');
}

function encodedRecipeFromHtml(html: string): string | undefined {
  const marker = html.indexOf('encodedRecipe');
  if (marker < 0) return undefined;
  const slice = html.slice(Math.max(0, marker - 32), marker + 80_000);
  const match = slice.match(/"encodedRecipe"\s*:\s*"([^"]+)"/);
  return match?.[1];
}

function decodeProvechoRecipe(encoded: string): Record<string, unknown> | null {
  try {
    const raw = Buffer.from(encoded, 'base64').toString('latin1');
    let json = '';
    for (let i = 0; i < raw.length; i += 1) {
      json += String.fromCharCode(raw.charCodeAt(i) ^ PROVECHO_KEY.charCodeAt(i % PROVECHO_KEY.length));
    }
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function coreFromProvecho(recipe: Record<string, unknown>): ExtractedRecipeCore | null {
  const title = asString(recipe.name);
  if (!title) return null;
  const id = createIdFactory();
  const subs = Array.isArray(recipe.subRecipes) ? recipe.subRecipes : [];
  const namedSubs = subs.filter((sub) => asRecord(sub) && asString(asRecord(sub)?.tabname));
  const ingredients: CleanIngredient[] = [];
  const method: CleanMethodBlock[] = [];

  for (const sub of subs) {
    const rec = asRecord(sub);
    if (!rec) continue;
    const group = namedSubs.length > 1 ? groupName(asString(rec.tabname)) : undefined;
    const directions = Array.isArray(rec.directions) ? rec.directions : [];
    const listed = asRecords(rec.ingredients);
    const inline = directions.flatMap((direction) => asRecords(asRecord(direction)?.ingredients));
    for (const item of listed.length ? listed : inline) {
      const line = ingredientLine(item, id('ing'), group);
      if (line) ingredients.push(line);
    }
    for (const direction of directions) {
      const text = asString(asRecord(direction)?.text);
      if (!text) continue;
      const heading = text.length <= 80 && /:\s*$/.test(text);
      method.push({
        id: id(heading ? 'heading' : 'step'),
        type: heading ? 'heading' : 'step',
        text,
      });
    }
  }

  if (!ingredients.length || !method.some((block) => block.type === 'step')) return null;
  const images = Array.isArray(recipe.images) ? recipe.images : [];
  const imageUrl = asString(images[0]);
  return {
    title,
    ingredients,
    method,
    imageUrl,
    originalServings: servings(recipe.yieldAmount),
    cookTimeMinutes: secondsToMinutes(recipe.timeToCook),
    authorName: asString(recipe.authorUsername),
    siteName: 'Provecho',
  };
}

function ingredientLine(item: Record<string, unknown>, id: string, group?: string): CleanIngredient | null {
  const text = asString(item.text);
  if (!text || /:\s*$/.test(text) || /^for the\b/i.test(text)) return null;
  const qty = typeof item.qty === 'number' && item.qty > 0 ? String(item.qty) : '';
  const unit = asString(item.unit);
  const alreadyNumbered = Boolean(qty) && text.replace(/\s+/g, ' ').trim().startsWith(qty);
  const line = alreadyNumbered ? text : [qty, unit, text].filter(Boolean).join(' ');
  return ingredientFromLine(line, id, group);
}

function groupName(tabname: string | undefined): string | undefined {
  if (!tabname || /^subrecipe\b/i.test(tabname)) return undefined;
  return tabname;
}

function servings(value: unknown): number | undefined {
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return servings(rec.amount ?? rec.value ?? rec.servings);
  }
  const match = String(value ?? '').match(/\d+/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 && n < 100 ? n : undefined;
}

function secondsToMinutes(value: unknown): number | undefined {
  if (typeof value !== 'number' || value <= 0) return undefined;
  const minutes = Math.round(value / 60);
  return minutes > 0 ? minutes : undefined;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
