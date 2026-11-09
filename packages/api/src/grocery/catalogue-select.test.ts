import { describe, expect, it } from 'vitest';

import {
  balanceCatalogueBatches,
  batchDayPerth,
  rankIngredientsFromRecipes,
  selectWeeklyCatalogue,
  weekStartPerth,
} from './catalogue-select.js';

describe('catalogue weekly selection', () => {
  it('ranks ingredients by recipe frequency after normalisation', () => {
    const ranked = rankIngredientsFromRecipes([
      [{ name: 'finely chopped brown onions' }, { name: 'garlic cloves' }],
      [{ name: 'brown onion' }, { name: 'extra virgin olive oil' }],
      [{ name: 'sliced brown onions' }],
      [{ name: 'olive oil' }],
    ]);
    expect(ranked[0]?.ingredientKey).toBe('brown onion');
    expect(ranked[0]?.recipeCount).toBe(3);
    expect(ranked.find((row) => row.ingredientKey === 'garlic')?.recipeCount).toBe(1);
    expect(ranked.find((row) => row.ingredientKey === 'olive oil')?.recipeCount).toBe(2);
    expect(ranked[0]?.searchQuery).toContain('onion');
  });

  it('keeps top N plus capped queued requests ranked by request_count', () => {
    const ranked = Array.from({ length: 5 }, (_, i) => ({
      ingredientKey: `item-${i}`,
      displayName: `Item ${i}`,
      searchQuery: `item ${i}`,
      recipeCount: 10 - i,
    }));
    const selected = selectWeeklyCatalogue(
      ranked,
      [
        { ingredientKey: 'miss-a', searchQuery: 'miss a', requestCount: 3 },
        { ingredientKey: 'item-0', searchQuery: 'dup', requestCount: 99 },
        { ingredientKey: 'miss-b', searchQuery: 'miss b', requestCount: 9 },
        { ingredientKey: 'miss-c', searchQuery: 'miss c', requestCount: 1 },
      ],
      3,
      2,
    );
    expect(selected.map((row) => row.ingredientKey)).toEqual([
      'item-0',
      'item-1',
      'item-2',
      'miss-b',
      'miss-a',
    ]);
    expect(selected.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('balances batches by rank across 7 days', () => {
    const ranked = selectWeeklyCatalogue(
      Array.from({ length: 14 }, (_, i) => ({
        ingredientKey: `k-${i}`,
        displayName: `K ${i}`,
        searchQuery: `k ${i}`,
        recipeCount: 20 - i,
      })),
      [],
      14,
      0,
    );
    const batches = balanceCatalogueBatches(ranked, '2026-11-09');
    expect(batches).toHaveLength(14);
    expect(batches.filter((row) => row.batchDay === 0).map((row) => row.rank)).toEqual([1, 8]);
    expect(batches.filter((row) => row.batchDay === 1).map((row) => row.rank)).toEqual([2, 9]);
    for (let day = 0; day < 7; day += 1) {
      expect(batches.filter((row) => row.batchDay === day)).toHaveLength(2);
    }
  });

  it('uses Perth Monday week start and Mon=0 batch days', () => {
    // Sunday 16:00 UTC = Monday 00:00 AWST
    const mondayStart = new Date('2026-11-08T16:00:00.000Z');
    expect(weekStartPerth(mondayStart)).toBe('2026-11-09');
    expect(batchDayPerth(mondayStart)).toBe(0);
    // Friday 17:00 UTC = Saturday 01:00 AWST
    const saturday = new Date('2026-11-13T17:00:00.000Z');
    expect(weekStartPerth(saturday)).toBe('2026-11-09');
    expect(batchDayPerth(saturday)).toBe(5);
  });
});
