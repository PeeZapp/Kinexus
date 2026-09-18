import { describe, expect, it } from 'vitest';

import { recipesForSlot } from './generate-plan';
import {
  filterRecipesForSwap,
  NUTRITION_SWAP_BAND,
  nutritionWithinBand,
  pickRandomSwapRecipe,
  rememberSwapId,
} from './swap-recipe';
import type { Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

const lunchSalad = recipe({
  id: 'lunch',
  name: 'Chicken salad',
  mealSlots: ['lunch'],
  calories: 540,
  protein: 38,
  vegetarian: false,
  ingredients: [{ name: 'chicken' }],
});
const dinnerSteak = recipe({
  id: 'dinner',
  name: 'Steak',
  mealSlots: ['dinner'],
  calories: 680,
  protein: 42,
  ingredients: [{ name: 'beef steak' }],
});
const oats = recipe({
  id: 'oats',
  name: 'Oats',
  mealSlots: ['breakfast'],
  calories: 380,
  protein: 18,
  vegetarian: true,
  ingredients: [{ name: 'oats' }, { name: 'milk' }],
});
const tofu = recipe({
  id: 'tofu',
  name: 'Tofu stir fry',
  mealSlots: ['dinner'],
  calories: 620,
  protein: 36,
  vegetarian: true,
  ingredients: [{ name: 'tofu' }],
});
const heavy = recipe({
  id: 'heavy',
  name: 'Lasagne',
  mealSlots: ['dinner'],
  calories: 1100,
  protein: 48,
  ingredients: [{ name: 'beef mince' }],
});
const light = recipe({
  id: 'light',
  name: 'Soup',
  mealSlots: ['dinner'],
  calories: 280,
  protein: 12,
  vegetarian: true,
  ingredients: [{ name: 'lentil' }],
});

describe('recipesForSlot lunch as dinner', () => {
  it('lets lunch recipes fill a dinner slot', () => {
    expect(recipesForSlot([lunchSalad, oats], 'dinner').map((item) => item.id)).toEqual(['lunch']);
  });

  it('does not put breakfast into dinner when lunch/dinner recipes exist', () => {
    expect(recipesForSlot([lunchSalad, dinnerSteak, oats], 'dinner').map((item) => item.id)).toEqual([
      'lunch',
      'dinner',
    ]);
  });
});

describe('swap filters and nutrition band', () => {
  it('filters vegetarian and protein kind', () => {
    const pool = [lunchSalad, tofu, dinnerSteak, oats];
    expect(filterRecipesForSwap(pool, { vegetarian: true }).map((item) => item.id).sort()).toEqual(['oats', 'tofu']);
    expect(filterRecipesForSwap(pool, { proteinKind: 'chicken' }).map((item) => item.id)).toEqual(['lunch']);
    expect(filterRecipesForSwap(pool, { query: 'stir' }).map((item) => item.id)).toEqual(['tofu']);
  });

  it('keeps recipes within ±20% calories and protein', () => {
    const current = { calories: 650, protein: 40 };
    expect(nutritionWithinBand(dinnerSteak, current)).toBe(true);
    expect(nutritionWithinBand(tofu, current)).toBe(true);
    expect(nutritionWithinBand(heavy, current)).toBe(false);
    expect(nutritionWithinBand(light, current)).toBe(false);
    expect(NUTRITION_SWAP_BAND).toBe(0.2);
  });
});

describe('pickRandomSwapRecipe', () => {
  const pool = [dinnerSteak, tofu, heavy, light, lunchSalad];

  it('prefers similar nutrition and skips the current recipe', () => {
    const picked = pickRandomSwapRecipe({
      recipes: pool,
      currentId: 'dinner',
      current: dinnerSteak,
      random: () => 0,
    });
    expect(picked?.id).not.toBe('dinner');
    expect(['tofu', 'lunch']).toContain(picked?.id);
  });

  it('avoids recently shown recipes instead of looping a tiny set', () => {
    let recent: string[] = [];
    const seen = new Set<string>();
    const randoms = [0.1, 0.4, 0.7, 0.2, 0.9, 0.35, 0.55, 0.8];
    for (let i = 0; i < randoms.length; i++) {
      const picked = pickRandomSwapRecipe({
        recipes: [dinnerSteak, tofu, lunchSalad, heavy, light],
        currentId: 'dinner',
        current: dinnerSteak,
        recentIds: recent,
        random: () => randoms[i]!,
      });
      expect(picked).toBeTruthy();
      seen.add(picked!.id);
      recent = rememberSwapId(recent, picked!.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('falls back to the wider pool when nothing is in band', () => {
    const picked = pickRandomSwapRecipe({
      recipes: [heavy, light],
      currentId: null,
      current: { calories: 650, protein: 40 },
      random: () => 0,
    });
    expect(picked?.id).toBeTruthy();
  });
});
