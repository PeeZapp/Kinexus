import { afterEach, describe, expect, it, vi } from 'vitest';

const searchColes = vi.fn(async () => [] as { productId: string }[]);
const searchWoolworths = vi.fn(async () => [] as { productId: string }[]);

vi.mock('./coles.js', () => ({
  searchColesProducts: (...args: unknown[]) => searchColes(...args),
}));
vi.mock('./woolworths.js', () => ({
  searchWoolworthsProducts: (...args: unknown[]) => searchWoolworths(...args),
}));

const rpc = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn(async () => ({ data: { state: 'WA' }, error: null }));
const inFilter = vi.fn();
const eqFilter = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock('../supabase-admin.js', () => ({
  isServiceRoleConfigured: () => true,
  createServiceClient: () => ({
    from: (...args: unknown[]) => from(...args),
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}));

import { compareGroceryList, offerFromPriceRow, searchGroceryCatalog } from './compare.js';

function selectBuilder(rows: unknown[], mode: 'eq-then-in' | 'eq-await' | 'eq-maybe' = 'eq-then-in') {
  if (mode === 'eq-await') {
    return {
      select: () => ({
        eq: (...args: unknown[]) => {
          eqFilter(...args);
          return Promise.resolve({ data: rows, error: null });
        },
      }),
    };
  }
  if (mode === 'eq-maybe') {
    return {
      select: () => ({
        eq: (...args: unknown[]) => {
          eqFilter(...args);
          return { maybeSingle };
        },
      }),
    };
  }
  return {
    select: () => ({
      eq: (...args: unknown[]) => {
        eqFilter(...args);
        return {
          in: (...args2: unknown[]) => {
            inFilter(...args2);
            return Promise.resolve({ data: rows, error: null });
          },
        };
      },
    }),
  };
}

describe('offerFromPriceRow', () => {
  it('restores pack and unit fields from stored labels', () => {
    expect(
      offerFromPriceRow({
        product_id: '1',
        name: 'Full Cream Milk 2L',
        brand: 'Homebrand',
        price: 3.2,
        pack_size: '2L',
        unit_price: 0.0016,
        by_weight: false,
        in_stock: true,
      }),
    ).toMatchObject({
      productId: '1',
      shelfPrice: 3.2,
      packMl: 2000,
      perMl: 0.0016,
      weighted: false,
    });
  });
});

describe('compareGroceryList catalogue reads', () => {
  afterEach(() => {
    searchColes.mockReset();
    searchWoolworths.mockReset();
    rpc.mockReset();
    maybeSingle.mockReset();
    inFilter.mockReset();
    eqFilter.mockReset();
    select.mockReset();
    from.mockReset();
  });

  it('serves catalogue hits from grocery_prices with zero live store calls', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'households') return selectBuilder([], 'eq-maybe');
      if (table === 'grocery_store_regions') {
        return selectBuilder(
          [
            { store: 'coles', store_id: '7674' },
            { store: 'woolworths', store_id: '4392' },
          ],
          'eq-await',
        );
      }
      if (table === 'grocery_prices') {
        return selectBuilder([
          {
            ingredient_key: 'milk',
            store: 'coles',
            product_id: 'c1',
            name: 'Milk 2L',
            brand: null,
            price: 3.2,
            pack_size: '2L',
            unit_price: 0.0016,
            by_weight: false,
            in_stock: true,
            fetched_at: '2026-11-08T01:00:00.000Z',
          },
          {
            ingredient_key: 'milk',
            store: 'woolworths',
            product_id: 'w1',
            name: 'Milk 2L',
            brand: null,
            price: 3.1,
            pack_size: '2L',
            unit_price: 0.00155,
            by_weight: false,
            in_stock: true,
            fetched_at: '2026-11-07T01:00:00.000Z',
          },
        ]);
      }
      return selectBuilder([]);
    });

    const result = await compareGroceryList({
      country: 'AU',
      householdId: 'hh-1',
      items: [{ id: '1', name: 'milk', amount: '2L' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(searchColes).not.toHaveBeenCalled();
    expect(searchWoolworths).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(result.pricesAsOf).toBe('2026-11-07T01:00:00.000Z');
    expect(result.comparison.items[0]?.quotes.length).toBeGreaterThan(0);
  });

  it('live-searches misses and queues them for next week', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'households') return selectBuilder([], 'eq-maybe');
      if (table === 'grocery_store_regions') {
        return selectBuilder(
          [
            { store: 'coles', store_id: '7674' },
            { store: 'woolworths', store_id: '4392' },
          ],
          'eq-await',
        );
      }
      if (table === 'grocery_prices') return selectBuilder([]);
      return selectBuilder([]);
    });
    searchColes.mockResolvedValue([
      {
        productId: 'c-rare',
        name: 'Rare Spice 50g',
        brand: null,
        shelfPrice: 4,
        packGrams: 50,
        packMl: null,
        packCount: null,
        perGram: 0.08,
        perMl: null,
        perEach: null,
        weighted: false,
        inStock: true,
      },
    ]);
    searchWoolworths.mockResolvedValue([]);

    const result = await compareGroceryList({
      country: 'AU',
      items: [{ id: '1', name: 'rare spice blend', amount: null }],
    });

    expect(result.ok).toBe(true);
    expect(searchColes).toHaveBeenCalled();
    expect(searchWoolworths).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'queue_grocery_catalogue_request',
      expect.objectContaining({
        p_ingredient_key: expect.any(String),
        p_search_query: expect.any(String),
      }),
    );
  });
});

describe('searchGroceryCatalog catalogue reads', () => {
  afterEach(() => {
    searchColes.mockReset();
    searchWoolworths.mockReset();
    rpc.mockReset();
    from.mockReset();
  });

  it('returns stored offers without live calls on catalogue hits', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'grocery_store_regions') {
        return selectBuilder([{ store: 'coles', store_id: '7674' }], 'eq-await');
      }
      if (table === 'grocery_prices') {
        return selectBuilder([
          {
            ingredient_key: 'milk',
            store: 'coles',
            product_id: 'c1',
            name: 'Milk 2L',
            brand: null,
            price: 3.2,
            pack_size: '2L',
            unit_price: 0.0016,
            by_weight: false,
            in_stock: true,
            fetched_at: '2026-11-08T01:00:00.000Z',
          },
          {
            ingredient_key: 'milk',
            store: 'woolworths',
            product_id: 'w1',
            name: 'Milk 2L',
            brand: null,
            price: 3.1,
            pack_size: '2L',
            unit_price: 0.00155,
            by_weight: false,
            in_stock: true,
            fetched_at: '2026-11-08T01:00:00.000Z',
          },
        ]);
      }
      return selectBuilder([]);
    });

    const result = await searchGroceryCatalog({ country: 'AU', name: 'milk', amount: '2L' });
    expect(result.ok).toBe(true);
    expect(searchColes).not.toHaveBeenCalled();
    expect(searchWoolworths).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
