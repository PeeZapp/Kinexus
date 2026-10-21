import { describe, expect, it } from 'vitest';

import { lookupChainsForCountry } from './grocery-chains';
import {
  catalogueQuery,
  compareShoppingList,
  comparisonFromLineQuotes,
  offerMatchesIngredient,
  storedGroceryQuoteMatches,
  parsePackSize,
  parseUnitPrice,
  pickCatalogueOffer,
  type CatalogueOffer,
} from './grocery-compare';

function offer(overrides: Partial<CatalogueOffer> & Pick<CatalogueOffer, 'name' | 'shelfPrice'>): CatalogueOffer {
  return {
    productId: overrides.name,
    brand: 'House',
    packGrams: null,
    packMl: null,
    packCount: null,
    perGram: null,
    perMl: null,
    perEach: null,
    weighted: false,
    inStock: true,
    ...overrides,
  };
}

describe('catalogue parsing', () => {
  it('reads pack size and unit price text', () => {
    expect(parsePackSize('6x375ml')).toEqual({ grams: null, ml: 2250, count: null });
    expect(parsePackSize('approx. 35g each')).toEqual({ grams: 35, ml: null, count: null });
    expect(parsePackSize('2L')).toEqual({ grams: null, ml: 2000, count: null });
    expect(parseUnitPrice('$13.00/ 1kg')).toEqual({ perGram: 0.013, perMl: null, perEach: null });
    expect(parseUnitPrice('$1.70 / 1L')).toEqual({ perGram: null, perMl: 0.0017, perEach: null });
  });

  it('keeps varieties apart and skips sauces', () => {
    expect(catalogueQuery('finely chopped brown onions')).toBe('brown onion');
    expect(offerMatchesIngredient('brown onion', 'Coles Brown Onions 1kg')).toBe(true);
    expect(offerMatchesIngredient('brown onion', 'Red Onion 1kg')).toBe(false);
    expect(offerMatchesIngredient('onion', 'Brown Onion Shallots Loose')).toBe(false);
    expect(offerMatchesIngredient('milk', 'Almond Milk 1L')).toBe(false);
    expect(offerMatchesIngredient('milk', 'Woolworths Whole Milk 2L')).toBe(true);
    expect(offerMatchesIngredient('chicken breast', 'Crumbed Chicken Schnitzel')).toBe(false);
  });
});

describe('pickCatalogueOffer', () => {
  it('buys enough packs to cover the list amount', () => {
    const picked = pickCatalogueOffer('milk', '3L', [
      offer({ name: 'Woolworths Whole Milk 2L', shelfPrice: 3.4, packMl: 2000, perMl: 0.0017 }),
      offer({ name: 'Woolworths Whole Milk 1L', shelfPrice: 2.5, packMl: 1000, perMl: 0.0025 }),
    ]);
    expect(picked?.offer.name).toBe('Woolworths Whole Milk 2L');
    expect(picked?.packs).toBe(2);
    expect(picked?.price).toBe(6.8);
  });

  it('buys whole weight steps to cover the amount', () => {
    const picked = pickCatalogueOffer('chicken breast', '650g', [
      offer({ name: 'Chicken Breast Fillet per 300g', shelfPrice: 2.85, packGrams: 300, perGram: 0.0095 }),
      offer({ name: 'Chicken Breast Fillets 650g', shelfPrice: 9.4, packGrams: 650, perGram: 0.01446 }),
    ]);
    expect(picked?.offer.name).toBe('Chicken Breast Fillet per 300g');
    expect(picked?.packs).toBe(3);
    expect(picked?.price).toBe(8.55);
  });

  it('prices loose produce by the weight needed', () => {
    const picked = pickCatalogueOffer('brown onion', '200g', [
      offer({
        name: 'Brown Onions per kg',
        shelfPrice: 3.9,
        weighted: true,
        perGram: 0.0039,
        packGrams: 1000,
      }),
    ]);
    expect(picked?.price).toBe(0.78);
  });

  it('skips a bulk bag when the list has no amount', () => {
    const picked = pickCatalogueOffer('rice', null, [
      offer({ name: 'Rice 5kg', shelfPrice: 8, packGrams: 5000, perGram: 0.0016 }),
      offer({ name: 'Rice 1kg', shelfPrice: 2.5, packGrams: 1000, perGram: 0.0025 }),
    ]);
    expect(picked?.offer.name).toBe('Rice 1kg');
  });
});

