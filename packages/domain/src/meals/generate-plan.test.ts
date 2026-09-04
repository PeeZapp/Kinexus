import { describe, expect, it } from 'vitest';

import {
  CORE_SLOTS,
  generateMealPlan,
  OPTIONAL_SLOTS,
  recipesForSlot,
  SLOT_ASSUMED,
  slotTarget,
} from './generate-plan';
import { mealSlotRecordKey, type NutritionGoals, type Recipe } from './types';

const GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

describe('slotTarget budgeting', () => {
  it('splits remaining budget across selected core slots by assumed weight', () => {
    const selected = [...CORE_SLOTS];
    const breakfast = slotTarget('breakfast', selected, GOALS);
    const lunch = slotTarget('lunch', selected, GOALS);
    const dinner = slotTarget('dinner', selected, GOALS);

    const totalCal = SLOT_ASSUMED.breakfast.calories + SLOT_ASSUMED.lunch.calories + SLOT_ASSUMED.dinner.calories;
    expect(breakfast.calories).toBe(Math.round(GOALS.calories * (SLOT_ASSUMED.breakfast.calories / totalCal)));
    expect(lunch.calories).toBe(Math.round(GOALS.calories * (SLOT_ASSUMED.lunch.calories / totalCal)));
    expect(dinner.calories).toBe(Math.round(GOALS.calories * (SLOT_ASSUMED.dinner.calories / totalCal)));
    expect(breakfast.calories + lunch.calories + dinner.calories).toBeGreaterThan(GOALS.calories - 3);
    expect(breakfast.protein).toBeGreaterThan(0);
  });

  it('does not subtract unselected snack or dessert calories from the budget', () => {
    const coreOnly = slotTarget('lunch', CORE_SLOTS, GOALS);
    const withSnack = slotTarget('lunch', [...CORE_SLOTS, 'morning_snack'], GOALS);

    // Adding an optional snack redistributes the same 2000 kcal; it does not first
    // "assume" the snack was eaten. Lunch target therefore drops, but not by the
    // full assumed-snack amount.
    expect(withSnack.calories).toBeLessThan(coreOnly.calories);

    const lunchDinnerOnly = slotTarget('lunch', ['lunch', 'dinner'], GOALS);
    const wronglyAssumedSnacks =
      OPTIONAL_SLOTS.reduce((sum, s) => sum + SLOT_ASSUMED[s].calories, 0) + SLOT_ASSUMED.breakfast.calories;
    const ifSnacksWereAssumed = Math.max(GOALS.calories - wronglyAssumedSnacks, 80);
    const selectedCal = SLOT_ASSUMED.lunch.calories + SLOT_ASSUMED.dinner.calories;
    const naiveSnackAssumedLunch = Math.round(ifSnacksWereAssumed * (SLOT_ASSUMED.lunch.calories / selectedCal));

    expect(lunchDinnerOnly.calories).toBeGreaterThan(naiveSnackAssumedLunch);
    // Only breakfast is assumed unselected core (380), not snacks.
    expect(lunchDinnerOnly.calories).toBe(
      Math.round((GOALS.calories - SLOT_ASSUMED.breakfast.calories) * (SLOT_ASSUMED.lunch.calories / selectedCal)),
    );
  });
});

describe('recipesForSlot eligibility', () => {
  const breakfast = recipe({
    id: 'b1',
    name: 'Oats',
    mealSlots: ['breakfast'],
    calories: 400,
    protein: 20,
  });
  const component = recipe({
    id: 'c1',
    name: 'Chicken stock',
    isComponent: true,
    mealSlots: ['breakfast', 'lunch', 'dinner'],
    calories: 50,
    protein: 5,
  });
  const excluded = recipe({
    id: 'e1',
    name: 'Cheat pizza',
    excludedFromAuto: true,
    mealSlots: ['dinner'],
    calories: 900,
    protein: 30,
  });
  const dinner = recipe({
    id: 'd1',
    name: 'Stir fry',
    mealSlots: ['dinner'],
    calories: 650,
    protein: 40,
  });
  const morningSnack = recipe({
    id: 's1',
    name: 'Yoghurt',
    mealSlots: ['morning_snack'],
    calories: 150,
    protein: 10,
  });

  it('never picks isComponent or excludedFromAuto recipes', () => {
    const pool = recipesForSlot([breakfast, component, excluded, dinner], 'breakfast');
    expect(pool.map((r) => r.id)).toEqual(['b1']);
  });

  it('treats snack slots as interchangeable', () => {
    const pool = recipesForSlot([morningSnack, dinner], 'afternoon_snack');
    expect(pool.map((r) => r.id)).toEqual(['s1']);
  });

  it('falls back to all eligible recipes when none match the slot', () => {
    const pool = recipesForSlot([breakfast, component, excluded], 'dinner');
    expect(pool.map((r) => r.id)).toEqual(['b1']);
  });
});

describe('generateMealPlan', () => {
  it('skips existing slots and never assigns component or excluded recipes', () => {
    const library: Recipe[] = [
      recipe({
        id: 'ok',
        name: 'OK dinner',
        mealSlots: ['dinner'],
        calories: 660,
        protein: 38,
        ingredients: [{ name: 'chicken' }],
      }),
      recipe({
        id: 'stock',
        name: 'Stock',
        isComponent: true,
        mealSlots: ['dinner'],
        calories: 40,
        protein: 4,
      }),
      recipe({
        id: 'skip',
        name: 'Skip',
        excludedFromAuto: true,
        mealSlots: ['dinner'],
        calories: 660,
        protein: 38,
      }),
    ];

    const existing = new Set([mealSlotRecordKey('monday', 'dinner')]);
    const plan = generateMealPlan(['dinner'], existing, library, GOALS, { random: () => 0 });

    expect(plan.some((s) => s.day === 'monday' && s.slot === 'dinner')).toBe(false);
    expect(plan.length).toBe(6);
    expect(plan.every((s) => s.recipe.id === 'ok')).toBe(true);
  });
});
