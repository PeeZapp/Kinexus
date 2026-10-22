import type { Recipe, RecipeClass } from './types';

export const RECIPE_CLASSES: readonly { key: RecipeClass; label: string }[] = [
  { key: 'sauce', label: 'Sauce' },
  { key: 'side', label: 'Side' },
  { key: 'marinade', label: 'Marinade' },
  { key: 'dressing', label: 'Dressing' },
  { key: 'stock', label: 'Stock' },
  { key: 'rub', label: 'Rub' },
  { key: 'dip', label: 'Dip' },
  { key: 'condiment', label: 'Condiment' },
];

const CLASS_KEYS = new Set<string>(RECIPE_CLASSES.map((item) => item.key));

export function isRecipeClass(value: string | null | undefined): value is RecipeClass {
  return Boolean(value && CLASS_KEYS.has(value));
}

export function recipeClassLabel(value: RecipeClass): string {
  return RECIPE_CLASSES.find((item) => item.key === value)?.label ?? value;
}

/** Exact-match key for linking an ingredient name to a classed recipe name. */
export function recipeNameKey(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolve the classed recipe an ingredient refers to.
 * An explicit id wins. Otherwise the names must match exactly after normalisation.
 * A single household recipe beats a catalog recipe. Two household recipes with the same name do not link.
 */
export function linkedRecipeForIngredient(
  name: string,
  recipes: readonly Recipe[],
  opts?: { explicitId?: string; excludeIds?: readonly string[] },
): Recipe | undefined {
  const exclude = new Set(opts?.excludeIds ?? []);
  if (opts?.explicitId && !exclude.has(opts.explicitId)) {
    const explicit = recipes.find((recipe) => recipe.id === opts.explicitId && !recipe.removed);
    if (explicit && (explicit.recipeClass || explicit.isComponent)) return explicit;
  }
  const key = recipeNameKey(name);
  if (!key) return undefined;
  const matches = recipes.filter(
    (recipe) =>
      !recipe.removed &&
      Boolean(recipe.recipeClass) &&
      !exclude.has(recipe.id) &&
      recipeNameKey(recipe.name) === key,
  );
  const household = matches.filter((recipe) => recipe.householdId != null);
  const pool = household.length > 0 ? household : matches;
  if (pool.length !== 1) return undefined;
  return pool[0];
}
