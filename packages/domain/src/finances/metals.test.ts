import { describe, expect, it } from 'vitest';

import {
  applyMetalQuotes,
  convertMetalCostPerUnit,
  convertMetalWeight,
  isMetalKind,
  metalHoldingMarketValue,
  metalHoldingSizeLabel,
  metalPortfolioTotals,
  metalPremiumLabel,
  metalSpotPerUnit,
  parseMetalPremium,
  parseMetalQuantity,
  parseMetalWeight,
  weightToTroyOunces,
  yahooMetalTicker,
} from './metals';
import type { FinanceMetalHolding } from './types';

function holding(
  partial: Partial<FinanceMetalHolding> & Pick<FinanceMetalHolding, 'id' | 'metal' | 'weight' | 'unit'>,
): FinanceMetalHolding {
  return {
    householdId: 'h1',
    createdBy: null,
    name: null,
    costPerUnit: null,
    premiumPercent: 0,
    quantity: 1,
    lastPrice: null,
    pricedAt: null,
    createdAt: '2026-09-25',
    updatedAt: '2026-09-25',
    ...partial,
  };
}

describe('metal weight', () => {
  it('keeps troy ounces and converts grams', () => {
    expect(isMetalKind('gold')).toBe(true);
    expect(isMetalKind('copper')).toBe(false);
    expect(yahooMetalTicker('silver')).toBe('SI=F');
    expect(weightToTroyOunces(2, 'oz')).toBe(2);
    expect(convertMetalWeight(1, 'oz', 'g')).toBe(31.103477);
    expect(convertMetalWeight(1, 'kg', 'oz')).toBeCloseTo(32.150747, 5);
    expect(parseMetalWeight('31.103477')).toBe(31.103477);
    expect(parseMetalWeight('-1')).toBeNull();
  });

  it('moves average cost with the unit', () => {
    expect(convertMetalCostPerUnit(3110.35, 'oz', 'g')).toBe(100);
    expect(metalSpotPerUnit(3110.35, 'g')).toBe(100);
    expect(metalSpotPerUnit(4000, 'oz')).toBe(4000);
  });
});

describe('metal values', () => {
  it('prices weight from the troy-ounce spot, otherwise cost', () => {
    expect(
      metalHoldingMarketValue({ weight: 10, unit: 'g', lastPrice: 4000, costPerUnit: 100 }),
    ).toBe(1286.03);
    expect(metalHoldingMarketValue({ weight: 10, unit: 'g', lastPrice: null, costPerUnit: 100 })).toBe(1000);
  });

  it('adds a premium over spot and leaves the cost fallback unchanged', () => {
    expect(
      metalHoldingMarketValue({ weight: 1, unit: 'oz', lastPrice: 4000, costPerUnit: 3000, premiumPercent: 10 }),
    ).toBe(4400);
    expect(
      metalHoldingMarketValue({ weight: 1, unit: 'oz', lastPrice: null, costPerUnit: 3000, premiumPercent: 10 }),
    ).toBe(3000);
    expect(parseMetalPremium('10%')).toBe(10);
    expect(parseMetalPremium('')).toBe(0);
    expect(parseMetalPremium('-101')).toBeNull();
    expect(metalPremiumLabel(10)).toBe('+10% over spot');
    expect(metalPremiumLabel(-5)).toBe('5% under spot');
  });

  it('values a count of pieces from the weight of one', () => {
    expect(
      metalHoldingMarketValue({
        weight: 1,
        unit: 'oz',
        quantity: 2,
        lastPrice: 4000,
        costPerUnit: 50,
        premiumPercent: 10,
      }),
    ).toBe(8800);
    expect(
      metalHoldingMarketValue(
        {
          weight: 1,
          unit: 'oz',
          quantity: 2,
          lastPrice: 4000,
          costPerUnit: 50,
          premiumPercent: 10,
        },
        'spot',
      ),
    ).toBe(8000);
    expect(metalHoldingSizeLabel({ weight: 1, unit: 'oz', quantity: 2 })).toBe('2 × 1 troy oz');
    expect(parseMetalQuantity('2')).toBe(2);
    expect(parseMetalQuantity('')).toBe(1);
    expect(parseMetalQuantity('2.5')).toBeNull();
  });

  it('applies one spot to every holding of that metal', () => {
    const rows = [
      holding({ id: '1', metal: 'gold', weight: 1, unit: 'oz', costPerUnit: 3000 }),
      holding({ id: '2', metal: 'silver', weight: 20, unit: 'oz', costPerUnit: 40 }),
    ];
    const priced = applyMetalQuotes(
      rows,
      [{ metal: 'gold', price: 4200, currency: 'AUD', name: 'Gold' }],
      '2026-09-25T00:00:00Z',
    );
    const totals = metalPortfolioTotals(priced);
    expect(priced[0]?.lastPrice).toBe(4200);
    expect(priced[1]?.lastPrice).toBeNull();
    expect(totals.marketValue).toBe(5000);
    expect(totals.pricedCount).toBe(1);
    expect(totals.unpricedCount).toBe(1);
  });
});
