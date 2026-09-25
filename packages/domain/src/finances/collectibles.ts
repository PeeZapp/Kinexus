import { parseMoney, roundMoney } from '../stash/money';
import {
  COLLECTIBLE_CONDITIONS,
  COLLECTIBLE_KINDS,
  COLLECTIBLE_SOURCES,
  type CollectibleCondition,
  type CollectibleKind,
  type CollectibleKindGroup,
  type CollectibleSearchHit,
  type CollectibleSource,
  type FinanceCollectible,
} from './types';

const KIND_SET = new Set<string>(COLLECTIBLE_KINDS);
const CONDITION_SET = new Set<string>(COLLECTIBLE_CONDITIONS);
const SOURCE_SET = new Set<string>(COLLECTIBLE_SOURCES);

const KIND_LABELS: Record<CollectibleKind, string> = {
  lego: 'LEGO',
  minifig: 'Minifigs',
  trading_card: 'Trading cards',
  video_game: 'Video games',
  comic: 'Comics',
  funko: 'Funko',
  coin: 'Coins',
  vinyl: 'Vinyl',
  sneaker: 'Sneakers',
  watch: 'Watches',
  other: 'Other',
};

const SOURCE_LABELS: Record<CollectibleSource, string> = {
  brickeconomy: 'BrickEconomy',
  brickset: 'Brickset',
  pricecharting: 'PriceCharting',
  discogs: 'Discogs',
  stockx: 'StockX',
  chrono24: 'Chrono24',
  manual: 'Manual',
};

const SOURCE_FOR_KIND: Record<CollectibleKind, CollectibleSource> = {
  lego: 'brickeconomy',
  minifig: 'brickeconomy',
  trading_card: 'pricecharting',
  video_game: 'pricecharting',
  comic: 'pricecharting',
  funko: 'pricecharting',
  coin: 'pricecharting',
  vinyl: 'discogs',
  sneaker: 'stockx',
  watch: 'chrono24',
  other: 'manual',
};

const SEARCH_HINTS: Record<CollectibleKind, string> = {
  lego: 'BrickEconomy when it is reachable, otherwise Brickset retail. Try a set number like 75192.',
  minifig: 'BrickEconomy when reachable, otherwise Brickset / BrickLink values. Try sw0509 or a name.',
  trading_card: 'PriceCharting — name plus set works best (Charizard Base Set).',
  video_game: 'PriceCharting — game plus platform (Super Mario 64 N64).',
  comic: 'PriceCharting — title plus issue (Batman #1).',
  funko: 'PriceCharting — character plus line (Iron Man Marvel).',
  coin: 'PriceCharting — year, denomination, and mint if you know it.',
  vinyl: 'Discogs — artist and album. Lowest marketplace price is used.',
  sneaker: 'StockX often blocks automated lookups. If search is empty, enter a sold price.',
  watch: 'Chrono24 often blocks automated lookups. If search is empty, enter a listing price.',
  other: 'PriceCharting first, or type a name and value yourself.',
};

const SEARCH_PLACEHOLDERS: Record<CollectibleKind, string> = {
  lego: '75192 or Millennium Falcon',
  minifig: 'sw0509 or Luke Skywalker',
  trading_card: 'Charizard Base Set',
  video_game: 'Super Mario 64',
  comic: 'Batman #1',
  funko: 'Iron Man',
  coin: '1921 Morgan Dollar',
  vinyl: 'Nirvana Nevermind',
  sneaker: 'Jordan 1 Chicago',
  watch: 'Rolex Submariner',
  other: 'Name or catalog search',
};

const USD_RATES: Record<string, number> = {
  USD: 1,
  AUD: 1.55,
  NZD: 1.65,
  GBP: 0.8,
  EUR: 0.93,
  CAD: 1.35,
  SGD: 1.35,
  ZAR: 18.5,
  JPY: 150,
  CHF: 0.9,
  HKD: 7.8,
  MXN: 17.5,
  INR: 83,
  BRL: 5,
  SEK: 10.5,
  NOK: 10.8,
  DKK: 7,
  KRW: 1350,
};

export function isCollectibleKind(value: string | null | undefined): value is CollectibleKind {
  return Boolean(value && KIND_SET.has(value));
}

export function isCollectibleCondition(value: string | null | undefined): value is CollectibleCondition {
  return Boolean(value && CONDITION_SET.has(value));
}

export function isCollectibleSource(value: string | null | undefined): value is CollectibleSource {
  return Boolean(value && SOURCE_SET.has(value));
}

export function collectibleKindLabel(kind: CollectibleKind): string {
  return KIND_LABELS[kind];
}

export function collectibleSourceLabel(source: CollectibleSource): string {
  return SOURCE_LABELS[source];
}

export function collectibleConditionLabel(condition: CollectibleCondition): string {
  return condition === 'new' ? 'New / sealed' : 'Used';
}

export function sourceForKind(kind: CollectibleKind): CollectibleSource {
  return SOURCE_FOR_KIND[kind];
}

export function collectibleCatalogHint(kind: CollectibleKind): string {
  return SEARCH_HINTS[kind];
}

export function collectibleSearchPlaceholder(kind: CollectibleKind): string {
  return SEARCH_PLACEHOLDERS[kind];
}

