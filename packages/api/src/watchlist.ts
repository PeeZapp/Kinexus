import {
  isWatchlistMediaType,
  isWatchlistOfferType,
  normalizeCountryCode,
  parseWatchlistUrl,
  pickYoutubeTrailerUrl,
  watchlistListError,
  yearFromDate,
  type WatchlistMediaType,
  type WatchlistProvider,
  type WatchlistResolvedTitle,
  type WatchlistSearchHit,
} from '@kinexus/domain';

const TMDB_BASE = 'https://api.themoviedb.org/3';

type TmdbSearchItem = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
};

type TmdbProviderOffer = {
  provider_id?: number;
  provider_name?: string;
  logo_path?: string | null;
  display_priority?: number;
};

type TmdbWatchProviders = {
  link?: string;
  flatrate?: TmdbProviderOffer[];
  ads?: TmdbProviderOffer[];
  free?: TmdbProviderOffer[];
  rent?: TmdbProviderOffer[];
  buy?: TmdbProviderOffer[];
};

function tmdbKey(): string {
  return process.env.TMDB_API_KEY?.trim() ?? '';
}

function tmdbToken(): string {
  return process.env.TMDB_ACCESS_TOKEN?.trim() ?? '';
}

function assertTmdbConfigured(): void {
  if (!tmdbKey() && !tmdbToken()) {
    throw new Error('Watchlist search is not configured. Add TMDB_API_KEY in packages/api/.env.');
  }
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  assertTmdbConfigured();
  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tmdbToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    url.searchParams.set('api_key', tmdbKey());
  }
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('TMDB rejected the API key. Check TMDB_API_KEY.');
  }
  if (!response.ok) {
    throw new Error(`TMDB request failed (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

function hitFromTmdb(
  row: TmdbSearchItem,
  mediaType: WatchlistMediaType,
  imdbId?: string | null,
): WatchlistSearchHit | null {
  const tmdbId = Number(row.id);
  const title = (row.title || row.name || '').trim();
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !title) return null;
  return {
    tmdbId,
    mediaType,
    title: title.slice(0, 200),
    year: yearFromDate(row.release_date || row.first_air_date),
    overview: row.overview?.trim() ? row.overview.trim().slice(0, 600) : null,
    posterPath: row.poster_path ?? null,
    backdropPath: row.backdrop_path ?? null,
    imdbId: imdbId ?? null,
  };
}

function providersFromRegion(region: TmdbWatchProviders | undefined): WatchlistProvider[] {
  if (!region) return [];
  const out: WatchlistProvider[] = [];
  const seen = new Set<string>();
  for (const offerType of ['flatrate', 'ads', 'free', 'rent', 'buy'] as const) {
    const rows = region[offerType] ?? [];
    for (const row of rows) {
      const providerId = Number(row.provider_id);
      const providerName = (row.provider_name ?? '').trim();
      if (!Number.isInteger(providerId) || providerId <= 0 || !providerName) continue;
      if (!isWatchlistOfferType(offerType)) continue;
      const key = `${offerType}:${providerId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        offerType,
        providerId,
        providerName: providerName.slice(0, 80),
        logoPath: row.logo_path ?? null,
        displayPriority: Number.isFinite(row.display_priority) ? Number(row.display_priority) : 99,
      });
    }
  }
  return out;
}

export async function searchWatchlistTitles(query: string, country: string): Promise<WatchlistSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) throw new Error('Type at least two characters');
  if (q.length > 120) throw new Error('Search is too long');
  const region = normalizeCountryCode(country);
  const payload = await tmdbGet<{ results?: TmdbSearchItem[] }>('/search/multi', {
    query: q,
    include_adult: 'false',
    language: 'en-US',
    region,
  });
  const hits: WatchlistSearchHit[] = [];
  for (const row of payload.results ?? []) {
    if (!isWatchlistMediaType(row.media_type ?? '')) continue;
    const hit = hitFromTmdb(row, row.media_type as WatchlistMediaType);
    if (hit) hits.push(hit);
    if (hits.length >= 12) break;
  }
  return hits;
}

type TmdbTitlePayload = TmdbSearchItem & {
  external_ids?: { imdb_id?: string | null };
  'watch/providers'?: { results?: Record<string, TmdbWatchProviders> };
  videos?: {
    results?: {
      key?: string | null;
      site?: string | null;
      type?: string | null;
      official?: boolean | null;
      name?: string | null;
      iso_639_1?: string | null;
    }[];
  };
};

export async function lookupWatchlistTitle(input: {
  tmdbId: number;
  mediaType: WatchlistMediaType;
  country: string;
  sourceUrl?: string | null;
}): Promise<WatchlistResolvedTitle> {
  if (!Number.isInteger(input.tmdbId) || input.tmdbId <= 0) {
    throw new Error('A TMDB title id is required');
  }
  const country = normalizeCountryCode(input.country);
  const path = input.mediaType === 'tv' ? `/tv/${input.tmdbId}` : `/movie/${input.tmdbId}`;
  const payload = await tmdbGet<TmdbTitlePayload>(path, {
    append_to_response: 'external_ids,watch/providers,videos',
    language: 'en-US',
  });
  const hit = hitFromTmdb(payload, input.mediaType, payload.external_ids?.imdb_id ?? null);
  if (!hit) throw new Error('Could not load that title');
  const region = payload['watch/providers']?.results?.[country];
  return {
    ...hit,
    sourceUrl: input.sourceUrl ?? null,
    tmdbWatchUrl: region?.link ?? null,
    trailerUrl: pickYoutubeTrailerUrl(payload.videos?.results ?? []),
    providers: providersFromRegion(region),
    providersCountry: country,
  };
}

export async function resolveWatchlistUrl(url: string, country: string): Promise<WatchlistSearchHit[]> {
  const parsed = parseWatchlistUrl(url);
  if (parsed.kind === 'list') {
    const error = watchlistListError(parsed) ?? 'Lists cannot be imported';
    throw Object.assign(new Error(error), { status: 422 });
  }
  if (parsed.kind === 'invalid') {
    throw Object.assign(new Error(parsed.reason), { status: 400 });
  }
  if (parsed.kind === 'search') {
    return searchWatchlistTitles(parsed.query, country);
  }
  if (parsed.kind === 'tmdb') {
    const title = await lookupWatchlistTitle({
      tmdbId: parsed.tmdbId,
      mediaType: parsed.mediaType,
      country,
      sourceUrl: url,
    });
    return [title];
  }
  const found = await tmdbGet<{
    movie_results?: TmdbSearchItem[];
    tv_results?: TmdbSearchItem[];
  }>(`/find/${parsed.imdbId}`, { external_source: 'imdb_id' });
  const hits: WatchlistSearchHit[] = [];
  for (const row of found.movie_results ?? []) {
    const hit = hitFromTmdb(row, 'movie', parsed.imdbId);
    if (hit) hits.push(hit);
  }
  for (const row of found.tv_results ?? []) {
    const hit = hitFromTmdb(row, 'tv', parsed.imdbId);
    if (hit) hits.push(hit);
  }
  if (hits.length === 0) throw Object.assign(new Error('No TMDB match for that IMDb title'), { status: 404 });
  return hits;
}
