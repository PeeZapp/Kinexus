import { describe, expect, it } from 'vitest';

import {
  applyQuotes,
  formatHolderId,
  holderIdKind,
  holdingMarketValue,
  isAsxSymbol,
  normalizeAsxSymbol,
  portfolioTotals,
  yahooAsxSymbol,
} from './shares';
import type { FinanceShareHolding } from './types';

function holding(
  partial: Partial<FinanceShareHolding> & Pick<FinanceShareHolding, 'id' | 'symbol' | 'units'>,
): FinanceShareHolding {
  return {
    householdId: 'h1',
    portfolioId: 'p1',
    name: null,
    costPerUnit: null,
    lastPrice: null,
    pricedAt: null,
    createdAt: '2026-09-08',
    updatedAt: '2026-09-08',
    ...partial,
  };
}

describe('share identifiers', () => {
  it('normalises HIN and SRN', () => {
    expect(formatHolderId('x 000 123 4567')).toBe('X0001234567');
    expect(formatHolderId('0001234567')).toBe('X0001234567');
    expect(holderIdKind('X0001234567')).toBe('hin');
    expect(holderIdKind('I1234567890')).toBe('srn');
    expect(holderIdKind('nope')).toBeNull();
  });

  it('normalises ASX codes for Yahoo', () => {
    expect(normalizeAsxSymbol('cba.ax')).toBe('CBA');
    expect(isAsxSymbol('VAS')).toBe(true);
    expect(isAsxSymbol('not a ticker')).toBe(false);
    expect(yahooAsxSymbol('cba')).toBe('CBA.AX');
  });
});

describe('share values', () => {
  it('uses last price when present, otherwise cost', () => {
    expect(holdingMarketValue({ units: 10, lastPrice: 12.5, costPerUnit: 10 })).toBe(125);
    expect(holdingMarketValue({ units: 10, lastPrice: null, costPerUnit: 8 })).toBe(80);
  });

  it('totals a portfolio and applies quotes', () => {
    const rows = [
      holding({ id: '1', symbol: 'CBA', units: 10, costPerUnit: 100 }),
      holding({ id: '2', symbol: 'BHP', units: 4, costPerUnit: 40 }),
    ];
    const priced = applyQuotes(rows, [{ symbol: 'CBA', price: 120, currency: 'AUD', name: 'Commonwealth Bank' }], '2026-09-08T00:00:00Z');
    const totals = portfolioTotals(priced);
    expect(priced[0]?.name).toBe('Commonwealth Bank');
    expect(priced[0]?.lastPrice).toBe(120);
    expect(totals.marketValue).toBe(1360);
    expect(totals.pricedCount).toBe(1);
    expect(totals.unpricedCount).toBe(1);
  });
});
