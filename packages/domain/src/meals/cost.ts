import { formatMoney, roundMoney } from '../stash/money';
import { storeListLabel } from './markets';
import type { RecipeCostEstimate, RecipeCostLine } from './types';

export type { RecipeCostEstimate, RecipeCostLine } from './types';

export function costMonthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function isCostCurrent(pricedAt: string | null | undefined, now = new Date()): boolean {
  if (!pricedAt) return false;
  const priced = Date.parse(pricedAt);
  if (!Number.isFinite(priced)) return false;
  return priced >= costMonthStartUtc(now).getTime();
}

export function recentlyAttempted(attemptedAt: string | null | undefined, hours = 6, now = new Date()): boolean {
  if (!attemptedAt) return false;
  const at = Date.parse(attemptedAt);
  if (!Number.isFinite(at)) return false;
  return now.getTime() - at < hours * 60 * 60 * 1000;
}

export function costPerServeFromTotal(totalCost: number, servings: number | null | undefined): number {
  const serveCount = servings && servings > 0 ? servings : 1;
  return roundMoney(totalCost / serveCount);
}

export function asFiniteMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return roundMoney(value);
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n) && n >= 0) return roundMoney(n);
  }
  return null;
}

export function normalizeCostLines(raw: unknown): RecipeCostLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name) return [];
    const lineCost = asFiniteMoney(rec.lineCost ?? rec.cost ?? rec.price);
    if (lineCost == null) return [];
    const amount = typeof rec.amount === 'string' && rec.amount.trim() ? rec.amount.trim() : undefined;
    const store = typeof rec.store === 'string' && rec.store.trim() ? rec.store.trim() : undefined;
    const note = typeof rec.note === 'string' && rec.note.trim() ? rec.note.trim() : undefined;
    return [{ name, amount, lineCost, store, note }];
  });
}

export function normalizeRecipeCost(input: {
  totalCost: unknown;
  costPerServe?: unknown;
  currency: string;
  country: string;
  stores?: unknown;
  pricedAt: string;
  servingsBasis: number;
  breakdown?: unknown;
}): RecipeCostEstimate | null {
  const totalCost = asFiniteMoney(input.totalCost);
  if (totalCost == null) return null;
  const servings = input.servingsBasis > 0 ? input.servingsBasis : 1;
  const costPerServe = asFiniteMoney(input.costPerServe) ?? costPerServeFromTotal(totalCost, servings);
  const stores = Array.isArray(input.stores)
    ? input.stores.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
  return {
    totalCost,
    costPerServe,
    currency: input.currency,
    country: input.country,
    stores,
    pricedAt: input.pricedAt,
    servingsBasis: servings,
    breakdown: normalizeCostLines(input.breakdown),
  };
}

export function formatCostPerServe(cost: RecipeCostEstimate | null | undefined): string | null {
  if (!cost) return null;
  return `${formatMoney(cost.costPerServe, cost.currency)} / serve`;
}

export function formatDishCost(cost: RecipeCostEstimate | null | undefined): string | null {
  if (!cost) return null;
  return formatMoney(cost.totalCost, cost.currency);
}

export function formatCostSource(cost: RecipeCostEstimate | null | undefined): string | null {
  if (!cost) return null;
  const stores = storeListLabel(cost.stores);
  const month = new Date(cost.pricedAt);
  const when = Number.isFinite(month.getTime())
    ? month.toLocaleString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null;
  return when ? `Approx. ${stores} prices, ${when}` : `Approx. ${stores} prices`;
}
