import {
  EXTRACTION_CONFIDENCE,
  isCompleteCleanRecipe,
  type CleanIngredient,
  type CleanMethodBlock,
  type CleanRecipe,
  type RecipeExtractionMethod,
  type RecipeSourceKind,
} from '@kinexus/domain';
import type { AiClient } from '../ai/provider.js';
import { createAiClient } from '../ai/provider.js';
import { parseJsonObject } from '../recipe-draft.js';
import { createIdFactory, ingredientFromLine, type ExtractedRecipeCore } from './parse.js';

const CLEAN_RECIPE_PROMPT = `You extract cookable recipes from source text. Return ONLY JSON.

If the text is a real recipe (ingredients + steps), return:
{
  "ok": true,
  "title": "string",
  "servings": 4,
  "cookTimeMinutes": 30,
  "cuisine": "string or omit",
  "vegetarian": false,
  "chefTip": "string or omit",
  "ingredients": [{ "name": "flour", "amount": "1 cup", "optional": false, "group": "optional heading" }],
  "method": [{ "type": "heading" | "step", "text": "..." }]
}

If it is NOT a recipe (music video, vlog, news, product, lifestyle fluff without a method), return:
{ "ok": false, "reason": "not_a_recipe" }

Rules:
- Use only facts present in the text. Do not invent a dish from a URL or title alone.
- Extract the PRIMARY recipe for this page (match "Page title" / "Primary recipe name" when present). Ignore related recipes, roundups, comments, and recirc modules.
- Strip memoir, ads, and affiliate fluff. Ingredients + cookable steps only.
- method must include at least one { "type": "step" }.
- If servings or cook time are not stated, omit those fields. Do not guess.
- No markdown.`;

const VIDEO_RECIPE_PROMPT = `You extract a cookable recipe from video metadata (title, description, captions). Return ONLY JSON.

If the text is a real recipe (ingredients + steps you can cook from), return:
{
  "ok": true,
  "title": "string",
  "servings": 4,
  "cookTimeMinutes": 30,
  "ingredients": [{ "name": "chicken thighs", "amount": "4" }],
  "method": [{ "type": "step", "text": "Season the thighs with paprika and salt." }]
}

If it is NOT a recipe (music, vlog, product haul, no ingredients AND no method), return:
{ "ok": false, "reason": "not_a_recipe" }

Rules:
- Use only facts in the description, captions, and comments. Do not invent ingredients, quantities, or steps.
- Facebook/TikTok often put the recipe in comments or a linked page. Use those comments when present.
- Ignore "recipe in the comments below" teasers and other videos unless the comments themselves include ingredients or steps.
- Include quantities on ingredients only when the source states them.
- If servings or time are not stated, omit those fields (do not guess).
- method steps must be short numbered cook-view instructions (one action each).
- Title from the video title if it names the dish.
- No markdown.`;

export type StructureResult =
  | { ok: true; core: ExtractedRecipeCore; provider: string }
  | { ok: false; reason: 'not_a_recipe' | 'extraction_failed'; provider?: string };

/** DeepSeek first when DEEPSEEK_API_KEY is set; Claude fallback when ANTHROPIC_API_KEY is set. Never log keys. */
export function importLlmClients(): { structure: AiClient; fallback: AiClient | null } {
  const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const structure = hasDeepseek ? createAiClient('deepseek') : createAiClient();
  const fallback =
    hasAnthropic && structure.provider !== 'anthropic'
      ? createAiClient('anthropic')
      : hasDeepseek && structure.provider !== 'deepseek'
        ? createAiClient('deepseek')
        : null;
  return { structure, fallback };
}

export async function structureRecipeFromText(
  content: string,
  clients: { structure: AiClient; fallback: AiClient | null } = importLlmClients(),
  kind: 'web' | 'video' = 'web',
): Promise<StructureResult> {
  const trimmed = content.trim().slice(0, 100_000);
  if (trimmed.length < 20) return { ok: false, reason: 'not_a_recipe' };

  const first = await tryClient(clients.structure, trimmed, kind);
  if (first.ok) return first;
  if (clients.fallback) {
    const second = await tryClient(clients.fallback, trimmed, kind);
    if (second.ok) return second;
    return second;
  }
  return first;
}