export function looksLikeLegoSetNumber(query: string): string | null {
  const trimmed = query.trim();
  const match = trimmed.match(/^(\d{3,6})(-\d+)?$/);
  if (!match?.[1]) return null;
  return match[2] ? trimmed : `${match[1]}-1`;
}

export function brickOwlSetUrl(catalogId: string, name: string): string {
  const num = catalogId.replace(/-\d+$/, '');
  const slug = name
    .replace(new RegExp(`^${num}\\s+`, 'i'), '')
    .replace(/^LEGO\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://www.brickowl.com/catalog/lego-${slug}-set-${num}`;
}

export function convertQuotedMoney(amount: number, fromCurrency: string, toCurrency: string): number {
  const from = USD_RATES[fromCurrency.trim().toUpperCase()] ?? 1;
  const to = USD_RATES[toCurrency.trim().toUpperCase()] ?? from;
  return roundMoney((Math.max(0, amount) / from) * to);
}

export function convertSearchHit(hit: CollectibleSearchHit, toCurrency: string): CollectibleSearchHit {
  const from = hit.currency || 'USD';
  const to = toCurrency.trim().toUpperCase() || from;
  if (from === to) return { ...hit, currency: to };
  return {
    ...hit,
    currency: to,
    valueNew: hit.valueNew == null ? null : convertQuotedMoney(hit.valueNew, from, to),
    valueUsed: hit.valueUsed == null ? null : convertQuotedMoney(hit.valueUsed, from, to),
    retailValue: hit.retailValue == null ? null : convertQuotedMoney(hit.retailValue, from, to),
  };
}

export function pickCollectibleValue(
  hit: { valueNew?: unknown; valueUsed?: unknown; retailValue?: unknown },
  condition: CollectibleCondition,
): number | null {
  const neu = asQuotedAmount(hit.valueNew);
  const used = asQuotedAmount(hit.valueUsed);
  const retail = asQuotedAmount(hit.retailValue);
  if (condition === 'new') return neu ?? used ?? retail;
  return used ?? neu ?? retail;
}

export function collectibleHitHasValue(hit: { valueNew?: unknown; valueUsed?: unknown; retailValue?: unknown } | null | undefined): boolean {
  return hit != null && pickCollectibleValue(hit, 'new') != null;
}

export function asQuotedAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return roundMoney(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseQuotedPrice(value)?.amount ?? parseMoney(value);
    return parsed != null && parsed > 0 ? parsed : null;
  }
  return null;
}

export function collectibleUnitValue(item: Pick<FinanceCollectible, 'marketValue'>): number {
  return roundMoney(Math.max(0, item.marketValue));
}

export function collectibleHoldingValue(item: Pick<FinanceCollectible, 'marketValue' | 'quantity'>): number {
  const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1;
  return roundMoney(collectibleUnitValue(item) * qty);
}

export function collectibleHoldingCost(item: Pick<FinanceCollectible, 'purchasedValue' | 'quantity'>): number {
  if (item.purchasedValue == null) return 0;
  const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1;
  return roundMoney(Math.max(0, item.purchasedValue) * qty);
}

export function collectiblesTotal(items: readonly FinanceCollectible[]): number {
  return roundMoney(items.reduce((sum, item) => sum + collectibleHoldingValue(item), 0));
}

export function collectiblesCost(items: readonly FinanceCollectible[]): number {
  return roundMoney(items.reduce((sum, item) => sum + collectibleHoldingCost(item), 0));
}

export function groupCollectibles(items: readonly FinanceCollectible[]): CollectibleKindGroup[] {
  const byKind = new Map<CollectibleKind, FinanceCollectible[]>();
  for (const item of items) {
    const bucket = byKind.get(item.kind) ?? [];
    bucket.push(item);
    byKind.set(item.kind, bucket);
  }
  return COLLECTIBLE_KINDS.map((kind) => {
    const groupItems = (byKind.get(kind) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
    return {
      kind,
      label: collectibleKindLabel(kind),
      total: collectiblesTotal(groupItems),
      items: groupItems,
    };
  }).filter((group) => group.items.length > 0);
}

export function parseQuotedPrice(raw: string | number | null | undefined): { amount: number; currency: string } | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? { amount: roundMoney(raw), currency: 'USD' } : null;
  }
  if (raw == null || !String(raw).trim()) return null;
  const text = String(raw).trim();
  if (!/[0-9]/.test(text) || /n\/a/i.test(text) || text === '-' || text === '—') return null;
  const amount = parseMoney(text);
  if (amount == null || amount < 0) return null;
  return { amount, currency: currencyFromPriceText(text) };
}

export function currencyFromPriceText(raw: string): string {
  const text = raw.replace(/\s+/g, '');
  if (/^(A\$|AU\$)/i.test(text) || /\bAUD\b/i.test(text)) return 'AUD';
  if (/^(NZ\$|NZD)/i.test(text)) return 'NZD';
  if (/^(C\$|CA\$|CAD)/i.test(text)) return 'CAD';
  if (/^(HK\$|HKD)/i.test(text)) return 'HKD';
  if (/^(S\$|SGD)/i.test(text)) return 'SGD';
  if (/£|GBP/i.test(text)) return 'GBP';
  if (/€|EUR/i.test(text)) return 'EUR';
  if (/¥|JPY/i.test(text)) return 'JPY';
  if (/\bUSD\b/i.test(text) || /^US\$/i.test(text) || /^~?\$/.test(text)) return 'USD';
  return 'USD';
}
