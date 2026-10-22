import { roundMoney } from '../stash/money';
import { parseAmount } from './amounts';
import { scaledQuantityLabel } from './clean-recipe';
import type { Recipe } from './types';

/** Servings the ingredient amounts were written for. */
export function recipeBaseServings(recipe: Pick<Recipe, 'servings' | 'cost'>): number | undefined {
  if (recipe.servings != null && recipe.servings > 0) return recipe.servings;
  const basis = recipe.cost?.servingsBasis;
  if (basis != null && basis > 0) return basis;
  return undefined;
}

function scaleAmount(amount: string | undefined, base: number, target: number): string | undefined {
  if (!amount?.trim()) return amount;
  const parsed = parseAmount(amount);
  const label = scaledQuantityLabel(
    { value: parsed?.value ?? null, unit: parsed?.unit || undefined, raw: amount.trim() },
    base,
    target,
  );
  return label || amount;
}

/**
 * Copy a recipe with ingredient amounts and dish cost scaled from its written
 * yield to `viewServings`. Per-serve nutrition and cost per serve stay put.
 * Missing yield, or a target that matches it, returns the same recipe.
 */
export function scaleRecipeToServings<T extends Pick<Recipe, 'servings' | 'ingredients' | 'cost'>>(
  recipe: T,
  viewServings: number | null | undefined,
): T {
  const base = recipeBaseServings(recipe);
  if (
    viewServings == null ||
    !Number.isFinite(viewServings) ||
    viewServings <= 0 ||
    base == null ||
    viewServings === base
  ) {
    return recipe;
  }

  const factor = viewServings / base;
  const ingredients = recipe.ingredients?.map((ingredient) => ({
    ...ingredient,
    amount: scaleAmount(ingredient.amount, base, viewServings),
  }));
  const cost = recipe.cost
    ? {
        ...recipe.cost,
        totalCost: roundMoney(recipe.cost.totalCost * factor),
        servingsBasis: viewServings,
        breakdown: recipe.cost.breakdown.map((line) => ({
          ...line,
          amount: line.amount ? scaleAmount(line.amount, base, viewServings) : line.amount,
          lineCost: roundMoney(line.lineCost * factor),
        })),
      }
    : recipe.cost;

  return {
    ...recipe,
    servings: viewServings,
    ...(ingredients ? { ingredients } : {}),
    ...(cost ? { cost } : {}),
  };
}