describe('compareShoppingList', () => {
  const milk = offer({ name: 'Whole Milk 2L', shelfPrice: 3, packMl: 2000 });
  const onion = offer({ name: 'Brown Onions 1kg', shelfPrice: 2, packGrams: 1000 });

  it('names the cheapest line and the fullest cheaper basket', () => {
    const comparison = compareShoppingList({
      currency: 'AUD',
      items: [
        { id: 'milk', name: 'milk', amount: '2L' },
        { id: 'onion', name: 'brown onion', amount: '1kg' },
      ],
      shops: [
        {
          chainId: 'coles',
          chainName: 'Coles',
          storeId: '270',
          storeName: 'Coles Subiaco',
          offersByItemId: {
            milk: [{ ...milk, shelfPrice: 3.5 }],
            onion: [{ ...onion, shelfPrice: 1.5 }],
          },
        },
        {
          chainId: 'woolworths',
          chainName: 'Woolworths',
          storeId: '4392',
          storeName: 'Subiaco Square',
          offersByItemId: {
            milk: [milk],
            onion: [],
          },
        },
      ],
    });

    const milkRow = comparison.items.find((item) => item.itemId === 'milk');
    expect(milkRow?.cheapestChainId).toBe('woolworths');
    expect(comparison.cheapestShop?.chainId).toBe('coles');
    expect(comparison.cheapestShop?.pricedCount).toBe(2);
    expect(comparison.shops.find((shop) => shop.chainId === 'woolworths')?.pricedCount).toBe(1);
  });
});

describe('saved quotes', () => {
  it('keeps a saved price only for the same name and amount', () => {
    const quote = { name: 'chicken breast', amount: '650g', quotes: [] };
    expect(storedGroceryQuoteMatches({ name: 'chicken breast', amount: '650g' }, quote)).toBe(true);
    expect(storedGroceryQuoteMatches({ name: 'chicken breast', amount: '300g' }, quote)).toBe(false);
    expect(storedGroceryQuoteMatches({ name: 'chicken breast', amount: '650g' }, null)).toBe(false);
  });

  it('rebuilds the cheapest shop from saved line quotes', () => {
    const comparison = comparisonFromLineQuotes({
      currency: 'AUD',
      items: [
        {
          id: 'milk',
          quotes: [
            {
              chainId: 'woolworths',
              chainName: 'Woolworths',
              storeId: 'woolworths',
              storeName: 'Woolworths',
              productId: '1',
              productName: 'Milk 2L',
              price: 3,
              packs: 1,
            },
            {
              chainId: 'coles',
              chainName: 'Coles',
              storeId: 'coles',
              storeName: 'Coles',
              productId: '2',
              productName: 'Milk 2L',
              price: 3.5,
              packs: 1,
            },
          ],
        },
        {
          id: 'onion',
          quotes: [
            {
              chainId: 'coles',
              chainName: 'Coles',
              storeId: 'coles',
              storeName: 'Coles',
              productId: '3',
              productName: 'Brown Onions 1kg',
              price: 2,
              packs: 1,
            },
          ],
        },
      ],
    });
    expect(comparison.items.find((item) => item.itemId === 'milk')?.cheapestChainId).toBe('woolworths');
    expect(comparison.cheapestShop?.chainId).toBe('coles');
    expect(comparison.cheapestShop?.pricedCount).toBe(2);
  });
});

describe('lookup chains', () => {
  it('enables Coles and Woolworths for Australia', () => {
    expect(lookupChainsForCountry('AU').map((chain) => chain.id)).toEqual(['coles', 'woolworths']);
    expect(lookupChainsForCountry('GB')).toEqual([]);
  });
});
