import type { HouseholdRole } from '../household/types';
import type {
  WatchlistEntry,
  WatchlistItem,
  WatchlistItemStatus,
  WatchlistList,
  WatchlistMediaType,
  WatchlistOfferType,
  WatchlistProvider,
  WatchlistSearchHit,
  WatchlistTitle,
  WatchlistUrlParse,
  WatchlistVisibility,
} from './types';

export const WATCHLIST_VISIBILITIES = ['household', 'personal'] as const;
export const WATCHLIST_MEDIA_TYPES = ['movie', 'tv'] as const;
export const WATCHLIST_ITEM_STATUSES = ['want', 'watching', 'watched'] as const;
export const WATCHLIST_OFFER_TYPES = ['flatrate', 'ads', 'free', 'rent', 'buy'] as const;

const VISIBILITY_SET = new Set<string>(WATCHLIST_VISIBILITIES);
const MEDIA_SET = new Set<string>(WATCHLIST_MEDIA_TYPES);
const STATUS_SET = new Set<string>(WATCHLIST_ITEM_STATUSES);
const OFFER_SET = new Set<string>(WATCHLIST_OFFER_TYPES);

const TMDB_IMAGE = 'https://image.tmdb.org/t/p';
const PROVIDER_STALE_MS = 12 * 60 * 60 * 1000;

export function isWatchlistVisibility(value: string): value is WatchlistVisibility {
  return VISIBILITY_SET.has(value);
}

export function isWatchlistMediaType(value: string): value is WatchlistMediaType {
  return MEDIA_SET.has(value);
}

export function isWatchlistItemStatus(value: string): value is WatchlistItemStatus {
  return STATUS_SET.has(value);
}

export function isWatchlistOfferType(value: string): value is WatchlistOfferType {
  return OFFER_SET.has(value);
}

