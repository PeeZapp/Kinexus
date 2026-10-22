import { describe, expect, it } from 'vitest';

import { scaleRecipeToServings } from './scale-servings';
import type { Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

describe('scaleRecipeToServings', () => {
  const lasagne = recipe({
    id: 'lasagne',
    name: 'Lasagne',
    servings: 8,
    calories: 640,
    ingredients: [
      { name: 'Mince', amount: '800g' },
      { name: 'Salt', amount: 'to taste' },
    ],
    cost: {
      totalCost: 24,
      costPerServe: 3,
      currency: 'AUD',
      country: 'AU',
      stores: [],
      pricedAt: '2026-10-01',
      servingsBasis: 8,
      breakdown: [{ name: 'Mince', amount: '800g', lineCost: 16 }],
    },
  });

  it('scales amounts and dish cost down to the requested serves', () => {
    const scaled = scaleRecipeToServings(lasagne, 2);
    expect(scaled.servings).toBe(2);
    expect(scaled.ingredients?.[0]?.amount).toBe('200g');
    expect(scaled.ingredients?.[1]?.amount).toBe('to taste');
    expect(scaled.calories).toBe(640);
    expect(scaled.cost?.totalCost).toBe(6);
    expect(scaled.cost?.costPerServe).toBe(3);
    expect(scaled.cost?.servingsBasis).toBe(2);
    expect(scaled.cost?.breakdown[0]?.lineCost).toBe(4);
  });

  it('leaves the recipe when the yield is already the requested count', () => {
    expect(scaleRecipeToServings(lasagne, 8)).toBe(lasagne);
  });

  it('does not invent a scale when servings are missing', () => {
    const bare = recipe({ id: 'bare', name: 'Bare', ingredients: [{ name: 'Flour', amount: '200g' }] });
    expect(scaleRecipeToServings(bare, 2)).toBe(bare);
  });
});
