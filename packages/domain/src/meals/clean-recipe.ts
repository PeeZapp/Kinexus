/**
 * Clean-recipe import / cook-view contract.
 *
 * Spec only in this step: not wired to API routes or UI.
 * Persisted household/catalog rows remain {@link Recipe} in `./types`.
 * Save maps {@link CleanRecipe} → `Omit<Recipe, 'id' | 'householdId'>`.
 */

import { parseAmount } from './amounts';
import { classifyRecipeHost } from './recipe-url';
import type { Ingredient, MealSlotKey, Recipe } from './types';

/** How we classified the submitted URL before fetching. */
export type RecipeSourceKind = 'web' | 'youtube' | 'tiktok' | 'instagram' | 'facebook';

/** How the cook recipe was produced. Never `url_hint` (training-data reconstruction). */
export type RecipeExtractionMethod = 'json-ld' | 'microdata' | 'html-llm' | 'transcript-llm' | 'caption-llm';

export type RecipeImportErrorCode =
  | 'invalid_url'
  | 'unsupported_url'
  | 'not_a_recipe'
  | 'timeout'
  | 'blocked'
  | 'ssrf_blocked'
  | 'fetch_failed'
  | 'video_no_transcript'
  | 'extraction_failed'
  | 'rate_limited';

/**
 * User-facing buckets from the PRD. Map any {@link RecipeImportErrorCode} onto one of these
 * (plus a short hint). Instant fetch failures are unsupported, not timeouts.
 */
export type RecipeImportUserError = 'not_a_recipe' | 'unsupported_url' | 'timeout';

export const RECIPE_NOT_FOUND_MESSAGE = 'Recipe not found';

export const RECIPE_IMPORT_ERROR_TITLE: Record<RecipeImportUserError, string> = {
  not_a_recipe: 'Not a recipe',
  unsupported_url: 'That link isn’t supported yet',
  timeout: 'This is taking too long',
};

export const RECIPE_IMPORT_ERROR_BODY: Record<RecipeImportUserError, string> = {
  not_a_recipe: 'Try another link, or paste the ingredients and steps.',
  unsupported_url: 'Paste the recipe text, or try a recipe page or a public YouTube, TikTok, Instagram, or Facebook video.',
  timeout: 'Try again, or paste the recipe text.',
};

export const RECIPE_IMPORT_USER_ERROR_COPY: Record<RecipeImportUserError, string> = {
  not_a_recipe: RECIPE_NOT_FOUND_MESSAGE,
  unsupported_url: `${RECIPE_IMPORT_ERROR_TITLE.unsupported_url}. ${RECIPE_IMPORT_ERROR_BODY.unsupported_url}`,
  timeout: `${RECIPE_IMPORT_ERROR_TITLE.timeout}. ${RECIPE_IMPORT_ERROR_BODY.timeout}`,
};

export function userErrorFromCode(code?: RecipeImportErrorCode | string | null): RecipeImportUserError {
  switch (code) {
    case 'not_a_recipe':
    case 'extraction_failed':
      return 'not_a_recipe';
    case 'timeout':
      return 'timeout';
    case 'fetch_failed':
      return 'unsupported_url';
    default:
      return 'unsupported_url';
  }
}

export const RECIPE_IMPORT_PROGRESS_MESSAGES = [
  'Fetching…',
  'Reading the recipe…',
  'Summarizing with AI…',
  'Almost there…',
] as const;

export function rotatingProgressMessage(startedAtMs: number, nowMs = Date.now()): string {
  const elapsed = Math.max(0, nowMs - startedAtMs);
  const index = Math.floor(elapsed / 4000) % RECIPE_IMPORT_PROGRESS_MESSAGES.length;
  return RECIPE_IMPORT_PROGRESS_MESSAGES[index] ?? 'Fetching…';
}

/** Public job status for POST/GET /api/recipes. */
export type RecipeImportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** @deprecated Prefer {@link RecipeImportJobStatus}; phase copy lives on `phaseLabel`. */
export type RecipeImportPhase = RecipeImportJobStatus;

/** Original quantity as printed. `value` is null when the line is unquantified (“to taste”). */
export type RecipeQuantity = {
  value: number | null;
  unit?: string;
  /** Canonical display of the source text, e.g. `"1½ cups"` or `"salt"`. */
  raw: string;
};

