import { roundMoney } from '../stash/money';
import type { FinanceCryptoHolding, FinanceCryptoQuote, FinancePortfolioTotals } from './types';

const CRYPTO = /^[A-Z0-9]{2,12}$/;
const QUOTE_PAIR = /^([A-Z0-9]{2,12})[-/]([A-Z]{3})$/;

export function normalizeCryptoSymbol(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').toUpperCase().trim().replace(/[^A-Z0-9-/]/g, '');
  const pair = QUOTE_PAIR.exec(cleaned);
  if (pair) return pair[1]!;
  return cleaned.replace(/[^A-Z0-9]/g, '');
}

export function isCryptoSymbol(raw: string | null | undefined): boolean {
  return CRYPTO.test(normalizeCryptoSymbol(raw));
}

export function yahooCryptoSymbol(symbol: string, currency = 'AUD'): string {
  const code = normalizeCryptoSymbol(symbol);
  const fiat = (currency || 'AUD').toUpperCase().replace(/[^A-Z]/g, '') || 'AUD';
  return `${code}-${fiat}`;
}

export function cryptoHoldingMarketValue(
  holding: Pick<FinanceCryptoHolding, 'units' | 'lastPrice' | 'costPerUnit'>,
): number {
  const units = Math.max(0, holding.units);
  const price = holding.lastPrice ?? holding.costPerUnit ?? 0;
  return roundMoney(units * Math.max(0, price));
}

export function cryptoHoldingCost(holding: Pick<FinanceCryptoHolding, 'units' | 'costPerUnit'>): number {
  if (holding.costPerUnit == null) return 0;
  return roundMoney(Math.max(0, holding.units) * Math.max(0, holding.costPerUnit));
}

export function cryptoPortfolioTotals(holdings: readonly FinanceCryptoHolding[]): FinancePortfolioTotals {
  let marketValue = 0;
  let cost = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  for (const holding of holdings) {
    marketValue += cryptoHoldingMarketValue(holding);
    cost += cryptoHoldingCost(holding);
    if (holding.lastPrice != null) pricedCount += 1;
    else unpricedCount += 1;
  }
  return {
    marketValue: roundMoney(marketValue),
    cost: roundMoney(cost),
    gain: roundMoney(marketValue - cost),
    pricedCount,
    unpricedCount,
  };
}

export function applyCryptoQuotes(
  holdings: readonly FinanceCryptoHolding[],
  quotes: readonly FinanceCryptoQuote[],
  pricedAt: string,
): FinanceCryptoHolding[] {
  const bySymbol = new Map(quotes.map((quote) => [normalizeCryptoSymbol(quote.symbol), quote]));
  return holdings.map((holding) => {
    const quote = bySymbol.get(holding.symbol);
    if (!quote) return holding;
    return {
      ...holding,
      lastPrice: quote.price,
      pricedAt,
      name: quote.name || holding.name,
    };
  });
}
