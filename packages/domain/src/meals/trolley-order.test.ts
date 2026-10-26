import { describe, expect, it } from 'vitest';

import { trolleyOrder } from './trolley-order';
import type { StoredGroceryQuote } from './grocery-compare';

function quote(chainId: string, productId: string, productName: string): StoredGroceryQuote {
  return {
    name: 'chicken breast',
    amount: '500g',
    quotes: [
      {
        chainId,
        chainName: chainId,
        storeId: chainId,
        storeName: chainId,
        productId,
        productName,
        price: 11,
        packs: 1,
      },
    ],
  };
}

describe('trolleyOrder', () => {
  const breast = {
    id: 'breast',
    name: 'chicken breast',
    amount: '500g',
    quote: quote('woolworths', '123', 'Chicken Breast Fillets 500g'),
  };

  it('keeps the matched product for the preferred shop', () => {
    const order = trolleyOrder([breast], 'woolworths');
    expect(order?.lines).toEqual([
      {
        itemId: 'breast',
        name: 'chicken breast',
        amount: '500g',
        chainId: 'woolworths',
        productId: '123',
        productName: 'Chicken Breast Fillets 500g',
        packs: 1,
      },
    ]);
    expect(order?.skipped).toEqual([]);
  });

  it('skips an item that is only matched at the other shop', () => {
    const order = trolleyOrder([breast], 'coles');
    expect(order?.lines).toEqual([]);
    expect(order?.skipped.map((row) => row.name)).toEqual(['chicken breast']);
  });

  it('leaves checked items out of the trolley', () => {
    const order = trolleyOrder([{ ...breast, checked: true }], 'woolworths');
    expect(order?.lines).toEqual([]);
    expect(order?.skipped).toEqual([]);
  });
});
