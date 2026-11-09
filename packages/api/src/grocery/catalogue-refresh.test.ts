import { describe, expect, it, vi } from 'vitest';

import {
  buildWorkUnits,
  filterPendingWork,
  regionsForStates,
  rolloverBatchDays,
  type CatalogueItemRow,
  type StoreRegion,
} from './catalogue-refresh.js';

const regions: StoreRegion[] = [
  { state: 'WA', store: 'coles', storeId: '7674' },
  { state: 'WA', store: 'woolworths', storeId: '4392' },
  { state: 'NSW', store: 'coles', storeId: '1000' },
];

describe('catalogue refresh helpers', () => {
  it('looks up store ids from regions for active states only', () => {
    expect(regionsForStates(regions, ['WA'])).toEqual([
      { state: 'WA', store: 'coles', storeId: '7674' },
      { state: 'WA', store: 'woolworths', storeId: '4392' },
    ]);
    expect(regionsForStates(regions, ['NSW']).map((row) => row.storeId)).toEqual(['1000']);
  });

  it('builds one work unit per item × store × state', () => {
    const items: CatalogueItemRow[] = [
      { ingredientKey: 'milk', displayName: 'milk', searchQuery: 'milk', rank: 1, batchDay: 0 },
      { ingredientKey: 'eggs', displayName: 'eggs', searchQuery: 'eggs', rank: 2, batchDay: 0 },
    ];
    const units = buildWorkUnits(items, regionsForStates(regions, ['WA']));
    expect(units).toHaveLength(4);
    expect(units.map((unit) => `${unit.ingredientKey}:${unit.store}:${unit.storeId}`)).toEqual([
      'milk:coles:7674',
      'milk:woolworths:4392',
      'eggs:coles:7674',
      'eggs:woolworths:4392',
    ]);
  });

  it('skips work units already priced this week', () => {
    const items: CatalogueItemRow[] = [
      { ingredientKey: 'milk', displayName: 'milk', searchQuery: 'milk', rank: 1, batchDay: 0 },
    ];
    const units = buildWorkUnits(items, regionsForStates(regions, ['WA']));
    const pending = filterPendingWork(units, new Set(['milk|coles|WA']));
    expect(pending).toHaveLength(1);
    expect(pending[0]?.store).toBe('woolworths');
  });

  it('rolls incomplete earlier-day items into today, not past Sunday', () => {
    const items: CatalogueItemRow[] = [
      { ingredientKey: 'done', displayName: 'done', searchQuery: 'done', rank: 1, batchDay: 0 },
      { ingredientKey: 'fail', displayName: 'fail', searchQuery: 'fail', rank: 2, batchDay: 0 },
      { ingredientKey: 'today', displayName: 'today', searchQuery: 'today', rank: 3, batchDay: 2 },
    ];
    const { next, rolledKeys } = rolloverBatchDays(items, 2, new Set(['done']));
    expect(rolledKeys).toEqual(['fail']);
    expect(next.find((row) => row.ingredientKey === 'fail')?.batchDay).toBe(2);
    expect(next.find((row) => row.ingredientKey === 'done')?.batchDay).toBe(0);

    const sunday = rolloverBatchDays(
      [{ ingredientKey: 'stuck', displayName: 'stuck', searchQuery: 'stuck', rank: 1, batchDay: 6 }],
      6,
      new Set(),
    );
    expect(sunday.rolledKeys).toEqual([]);
    expect(sunday.next[0]?.batchDay).toBe(6);
  });

  it('mock store search receives region store ids, not hardcoded defaults', async () => {
    const search = vi.fn(async () => [
      {
        productId: '1',
        name: 'Full cream milk 2L',
        brand: 'Homebrand',
        shelfPrice: 3.2,
        packGrams: null,
        packMl: 2000,
        packCount: null,
        perGram: null,
        perMl: 0.0016,
        perEach: null,
        weighted: false,
        inStock: true,
      },
    ]);
    const units = buildWorkUnits(
      [{ ingredientKey: 'milk', displayName: 'milk', searchQuery: 'milk', rank: 1, batchDay: 0 }],
      regionsForStates(regions, ['WA']),
    );
    for (const unit of units) {
      await search(unit.store, unit.searchQuery, unit.storeId);
    }
    expect(search).toHaveBeenCalledWith('coles', 'milk', '7674');
    expect(search).toHaveBeenCalledWith('woolworths', 'milk', '4392');
    expect(search).not.toHaveBeenCalledWith('coles', 'milk', undefined);
  });
});
