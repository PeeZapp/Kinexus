import type { Recipe } from './types';

export function hideReplacedCatalogRecipes(recipes: readonly Recipe[]): Recipe[] {
  const replaced = new Set(
    recipes
      .filter((recipe) => recipe.replacesSource && recipe.sourcedFromRecipeId)
      .map((recipe) => recipe.sourcedFromRecipeId as string),
  );
  if (replaced.size === 0) return [...recipes];
  return recipes.filter((recipe) => recipe.householdId != null || !replaced.has(recipe.id));
}

export function findReplacingRecipe(recipes: readonly Recipe[], sourceId: string): Recipe | undefined {
  return recipes.find((recipe) => recipe.replacesSource && recipe.sourcedFromRecipeId === sourceId);
}

/** Recipe to show for a plan/library id, including a household overwrite of a catalog recipe. */
export function recipeForHouseholdView(recipes: readonly Recipe[], recipeId: string | null | undefined): Recipe | undefined {
  if (!recipeId) return undefined;
  return findReplacingRecipe(recipes, recipeId) ?? recipes.find((recipe) => recipe.id === recipeId);
}
