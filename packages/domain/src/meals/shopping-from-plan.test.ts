import { describe, expect, it } from 'vitest';

import { combineAmounts } from './amounts';
import { shoppingMergeKey } from './ingredient-merge';
import { groupShoppingByCategory, resolveShoppingCategory, shoppingFromPlan } from './shopping-from-plan';
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

  it('converts garlic cloves to grams with approx note', () => {
    expect(combineAmounts(['2 cloves', '6 cloves'], { ingredientName: 'garlic' })).toBe(
      '32g (approx 8 cloves)',
    );
  });

  it('sums onions into a simple shopping count', () => {
    expect(
      combineAmounts(['1 medium', '2 large', '1', '0.5 small'], { ingredientName: 'onion' }),
    ).toBe('4.5 onions');
    expect(combineAmounts(['1 chopped', '1 sliced'], { ingredientName: 'onion' })).toBe('2 onions');
    expect(combineAmounts(['150g', '150g'], { ingredientName: 'onion' })).toBe('2 onions');
  });

  it('keeps fractional heads for lettuce', () => {
    expect(combineAmounts(['0.5', '1/2'], { ingredientName: 'iceberg lettuce' })).toBe(
      '1 iceberg lettuce',
    );
    expect(combineAmounts(['½'], { ingredientName: 'iceberg lettuce' })).toBe('0.5 iceberg lettuce');
  });
});

describe('shoppingMergeKey', () => {
  it('merges prep and garlic clove variants', () => {
    expect(shoppingMergeKey('garlic cloves')).toBe(shoppingMergeKey('garlic'));
    expect(shoppingMergeKey('sliced onions')).toBe(shoppingMergeKey('onion'));
    expect(shoppingMergeKey('dry white wine')).toBe(shoppingMergeKey('white wine'));
    expect(shoppingMergeKey('sea salt')).toBe(shoppingMergeKey('salt'));
    expect(shoppingMergeKey('fine sea salt')).toBe(shoppingMergeKey('salt'));
    expect(shoppingMergeKey('garlic salt')).not.toBe(shoppingMergeKey('salt'));
  });

  it('keeps distinct varieties separate', () => {
    expect(shoppingMergeKey('green onion')).not.toBe(shoppingMergeKey('onion'));
    expect(shoppingMergeKey('red onion')).not.toBe(shoppingMergeKey('brown onion'));
    expect(shoppingMergeKey('red apple')).not.toBe(shoppingMergeKey('green apple'));
    expect(shoppingMergeKey('red wine')).not.toBe(shoppingMergeKey('white wine'));
  });

  it('keeps vinegars separate from wine and from each other', () => {
    expect(shoppingMergeKey('white wine vinegar')).not.toBe(shoppingMergeKey('white wine'));
    expect(shoppingMergeKey('white wine vinegar')).not.toBe(shoppingMergeKey('wine vinegar'));
    expect(shoppingMergeKey('red wine vinegar')).not.toBe(shoppingMergeKey('red wine'));
    expect(shoppingMergeKey('balsamic vinegar')).not.toBe(shoppingMergeKey('apple cider vinegar'));
    expect(shoppingMergeKey('dry white wine')).toBe(shoppingMergeKey('white wine'));
  });
});

