import { describe, expect, it } from 'vitest';

import {
  filterRecipesForFoodPrefs,
  householdAllergenAlertLabel,
  preferredCuisineBoost,
  recipeConflictsHouseholdAllergies,
  recipeFitsHouseholdEquipment,
} from './food-prefs';
import { generateMealPlan } from './generate-plan';
import type { NutritionGoals, Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, mealSlots: ['dinner'], ...partial };
}

const GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };

describe('food prefs filters', () => {
  it('excludes recipes that conflict with household allergies', () => {
    const pasta = recipe({ id: '1', name: 'Pasta', allergens: ['dairy', 'gluten'] });
    const salad = recipe({ id: '2', name: 'Salad', allergens: [] });
    expect(recipeConflictsHouseholdAllergies(pasta, ['dairy'])).toBe(true);
    expect(recipeConflictsHouseholdAllergies(salad, ['dairy'])).toBe(false);
    expect(filterRecipesForFoodPrefs([pasta, salad], { allergies: ['dairy'] }).map((r) => r.id)).toEqual(['2']);
  });

  it('passes through when allergies and equipment prefs are empty', () => {
    const pasta = recipe({ id: '1', name: 'Pasta', allergens: ['dairy'], equipment: ['oven'] });
    expect(filterRecipesForFoodPrefs([pasta], { allergies: [], equipment: [], cuisines: ['Italian'] })).toEqual([
      pasta,
    ]);
  });

  it('keeps untagged equipment recipes for any household equipment', () => {
    const skillet = recipe({ id: '1', name: 'Eggs', equipment: [] });
    expect(recipeFitsHouseholdEquipment(skillet, ['oven'])).toBe(true);
    expect(filterRecipesForFoodPrefs([skillet], { equipment: ['blender'] }).map((r) => r.id)).toEqual(['1']);
  });

  it('requires every recipe equipment tag to be owned', () => {
    const bake = recipe({ id: '1', name: 'Bake', equipment: ['oven', 'stand-mixer'] });
    expect(recipeFitsHouseholdEquipment(bake, ['oven', 'stand-mixer', 'blender'])).toBe(true);
    expect(recipeFitsHouseholdEquipment(bake, ['oven'])).toBe(false);
    expect(filterRecipesForFoodPrefs([bake], { equipment: ['oven'] })).toEqual([]);
  });

  it('alerts on optional ingredient allergens without excluding from generate', () => {
    const dish = recipe({
      id: '1',
      name: 'Ful',
      allergens: [],
      ingredients: [{ name: 'Tahina', amount: 'To serve', optional: true, allergens: ['sesame'] }],
    });
    expect(filterRecipesForFoodPrefs([dish], { allergies: ['sesame'] })).toEqual([dish]);
    expect(householdAllergenAlertLabel(dish, ['sesame'])).toBe('Optional: Sesame');
  });

  it('soft-biases preferred cuisines without hard filtering', () => {
    const thai = recipe({
      id: 'thai',
      name: 'Thai curry',
      cuisine: 'Thai',
      cuisines: ['Thai'],
      calories: 600,
      protein: 35,
      mealSlots: ['dinner'],
    });
    const italian = recipe({
      id: 'italian',
      name: 'Pasta',
      cuisine: 'Italian',
      cuisines: ['Italian'],
      calories: 600,
      protein: 35,
      mealSlots: ['dinner'],
    });
    expect(preferredCuisineBoost(thai, ['Thai'])).toBeGreaterThan(0);
    expect(preferredCuisineBoost(italian, ['Thai'])).toBe(0);

    const results = generateMealPlan(['dinner'], new Set(), [thai, italian], GOALS, {
      days: ['monday'],
      preferredCuisines: ['Thai'],
      random: () => 0,
    });
    expect(results.some((row) => row.recipe.id === 'italian' || row.recipe.id === 'thai')).toBe(true);
    expect(filterRecipesForFoodPrefs([thai, italian], { cuisines: ['Thai'] })).toHaveLength(2);
  });
});
