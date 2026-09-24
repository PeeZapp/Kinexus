import { describe, expect, it } from 'vitest';

import {
  applyCryptoQuotes,
  cryptoHoldingMarketValue,
  cryptoPortfolioTotals,
  isCryptoSymbol,
  normalizeCryptoSymbol,
  yahooCryptoSymbol,
} from './crypto';
import type { FinanceCryptoHolding } from './types';

function holding(
  partial: Partial<FinanceCryptoHolding> & Pick<FinanceCryptoHolding, 'id' | 'symbol' | 'units'>,
): FinanceCryptoHolding {
  return {
    householdId: 'h1',
    name: null,
    costPerUnit: null,
    lastPrice: null,
    pricedAt: null,
    createdAt: '2026-09-24',
    updatedAt: '2026-09-24',
    ...partial,
  };
}

describe('crypto identifiers', () => {
  it('normalises symbols and Yahoo pairs', () => {
    expect(normalizeCryptoSymbol('btc')).toBe('BTC');
    expect(normalizeCryptoSymbol('eth-aud')).toBe('ETH');
    expect(normalizeCryptoSymbol('sol/usd')).toBe('SOL');
    expect(isCryptoSymbol('BTC')).toBe(true);
    expect(isCryptoSymbol('x')).toBe(false);
    expect(yahooCryptoSymbol('btc', 'AUD')).toBe('BTC-AUD');
  });
});

describe('crypto values', () => {
  it('uses last price when present, otherwise cost', () => {
    expect(cryptoHoldingMarketValue({ units: 0.5, lastPrice: 100_000, costPerUnit: 80_000 })).toBe(50_000);
    expect(cryptoHoldingMarketValue({ units: 2, lastPrice: null, costPerUnit: 40 })).toBe(80);
  });

  it('totals holdings and applies quotes', () => {
    const rows = [
      holding({ id: '1', symbol: 'BTC', units: 0.1, costPerUnit: 90_000 }),
      holding({ id: '2', symbol: 'ETH', units: 2, costPerUnit: 3_000 }),
    ];
    const priced = applyCryptoQuotes(
      rows,
      [{ symbol: 'BTC', price: 100_000, currency: 'AUD', name: 'Bitcoin' }],
      '2026-09-24T00:00:00Z',
    );
    const totals = cryptoPortfolioTotals(priced);
    expect(priced[0]?.name).toBe('Bitcoin');
    expect(priced[0]?.lastPrice).toBe(100_000);
    expect(totals.marketValue).toBe(16_000);
    expect(totals.pricedCount).toBe(1);
    expect(totals.unpricedCount).toBe(1);
  });
});