describe('resolveShoppingCategory', () => {
  it('puts stock and broth in Pantry even when AI says meat', () => {
    expect(resolveShoppingCategory('meat', 'beef stock')).toBe('Pantry');
    expect(resolveShoppingCategory('meat', 'chicken broth')).toBe('Pantry');
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

  it('includes a personal meal even when that slot type is off the family plan', () => {
    const eggs = recipe({
      id: 'eggs',
      name: 'Eggs',
      mealSlots: ['breakfast'],
      ingredients: [{ name: 'Eggs', amount: '2', category: 'dairy' }],
    });
    const items = shoppingFromPlan({
      plan: {
        ...plan,
        slots: [
          { day: 'monday', slotKey: 'breakfast', recipeId: 'oats' },
          { day: 'monday', slotKey: 'breakfast', recipeId: 'eggs', audiencePersonIds: ['paul'] },
          { day: 'tuesday', slotKey: 'dinner', recipeId: 'eggs', audiencePersonIds: ['paul'] },
        ],
      },
      recipes: [oats, porridge, eggs],
    });
    expect(items.find((item) => item.name === 'Eggs')?.amount).toBe('4 Eggs');
    expect(items.find((item) => item.name === 'Eggs')?.recipeSources.map((source) => source.recipeId)).toEqual(['eggs']);
    expect(items.find((item) => item.name === 'Milk')?.amount).toBe('200ml');
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

  it('merges garlic variants and files stock under Pantry', () => {
    const stew = recipe({
      id: 'stew',
      name: 'Stew',
      mealSlots: ['dinner'],
      ingredients: [
        { name: 'garlic', amount: '2 cloves', category: 'vegetable' },
        { name: 'beef stock', amount: '500ml', category: 'meat' },
      ],
    });
    const tacos = recipe({
      id: 'tacos',
      name: 'Tacos',
      mealSlots: ['dinner'],
      ingredients: [{ name: 'garlic cloves', amount: '6 cloves', category: 'vegetable' }],
    });
    const items = shoppingFromPlan({
      plan: {
        activeSlots: ['dinner'],
        slots: [
          { day: 'monday', slotKey: 'dinner', recipeId: 'stew' },
          { day: 'tuesday', slotKey: 'dinner', recipeId: 'tacos' },
        ],
      },
      recipes: [stew, tacos],
    });
    const garlic = items.find((i) => shoppingMergeKey(i.name) === 'garlic');
    expect(garlic?.amount).toBe('32g (approx 8 cloves)');
    expect(garlic?.mergedFrom?.length).toBeGreaterThan(0);
    expect(garlic?.sharedMealCount).toBe(2);
    expect(items.find((i) => i.name.toLowerCase().includes('stock'))?.category).toBe('Pantry');
  });

  it('links a matching sauce and can swap that line for one batch', () => {
    const pesto = recipe({
      id: 'pesto',
      name: 'Pesto',
      recipeClass: 'sauce',
      householdId: 'hh',
      ingredients: [
        { name: 'basil', amount: '50g' },
        { name: 'olive oil', amount: '60ml' },
      ],
    });
    const pasta = recipe({
      id: 'pasta',
      name: 'Pasta',
      mealSlots: ['dinner'],
      ingredients: [{ name: 'pesto', amount: '4 tbsp' }, { name: 'spaghetti', amount: '400g' }],
    });
    const again = recipe({
      id: 'again',
      name: 'Pesto chicken',
      mealSlots: ['dinner'],
      ingredients: [{ name: 'Pesto', amount: '2 tbsp' }],
    });
    const plan = {
      activeSlots: ['dinner'] as const,
      slots: [
        { day: 'monday' as const, slotKey: 'dinner' as const, recipeId: 'pasta' },
        { day: 'tuesday' as const, slotKey: 'dinner' as const, recipeId: 'again' },
      ],
    };
    const bought = shoppingFromPlan({ plan, recipes: [pesto, pasta, again] });
    const pestoLine = bought.find((item) => item.name.toLowerCase() === 'pesto');
    expect(pestoLine?.linkedRecipeId).toBe('pesto');
    expect(bought.find((item) => item.name === 'basil')).toBeUndefined();

    const made = shoppingFromPlan({ plan, recipes: [pesto, pasta, again], makeRecipeIds: ['pesto'] });
    expect(made.find((item) => item.name.toLowerCase() === 'pesto')).toBeUndefined();
    expect(made.find((item) => item.name === 'basil')?.amount).toBe('50g');
    expect(made.find((item) => item.name === 'basil')?.madeFromRecipeId).toBe('pesto');
    expect(made.filter((item) => item.name === 'olive oil')).toHaveLength(1);
  });

  it('adds a side recipe’s ingredients with the meal', () => {
    const potatoes = recipe({
      id: 'potatoes',
      name: 'Roast potatoes',
      recipeClass: 'side',
      ingredients: [{ name: 'potatoes', amount: '800g' }],
    });
    const roast = recipe({
      id: 'roast',
      name: 'Roast chicken',
      mealSlots: ['dinner'],
      ingredients: [{ name: 'chicken', amount: '1.5kg' }],
    });
    const items = shoppingFromPlan({
      plan: {
        activeSlots: ['dinner'],
        slots: [{ day: 'monday', slotKey: 'dinner', recipeId: 'roast', sideRecipeIds: ['potatoes'] }],
      },
      recipes: [roast, potatoes],
    });
    expect(items.map((item) => item.name).sort()).toEqual(['chicken', 'potatoes']);
  });

  it('scales a large recipe down to the slot serve count', () => {
    const lasagne = recipe({
      id: 'lasagne',
      name: 'Lasagne',
      servings: 8,
      mealSlots: ['dinner'],
      ingredients: [{ name: 'Mince', amount: '800g' }],
    });
    const items = shoppingFromPlan({
      plan: {
        activeSlots: ['dinner'],
        slots: [{ day: 'monday', slotKey: 'dinner', recipeId: 'lasagne', targetServings: 2 }],
      },
      recipes: [lasagne],
    });
    expect(items.find((item) => item.name === 'Mince')?.amount).toBe('200g');
  });
});
