import type { HouseholdRole } from '../household/types';
import { canSeeShared, canEditShared } from '../household/access';

export const INVESTMENT_STATUSES = ['watching', 'idea', 'holding', 'closed'] as const;
export type InvestmentStatus = (typeof INVESTMENT_STATUSES)[number];

export const INVESTMENT_ALERT_KINDS = ['above', 'below', 'pct_move'] as const;
export type InvestmentAlertKind = (typeof INVESTMENT_ALERT_KINDS)[number];

export const TRADE_SIDES = ['buy', 'sell'] as const;
export type TradeSide = (typeof TRADE_SIDES)[number];

export type InvestmentVisibility = 'household' | 'private';

export type FinanceInvestmentItem = {
  id: string;
  householdId: string;
  createdBy: string;
  visibility: InvestmentVisibility;
  symbol: string | null;
  title: string;
  thesis: string;
  notes: string;
  tags: string[];
  status: InvestmentStatus;
  targetPrice: number | null;
  stopPrice: number | null;
  alertAbove: number | null;
  alertBelow: number | null;
  alertPctMove: number | null;
  lastPrice: number | null;
  lastPriceAt: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type FinanceInvestmentAlert = {
  id: string;
  householdId: string;
  itemId: string;
  kind: InvestmentAlertKind;
  threshold: number;
  active: boolean;
  lastTriggeredAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FinanceTradeJournalEntry = {
  id: string;
  householdId: string;
  createdBy: string;
  visibility: InvestmentVisibility;
  itemId: string | null;
  symbol: string | null;
  side: TradeSide;
  qty: number;
  price: number;
  fees: number;
  tradedOn: string;
  thesis: string;
  emotions: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export function isInvestmentStatus(value: string): value is InvestmentStatus {
  return (INVESTMENT_STATUSES as readonly string[]).includes(value);
}

export function isTradeSide(value: string): value is TradeSide {
  return (TRADE_SIDES as readonly string[]).includes(value);
}

export function investmentStatusLabel(status: InvestmentStatus): string {
  switch (status) {
    case 'watching':
      return 'Watching';
    case 'idea':
      return 'Idea';
    case 'holding':
      return 'Holding';
    case 'closed':
      return 'Closed';
  }
}

export function canViewInvestmentItem(
  item: Pick<FinanceInvestmentItem, 'createdBy' | 'visibility'>,
  opts: { role: HouseholdRole | null; userId: string | null },
): boolean {
  return canSeeShared({
    role: opts.role,
    userId: opts.userId,
    personId: null,
    createdBy: item.createdBy,
    visibility: item.visibility,
    personIds: [],
  });
}

export function canEditInvestmentItem(
  item: Pick<FinanceInvestmentItem, 'createdBy' | 'visibility'>,
  opts: { role: HouseholdRole | null; userId: string | null },
): boolean {
  return canEditShared({
    role: opts.role,
    userId: opts.userId,
    personId: null,
    createdBy: item.createdBy,
    visibility: item.visibility,
    personIds: [],
  });
}

export function canViewTradeEntry(
  entry: Pick<FinanceTradeJournalEntry, 'createdBy' | 'visibility'>,
  opts: { role: HouseholdRole | null; userId: string | null },
): boolean {
  return canViewInvestmentItem(entry, opts);
}

export function canEditTradeEntry(
  entry: Pick<FinanceTradeJournalEntry, 'createdBy' | 'visibility'>,
  opts: { role: HouseholdRole | null; userId: string | null },
): boolean {
  return canEditInvestmentItem(entry, opts);
}

/** Simple realized P/L for matched sell lots against average buy cost (honest/simple). */
export function tradeJournalSummary(entries: readonly FinanceTradeJournalEntry[]): {
  buys: number;
  sells: number;
  fees: number;
  realizedPnl: number | null;
} {
  let buys = 0;
  let sells = 0;
  let fees = 0;
  const bySymbol = new Map<string, { qty: number; cost: number }>();

  const sorted = [...entries].sort((a, b) => a.tradedOn.localeCompare(b.tradedOn) || a.createdAt.localeCompare(b.createdAt));
  let realized = 0;
  let hasRealized = false;

  for (const entry of sorted) {
    fees += entry.fees;
    const key = (entry.symbol ?? entry.itemId ?? '').toUpperCase();
    if (!key) continue;
    const lot = bySymbol.get(key) ?? { qty: 0, cost: 0 };
    if (entry.side === 'buy') {
      buys += entry.qty * entry.price;
      lot.cost += entry.qty * entry.price + entry.fees;
      lot.qty += entry.qty;
      bySymbol.set(key, lot);
    } else {
      sells += entry.qty * entry.price;
      if (lot.qty > 0) {
        const avg = lot.cost / lot.qty;
        const closed = Math.min(entry.qty, lot.qty);
        realized += closed * entry.price - closed * avg - entry.fees;
        hasRealized = true;
        lot.qty -= closed;
        lot.cost = avg * lot.qty;
        bySymbol.set(key, lot);
      }
    }
  }

  return {
    buys: Math.round(buys * 100) / 100,
    sells: Math.round(sells * 100) / 100,
    fees: Math.round(fees * 100) / 100,
    realizedPnl: hasRealized ? Math.round(realized * 100) / 100 : null,
  };
}

export function investmentAlertTriggered(
  kind: InvestmentAlertKind,
  threshold: number,
  price: number,
  previousPrice: number | null,
): boolean {
  if (!(price > 0)) return false;
  if (kind === 'above') return price >= threshold;
  if (kind === 'below') return price <= threshold;
  if (kind === 'pct_move') {
    if (previousPrice == null || !(previousPrice > 0)) return false;
    const pct = (Math.abs(price - previousPrice) / previousPrice) * 100;
    return pct >= threshold;
  }
  return false;
}
