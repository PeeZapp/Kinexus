import type { Ingredient, Recipe } from './types';

function text(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function ingredientKey(items: readonly Ingredient[] | undefined): string {
  return (items ?? [])
    .map((item) =>
      [text(item.amount).toLowerCase(), text(item.name).toLowerCase(), text(item.category).toLowerCase(), item.baseRecipeId ?? ''].join(
        '|',
      ),
    )
    .join('\n');
}

function methodKey(steps: readonly string[] | undefined): string {
  return (steps ?? []).map((step) => text(step)).join('\n');
}

/** Cookable content copied when a household recipe is published. Photos and nutrition can drift on their own. */
export function householdRecipeMatchesPublishedCatalog(household: Recipe, catalog: Recipe): boolean {
  return (
    text(household.name) === text(catalog.name) &&
    text(household.emoji) === text(catalog.emoji) &&
    text(household.cuisine) === text(catalog.cuisine) &&
    (household.cookTime ?? null) === (catalog.cookTime ?? null) &&
    (household.servings ?? null) === (catalog.servings ?? null) &&
    Boolean(household.vegetarian) === Boolean(catalog.vegetarian) &&
    ingredientKey(household.ingredients) === ingredientKey(catalog.ingredients) &&
    methodKey(household.method) === methodKey(catalog.method) &&
    text(household.chefTip) === text(catalog.chefTip) &&
    text(household.notes) === text(catalog.notes) &&
    (household.mealSlots ?? []).join(',') === (catalog.mealSlots ?? []).join(',') &&
    (household.recipeClass ?? '') === (catalog.recipeClass ?? '') &&
    Boolean(household.isComponent) === Boolean(catalog.isComponent) &&
    text(household.sourceUrl) === text(catalog.sourceUrl)
  );
}

export function hideReplacedCatalogRecipes(recipes: readonly Recipe[]): Recipe[] {
  const replaced = new Set(
    recipes
      .filter((recipe) => recipe.replacesSource && recipe.sourcedFromRecipeId)
      .map((recipe) => recipe.sourcedFromRecipeId as string),
  );
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const hideHousehold = new Set<string>();
  const householdOverride = new Map<string, Recipe>();

  for (const catalog of recipes) {
    if (catalog.householdId != null || catalog.removed || !catalog.creatorSourceRecipeId) continue;
    const source = byId.get(catalog.creatorSourceRecipeId);
    if (!source || source.householdId == null || source.removed) continue;
    if (householdRecipeMatchesPublishedCatalog(source, catalog)) {
      const sourceIsReplacement = source.replacesSource && source.sourcedFromRecipeId === catalog.id;
      if (!sourceIsReplacement) hideHousehold.add(source.id);
      continue;
    }
    if (replaced.has(catalog.id)) continue;
    replaced.add(catalog.id);
    householdOverride.set(source.id, {
      ...source,
      publishedCatalogId: catalog.id,
      ...(source.replacesSource
        ? {}
        : {
            replacesSource: true,
            sourcedFromRecipeId: catalog.id,
          }),
    });
  }

  if (replaced.size === 0 && hideHousehold.size === 0) return [...recipes];

  const next: Recipe[] = [];
  for (const recipe of recipes) {
    if (hideHousehold.has(recipe.id)) continue;
    if (recipe.householdId == null && replaced.has(recipe.id)) continue;
    const override = householdOverride.get(recipe.id);
    if (override) {
      next.push(override);
      continue;
    }
    if (
      recipe.householdId == null &&
      recipe.creatorSourceRecipeId &&
      hideHousehold.has(recipe.creatorSourceRecipeId)
    ) {
      const source = byId.get(recipe.creatorSourceRecipeId);
      if (source?.excludedFromAuto && !recipe.excludedFromAuto) {
        next.push({ ...recipe, excludedFromAuto: true });
        continue;
      }
    }
    next.push(recipe);
  }
  return next;
}

export function findReplacingRecipe(recipes: readonly Recipe[], sourceId: string): Recipe | undefined {
  return recipes.find((recipe) => recipe.replacesSource && recipe.sourcedFromRecipeId === sourceId);
}

/** Recipe to show for a plan/library id, including a household overwrite of a catalog recipe. */
export function recipeForHouseholdView(recipes: readonly Recipe[], recipeId: string | null | undefined): Recipe | undefined {
  if (!recipeId) return undefined;
  return (
    findReplacingRecipe(recipes, recipeId) ??
    recipes.find((recipe) => recipe.id === recipeId) ??
    recipes.find((recipe) => !recipe.householdId && !recipe.removed && recipe.creatorSourceRecipeId === recipeId)
  );
}

/** Favourites saved on a collapsed household or catalog id still apply to the recipe the book shows. */
export function favouriteIdsForLibrary(recipes: readonly Recipe[], favouriteIds: readonly string[]): Set<string> {
  const ids = new Set(favouriteIds);
  if (ids.size === 0) return ids;
  for (const recipe of recipes) {
    if (recipe.creatorSourceRecipeId && ids.has(recipe.creatorSourceRecipeId)) ids.add(recipe.id);
    if (recipe.replacesSource && recipe.sourcedFromRecipeId && ids.has(recipe.sourcedFromRecipeId)) ids.add(recipe.id);
  }
  return ids;
}
