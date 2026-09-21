import { describe, expect, it } from 'vitest';

import { estimateRecipeNutrition, nutritionCoverageLow, nutritionKey } from './recipe-nutrition';

describe('estimateRecipeNutrition', () => {
  it('updates calories and macros from ingredient amounts and servings', () => {
    const four = estimateRecipeNutrition(
      [
        { name: 'chicken thigh', amount: '400g' },
        { name: 'halloumi', amount: '200g' },
        { name: 'burger bun', amount: '4' },
      ],
      4,
    );
    const two = estimateRecipeNutrition(
      [
        { name: 'chicken thigh', amount: '400g' },
        { name: 'halloumi', amount: '200g' },
        { name: 'burger bun', amount: '4' },
      ],
      2,
    );
    expect(four).toMatchObject({ coveredIngredients: 3, totalIngredients: 3 });
    expect(four!.calories).toBeGreaterThan(300);
    expect(four!.protein).toBeGreaterThan(20);
    expect(two!.calories).toBeGreaterThan(four!.calories);
    expect(two!.protein).toBeGreaterThan(four!.protein);
  });

  it('scales when an ingredient amount changes', () => {
    const small = estimateRecipeNutrition([{ name: 'cheddar', amount: '50g' }], 1);
    const large = estimateRecipeNutrition([{ name: 'cheddar', amount: '100g' }], 1);
    expect(large!.calories).toBeGreaterThan(small!.calories);
    expect(large!.protein).toBeGreaterThan(small!.protein);
  });
});

describe('nutritionKey', () => {
  it('changes when ingredients change', () => {
    const before = nutritionKey([{ name: 'chicken', amount: '200g' }], 4);
    const after = nutritionKey([{ name: 'chicken', amount: '300g' }], 4);
    expect(before).not.toBe(after);
  });
});

describe('nutritionCoverageLow', () => {
  it('is true when nothing matched', () => {
    expect(nutritionCoverageLow(null)).toBe(true);
  });
});
