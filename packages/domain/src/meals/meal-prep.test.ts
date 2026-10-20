import { describe, expect, it } from 'vitest';

import {
  defaultMealPrepDaysToCover,
  generateMealPrepPlan,
  mealPrepCookSummary,
  mealPrepScore,
  recipesForMealPrep,
} from './meal-prep';
import type { NutritionGoals, Recipe } from './types';

const GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

describe('mealPrepScore', () => {
  it('scores stews higher than salads', () => {
    const stew = recipe({ id: '1', name: 'Beef stew', servings: 6, cookTime: 90, mealSlots: ['dinner'] });
    const salad = recipe({ id: '2', name: 'Garden salad', servings: 2, cookTime: 10, mealSlots: ['lunch'] });
    expect(mealPrepScore(stew, 'week_portions')).toBeGreaterThan(mealPrepScore(salad, 'week_portions'));
  });
});

describe('recipesForMealPrep', () => {
  it('prefers prep-friendly recipes for the slot', () => {
    const stew = recipe({
      id: 'stew',
      name: 'Chicken curry',
      servings: 6,
      cookTime: 45,
      calories: 600,
      protein: 35,
      mealSlots: ['dinner'],
    });
    const toast = recipe({
      id: 'toast',
      name: 'Avocado toast',
      servings: 1,
      cookTime: 5,
      calories: 350,
      protein: 10,
      mealSlots: ['dinner'],
    });
    const pool = recipesForMealPrep([stew, toast], 'dinner', 'freezer_batch');
    expect(pool[0]?.id).toBe('stew');
  });
});

describe('generateMealPrepPlan', () => {
  const library = [
    recipe({
      id: 'curry',
      name: 'Chicken curry',
      servings: 6,
      cookTime: 50,
      calories: 620,
      protein: 40,
      mealSlots: ['lunch', 'dinner'],
    }),
    recipe({
      id: 'stew',
      name: 'Beef stew',
      servings: 8,
      cookTime: 100,
      calories: 580,
      protein: 38,
      mealSlots: ['dinner'],
    }),
    recipe({
      id: 'chilli',
      name: 'Bean chilli',
      servings: 6,
      cookTime: 40,
      calories: 540,
      protein: 28,
      mealSlots: ['lunch', 'dinner'],
    }),
  ];

  it('fills from cook day with repeated week-portion dishes', () => {
    const result = generateMealPrepPlan(library, new Set(), {
      style: 'week_portions',
      cookDay: 'wednesday',
      slots: ['lunch'],
      dishCount: 1,
      daysToCover: 5,
      goals: GOALS,
      random: () => 0,
    });

    expect(result.cookList).toHaveLength(1);
    expect(result.slots.every((row) => row.slot === 'lunch')).toBe(true);
    expect(result.slots.map((row) => row.day)).toEqual([
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
    expect(new Set(result.slots.map((row) => row.recipe.id)).size).toBe(1);
    expect(mealPrepCookSummary(result)).toContain('Prep on Wednesday');
  });

  it('rotates freezer batch dishes across dinners', () => {
    const result = generateMealPrepPlan(library, new Set(), {
      style: 'freezer_batch',
      cookDay: 'monday',
      slots: ['dinner'],
      dishCount: 2,
      daysToCover: 4,
      goals: GOALS,
      random: () => 0,
    });

    expect(result.cookList.length).toBe(2);
    expect(result.slots).toHaveLength(4);
    const ids = result.slots.map((row) => row.recipe.id);
    expect(new Set(ids).size).toBe(2);
    expect(mealPrepCookSummary(result)).toContain('freeze');
  });

  it('skips reserved slots', () => {
    const result = generateMealPrepPlan(library, new Set(['thursday_lunch']), {
      style: 'week_portions',
      cookDay: 'wednesday',
      slots: ['lunch'],
      dishCount: 1,
      daysToCover: 3,
      goals: GOALS,
      random: () => 0,
    });
    expect(result.slots.map((row) => row.day)).toEqual(['wednesday', 'friday']);
  });
});

describe('defaultMealPrepDaysToCover', () => {
  it('covers remaining days including cook day', () => {
    expect(defaultMealPrepDaysToCover('monday')).toBe(7);
    expect(defaultMealPrepDaysToCover('friday')).toBe(3);
    expect(defaultMealPrepDaysToCover('sunday')).toBe(1);
  });
});