async function tryClient(client: AiClient, content: string, kind: 'web' | 'video'): Promise<StructureResult> {
  try {
    const prompt = kind === 'video' ? VIDEO_RECIPE_PROMPT : CLEAN_RECIPE_PROMPT;
    const text = await client.complete({
      json: true,
      prompt: `${prompt}\n\nSource text:\n${content}`,
    });
    const parsed = parseJsonObject(text);
    if (parsed.ok === false || parsed.reason === 'not_a_recipe') {
      return { ok: false, reason: 'not_a_recipe', provider: client.provider };
    }
    const core = coreFromLlm(parsed);
    if (!core || !isCompleteCleanRecipe(core)) {
      return { ok: false, reason: 'not_a_recipe', provider: client.provider };
    }
    return { ok: true, core, provider: client.provider };
  } catch {
    return { ok: false, reason: 'extraction_failed', provider: client.provider };
  }
}

function coreFromLlm(raw: Record<string, unknown>): ExtractedRecipeCore | null {
  const id = createIdFactory();
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const ingredients: CleanIngredient[] = [];
  if (Array.isArray(raw.ingredients)) {
    for (const item of raw.ingredients) {
      if (typeof item === 'string') {
        const line = ingredientFromLine(item, id('ing'));
        if (line) ingredients.push(line);
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const name = typeof rec.name === 'string' ? rec.name.trim() : '';
      if (!name) continue;
      const amount = typeof rec.amount === 'string' ? rec.amount.trim() : '';
      const line = ingredientFromLine(amount ? `${amount} ${name}` : name, id('ing'));
      if (!line) continue;
      if (typeof rec.group === 'string' && rec.group.trim()) line.group = rec.group.trim();
      if (rec.optional === true) line.optional = true;
      ingredients.push(line);
    }
  }

  const method: CleanMethodBlock[] = [];
  if (Array.isArray(raw.method)) {
    for (const item of raw.method) {
      if (typeof item === 'string') {
        const text = item.trim();
        if (text) method.push({ id: id('step'), type: 'step', text });
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const text = typeof rec.text === 'string' ? rec.text.trim() : '';
      if (!text) continue;
      method.push({
        id: id(rec.type === 'heading' ? 'heading' : 'step'),
        type: rec.type === 'heading' ? 'heading' : 'step',
        text,
      });
    }
  }

  const servings = typeof raw.servings === 'number' ? raw.servings : Number(raw.servings);
  const cook = typeof raw.cookTimeMinutes === 'number' ? raw.cookTimeMinutes : Number(raw.cookTimeMinutes);

  return {
    title,
    ingredients,
    method,
    originalServings: Number.isFinite(servings) && servings > 0 ? servings : undefined,
    cookTimeMinutes: Number.isFinite(cook) && cook > 0 ? cook : undefined,
    cuisine: typeof raw.cuisine === 'string' ? raw.cuisine : undefined,
    vegetarian: raw.vegetarian === true,
    chefTip: typeof raw.chefTip === 'string' ? raw.chefTip : undefined,
  };
}

export function wrapCleanRecipe(
  core: ExtractedRecipeCore,
  input: {
    inputUrl: string;
    canonicalUrl: string;
    displayHost: string;
    sourceKind: RecipeSourceKind;
    method: RecipeExtractionMethod;
    provider?: string;
    extractedAt?: string;
  },
): CleanRecipe {
  return {
    title: core.title,
    attribution: {
      inputUrl: input.inputUrl,
      sourceUrl: input.canonicalUrl,
      siteName: core.siteName,
      authorName: core.authorName,
      displayName: core.siteName ?? core.authorName ?? input.displayHost,
    },
    imageUrl: core.imageUrl,
    originalServings: core.originalServings,
    cookTimeMinutes: core.cookTimeMinutes,
    ingredients: core.ingredients,
    method: core.method,
    chefTip: core.chefTip,
    cuisine: core.cuisine,
    vegetarian: core.vegetarian,
    mealSlots: ['dinner'],
    extraction: {
      method: input.method,
      sourceKind: input.sourceKind,
      provider: input.provider,
      jsonLdComplete: input.method === 'json-ld',
      confidence: EXTRACTION_CONFIDENCE[input.method],
      extractedAt: input.extractedAt ?? new Date().toISOString(),
    },
  };
}
