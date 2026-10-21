import { describe, expect, it } from 'vitest';

import { colesOffer } from './coles.js';
import { woolworthsOffer } from './woolworths.js';

describe('catalogue offer parsers', () => {
  it('reads a Coles weighted product', () => {
    const offer = colesOffer({
      _type: 'PRODUCT',
      id: 5134809,
      name: 'Brown Onions per kg',
      brand: 'Coles',
      size: 'per kg',
      availability: true,
      pricing: { now: 3.9, comparable: '$3.90/ 1kg', unit: { isWeighted: true, price: 3.9 } },
    });
    expect(offer?.weighted).toBe(true);
    expect(offer?.perGram).toBeCloseTo(0.0039);
    expect(offer?.shelfPrice).toBe(3.9);
  });

  it('prices a Woolworths weight step, not the per-kilo display price', () => {
    const offer = woolworthsOffer({
      Stockcode: 25734,
      DisplayName: 'Woolworths RSPCA Approved Chicken Breast Fillet per 300g',
      Brand: 'Woolworths',
      Price: 9.5,
      InstorePrice: 9.5,
      Unit: 'KG',
      PackageSize: 'per 300g',
      CupString: '$9.50 / 1KG',
      PricePerKGLabel: 'Price per kg charged',
      IncrementalPrice: 2.85,
      IncrementalMinimumQuantity: 300,
      IncrementalMinimumQuantityUnit: 'g',
      IsAvailable: true,
      IsInStock: true,
    });
    expect(offer?.shelfPrice).toBe(2.85);
    expect(offer?.packGrams).toBe(300);
    expect(offer?.weighted).toBe(false);
  });

  it('keeps a fixed Woolworths tray as one pack', () => {
    const offer = woolworthsOffer({
      Stockcode: 1,
      DisplayName: 'Woolworths RSPCA Approved Chicken Breast Fillets 650g',
      Price: 9.4,
      InstorePrice: 9.4,
      Unit: 'Each',
      PackageSize: '650g',
      CupString: '$14.46 / 1KG',
      PricePerKGLabel: 'Price per kg charged',
      IsAvailable: true,
      IsInStock: true,
    });
    expect(offer?.shelfPrice).toBe(9.4);
    expect(offer?.packGrams).toBe(650);
    expect(offer?.weighted).toBe(false);
  });

  it('reads a Woolworths pack and its unit price', () => {
    const offer = woolworthsOffer({
      Stockcode: 888,
      DisplayName: 'Woolworths Whole Milk 2L',
      Brand: 'Woolworths',
      Price: 3.4,
      InstorePrice: 3.4,
      IsAvailable: true,
      CupString: '$1.70 / 1L',
    });
    expect(offer?.packMl).toBe(2000);
    expect(offer?.perMl).toBeCloseTo(0.0017);
  });

  it('skips Coles tiles that are not products', () => {
    expect(colesOffer({ _type: 'AD', name: 'Milk', pricing: { now: 1 } })).toBeNull();
  });
});
