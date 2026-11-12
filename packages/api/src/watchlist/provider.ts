import type {
  StreamingServiceOption,
  WatchlistMediaType,
  WatchlistRecommendSeed,
  WatchlistResolvedTitle,
  WatchlistSearchHit,
  WatchlistSuggestion,
} from '@kinexus/domain';

import type { WatchlistWatchingContext } from '../watchlist-watching.js';
import * as trakt from './trakt.js';
import {
  fetchAuCertification as tmdbFetchAuCertification,
  listStreamingServices as tmdbListStreamingServices,
  lookupWatchlistTitle as tmdbLookupWatchlistTitle,
  matchWatchlistImportRows as tmdbMatchWatchlistImportRows,
  recommendWatchlistTitles as tmdbRecommendWatchlistTitles,
  resolveWatchlistUrl as tmdbResolveWatchlistUrl,
  searchWatchlistPeople as tmdbSearchWatchlistPeople,
  searchWatchlistTitles as tmdbSearchWatchlistTitles,
  discoverWatchlistTitles as tmdbDiscoverWatchlistTitles,
  watchlistPersonMovies as tmdbWatchlistPersonMovies,
  watchlistTitleCast as tmdbWatchlistTitleCast,
  type WatchlistCastMember,
  type WatchlistImportMatchResult,
  type WatchlistImportMatchRow,
  type WatchlistPersonCredit,
  type WatchlistPersonHit,
} from './tmdb.js';

export type WatchlistProviderName = 'tmdb' | 'trakt';

export type WatchlistProvider = {
  readonly name: WatchlistProviderName;
  fetchAuCertification(mediaType: WatchlistMediaType, tmdbId: number): Promise<string | null>;
  searchWatchlistTitles(query: string, country: string): Promise<WatchlistSearchHit[]>;
  lookupWatchlistTitle(input: {
    tmdbId: number;
    mediaType: WatchlistMediaType;
    country: string;
    sourceUrl?: string | null;
  }): Promise<WatchlistResolvedTitle>;
  resolveWatchlistUrl(url: string, country: string): Promise<WatchlistSearchHit[]>;
  listStreamingServices(country: string): Promise<StreamingServiceOption[]>;
  recommendWatchlistTitles(input: {
    seeds: readonly WatchlistRecommendSeed[];
    exclude: readonly { tmdbId: number; mediaType: WatchlistMediaType }[];
    country?: string;
    providerIds?: readonly number[];
    watching?: WatchlistWatchingContext | null;
  }): Promise<{ band: number | null; results: WatchlistSuggestion[] }>;
  discoverWatchlistTitles(input: {
    mediaType: WatchlistMediaType;
    genreId: number | null;
    mode: 'browse' | 'surprise';
    country?: string;
    providerIds?: readonly number[];
    watching?: WatchlistWatchingContext | null;
  }): Promise<WatchlistSuggestion[]>;
  searchWatchlistPeople(query: string): Promise<WatchlistPersonHit[]>;
  watchlistTitleCast(input: {
    tmdbId: number;
    mediaType: WatchlistMediaType;
  }): Promise<WatchlistCastMember[]>;
  watchlistPersonMovies(personId: number): Promise<{
    name: string;
    profilePath: string | null;
    results: WatchlistPersonCredit[];
  }>;
  matchWatchlistImportRows(input: {
    rows: readonly WatchlistImportMatchRow[];
    country?: string;
  }): Promise<WatchlistImportMatchResult[]>;
};

export const WATCHLIST_PROVIDER_HEADER = 'x-kinexus-watchlist-provider';

const tmdbProvider: WatchlistProvider = {
  name: 'tmdb',
  fetchAuCertification: tmdbFetchAuCertification,
  searchWatchlistTitles: tmdbSearchWatchlistTitles,
  lookupWatchlistTitle: tmdbLookupWatchlistTitle,
  resolveWatchlistUrl: tmdbResolveWatchlistUrl,
  listStreamingServices: tmdbListStreamingServices,
  recommendWatchlistTitles: tmdbRecommendWatchlistTitles,
  discoverWatchlistTitles: tmdbDiscoverWatchlistTitles,
  searchWatchlistPeople: tmdbSearchWatchlistPeople,
  watchlistTitleCast: tmdbWatchlistTitleCast,
  watchlistPersonMovies: tmdbWatchlistPersonMovies,
  matchWatchlistImportRows: tmdbMatchWatchlistImportRows,
};

const traktWatchlistProvider: WatchlistProvider = {
  name: 'trakt',
  fetchAuCertification: trakt.fetchAuCertification,
  searchWatchlistTitles: trakt.searchWatchlistTitles,
  lookupWatchlistTitle: trakt.lookupWatchlistTitle,
  resolveWatchlistUrl: trakt.resolveWatchlistUrl,
  listStreamingServices: trakt.listStreamingServices,
  recommendWatchlistTitles: trakt.recommendWatchlistTitles,
  discoverWatchlistTitles: trakt.discoverWatchlistTitles,
  searchWatchlistPeople: trakt.searchWatchlistPeople,
  watchlistTitleCast: trakt.watchlistTitleCast,
  watchlistPersonMovies: trakt.watchlistPersonMovies,
  matchWatchlistImportRows: trakt.matchWatchlistImportRows,
};

export function watchlistDevSwitchEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.WATCHLIST_DEV_SWITCH === '1';
}

export function parseWatchlistProviderHeader(raw: string | null | undefined): WatchlistProviderName | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'tmdb' || value === 'trakt') return value;
  return null;
}

export function resolveWatchlistProviderName(
  request?: Request | null,
  opts?: { mcp?: boolean },
): WatchlistProviderName {
  if (opts?.mcp) return 'tmdb';
  if (!watchlistDevSwitchEnabled() || !request) return 'tmdb';
  const fromHeader = parseWatchlistProviderHeader(request.headers.get(WATCHLIST_PROVIDER_HEADER));
  return fromHeader ?? 'tmdb';
}

export function getWatchlistProvider(
  request?: Request | null,
  opts?: { mcp?: boolean },
): WatchlistProvider {
  const name = resolveWatchlistProviderName(request, opts);
  return name === 'trakt' ? traktWatchlistProvider : tmdbProvider;
}

/** Trakt mode is look-only: refuse anything that creates or updates watchlist rows. */
export function watchlistWriteForbidden(
  providerName: WatchlistProviderName,
): { status: 403; body: { error: string } } | null {
  if (providerName !== 'trakt') return null;
  return {
    status: 403,
    body: {
      error:
        'Trakt preview mode is look-only. Switch back to TMDB to add titles, refresh providers, save reviews, or import.',
    },
  };
}
