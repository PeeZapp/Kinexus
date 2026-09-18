import { roundMoney } from '../stash/money';
import type {
  FinanceHolderKind,
  FinancePortfolioTotals,
  FinanceShareHolding,
  FinanceShareQuote,
} from './types';

const HIN = /^X\d{10}$/;
const BARE_HIN = /^\d{10}$/;
const SRN = /^I[A-Z0-9]{8,12}$/;
const ASX = /^[A-Z0-9]{1,6}$/;

export function normalizeHolderId(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[\s-]/g, '');
}

export function formatHolderId(raw: string | null | undefined): string | null {
  const value = normalizeHolderId(raw);
  if (!value) return null;
  if (BARE_HIN.test(value)) return `X${value}`;
  return value;
}

export function holderIdKind(raw: string | null | undefined): FinanceHolderKind | null {
  const value = formatHolderId(raw);
  if (!value) return null;
  if (HIN.test(value)) return 'hin';
  if (SRN.test(value)) return 'srn';
  return null;
}

export function holderIdLabel(kind: FinanceHolderKind | null | undefined): string {
  if (kind === 'srn') return 'SRN';
  return 'HIN';
}

export function normalizeAsxSymbol(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').toUpperCase().trim().replace(/\.AX$/i, '').replace(/[^A-Z0-9]/g, '');
  return cleaned;
}

export function isAsxSymbol(raw: string | null | undefined): boolean {
  return ASX.test(normalizeAsxSymbol(raw));
}

export function yahooAsxSymbol(symbol: string): string {
  return `${normalizeAsxSymbol(symbol)}.AX`;
}

export function holdingMarketValue(holding: Pick<FinanceShareHolding, 'units' | 'lastPrice' | 'costPerUnit'>): number {
  const units = Math.max(0, holding.units);
  const price = holding.lastPrice ?? holding.costPerUnit ?? 0;
  return roundMoney(units * Math.max(0, price));
}

export function holdingCost(holding: Pick<FinanceShareHolding, 'units' | 'costPerUnit'>): number {
  if (holding.costPerUnit == null) return 0;
  return roundMoney(Math.max(0, holding.units) * Math.max(0, holding.costPerUnit));
}

export function portfolioTotals(holdings: readonly FinanceShareHolding[]): FinancePortfolioTotals {
  let marketValue = 0;
  let cost = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  for (const holding of holdings) {
    marketValue += holdingMarketValue(holding);
    cost += holdingCost(holding);
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

export function applyQuotes(
  holdings: readonly FinanceShareHolding[],
  quotes: readonly FinanceShareQuote[],
  pricedAt: string,
): FinanceShareHolding[] {
  const bySymbol = new Map(quotes.map((quote) => [normalizeAsxSymbol(quote.symbol), quote]));
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

export function holdingsForPortfolio(
  portfolioId: string,
  holdings: readonly FinanceShareHolding[],
): FinanceShareHolding[] {
  return holdings
    .filter((holding) => holding.portfolioId === portfolioId)
    .slice()
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}