export type CleanIngredient = {
  id: string;
  name: string;
  quantity?: RecipeQuantity;
  note?: string;
  optional?: boolean;
  /** Ingredient group heading, e.g. "Dressing". */
  group?: string;
};

export type CleanMethodBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'step'; text: string };

export type RecipeAttribution = {
  /** URL the user pasted (trimmed). Always present. */
  inputUrl: string;
  /** Canonical http(s) URL to open. Same as inputUrl when we cannot canonicalize. */
  sourceUrl: string;
  siteName?: string;
  authorName?: string;
  /** Host or channel shown in "From …". */
  displayName: string;
};

export type RecipeExtractionMeta = {
  method: RecipeExtractionMethod;
  sourceKind: RecipeSourceKind;
  /** `anthropic` | `deepseek` when an LLM was used; omit for pure JSON-LD. */
  provider?: string;
  jsonLdComplete?: boolean;
  /** 0–1. JSON-LD ~0.95, microdata ~0.85, LLM lower. */
  confidence: number;
  extractedAt: string;
};

/**
 * Cook-view recipe. Session serving scale and ingredient checks are UI state, not fields here.
 * Scale: `display = quantity.value * (viewServings / originalServings)` when both are finite and > 0.
 * If `originalServings` is missing, disable +/- and show amounts as `raw`.
 */
export type CleanRecipe = {
  title: string;
  attribution: RecipeAttribution;
  imageUrl?: string;
  /** Servings as published. Cook-view +/- starts here. */
  originalServings?: number;
  cookTimeMinutes?: number;
  ingredients: CleanIngredient[];
  method: CleanMethodBlock[];
  chefTip?: string;
  cuisine?: string;
  vegetarian?: boolean;
  /** Hint for save → household meal slots; default dinner. */
  mealSlots?: MealSlotKey[];
  extraction: RecipeExtractionMeta;
};

export type RecipeImportJob = {
  id: string;
  status: RecipeImportJobStatus;
  sourceKind?: RecipeSourceKind;
  inputUrl: string;
  canonicalUrl?: string;
  /** 0–100. Video jobs should move during caption + LLM phases, not sit at 0. */
  progress: number;
  phaseLabel: string;
  errorCode?: RecipeImportErrorCode;
  errorMessage?: string;
  recipe?: CleanRecipe;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp after which the client should treat the job as `timeout`. */
  expiresAt: string;
};

export const EXTRACTION_CONFIDENCE: Record<RecipeExtractionMethod, number> = {
  'json-ld': 0.95,
  microdata: 0.85,
  'html-llm': 0.65,
  'transcript-llm': 0.6,
  'caption-llm': 0.55,
};

export type CreateRecipeImportRequest = {
  url: string;
};

export type CreateRecipeImportResponse = {
  job: RecipeImportJob;
};

export type GetRecipeImportResponse = {
  job: RecipeImportJob;
};

/**
 * Fields required before we accept JSON-LD (or an LLM payload) as a cookable recipe.
 * Name + image alone is not enough.
 */
export function isCompleteCleanRecipe(
  recipe: Pick<CleanRecipe, 'title' | 'ingredients' | 'method'>,
): boolean {
  const hasStep = recipe.method.some((block) => block.type === 'step' && block.text.trim().length > 0);
  const hasIngredient = recipe.ingredients.some((line) => line.name.trim().length > 0);
  return recipe.title.trim().length > 0 && hasIngredient && hasStep;
}

/**
 * Flatten method blocks for today’s `Recipe.method: string[]`.
 * Headings are stored as `# Heading` so a later cook view can restore them without a migration.
 */
export function methodBlocksToStrings(method: CleanMethodBlock[]): string[] {
  return method
    .map((block) => {
      const text = block.text.trim();
      if (!text) return '';
      return block.type === 'heading' ? `# ${text}` : text;
    })
    .filter(Boolean);
}

export function cleanIngredientsToRecipeIngredients(ingredients: CleanIngredient[]): Ingredient[] {
  return ingredients.flatMap((line) => {
    const name = line.name.trim();
    if (!name) return [];
    const amount = line.quantity?.raw.trim();
    return [{ name, amount: amount || undefined }];
  });
}

