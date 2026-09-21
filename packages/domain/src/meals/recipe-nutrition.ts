import { parseAmount } from './amounts';
import type { Ingredient } from './types';

export type RecipeNutritionEstimate = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number;
  coveredIngredients: number;
  totalIngredients: number;
};

type BaseUnit = 'g' | 'ml' | 'each';

type NutritionEntry = {
  keywords: string[];
  anyKeyword?: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  baseAmount: number;
  baseUnit: BaseUnit;
};

function n(
  keywords: string[],
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  baseAmount = 100,
  baseUnit: BaseUnit = 'g',
  anyKeyword?: string[],
): NutritionEntry {
  return { keywords, anyKeyword, calories, protein, carbs, fat, baseAmount, baseUnit };
}

/** Typical USDA-style values for home cooking, per baseAmount. */
const NUTRITION_DB: NutritionEntry[] = [
  n(['chicken'], 165, 31, 0, 3.6, 100, 'g', ['breast', 'fillet']),
  n(['chicken'], 177, 24, 0, 8.8, 100, 'g', ['thigh', 'drumstick', 'leg']),
  n(['chicken'], 215, 19, 0, 15, 100, 'g', ['wing']),
  n(['chicken'], 239, 27, 0, 14),
  n(['beef'], 250, 26, 0, 15, 100, 'g', ['mince', 'ground']),
  n(['beef'], 271, 25, 0, 19, 100, 'g', ['steak', 'sirloin', 'fillet']),
  n(['beef'], 250, 26, 0, 16),
  n(['lamb'], 294, 25, 0, 21),
  n(['pork'], 242, 27, 0, 14),
  n(['bacon'], 541, 37, 1.4, 42),
  n(['sausage'], 301, 12, 5, 27),
  n(['chorizo'], 455, 24, 2, 38),
  n(['turkey'], 189, 29, 0, 7),
  n(['salmon'], 208, 20, 0, 13),
  n(['tuna'], 132, 29, 0, 1.3, 100, 'g', ['canned', 'tin']),
  n(['tuna'], 144, 23, 0, 5),
  n(['prawn'], 99, 24, 0.2, 0.3),
  n(['shrimp'], 99, 24, 0.2, 0.3),
  n(['cod'], 82, 18, 0, 0.7),
  n(['fish'], 136, 19, 0, 6),
  n(['butter'], 717, 0.9, 0.1, 81),
  n(['parmesan'], 431, 38, 4, 29),
  n(['cheddar'], 402, 25, 1.3, 33),
  n(['mozzarella'], 280, 22, 2.2, 17),
  n(['feta'], 264, 14, 4, 21),
  n(['halloumi'], 321, 22, 2, 26),
  n(['haloumi'], 321, 22, 2, 26),
  n(['cheese'], 350, 22, 2.5, 28),
  n(['cream'], 340, 2, 3, 36, 100, 'ml', ['double', 'heavy', 'whipping']),
  n(['cream'], 198, 2.4, 3, 19, 100, 'ml'),
  n(['milk'], 61, 3.2, 4.8, 3.3, 100, 'ml'),
  n(['yoghurt'], 59, 10, 3.6, 0.4),
  n(['yogurt'], 59, 10, 3.6, 0.4),
  n(['egg'], 72, 6.3, 0.4, 4.8, 1, 'each'),
  n(['onion'], 40, 1.1, 9, 0.1),
  n(['garlic'], 149, 6.4, 33, 0.5),
  n(['tomato'], 18, 0.9, 3.9, 0.2),
  n(['capsicum'], 31, 1, 6, 0.3),
  n(['bell pepper'], 31, 1, 6, 0.3),
  n(['carrot'], 41, 0.9, 10, 0.2),
  n(['potato'], 86, 1.6, 20, 0.1, 100, 'g', ['sweet']),
  n(['potato'], 77, 2, 17, 0.1),
  n(['sweet potato'], 86, 1.6, 20, 0.1),
  n(['mushroom'], 22, 3.1, 3.3, 0.3),
  n(['broccoli'], 34, 2.8, 7, 0.4),
  n(['spinach'], 23, 2.9, 3.6, 0.4),
  n(['zucchini'], 17, 1.2, 3.1, 0.3),
  n(['courgette'], 17, 1.2, 3.1, 0.3),
  n(['lettuce'], 15, 1.4, 2.9, 0.2),
  n(['cucumber'], 15, 0.7, 3.6, 0.1),
  n(['avocado'], 240, 3, 12, 22, 1, 'each'),
  n(['lemon'], 17, 0.6, 5, 0.2, 1, 'each'),
  n(['lime'], 20, 0.5, 7, 0.1, 1, 'each'),
  n(['apple'], 95, 0.5, 25, 0.3, 1, 'each'),
  n(['banana'], 105, 1.3, 27, 0.4, 1, 'each'),
  n(['pasta'], 371, 13, 75, 1.5),
  n(['spaghetti'], 371, 13, 75, 1.5),
  n(['rice'], 130, 2.7, 28, 0.3),
  n(['flour'], 364, 10, 76, 1),
  n(['oat'], 389, 17, 66, 7),
  n(['breadcrumb'], 395, 13, 72, 5),
  n(['bread'], 265, 9, 49, 3.2, 1, 'each', ['bun', 'roll']),
  n(['bun'], 150, 5, 28, 2, 1, 'each'),
  n(['roll'], 150, 5, 28, 2, 1, 'each'),
  n(['bread'], 265, 9, 49, 3.2),
  n(['tortilla'], 140, 4, 24, 3.5, 1, 'each'),
  n(['wrap'], 140, 4, 24, 3.5, 1, 'each'),
  n(['lentil'], 116, 9, 20, 0.4),
  n(['chickpea'], 164, 9, 27, 2.6),
  n(['olive oil'], 119, 0, 0, 13.5, 15, 'ml'),
  n(['oil'], 120, 0, 0, 13.6, 15, 'ml'),
  n(['coconut milk'], 197, 2, 3, 21, 100, 'ml'),
  n(['soy sauce'], 8, 1.3, 0.8, 0, 15, 'ml'),
  n(['honey'], 64, 0.1, 17, 0, 15, 'g'),
  n(['sugar'], 387, 0, 100, 0),
  n(['mayonnaise'], 94, 0.1, 0.1, 10, 15, 'g'),
  n(['ketchup'], 15, 0.2, 4, 0, 15, 'g'),
  n(['mustard'], 10, 0.6, 1, 0.5, 15, 'g'),
  n(['stock'], 5, 0.5, 0.5, 0.1, 100, 'ml'),
  n(['broth'], 5, 0.5, 0.5, 0.1, 100, 'ml'),
  n(['wine'], 83, 0.1, 2.6, 0, 100, 'ml'),
  n(['water'], 0, 0, 0, 0, 100, 'ml'),
];

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toBaseUnit(value: number, unit: string): { value: number; unit: BaseUnit } | null {
  const u = unit.toLowerCase().trim();
  if (u === 'g' || u === 'gram' || u === 'grams') return { value, unit: 'g' };
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return { value: value * 1000, unit: 'g' };
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return { value: value * 28.35, unit: 'g' };
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return { value: value * 453.6, unit: 'g' };
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre' || u === 'milliliters' || u === 'millilitres') {
    return { value, unit: 'ml' };
  }
  if (u === 'l' || u === 'liter' || u === 'litre' || u === 'liters' || u === 'litres') return { value: value * 1000, unit: 'ml' };
  if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') return { value: value * 15, unit: 'ml' };
  if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return { value: value * 5, unit: 'ml' };
  if (u === 'cup' || u === 'cups') return { value: value * 240, unit: 'ml' };
  if (u === '' || u === 'each' || u === 'piece' || u === 'pieces' || u === 'unit' || u === 'units') {
    return { value, unit: 'each' };
  }
  if (u === 'clove' || u === 'cloves') return { value: value * 5, unit: 'g' };
  if (u === 'slice' || u === 'slices') return { value: value * 30, unit: 'g' };
  if (u === 'can' || u === 'tin' || u === 'cans' || u === 'tins') return { value: value * 400, unit: 'g' };
  return null;
}

