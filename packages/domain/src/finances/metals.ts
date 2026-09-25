import { roundMoney } from '../stash/money';
import type { FinanceMetalHolding, FinanceMetalQuote, FinancePortfolioTotals, MetalKind, MetalUnit } from './types';
import { METAL_KINDS, METAL_UNITS } from './types';

/** Grams in one troy ounce. Bullion quotes are per troy ounce, not an avoirdupois ounce. */
export const TROY_OUNCE_GRAMS = 31.1034768;

const KIND_SET = new Set<string>(METAL_KINDS);
const UNIT_SET = new Set<string>(METAL_UNITS);

const KIND_LABELS: Record<MetalKind, string> = {
  gold: 'Gold',
  silver: 'Silver',
  platinum: 'Platinum',
  palladium: 'Palladium',
};

const YAHOO_TICKERS: Record<MetalKind, string> = {
  gold: 'GC=F',
  silver: 'SI=F',
  platinum: 'PL=F',
  palladium: 'PA=F',
};

export function isMetalKind(value: string | null | undefined): value is MetalKind {
  return Boolean(value && KIND_SET.has(value));
}

export function isMetalUnit(value: string | null | undefined): value is MetalUnit {
  return Boolean(value && UNIT_SET.has(value));
}

export function metalKindLabel(metal: MetalKind): string {
  return KIND_LABELS[metal];
}

export function metalUnitLabel(unit: MetalUnit): string {
  if (unit === 'oz') return 'troy oz';
  if (unit === 'g') return 'g';
  return 'kg';
}

export function metalUnitLongLabel(unit: MetalUnit): string {
  if (unit === 'oz') return 'troy ounce';
  if (unit === 'g') return 'gram';
  return 'kilogram';
}

export function yahooMetalTicker(metal: MetalKind): string {
  return YAHOO_TICKERS[metal];
}

export function parseMetalQuantity(raw: string | number | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return 1;
  const value = Number(String(raw).trim().replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 1 || !Number.isInteger(value)) return null;
  return value;
}

export function metalHoldingQuantity(quantity: number | null | undefined): number {
  const count = Math.floor(quantity ?? 1);
  return count >= 1 ? count : 1;
}

export function metalHoldingSizeLabel(holding: {
  weight: number;
  unit: MetalUnit;
  quantity?: number | null;
}): string {
  const each = `${holding.weight} ${metalUnitLabel(holding.unit)}`;
  const count = metalHoldingQuantity(holding.quantity);
  return count > 1 ? `${count} × ${each}` : each;
}

function metalWeightTotal(holding: { weight: number; quantity?: number | null }): number {
  return Math.max(0, holding.weight) * metalHoldingQuantity(holding.quantity);
}

function roundWeight(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function parseMetalWeight(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 0) return null;
  return roundWeight(value);
}

export function weightToTroyOunces(weight: number, unit: MetalUnit): number {
  const amount = Math.max(0, weight);
  if (unit === 'oz') return amount;
  if (unit === 'g') return amount / TROY_OUNCE_GRAMS;
  return (amount * 1000) / TROY_OUNCE_GRAMS;
}

export function convertMetalWeight(weight: number, from: MetalUnit, to: MetalUnit): number {
  const ounces = weightToTroyOunces(weight, from);
  if (to === 'oz') return roundWeight(ounces);
  if (to === 'g') return roundWeight(ounces * TROY_OUNCE_GRAMS);
  return roundWeight((ounces * TROY_OUNCE_GRAMS) / 1000);
}

export function convertMetalCostPerUnit(cost: number, from: MetalUnit, to: MetalUnit): number {
  const fromOz = weightToTroyOunces(1, from);
  const toOz = weightToTroyOunces(1, to);
  if (fromOz === 0) return 0;
  return roundMoney(Math.max(0, cost) * (toOz / fromOz));
}

export function metalSpotPerUnit(pricePerTroyOz: number, unit: MetalUnit): number {
  return roundMoney(Math.max(0, pricePerTroyOz) * weightToTroyOunces(1, unit));
}

export function parseMetalPremium(raw: string | number | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return 0;
  const cleaned = String(raw).trim().replace(/%$/, '').replace(/,/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < -100) return null;
  return Math.round(value * 100) / 100;
}

export function metalPremiumMultiplier(premiumPercent: number | null | undefined): number {
  const premium = Number.isFinite(premiumPercent) ? premiumPercent! : 0;
  return Math.max(0, 1 + premium / 100);
}

export function metalPremiumLabel(premiumPercent: number | null | undefined): string | null {
  const premium = Number.isFinite(premiumPercent) ? premiumPercent! : 0;
  if (premium === 0) return null;
  const text = Number.isInteger(premium) ? String(Math.abs(premium)) : String(Math.abs(premium));
  return premium > 0 ? `+${text}% over spot` : `${text}% under spot`;
}

export type MetalValueBasis = 'spot' | 'premium';

export function metalHoldingMarketValue(
  holding: Pick<FinanceMetalHolding, 'weight' | 'unit' | 'lastPrice' | 'costPerUnit'> & {
    premiumPercent?: number | null;
    quantity?: number | null;
  },
  basis: MetalValueBasis = 'premium',
): number {
  const weight = metalWeightTotal(holding);
  if (holding.lastPrice != null) {
    const spot = weightToTroyOunces(weight, holding.unit) * Math.max(0, holding.lastPrice);
    const multiplier = basis === 'spot' ? 1 : metalPremiumMultiplier(holding.premiumPercent);
    return roundMoney(spot * multiplier);
  }
  if (holding.costPerUnit == null) return 0;
  return roundMoney(weight * Math.max(0, holding.costPerUnit));
}

export function metalHoldingCost(
  holding: Pick<FinanceMetalHolding, 'weight' | 'costPerUnit'> & { quantity?: number | null },
): number {
  if (holding.costPerUnit == null) return 0;
  return roundMoney(metalWeightTotal(holding) * Math.max(0, holding.costPerUnit));
}

export function metalPortfolioTotals(
  holdings: readonly FinanceMetalHolding[],
  basis: MetalValueBasis = 'premium',
): FinancePortfolioTotals {
  let marketValue = 0;
  let cost = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  for (const holding of holdings) {
    marketValue += metalHoldingMarketValue(holding, basis);
    cost += metalHoldingCost(holding);
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

export function applyMetalQuotes(
  holdings: readonly FinanceMetalHolding[],
  quotes: readonly FinanceMetalQuote[],
  pricedAt: string,
): FinanceMetalHolding[] {
  const byMetal = new Map(quotes.map((quote) => [quote.metal, quote]));
  return holdings.map((holding) => {
    const quote = byMetal.get(holding.metal);
    if (!quote) return holding;
    return {
      ...holding,
      lastPrice: quote.price,
      pricedAt,
    };
  });
}
