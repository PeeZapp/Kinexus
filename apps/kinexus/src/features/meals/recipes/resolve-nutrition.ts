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
}): Promise<RecipeNutritionEstimate | null> {
  const local = estimateRecipeNutrition(input.ingredients, input.servings);
  if (!nutritionCoverageLow(local) || !input.allowAi || !isMealsApiConfigured()) return local;
  try {
    const ai = await estimateRecipeNutritionFromApi({
      name: input.name,
      servings: input.servings,
      ingredients: input.ingredients,
    });
    if (ai.calories == null && ai.protein == null) return local;
    return {
      calories: ai.calories ?? local?.calories ?? 0,
      protein: ai.protein ?? local?.protein ?? 0,
      carbs: ai.carbs ?? local?.carbs ?? 0,
      fat: ai.fat ?? local?.fat ?? 0,
      servings: Math.max(1, input.servings || 1),
      coveredIngredients: input.ingredients.length,
      totalIngredients: input.ingredients.length,
    };
  } catch {
    return local;
  }
}
