import { describe, expect, it } from 'vitest';

import { DEFAULT_MARKET } from './markets';
import {
  catalogPricesFromAi,
  estimateIngredientCostUSD,
  estimateRecipeCost,
  estimateRecipeCostForMarket,
} from './recipe-costing';

describe('recipe costing', () => {
  it('prices chicken breast by weight', () => {
    expect(estimateIngredientCostUSD('chicken breast', '400g')).toBeCloseTo(3.6, 5);
  });

  it('converts Australian recipes into AUD using the Huddle multiplier', () => {
    const cost = estimateRecipeCostForMarket(
      {
        servings: 4,
        ingredients: [
          { name: 'chicken breast', amount: '400g' },
          { name: 'salt', amount: '1 tsp' },
        ],
      },
      DEFAULT_MARKET,
    );
    expect(cost).toMatchObject({
      country: 'AU',
      currency: 'AUD',
      stores: ['Woolworths', 'Coles'],
      servingsBasis: 4,
      coveredIngredients: 2,
      totalIngredients: 2,
    });
    expect(cost?.totalCost).toBe(5.6);
    expect(cost?.costPerServe).toBe(1.4);
  });

  it('lets AI catalog overrides replace the static unit price', () => {
    const raw = estimateRecipeCost(
      { ingredients: [{ name: 'chicken breast fillets', amount: '200g' }] },
      2,
      {
        aiPrices: {
          'chicken breast': { priceUSD: 1.2, baseAmount: 100, baseUnit: 'g' },
        },
      },
    );
    expect(raw?.totalUSD).toBeCloseTo(2.4, 5);
  });

  it('returns null when nothing in the recipe can be priced', () => {
    expect(
      estimateRecipeCost({
        ingredients: [{ name: 'mystery powder blend', amount: '1 pinch' }],
      }),
    ).toBeNull();
  });

  it('fills missing AI keys from the catalog baseline', () => {
    const prices = catalogPricesFromAi({ butter: { priceUSD: 0.99 } });
    expect(prices.butter?.priceUSD).toBe(0.99);
    expect(prices['chicken breast']?.priceUSD).toBe(0.9);
    expect(prices['chicken breast']?.baseAmount).toBe(100);
  });
});
