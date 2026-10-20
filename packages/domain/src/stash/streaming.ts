import type { WatchlistOfferType } from './types';

export const STREAMING_SERVICE_LIMIT = 24;
/** How many country services to offer in the picker (after storefront filters). */
export const STREAMING_SERVICE_PICKER_LIMIT = 80;
export const WATCHLIST_RECOMMEND_SCOPES = ['all', 'subscribed'] as const;

export type WatchlistRecommendScope = (typeof WATCHLIST_RECOMMEND_SCOPES)[number];

export type StreamingServiceOption = {
  providerId: number;
  providerName: string;
  logoPath: string | null;
};

export type StreamingServiceRow = StreamingServiceOption & {
  displayPriority: number;
};

/** Storefronts and ad-on channels, not services someone subscribes to. */
const BLOCKED_PROVIDER_IDS = new Set([2, 3, 7, 10, 35, 68, 192]);

const BLOCKED_NAME =
  /(?:google play|itunes|\bstore\b|youtube|justwatch|vudu|fandango|rakuten tv|microsoft store|sky store|amazon channel|apple tv channel|roku channel)/i;

const STREAMING_OFFERS = new Set<WatchlistOfferType>(['flatrate', 'ads', 'free']);

export function isWatchlistRecommendScope(value: string): value is WatchlistRecommendScope {
  return (WATCHLIST_RECOMMEND_SCOPES as readonly string[]).includes(value);
}

/**
 * TMDB's top-level `display_priority` is often the US/default rank even when
 * `watch_region` is set. Prefer the country entry so local services surface.
 */
export function resolveStreamingDisplayPriority(
  displayPriorities: Record<string, number> | null | undefined,
  region: string,
  fallback: number | null | undefined,
): number {
  const code = region.trim().toUpperCase();
  const regional = code ? displayPriorities?.[code] : undefined;
  if (typeof regional === 'number' && Number.isFinite(regional)) return regional;
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
  return 99;
}

export function normalizeStreamingProviderIds(value: readonly unknown[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    const id = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= STREAMING_SERVICE_LIMIT) break;
  }
  return out;
}

export function isSelectableStreamingService(providerId: number, providerName: string): boolean {
  if (!Number.isInteger(providerId) || providerId <= 0) return false;
  if (BLOCKED_PROVIDER_IDS.has(providerId)) return false;
  const name = providerName.trim();
  if (!name || BLOCKED_NAME.test(name)) return false;
  return true;
}

/** Subscription and free services for one country, most prominent first. */
export function mergeStreamingServices(rows: readonly StreamingServiceRow[]): StreamingServiceOption[] {
  const map = new Map<number, StreamingServiceRow>();
  for (const row of rows) {
    if (!isSelectableStreamingService(row.providerId, row.providerName)) continue;
    const next: StreamingServiceRow = {
      providerId: row.providerId,
      providerName: row.providerName.trim().slice(0, 80),
      logoPath: row.logoPath,
      displayPriority: Number.isFinite(row.displayPriority) ? row.displayPriority : 99,
    };
    const existing = map.get(row.providerId);
    if (!existing || next.displayPriority < existing.displayPriority) map.set(row.providerId, next);
  }
  return [...map.values()]
    .sort((a, b) => a.displayPriority - b.displayPriority || a.providerName.localeCompare(b.providerName))
    .slice(0, STREAMING_SERVICE_PICKER_LIMIT)
    .map(({ providerId, providerName, logoPath }) => ({ providerId, providerName, logoPath }));
}

/** True when a title can be watched on one of the selected services. */
export function titleStreamsOn(
  providers: readonly { offerType: WatchlistOfferType; providerId: number }[],
  providerIds: readonly number[],
): boolean {
  const wanted = new Set(providerIds);
  if (wanted.size === 0) return false;
  return providers.some((provider) => wanted.has(provider.providerId) && STREAMING_OFFERS.has(provider.offerType));
}
