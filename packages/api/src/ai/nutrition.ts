import { asNumber, parseJsonObject } from '../recipe-draft.js';
import type { AiDraftResult } from './extract.js';
import { completeResolved, type ResolvedAiClient } from './resolve.js';

export type NutritionDraft = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export async function estimateRecipeNutritionWithAi(
  resolved: ResolvedAiClient,
  input: {
    name?: string;
    servings?: number;
    ingredients: { name: string; amount?: string }[];
  },
): Promise<AiDraftResult<NutritionDraft>> {
  const lines = input.ingredients
    .map((item) => `- ${(item.amount ? `${item.amount} ` : '')}${item.name}`)
    .join('\n');
  const out = await completeResolved(resolved, {
    json: true,
    maxTokens: 400,
    prompt: `Estimate nutrition per serving for this home-cooked recipe.

Recipe name: ${input.name || 'Untitled'}
Servings: ${input.servings && input.servings > 0 ? input.servings : 1}

Ingredients:
${lines || '(none)'}

Return ONLY JSON: { "calories": number, "protein": number, "carbs": number, "fat": number }
Use grams for protein, carbs, and fat. Calories are kcal per serving. Round to whole numbers.`,
  });
  const raw = parseJsonObject(out.text);
  return {
    value: {
      calories: asNumber(raw.calories),
      protein: asNumber(raw.protein),
      carbs: asNumber(raw.carbs),
      fat: asNumber(raw.fat),
    },
    provider: out.provider,
    resultsMayVary: out.resultsMayVary,
  };
}