/** Persist original servings/amounts, not the cook-session scaled values. */
export function cleanRecipeToHouseholdDraft(
  recipe: CleanRecipe,
): Omit<Recipe, 'id' | 'householdId'> {
  return {
    name: recipe.title.trim(),
    cuisine: recipe.cuisine,
    cookTime: recipe.cookTimeMinutes,
    servings: recipe.originalServings,
    vegetarian: recipe.vegetarian,
    ingredients: cleanIngredientsToRecipeIngredients(recipe.ingredients),
    method: methodBlocksToStrings(recipe.method),
    chefTip: recipe.chefTip,
    mealSlots: recipe.mealSlots?.length ? recipe.mealSlots : ['dinner'],
    sourceUrl: recipe.attribution.sourceUrl,
    imageUrl: recipe.imageUrl,
  };
}

const COMPACT_UNITS = new Set(['g', 'kg', 'ml', 'l', 'oz', 'lb']);

export function formatScaledNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 100) return String(Math.round(value));
  if (abs >= 10) {
    const tenths = Math.round(value * 10) / 10;
    return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
  }
  const hundredths = Math.round(value * 100) / 100;
  return String(parseFloat(hundredths.toFixed(2)));
}

/**
 * Cook-view quantity label. Scales `value` from `originalServings` → `viewServings`.
 * Unparseable amounts (`value` null) and missing original servings stay as `raw`.
 */
export function scaledQuantityLabel(
  quantity: RecipeQuantity | undefined,
  originalServings: number | undefined,
  viewServings: number,
): string {
  if (!quantity) return '';
  if (
    quantity.value == null ||
    originalServings == null ||
    originalServings <= 0 ||
    !Number.isFinite(viewServings) ||
    viewServings === originalServings
  ) {
    return quantity.raw;
  }
  const scaled = quantity.value * (viewServings / originalServings);
  const nice = formatScaledNumber(scaled);
  const unit = quantity.unit?.trim();
  if (!unit) return nice;
  return COMPACT_UNITS.has(unit.toLowerCase()) ? `${nice}${unit}` : `${nice} ${unit}`;
}

function hostFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return undefined;
  }
}

/** Restore a cook view from a saved household `Recipe` (`# ` method headings). */
export function householdRecipeToClean(recipe: Recipe): CleanRecipe {
  const sourceUrl = recipe.sourceUrl?.trim() || '';
  const host = hostFromUrl(sourceUrl);
  let sourceKind: RecipeSourceKind = 'web';
  if (host) {
    try {
      sourceKind = classifyRecipeHost(host);
    } catch {
      sourceKind = 'web';
    }
  }

  const ingredients: CleanIngredient[] = (recipe.ingredients ?? []).flatMap((line, index) => {
    const name = line.name.trim();
    if (!name) return [];
    const raw = line.amount?.trim();
    const parsed = raw ? parseAmount(raw) : null;
    return [
      {
        id: `ing-${index + 1}`,
        name,
        quantity: raw
          ? { value: parsed?.value ?? null, unit: parsed?.unit || undefined, raw }
          : undefined,
      },
    ];
  });

  const method: CleanMethodBlock[] = [];
  for (const [index, text] of (recipe.method ?? []).entries()) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('# ')) {
      const heading = trimmed.slice(2).trim();
      if (!heading) continue;
      method.push({ id: `h-${index + 1}`, type: 'heading', text: heading });
      continue;
    }
    method.push({ id: `s-${index + 1}`, type: 'step', text: trimmed });
  }

  return {
    title: recipe.name.trim() || 'Untitled recipe',
    attribution: {
      inputUrl: sourceUrl,
      sourceUrl,
      displayName: host || 'Saved recipe',
    },
    imageUrl: recipe.imageUrl,
    originalServings: recipe.servings,
    cookTimeMinutes: recipe.cookTime,
    ingredients,
    method,
    chefTip: recipe.chefTip,
    cuisine: recipe.cuisine,
    vegetarian: recipe.vegetarian,
    mealSlots: recipe.mealSlots,
    extraction: {
      method: 'json-ld',
      sourceKind,
      confidence: 1,
      extractedAt: new Date(0).toISOString(),
    },
  };
}