export function tmdbImageUrl(
  path: string | null | undefined,
  size: 'w45' | 'w92' | 'w185' | 'w342' | 'w500' = 'w342',
): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE}/${size}${trimmed}`;
}

export function yearFromDate(value: string | null | undefined): number | null {
  const match = value?.match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1888 && year <= 2100 ? year : null;
}

export function slugToQuery(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/[_+]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseWatchlistUrl(raw: string): WatchlistUrlParse {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'invalid', reason: 'Paste a movie or series link' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'invalid', reason: 'Paste a full http(s) link' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'invalid', reason: 'Paste a full http(s) link' };
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const path = url.pathname;

  if (host === 'imdb.com' || host.endsWith('.imdb.com')) {
    if (/\/list\//i.test(path) || /\/user\/[^/]+\/(watchlist|ratings|lists)/i.test(path) || /\/chart\//i.test(path)) {
      return { kind: 'list', source: 'IMDb' };
    }
    const title = path.match(/\/title\/(tt\d+)/i);
    if (title?.[1]) return { kind: 'imdb', imdbId: title[1].toLowerCase() };
    return { kind: 'invalid', reason: 'That IMDb link is not a movie or series page' };
  }

  if (host === 'themoviedb.org' || host.endsWith('.themoviedb.org')) {
    if (/\/list\//.test(path) || /\/u\//.test(path)) return { kind: 'list', source: 'TMDB' };
    const movie = path.match(/\/movie\/(\d+)/);
    if (movie?.[1]) return { kind: 'tmdb', mediaType: 'movie', tmdbId: Number(movie[1]) };
    const tv = path.match(/\/tv\/(\d+)/);
    if (tv?.[1]) return { kind: 'tmdb', mediaType: 'tv', tmdbId: Number(tv[1]) };
    return { kind: 'invalid', reason: 'That TMDB link is not a movie or series page' };
  }

  if (host === 'rottentomatoes.com' || host.endsWith('.rottentomatoes.com')) {
    if (/\/browse\//.test(path) || /\/showtimes/.test(path) || /\/top-/.test(path) || path === '/' || path === '') {
      return { kind: 'list', source: 'Rotten Tomatoes' };
    }
    const movie = path.match(/\/m\/([^/]+)/);
    if (movie?.[1]) return { kind: 'search', query: slugToQuery(movie[1]), source: 'Rotten Tomatoes' };
    const tv = path.match(/\/tv\/([^/]+)/);
    if (tv?.[1]) return { kind: 'search', query: slugToQuery(tv[1]), source: 'Rotten Tomatoes' };
    return { kind: 'invalid', reason: 'That Rotten Tomatoes link is not a movie or series page' };
  }

  if (host === 'letterboxd.com' || host.endsWith('.letterboxd.com')) {
    if (/\/list\//.test(path) || /\/watchlist\/?/.test(path) || /\/films\/?$/.test(path)) {
      return { kind: 'list', source: 'Letterboxd' };
    }
    const film = path.match(/\/film\/([^/]+)/);
    if (film?.[1]) return { kind: 'search', query: slugToQuery(film[1]), source: 'Letterboxd' };
    return { kind: 'invalid', reason: 'That Letterboxd link is not a film page' };
  }

  if (host === 'justwatch.com' || host.endsWith('.justwatch.com')) {
    const movie = path.match(/\/movie\/([^/]+)/);
    if (movie?.[1]) return { kind: 'search', query: slugToQuery(movie[1]), source: 'JustWatch' };
    const tv = path.match(/\/tv-show\/([^/]+)/);
    if (tv?.[1]) return { kind: 'search', query: slugToQuery(tv[1]), source: 'JustWatch' };
    return { kind: 'list', source: 'JustWatch' };
  }

  if (host.endsWith('wikipedia.org')) {
    const wiki = path.match(/\/wiki\/([^/]+)/);
    if (wiki?.[1]) {
      const query = decodeURIComponent(wiki[1])
        .replace(/_/g, ' ')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (query) return { kind: 'search', query, source: 'Wikipedia' };
    }
  }

  if (host === 'trakt.tv' || host.endsWith('.trakt.tv')) {
    if (/\/users\/.+\/(lists|watchlist)/.test(path)) return { kind: 'list', source: 'Trakt' };
    const movie = path.match(/\/movies\/([^/]+)/);
    if (movie?.[1]) return { kind: 'search', query: slugToQuery(movie[1]), source: 'Trakt' };
    const show = path.match(/\/shows\/([^/]+)/);
    if (show?.[1]) return { kind: 'search', query: slugToQuery(show[1]), source: 'Trakt' };
  }

  return {
    kind: 'invalid',
    reason: 'Paste an IMDb, TMDB, Rotten Tomatoes, Letterboxd, or JustWatch title link',
  };
}

export function watchlistListError(parse: WatchlistUrlParse): string | null {
  if (parse.kind !== 'list') return null;
  return `${parse.source} lists can’t be imported. Open a single movie or series page and paste that link.`;
}

export function watchlistVisibilityLabel(visibility: WatchlistVisibility): string {
  return visibility === 'personal' ? 'Personal' : 'Household';
}

export function mediaTypeLabel(mediaType: WatchlistMediaType): string {
  return mediaType === 'tv' ? 'Series' : 'Movie';
}

export function itemStatusLabel(status: WatchlistItemStatus): string {
  if (status === 'watching') return 'Watching';
  if (status === 'watched') return 'Watched';
  return 'Want to watch';
}

export function offerTypeLabel(offerType: WatchlistOfferType): string {
  if (offerType === 'flatrate') return 'Stream';
  if (offerType === 'ads') return 'With ads';
  if (offerType === 'free') return 'Free';
  if (offerType === 'rent') return 'Rent';
  if (offerType === 'buy') return 'Buy';
  return offerType;
}

export function titleYearLabel(title: Pick<WatchlistSearchHit, 'title' | 'year' | 'mediaType'>): string {
  const kind = mediaTypeLabel(title.mediaType);
  return title.year ? `${title.title} (${title.year}) · ${kind}` : `${title.title} · ${kind}`;
}

export function canViewWatchlist(
  list: WatchlistList,
  opts: { userId: string | null },
): boolean {
  if (list.visibility === 'household') return true;
  return Boolean(opts.userId && list.createdBy === opts.userId);
}

export function canManageWatchlist(
  list: WatchlistList,
  opts: { userId: string | null; role: HouseholdRole | null },
): boolean {
  if (opts.userId && list.createdBy === opts.userId) return true;
  return list.visibility === 'household' && (opts.role === 'owner' || opts.role === 'admin');
}

export function watchlistEntries(
  lists: readonly WatchlistList[],
  titles: readonly WatchlistTitle[],
  items: readonly WatchlistItem[],
): WatchlistEntry[] {
  const listsById = new Map(lists.map((list) => [list.id, list]));
  const titlesById = new Map(titles.map((title) => [title.id, title]));
  const entries: WatchlistEntry[] = [];
  for (const item of items) {
    const list = listsById.get(item.listId);
    const title = titlesById.get(item.titleId);
    if (!list || !title) continue;
    entries.push({ item, list, title });
  }
  return entries.sort((a, b) => b.item.addedAt.localeCompare(a.item.addedAt));
}

export function filterWatchlistEntries(
  entries: readonly WatchlistEntry[],
  opts: {
    listId?: string | null;
    status?: WatchlistItemStatus | null;
    mediaType?: WatchlistMediaType | null;
    search?: string;
  },
): WatchlistEntry[] {
  const q = opts.search?.trim().toLowerCase() ?? '';
  return entries.filter((entry) => {
    if (opts.listId && entry.list.id !== opts.listId) return false;
    if (opts.status && entry.item.status !== opts.status) return false;
    if (opts.mediaType && entry.title.mediaType !== opts.mediaType) return false;
    if (!q) return true;
    const hay = [entry.title.title, entry.title.overview, entry.list.name, entry.item.notes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function providersAreStale(
  title: Pick<WatchlistTitle, 'providersFetchedAt' | 'providersCountry'>,
  country: string,
  now = Date.now(),
): boolean {
  if (!title.providersFetchedAt) return true;
  if ((title.providersCountry ?? '').toUpperCase() !== country.toUpperCase()) return true;
  const fetched = Date.parse(title.providersFetchedAt);
  if (!Number.isFinite(fetched)) return true;
  return now - fetched > PROVIDER_STALE_MS;
}

export type WatchlistProviderGroup = {
  offerType: WatchlistOfferType;
  label: string;
  providers: WatchlistProvider[];
};

const OFFER_ORDER: WatchlistOfferType[] = ['flatrate', 'ads', 'free', 'rent', 'buy'];

export function groupWatchlistProviders(providers: readonly WatchlistProvider[]): WatchlistProviderGroup[] {
  const groups: WatchlistProviderGroup[] = [];
  for (const offerType of OFFER_ORDER) {
    const rows = providers
      .filter((provider) => provider.offerType === offerType)
      .slice()
      .sort((a, b) => a.displayPriority - b.displayPriority || a.providerName.localeCompare(b.providerName));
    if (rows.length === 0) continue;
    groups.push({ offerType, label: offerTypeLabel(offerType), providers: rows });
  }
  return groups;
}

export function streamingSummary(providers: readonly WatchlistProvider[]): string {
  const stream = providers
    .filter((provider) => provider.offerType === 'flatrate' || provider.offerType === 'ads' || provider.offerType === 'free')
    .slice()
    .sort((a, b) => a.displayPriority - b.displayPriority);
  const unique: string[] = [];
  for (const provider of stream) {
    if (!unique.includes(provider.providerName)) unique.push(provider.providerName);
  }
  if (unique.length === 0) {
    const rentBuy = providers.filter((provider) => provider.offerType === 'rent' || provider.offerType === 'buy');
    if (rentBuy.length > 0) return 'Rent or buy';
    return 'No streaming listed';
  }
  if (unique.length <= 2) return unique.join(' · ');
  return `${unique[0]} · ${unique[1]} +${unique.length - 2}`;
}

export function parseStoredProviders(value: unknown): WatchlistProvider[] {
  if (!Array.isArray(value)) return [];
  const out: WatchlistProvider[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const offerRaw = String(rec.offer_type ?? rec.offerType ?? '');
    if (!isWatchlistOfferType(offerRaw)) continue;
    const providerId = Number(rec.provider_id ?? rec.providerId);
    const providerName = String(rec.provider_name ?? rec.providerName ?? '').trim();
    if (!Number.isInteger(providerId) || providerId <= 0 || !providerName) continue;
    const key = `${offerRaw}:${providerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const logoRaw = rec.logo_path ?? rec.logoPath;
    const priority = Number(rec.display_priority ?? rec.displayPriority);
    out.push({
      offerType: offerRaw,
      providerId,
      providerName: providerName.slice(0, 80),
      logoPath: typeof logoRaw === 'string' && logoRaw.trim() ? logoRaw.trim() : null,
      displayPriority: Number.isFinite(priority) ? priority : 99,
    });
  }
  return out;
}

export function serializeWatchlistProviders(providers: readonly WatchlistProvider[]): {
  offer_type: WatchlistOfferType;
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}[] {
  return providers.map((provider) => ({
    offer_type: provider.offerType,
    provider_id: provider.providerId,
    provider_name: provider.providerName,
    logo_path: provider.logoPath,
    display_priority: provider.displayPriority,
  }));
}
