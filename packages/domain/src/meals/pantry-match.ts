import { ingredientCoveredByPantry, shoppingMergeKey } from './ingredient-merge';
import type { Recipe } from './types';

/** Everyday seasonings treated as already on hand so they don't block a match. */
const ASSUMED_KEYS = new Set([
  'salt',
  'pepper',
  'black pepper',
  'white pepper',
  'kosher salt',
  'water',
  'oil',
  'olive oil',
  'vegetable oil',
  'canola oil',
  'cooking oil',
  'butter',
  'cooking spray',
]);

const CLOSE_MAX_MISSING = 3;
const CLOSE_MIN_COVERAGE = 0.5;

export type PantryMatch = {
  recipe: Recipe;
  status: 'ready' | 'close';
  /** Non-staple ingredients the pantry covers. */
  covered: string[];
  /** Non-staple ingredients still needed. */
  missing: string[];
  requiredCount: number;
};

export function isAssumedPantryStaple(name: string): boolean {
  const key = shoppingMergeKey(name);
  return Boolean(key) && ASSUMED_KEYS.has(key);
}

/** Split a typed or pasted list into unique ingredient names. */
export function parsePantryIngredients(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,;\n]+/)) {
    const name = stripLeadingAmount(part);
    if (!name) continue;
    const key = shoppingMergeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Append names, keeping the first spelling of each ingredient. */
export function addPantryIngredients(existing: readonly string[], incoming: readonly string[]): string[] {
  return parsePantryIngredients([...existing, ...incoming].join('\n'));
}

/**
 * Recipes the pantry can make, then ones within a few ingredients.
 * Staples (salt, pepper, oil, butter, water) are ignored.
 * Link-only recipes and component bases are skipped.
 */
export function matchRecipesToPantry(recipes: readonly Recipe[], pantry: readonly string[]): PantryMatch[] {
  const pantryItems = pantry.map((name) => name.trim()).filter(Boolean);
  if (pantryItems.length === 0) return [];

  const matches: PantryMatch[] = [];
  for (const recipe of recipes) {
    if (recipe.removed || recipe.isComponent) continue;
    if (recipe.recipeClass && !(recipe.mealSlots ?? []).length) continue;
    const required = uniqueIngredientNames(
      (recipe.ingredients ?? []).map((item) => item.name).filter((name) => name.trim() && !isAssumedPantryStaple(name)),
    );
    if (required.length === 0) continue;

    const covered: string[] = [];
    const missing: string[] = [];
    for (const name of required) {
      if (pantryItems.some((item) => ingredientCoveredByPantry(item, name))) covered.push(name);
      else missing.push(name);
    }
    if (covered.length === 0) continue;

    const coverage = covered.length / required.length;
    const status = missing.length === 0 ? 'ready' : 'close';
    if (status === 'close' && (missing.length > CLOSE_MAX_MISSING || coverage < CLOSE_MIN_COVERAGE)) continue;

    matches.push({
      recipe,
      status,
      covered,
      missing,
      requiredCount: required.length,
    });
  }

  matches.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ready' ? -1 : 1;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    const aCoverage = a.covered.length / a.requiredCount;
    const bCoverage = b.covered.length / b.requiredCount;
    if (aCoverage !== bCoverage) return bCoverage - aCoverage;
    return a.recipe.name.localeCompare(b.recipe.name);
  });
  return matches;
}

function uniqueIngredientNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = shoppingMergeKey(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function stripLeadingAmount(raw: string): string {
  return raw
    .trim()
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+(?:[./]\d+)?(?:\s*(?:g|kg|ml|l|oz|lb|cup|cups|tbsp|tsp|clove|cloves))?\s+/i, '')
    .trim();
}
