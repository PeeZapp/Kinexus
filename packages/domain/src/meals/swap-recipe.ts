import { nutritionFitScore, recipeProteinKind, type RecipeProteinKind } from './generate-plan';
import type { Recipe } from './types';

/** Default ± band for calorie and protein when suggesting a swap. */
export const NUTRITION_SWAP_BAND = 0.2;

export type SwapRecipeFilters = {
  query?: string;
  vegetarian?: boolean;
  proteinKind?: RecipeProteinKind | null;
};

export type NutritionReference = {
  calories?: number | null;
  protein?: number | null;
};

export function nutritionWithinBand(
  recipe: Recipe,
  reference: NutritionReference,
  band = NUTRITION_SWAP_BAND,
): boolean {
  if (recipe.calories == null || recipe.protein == null) return false;
  const calories = reference.calories;
  const protein = reference.protein;
  if (calories == null && protein == null) return true;
  if (calories != null && calories > 0 && !withinPercent(recipe.calories, calories, band)) return false;
  if (protein != null && protein > 0 && !withinPercent(recipe.protein, protein, band)) return false;
  return true;
}

export function filterRecipesForSwap(recipes: readonly Recipe[], filters: SwapRecipeFilters = {}): Recipe[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return recipes.filter((recipe) => {
    if (filters.vegetarian && !recipe.vegetarian) return false;
    if (filters.proteinKind && recipeProteinKind(recipe) !== filters.proteinKind) return false;
    if (!query) return true;
    return (
      recipe.name.toLowerCase().includes(query) ||
      (recipe.cuisine ?? '').toLowerCase().includes(query) ||
      recipeProteinKind(recipe).includes(query)
    );
  });
}

export function sortRecipesByNutrition(recipes: readonly Recipe[], reference: NutritionReference): Recipe[] {
  const target = {
    calories: reference.calories && reference.calories > 0 ? reference.calories : 0,
    protein: reference.protein && reference.protein > 0 ? reference.protein : 0,
  };
  if (target.calories <= 0 && target.protein <= 0) {
    return [...recipes].sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...recipes].sort((a, b) => {
    const diff = nutritionFitScore(a, target) - nutritionFitScore(b, target);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

export function proteinKindsInRecipes(recipes: readonly Recipe[]): RecipeProteinKind[] {
  const seen = new Set<RecipeProteinKind>();
  for (const recipe of recipes) seen.add(recipeProteinKind(recipe));
  return PROTEIN_KIND_ORDER.filter((kind) => seen.has(kind));
}

const PROTEIN_KIND_ORDER: readonly RecipeProteinKind[] = [
  'chicken',
  'beef',
  'pork',
  'seafood',
  'plant',
  'egg',
  'turkey',
  'other',
];

/**
 * Pick a random swap that is similar in calories/protein and avoids recently shown recipes.
 * Widens the nutrition band if the similar pool is too small, then falls back to the full slot pool.
 */
export function pickRandomSwapRecipe(input: {
  recipes: readonly Recipe[];
  currentId?: string | null;
  current?: NutritionReference | null;
  target?: NutritionReference | null;
  recentIds?: readonly string[];
  random?: () => number;
}): Recipe | null {
  const currentId = input.currentId ?? null;
  const pool = input.recipes.filter((recipe) => recipe.id !== currentId);
  if (pool.length === 0) return null;
  const random = input.random ?? Math.random;
  const reference: NutritionReference = {
    calories: input.current?.calories || input.target?.calories || null,
    protein: input.current?.protein || input.target?.protein || null,
  };
  const recent = input.recentIds ?? [];

  for (const band of [NUTRITION_SWAP_BAND, 0.35, 0.5]) {
    const similar = pool.filter((recipe) => nutritionWithinBand(recipe, reference, band));
    const picked = pickFresh(similar, recent, random);
    if (picked) return picked;
  }
  return pickFresh(pool, recent, random) ?? pool[Math.floor(random() * pool.length)] ?? null;
}

export function rememberSwapId(recent: readonly string[], id: string, limit = 16): string[] {
  const next = [...recent.filter((item) => item !== id), id];
  return next.slice(Math.max(0, next.length - limit));
}

function pickFresh(candidates: readonly Recipe[], recent: readonly string[], random: () => number): Recipe | null {
  if (candidates.length === 0) return null;
  const unused = candidates.filter((recipe) => !recent.includes(recipe.id));
  if (unused.length === 0) return null;
  return unused[Math.floor(random() * unused.length)] ?? null;
}

function withinPercent(value: number, reference: number, band: number): boolean {
  const lo = reference * (1 - band);
  const hi = reference * (1 + band);
  return value >= lo && value <= hi;
}
