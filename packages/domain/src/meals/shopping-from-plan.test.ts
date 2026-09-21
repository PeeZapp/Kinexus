import { describe, expect, it } from 'vitest';

import { combineAmounts } from './amounts';
import { groupShoppingByCategory, shoppingFromPlan } from './shopping-from-plan';
import type { MealPlan, Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

describe('combineAmounts', () => {
  it('sums the same unit', () => {
    expect(combineAmounts(['50g', '100g'])).toBe('150g');
  });

  it('converts mixed volume units to ml', () => {
    expect(combineAmounts(['1 tbsp', '1 tsp'])).toBe('20ml');
  });
});

describe('shoppingFromPlan', () => {
  const oats = recipe({
    id: 'oats',
    name: 'Oats',
    mealSlots: ['breakfast'],
    ingredients: [
      { name: 'Rolled oats', amount: '50g', category: 'grain' },
      { name: 'Milk', amount: '200ml', category: 'dairy' },
    ],
  });
  const porridge = recipe({
    id: 'porridge',
    name: 'Porridge',
    mealSlots: ['breakfast'],
    ingredients: [{ name: 'Rolled oats', amount: '80g', category: 'grain' }],
  });

  const plan: MealPlan = {
    id: 'p1',
    householdId: 'h1',
    weekStart: '2026-09-07',
    activeSlots: ['breakfast'],
    slots: [
      { day: 'monday', slotKey: 'breakfast', recipeId: 'oats' },
      { day: 'tuesday', slotKey: 'breakfast', recipeId: 'porridge' },
      { day: 'monday', slotKey: 'dinner', recipeId: 'oats' },
    ],
  };

  it('merges amounts and groups by aisle category', () => {
    const items = shoppingFromPlan({ plan, recipes: [oats, porridge] });
    const oatsItem = items.find((i) => i.name === 'Rolled oats');
    expect(oatsItem?.amount).toBe('130g');
    expect(oatsItem?.sharedMealCount).toBe(2);
    expect(oatsItem?.recipeSources.map((s) => s.recipeId).sort()).toEqual(['oats', 'porridge']);

    const grouped = groupShoppingByCategory(items);
    expect(grouped.map((g) => g.category)).toEqual(['Dairy & Eggs', 'Grains & Pasta']);
  });

  it('ignores slots that are not in activeSlots', () => {
    const items = shoppingFromPlan({ plan, recipes: [oats, porridge] });
    // dinner oats would add another 50g + 200ml if included
    expect(items.find((i) => i.name === 'Milk')?.amount).toBe('200ml');
  });

  it('ignores hidden slots even when they still have a recipe', () => {
    const items = shoppingFromPlan({
      plan: {
        ...plan,
        slots: [{ day: 'monday', slotKey: 'breakfast', recipeId: 'oats', hidden: true }],
      },
      recipes: [oats, porridge],
    });
    expect(items).toEqual([]);
  });

  it('uses household overwrite ingredients instead of the original catalog recipe', () => {
    const catalog = recipe({
      id: 'cat-burger',
      name: 'Chicken halloumi burger',
      mealSlots: ['dinner'],
      ingredients: [
        { name: 'Chicken thigh', amount: '400g' },
        { name: 'Halloumi', amount: '200g' },
        { name: 'Burger bun', amount: '4' },
      ],
    });
    const household = recipe({
      id: 'hh-burger',
      name: 'Chicken halloumi burger',
      householdId: 'hh-1',
      sourcedFromRecipeId: 'cat-burger',
      replacesSource: true,
      mealSlots: ['dinner'],
      ingredients: [
        { name: 'Chicken thigh', amount: '400g' },
        { name: 'Halloumi', amount: '250g' },
      ],
    });
    const items = shoppingFromPlan({
      plan: {
        activeSlots: ['dinner'],
        slots: [
          { day: 'monday', slotKey: 'dinner', recipeId: 'cat-burger' },
          { day: 'tuesday', slotKey: 'dinner', recipeId: 'hh-burger' },
        ],
      },
      recipes: [catalog, household],
    });
    expect(items.map((item) => item.name).sort()).toEqual(['Chicken thigh', 'Halloumi']);
    expect(items.find((item) => item.name === 'Halloumi')?.amount).toBe('500g');
    expect(items.find((item) => item.name === 'Burger bun')).toBeUndefined();
    expect(items.find((item) => item.name === 'Chicken thigh')?.recipeSources.map((s) => s.recipeId)).toEqual([
      'hh-burger',
    ]);
  });
});
