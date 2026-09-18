import { describe, expect, it } from 'vitest';

import {
  costPerServeFromTotal,
  formatCostPerServe,
  isCostCurrent,
  normalizeRecipeCost,
  recentlyAttempted,
} from './cost';
import { marketForCountry, marketForHousehold, storeListLabel } from './markets';

describe('recipe cost helpers', () => {
  it('defaults Australian households to Woolworths and Coles', () => {
    expect(marketForCountry(null)).toMatchObject({
      country: 'AU',
      currency: 'AUD',
      stores: ['Woolworths', 'Coles'],
    });
    expect(marketForHousehold({ country: 'au', currency: null }).currency).toBe('AUD');
    expect(storeListLabel(['Woolworths', 'Coles'])).toBe('Woolworths and Coles');
  });

  it('treats estimates from this UTC month as current', () => {
    const now = new Date('2026-09-07T04:00:00.000Z');
    expect(isCostCurrent('2026-09-01T00:00:00.000Z', now)).toBe(true);
    expect(isCostCurrent('2026-08-31T23:59:59.000Z', now)).toBe(false);
    expect(recentlyAttempted('2026-09-07T01:00:00.000Z', 6, now)).toBe(true);
    expect(recentlyAttempted('2026-09-06T20:00:00.000Z', 6, now)).toBe(false);
  });

  it('derives cost per serve and formats it', () => {
    expect(costPerServeFromTotal(12.4, 4)).toBe(3.1);
    const cost = normalizeRecipeCost({
      totalCost: '12.40',
      currency: 'AUD',
      country: 'AU',
      stores: ['Woolworths', 'Coles'],
      pricedAt: '2026-09-01T00:00:00.000Z',
      servingsBasis: 4,
      breakdown: [{ name: 'chicken', amount: '400g', lineCost: 6.2, store: 'Woolworths' }],
    });
    expect(cost?.costPerServe).toBe(3.1);
    expect(cost?.breakdown).toHaveLength(1);
    expect(formatCostPerServe(cost)).toMatch(/3\.10/);
  });
});
