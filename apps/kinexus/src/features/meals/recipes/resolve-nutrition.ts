import {
  estimateRecipeNutrition,
  nutritionCoverageLow,
  type Ingredient,
  type RecipeNutritionEstimate,
} from '@kinexus/domain';

import { estimateRecipeNutritionFromApi, isMealsApiConfigured } from '@/src/lib/meals-api';

export async function resolveRecipeNutrition(input: {
  name?: string;
  ingredients: Ingredient[];
  servings?: number;
  allowAi?: boolean;
  householdId?: string;
}): Promise<(RecipeNutritionEstimate & { resultsMayVary?: boolean }) | null> {
  const local = estimateRecipeNutrition(input.ingredients, input.servings);
  if (!nutritionCoverageLow(local) || !input.allowAi || !input.householdId || !isMealsApiConfigured()) return local;
  try {
    const ai = await estimateRecipeNutritionFromApi({
      name: input.name,
      servings: input.servings,
      ingredients: input.ingredients,
      householdId: input.householdId,
    });
    if (ai.value.calories == null && ai.value.protein == null) return local;
    return {
      calories: ai.value.calories ?? local?.calories ?? 0,
      protein: ai.value.protein ?? local?.protein ?? 0,
      carbs: ai.value.carbs ?? local?.carbs ?? 0,
      fat: ai.value.fat ?? local?.fat ?? 0,
      servings: Math.max(1, input.servings || 1),
      coveredIngredients: input.ingredients.length,
      totalIngredients: input.ingredients.length,
      ...(ai.resultsMayVary ? { resultsMayVary: true } : {}),
    };
  } catch {
    return local;
  }
}