function findNutrition(ingredientName: string): NutritionEntry | null {
  const name = norm(ingredientName);
  let best: NutritionEntry | null = null;
  let bestScore = 0;
  for (const entry of NUTRITION_DB) {
    if (!entry.keywords.every((kw) => name.includes(kw))) continue;
    if (entry.anyKeyword && !entry.anyKeyword.some((kw) => name.includes(kw))) continue;
    const score =
      entry.keywords.reduce((sum, kw) => sum + kw.length, 0) +
      (entry.anyKeyword ? entry.anyKeyword.reduce((sum, kw) => sum + kw.length, 0) : 0);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

function scale(entry: NutritionEntry, amount?: string): { calories: number; protein: number; carbs: number; fat: number } {
  const parsed = parseAmount(amount);
  const converted = parsed ? toBaseUnit(parsed.value, parsed.unit) : null;
  const factor =
    converted && converted.unit === entry.baseUnit ? converted.value / entry.baseAmount : 1;
  return {
    calories: entry.calories * factor,
    protein: entry.protein * factor,
    carbs: entry.carbs * factor,
    fat: entry.fat * factor,
  };
}

export function nutritionKey(ingredients: readonly Ingredient[], servings?: number): string {
  const lines = ingredients
    .map((item) => `${(item.amount ?? '').trim().toLowerCase()}|${item.name.trim().toLowerCase()}`)
    .filter((line) => !line.endsWith('|'));
  return `${servings ?? ''}:${lines.join(';')}`;
}

export function estimateRecipeNutrition(
  ingredients: readonly Ingredient[],
  servings = 1,
): RecipeNutritionEstimate | null {
  const usable = ingredients.filter((item) => item.name.trim());
  if (usable.length === 0) return null;
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let covered = 0;
  for (const item of usable) {
    const entry = findNutrition(item.name);
    if (!entry) continue;
    covered += 1;
    const line = scale(entry, item.amount);
    calories += line.calories;
    protein += line.protein;
    carbs += line.carbs;
    fat += line.fat;
  }
  if (covered === 0) return null;
  const serves = Math.max(1, servings || 1);
  return {
    calories: Math.round(calories / serves),
    protein: Math.round(protein / serves),
    carbs: Math.round(carbs / serves),
    fat: Math.round(fat / serves),
    servings: serves,
    coveredIngredients: covered,
    totalIngredients: usable.length,
  };
}

export function nutritionCoverageLow(estimate: RecipeNutritionEstimate | null): boolean {
  if (!estimate) return true;
  return estimate.coveredIngredients / Math.max(1, estimate.totalIngredients) < 0.5;
}
