import {
  audienceFromCertification,
  certificationAllowed,
  isWatchlistOfferType,
  mergeStreamingServices,
  normalizeCountryCode,
  normalizeStreamingProviderIds,
  rankWatchlistSuggestions,
  titleStreamsOn,
  watchlistTasteBand,
  watchlistTitleKey,
  type StreamingServiceOption,
  type WatchlistMediaType,
  type WatchlistOfferType,
  type WatchlistProvider,
  type WatchlistRecommendSeed,
  type WatchlistResolvedTitle,
  type WatchlistSearchHit,
  type WatchlistSuggestion,
  type WatchlistTasteCandidate,
  type WatchlistTasteSeed,
} from '@kinexus/domain';

import type { WatchlistWatchingContext } from '../watchlist-watching.js';
import { bumpWatchlistProviderRequest, createTtlCache } from './cache.js';
import {
  fetchAuCertification as tmdbFetchAuCertification,
  listStreamingServices as tmdbListStreamingServices,
  matchWatchlistImportRows as tmdbMatchWatchlistImportRows,
  resolveWatchlistUrl as tmdbResolveWatchlistUrl,
  type WatchlistCastMember,
  type WatchlistImportMatchResult,
  type WatchlistImportMatchRow,
  type WatchlistPersonCredit,
  type WatchlistPersonHit,
} from './tmdb.js';

const TRAKT_BASE = 'https://api.trakt.tv';
const SA_BASE = 'https://api.movieofthenight.com/v4';

/** Map Streaming Availability service ids → TMDB/JustWatch provider ids (AU-focused). */
const SA_TO_TMDB_PROVIDER: Record<string, number> = {
  netflix: 8,
  prime: 119,
  disney: 337,
  apple: 350,
  stan: 21,
  paramount: 531,
  hbo: 1899,
  mubi: 11,
  britbox: 151,
  curiosity: 190,
  tubi: 73,
  crunchyroll: 283,
  amc: 526,
  zee5: 232,
  bing: 385,
  foxtel: 105,
};

type TraktIds = {
  trakt?: number;
  slug?: string;
  imdb?: string | null;
  tmdb?: number | null;
};

type TraktMovie = {
  title?: string;
  year?: number | null;
  overview?: string | null;
  rating?: number | null;
  votes?: number | null;
  ids?: TraktIds;
  images?: { poster?: string[]; fanart?: string[] };
};

type TraktShow = {
  title?: string;
  year?: number | null;
  overview?: string | null;
  rating?: number | null;
  votes?: number | null;
  ids?: TraktIds;
  images?: { poster?: string[]; fanart?: string[] };
};

type TraktPerson = {
  name?: string;
  ids?: TraktIds;
  images?: { headshot?: string[] };
};

type TraktSearchRow = {
  type?: string;
  score?: number;
  movie?: TraktMovie;
  show?: TraktShow;
  person?: TraktPerson;
};

type TraktCastPerson = {
  person?: TraktPerson;
  characters?: string[];
  character?: string;
};

type TraktPeoplePayload = {
  cast?: TraktCastPerson[];
};

type TraktPersonMovieCredit = {
  movie?: TraktMovie;
  characters?: string[];
  character?: string;
  job?: string;
};

type SaStreamingOption = {
  service?: { id?: string; name?: string; imageSet?: { lightThemeImage?: string; darkThemeImage?: string; whiteImage?: string } };
  type?: string;
  link?: string;
};

type SaShow = {
  title?: string;
  overview?: string;
  showType?: string;
  releaseYear?: number;
  firstAirYear?: number;
  imdbId?: string;
  tmdbId?: string;
  directors?: string[];
  imageSet?: {
    verticalPoster?: { w240?: string; w360?: string; w480?: string };
    horizontalPoster?: { w360?: string; w480?: string; w720?: string };
  };
  streamingOptions?: Record<string, SaStreamingOption[]>;
  ageCertification?: string | null;
  certification?: string | null;
};

const titleCache = createTtlCache<WatchlistResolvedTitle>();
const personCache = createTtlCache<{ name: string; profilePath: string | null; results: WatchlistPersonCredit[] }>();
const castCache = createTtlCache<WatchlistCastMember[]>();
const saShowCache = createTtlCache<SaShow | null>();
const posterCache = createTtlCache<string | null>();
const servicesCache = createTtlCache<StreamingServiceOption[]>();

function traktClientId(): string {
  return process.env.TRAKT_CLIENT_ID?.trim() ?? '';
}

function streamingAvailabilityKey(): string {
  return process.env.STREAMING_AVAILABILITY_KEY?.trim() ?? '';
}

function assertTraktConfigured(): void {
  if (!traktClientId()) {
    throw new Error('Trakt preview is not configured. Add TRAKT_CLIENT_ID in packages/api/.env.');
  }
}

function assertSaConfigured(): void {
  if (!streamingAvailabilityKey()) {
    throw new Error(
      'Streaming Availability is not configured. Add STREAMING_AVAILABILITY_KEY in packages/api/.env.',
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function traktGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  assertTraktConfigured();
  const url = new URL(`${TRAKT_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  bumpWatchlistProviderRequest('trakt');
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': traktClientId(),
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('Trakt rejected the client id. Check TRAKT_CLIENT_ID.');
      }
      if (response.status === 429) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      if (!response.ok) throw new Error(`Trakt request failed (HTTP ${response.status})`);
      return (await response.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt === 2) break;
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Trakt request failed');
}

async function saGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  assertSaConfigured();
  const url = new URL(`${SA_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  bumpWatchlistProviderRequest('streamingAvailability');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-API-Key': streamingAvailabilityKey(),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('Streaming Availability rejected the API key. Check STREAMING_AVAILABILITY_KEY.');
  }
  if (response.status === 404) {
    throw Object.assign(new Error('Not found'), { status: 404 });
  }
  if (!response.ok) throw new Error(`Streaming Availability request failed (HTTP ${response.status})`);
  return (await response.json()) as T;
}

/** Parse SA `tmdbId` values like `movie/238` or bare numeric strings. */
export function parseSaTmdbId(raw: string | null | undefined): { mediaType: WatchlistMediaType; tmdbId: number } | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const slash = value.match(/^(movie|tv|show|series)\/(\d+)$/i);
  if (slash) {
    const kind = slash[1]!.toLowerCase();
    const mediaType: WatchlistMediaType = kind === 'movie' ? 'movie' : 'tv';
    const tmdbId = Number(slash[2]);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
    return { mediaType, tmdbId };
  }
  const tmdbId = Number(value);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  return { mediaType: 'movie', tmdbId };
}

export function tmdbIdFromTraktIds(ids: TraktIds | null | undefined): number | null {
  const tmdbId = Number(ids?.tmdb);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  return tmdbId;
}

/** Drop titles/people that cannot be keyed by TMDB id (shared identity with stored rows). */
export function requireTmdbId<T extends { tmdbId?: number | null }>(row: T | null | undefined): (T & { tmdbId: number }) | null {
  if (!row) return null;
  const tmdbId = Number(row.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  return { ...row, tmdbId };
}

function posterFromTrakt(images: { poster?: string[]; fanart?: string[] } | undefined): string | null {
  const poster = images?.poster?.[0] ?? images?.fanart?.[0] ?? null;
  return poster?.trim() || null;
}

function posterFromSa(show: SaShow | null | undefined): string | null {
  const vertical = show?.imageSet?.verticalPoster;
  return vertical?.w480 || vertical?.w360 || vertical?.w240 || show?.imageSet?.horizontalPoster?.w720 || null;
}

async function tmdbPosterPath(mediaType: WatchlistMediaType, tmdbId: number): Promise<string | null> {
  const key = `poster:${mediaType}:${tmdbId}`;
  return posterCache.getOrLoad(key, async () => {
    const apiKey = process.env.TMDB_API_KEY?.trim() ?? '';
    const token = process.env.TMDB_ACCESS_TOKEN?.trim() ?? '';
    if (!apiKey && !token) return null;
    bumpWatchlistProviderRequest('tmdbImages');
    const path = mediaType === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set('language', 'en-US');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    else url.searchParams.set('api_key', apiKey);
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return null;
      const payload = (await response.json()) as { poster_path?: string | null };
      return payload.poster_path ?? null;
    } catch {
      return null;
    }
  });
}

async function resolvePosterPath(
  mediaType: WatchlistMediaType,
  tmdbId: number,
  candidates: readonly (string | null | undefined)[],
): Promise<string | null> {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return tmdbPosterPath(mediaType, tmdbId);
}

function hitFromTraktMovie(movie: TraktMovie | undefined): WatchlistSearchHit | null {
  if (!movie) return null;
  const tmdbId = tmdbIdFromTraktIds(movie.ids);
  if (tmdbId == null) return null;
  const title = (movie.title ?? '').trim();
  if (!title) return null;
  return {
    tmdbId,
    mediaType: 'movie',
    title: title.slice(0, 200),
    year: typeof movie.year === 'number' && movie.year > 0 ? movie.year : null,
    overview: movie.overview?.trim() ? movie.overview.trim().slice(0, 600) : null,
    posterPath: posterFromTrakt(movie.images),
    backdropPath: null,
    imdbId: movie.ids?.imdb?.trim() || null,
  };
}

function hitFromTraktShow(show: TraktShow | undefined): WatchlistSearchHit | null {
  if (!show) return null;
  const tmdbId = tmdbIdFromTraktIds(show.ids);
  if (tmdbId == null) return null;
  const title = (show.title ?? '').trim();
  if (!title) return null;
  return {
    tmdbId,
    mediaType: 'tv',
    title: title.slice(0, 200),
    year: typeof show.year === 'number' && show.year > 0 ? show.year : null,
    overview: show.overview?.trim() ? show.overview.trim().slice(0, 600) : null,
    posterPath: posterFromTrakt(show.images),
    backdropPath: null,
    imdbId: show.ids?.imdb?.trim() || null,
  };
}

function publicScoreOf(rating: number | null | undefined): number | null {
  const score = Number(rating);
  if (!Number.isFinite(score) || score <= 0) return null;
  return Math.round(score * 10) / 10;
}

function suggestionFromHit(hit: WatchlistSearchHit, rating: number | null | undefined, reason: string | null): WatchlistSuggestion {
  return { ...hit, publicScore: publicScoreOf(rating), reason };
}

function mapSaOfferType(raw: string | null | undefined): WatchlistOfferType | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'subscription' || value === 'addon') return 'flatrate';
  if (value === 'free') return 'free';
  if (value === 'rent') return 'rent';
  if (value === 'buy') return 'buy';
  if (value === 'ads') return 'ads';
  return isWatchlistOfferType(value) ? value : null;
}

function saProviderId(serviceId: string): number {
  const mapped = SA_TO_TMDB_PROVIDER[serviceId];
  if (mapped) return mapped;
  let hash = 0;
  for (let i = 0; i < serviceId.length; i += 1) hash = (hash * 31 + serviceId.charCodeAt(i)) >>> 0;
  return 50_000 + (hash % 40_000);
}

function providersFromSa(show: SaShow | null, country: string): WatchlistProvider[] {
  if (!show?.streamingOptions) return [];
  const region = country.toLowerCase();
  const rows = show.streamingOptions[region] ?? show.streamingOptions[country] ?? [];
  const out: WatchlistProvider[] = [];
  const seen = new Set<string>();
  let priority = 0;
  for (const row of rows) {
    const serviceId = (row.service?.id ?? '').trim();
    const providerName = (row.service?.name ?? serviceId).trim();
    const offerType = mapSaOfferType(row.type);
    if (!serviceId || !providerName || !offerType) continue;
    const providerId = saProviderId(serviceId);
    const key = `${offerType}:${providerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      offerType,
      providerId,
      providerName: providerName.slice(0, 80),
      logoPath:
        row.service?.imageSet?.lightThemeImage ||
        row.service?.imageSet?.darkThemeImage ||
        row.service?.imageSet?.whiteImage ||
        null,
      displayPriority: priority,
    });
    priority += 1;
  }
  return out;
}

function certificationFromSa(show: SaShow | null): string | null {
  const raw = show?.ageCertification ?? show?.certification ?? null;
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || null;
}

async function loadSaShow(mediaType: WatchlistMediaType, tmdbId: number, country: string): Promise<SaShow | null> {
  const key = `sa:${mediaType}:${tmdbId}:${country.toLowerCase()}`;
  return saShowCache.getOrLoad(key, async () => {
    try {
      const id = `${mediaType}/${tmdbId}`;
      return await saGet<SaShow>(`/shows/${encodeURIComponent(id)}`, { country: country.toLowerCase() });
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      return null;
    }
  });
}

async function enrichHitPoster(hit: WatchlistSearchHit): Promise<WatchlistSearchHit> {
  if (hit.posterPath) return hit;
  const posterPath = await resolvePosterPath(hit.mediaType, hit.tmdbId, []);
  return posterPath ? { ...hit, posterPath } : hit;
}

export async function searchWatchlistTitles(query: string, _country: string): Promise<WatchlistSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) throw new Error('Type at least two characters');
  if (q.length > 120) throw new Error('Search is too long');
  const [movies, shows] = await Promise.all([
    traktGet<TraktSearchRow[]>('/search/movie', { query: q, extended: 'full', limit: '12' }),
    traktGet<TraktSearchRow[]>('/search/show', { query: q, extended: 'full', limit: '12' }),
  ]);
  const hits: WatchlistSearchHit[] = [];
  const seen = new Set<string>();
  for (const row of [...movies, ...shows]) {
    const hit = row.type === 'show' || row.show ? hitFromTraktShow(row.show) : hitFromTraktMovie(row.movie);
    if (!hit) continue;
    const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(await enrichHitPoster(hit));
    if (hits.length >= 12) break;
  }
  return hits;
}

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
  const cacheKey = `lookup:${input.mediaType}:${input.tmdbId}:${country}`;
  return titleCache.getOrLoad(cacheKey, async () => {
    const path =
      input.mediaType === 'tv'
        ? `/shows/tmdb/${input.tmdbId}`
        : `/movies/tmdb/${input.tmdbId}`;
    const payload =
      input.mediaType === 'tv'
        ? await traktGet<TraktShow>(path, { extended: 'full' })
        : await traktGet<TraktMovie>(path, { extended: 'full' });
    const hit =
      input.mediaType === 'tv' ? hitFromTraktShow(payload) : hitFromTraktMovie(payload as TraktMovie);
    if (!hit) throw new Error('Could not load that title');
    const sa = await loadSaShow(input.mediaType, input.tmdbId, country);
    const posterPath = await resolvePosterPath(input.mediaType, input.tmdbId, [
      hit.posterPath,
      posterFromSa(sa),
    ]);
    const contentRating = certificationFromSa(sa);
    const director =
      input.mediaType === 'movie' && sa?.directors?.length
        ? sa.directors.map((name) => name.trim()).filter(Boolean).slice(0, 4).join(', ') || undefined
        : undefined;
    return {
      ...hit,
      posterPath,
      ...(director ? { director } : {}),
      sourceUrl: input.sourceUrl ?? null,
      tmdbWatchUrl: null,
      trailerUrl: null,
      contentRating,
      audience: audienceFromCertification(contentRating),
      providers: providersFromSa(sa, country),
      providersCountry: country,
    };
  });
}

export async function fetchAuCertification(
  mediaType: WatchlistMediaType,
  tmdbId: number,
): Promise<string | null> {
  const show = await loadSaShow(mediaType, tmdbId, 'au');
  const fromSa = certificationFromSa(show);
  if (fromSa) return fromSa;
  // Streaming Availability often omits AU certs; leave null rather than inventing one.
  return null;
}

/** URL resolve still uses TMDB parsers + find-by-IMDb in trakt mode. */
export async function resolveWatchlistUrl(url: string, country: string): Promise<WatchlistSearchHit[]> {
  return tmdbResolveWatchlistUrl(url, country);
}

export async function listStreamingServices(country: string): Promise<StreamingServiceOption[]> {
  const region = normalizeCountryCode(country).toLowerCase();
  return servicesCache.getOrLoad(`services:${region}`, async () => {
    try {
      const payload = await saGet<{
        services?: Record<string, { id?: string; name?: string; imageSet?: { lightThemeImage?: string } }>;
      }>(`/countries/${region}`);
      const rows = Object.values(payload.services ?? {}).flatMap((service, index) => {
        const serviceId = (service.id ?? '').trim();
        const providerName = (service.name ?? serviceId).trim();
        if (!serviceId || !providerName) return [];
        return [
          {
            providerId: saProviderId(serviceId),
            providerName,
            logoPath: service.imageSet?.lightThemeImage ?? null,
            displayPriority: index,
          },
        ];
      });
      return mergeStreamingServices(rows);
    } catch {
      // Fall back so the Services sheet still works when SA is misconfigured.
      return tmdbListStreamingServices(country);
    }
  });
}

async function streamsOnSelectedServices(
  hit: { tmdbId: number; mediaType: WatchlistMediaType },
  country: string,
  providerIds: readonly number[],
): Promise<boolean> {
  try {
    const show = await loadSaShow(hit.mediaType, hit.tmdbId, country);
    return titleStreamsOn(providersFromSa(show, country), providerIds);
  } catch {
    return false;
  }
}

async function keepOnServices<T extends { tmdbId: number; mediaType: WatchlistMediaType }>(
  rows: readonly T[],
  country: string,
  providerIds: readonly number[],
  limit: number,
): Promise<T[]> {
  const kept: T[] = [];
  const queue = [...rows];
  while (queue.length > 0 && kept.length < limit) {
    const batch = queue.splice(0, 4);
    const flags = await Promise.all(batch.map((row) => streamsOnSelectedServices(row, country, providerIds)));
    for (let index = 0; index < batch.length; index += 1) {
      const row = batch[index];
      if (row && flags[index] && kept.length < limit) kept.push(row);
    }
  }
  return kept;
}

function applyWatchingExclusions(
  exclude: Set<string>,
  watching: WatchlistWatchingContext | null | undefined,
): Set<string> {
  if (!watching) return exclude;
  const next = new Set(exclude);
  for (const key of watching.watchedKeys) next.add(key);
  for (const key of watching.dislikedKeys) next.add(key);
  return next;
}

async function filterByAuCertification<T extends { tmdbId: number; mediaType: WatchlistMediaType }>(
  rows: readonly T[],
  watching: WatchlistWatchingContext | null | undefined,
): Promise<T[]> {
  if (!watching) return [...rows];
  // Trakt/SA cert coverage is sparse; fall back to TMDB AU certs for watching filters.
  const kept: T[] = [];
  const queue = [...rows];
  while (queue.length > 0) {
    const batch = queue.splice(0, 6);
    const certs = await Promise.all(batch.map((row) => tmdbFetchAuCertification(row.mediaType, row.tmdbId)));
    for (let index = 0; index < batch.length; index += 1) {
      const row = batch[index];
      if (!row) continue;
      if (
        certificationAllowed(certs[index], watching.maxCertification, {
          allowMissing: watching.allowMissingCertification,
        })
      ) {
        kept.push(row);
      }
    }
  }
  return kept;
}

export async function recommendWatchlistTitles(input: {
  seeds: readonly WatchlistRecommendSeed[];
  exclude: readonly { tmdbId: number; mediaType: WatchlistMediaType }[];
  country?: string;
  providerIds?: readonly number[];
  watching?: WatchlistWatchingContext | null;
}): Promise<{ band: number | null; results: WatchlistSuggestion[] }> {
  const providerIds = normalizeStreamingProviderIds(input.providerIds ?? []);
  const country = normalizeCountryCode(input.country);
  const filtering = providerIds.length > 0;
  const watching = input.watching ?? null;
  const seedPool =
    input.seeds.length > 0
      ? input.seeds
      : (watching?.taste.likedTitles.slice(0, 8).map((row) => ({
          tmdbId: row.tmdbId,
          mediaType: row.mediaType,
          title: `Title ${row.tmdbId}`,
          userScore: row.score,
        })) ?? []);
  const ordered = [...seedPool]
    .sort((a, b) => (b.userScore ?? 0) - (a.userScore ?? 0))
    .slice(0, 6);
  if (ordered.length === 0) {
    throw Object.assign(new Error('Rate a few titles you liked first'), { status: 400 });
  }

  const tasteSeeds: WatchlistTasteSeed[] = [];
  const buckets = new Map<
    string,
    { hit: WatchlistSearchHit; rating: number | null; voteCount: number; sources: string[] }
  >();

  await Promise.all(
    ordered.map(async (seed) => {
      const seedKey = watchlistTitleKey(seed.mediaType, seed.tmdbId);
      tasteSeeds.push({
        key: seedKey,
        title: seed.title,
        userScore: seed.userScore,
        publicScore: null,
      });
      try {
        const path =
          seed.mediaType === 'tv'
            ? `/shows/tmdb/${seed.tmdbId}/related`
            : `/movies/tmdb/${seed.tmdbId}/related`;
        const related =
          seed.mediaType === 'tv'
            ? await traktGet<TraktShow[]>(path, { extended: 'full', limit: '18' })
            : await traktGet<TraktMovie[]>(path, { extended: 'full', limit: '18' });
        for (const row of related) {
          const hit = seed.mediaType === 'tv' ? hitFromTraktShow(row) : hitFromTraktMovie(row as TraktMovie);
          if (!hit) continue;
          const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
          const current = buckets.get(key);
          if (!current) {
            buckets.set(key, {
              hit,
              rating: typeof row.rating === 'number' ? row.rating : null,
              voteCount: Number(row.votes) || 0,
              sources: [seedKey],
            });
          } else if (!current.sources.includes(seedKey)) {
            current.sources.push(seedKey);
          }
        }
      } catch {
        // Skip failed seed related pulls.
      }
    }),
  );

  if (buckets.size < 8) {
    try {
      const trending = await traktGet<{ movie?: TraktMovie; show?: TraktShow; watchers?: number }[]>(
        '/movies/trending',
        { extended: 'full', limit: '20' },
      );
      for (const row of trending) {
        const hit = hitFromTraktMovie(row.movie);
        if (!hit) continue;
        const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
        if (!buckets.has(key)) {
          buckets.set(key, {
            hit,
            rating: typeof row.movie?.rating === 'number' ? row.movie.rating : null,
            voteCount: Number(row.movie?.votes) || Number(row.watchers) || 0,
            sources: ['trending'],
          });
        }
      }
    } catch {
      // optional fill
    }
  }

  const exclude = applyWatchingExclusions(
    new Set(input.exclude.map((row) => watchlistTitleKey(row.mediaType, row.tmdbId))),
    watching,
  );
  const candidates: WatchlistTasteCandidate[] = [...buckets.entries()].map(([key, bucket]) => ({
    key,
    publicScore: publicScoreOf(bucket.rating),
    voteCount: bucket.voteCount,
    sources: bucket.sources,
  }));
  const ranked = rankWatchlistSuggestions(tasteSeeds, candidates, exclude, filtering || watching ? 36 : 12);
  const suggestions: WatchlistSuggestion[] = [];
  for (const rank of ranked) {
    const bucket = buckets.get(rank.key);
    if (!bucket) continue;
    suggestions.push(suggestionFromHit(await enrichHitPoster(bucket.hit), bucket.rating, rank.reason));
  }
  const ageSafe = await filterByAuCertification(suggestions, watching);
  const results = filtering ? await keepOnServices(ageSafe, country, providerIds, 12) : ageSafe.slice(0, 12);
  return { band: watchlistTasteBand(tasteSeeds), results };
}

export async function discoverWatchlistTitles(input: {
  mediaType: WatchlistMediaType;
  genreId: number | null;
  mode: 'browse' | 'surprise';
  country?: string;
  providerIds?: readonly number[];
  watching?: WatchlistWatchingContext | null;
}): Promise<WatchlistSuggestion[]> {
  const providerIds = normalizeStreamingProviderIds(input.providerIds ?? []);
  const filtering = providerIds.length > 0;
  const watching = input.watching ?? null;
  const country = normalizeCountryCode(input.country);
  const path = input.mediaType === 'tv' ? '/shows/trending' : '/movies/trending';
  const payload = await traktGet<{ movie?: TraktMovie; show?: TraktShow; watchers?: number }[]>(path, {
    extended: 'full',
    limit: input.mode === 'surprise' ? '20' : '40',
  });
  const exclude = applyWatchingExclusions(new Set(), watching);
  const suggestions: WatchlistSuggestion[] = [];
  for (const row of payload) {
    const hit = input.mediaType === 'tv' ? hitFromTraktShow(row.show) : hitFromTraktMovie(row.movie);
    if (!hit) continue;
    const key = watchlistTitleKey(hit.mediaType, hit.tmdbId);
    if (exclude.has(key)) continue;
    const rating = input.mediaType === 'tv' ? row.show?.rating : row.movie?.rating;
    suggestions.push(suggestionFromHit(await enrichHitPoster(hit), rating ?? null, null));
  }
  const ageSafe = await filterByAuCertification(suggestions, watching);
  const filtered = filtering ? await keepOnServices(ageSafe, country, providerIds, 40) : ageSafe;
  if (input.mode !== 'surprise') return filtered.slice(0, 40);
  if (filtered.length === 0) return [];
  const pick = filtered[Math.floor(Math.random() * Math.min(filtered.length, 12))];
  return pick ? [pick] : [];
}

export async function searchWatchlistPeople(query: string): Promise<WatchlistPersonHit[]> {
  const q = query.trim();
  if (q.length < 2) throw new Error('Type at least two characters');
  if (q.length > 120) throw new Error('Search is too long');
  const payload = await traktGet<TraktSearchRow[]>('/search/person', {
    query: q,
    extended: 'full',
    limit: '10',
  });
  const people: WatchlistPersonHit[] = [];
  for (const row of payload) {
    const tmdbId = tmdbIdFromTraktIds(row.person?.ids);
    const name = (row.person?.name ?? '').trim();
    if (tmdbId == null || !name) continue;
    people.push({
      id: tmdbId,
      name: name.slice(0, 120),
      knownFor: null,
      profilePath: row.person?.images?.headshot?.[0] ?? null,
    });
    if (people.length >= 6) break;
  }
  return people;
}

const TOP_CAST_LIMIT = 12;

export async function watchlistTitleCast(input: {
  tmdbId: number;
  mediaType: WatchlistMediaType;
}): Promise<WatchlistCastMember[]> {
  if (!Number.isInteger(input.tmdbId) || input.tmdbId <= 0) {
    throw Object.assign(new Error('A TMDB title id is required'), { status: 400 });
  }
  const key = `cast:${input.mediaType}:${input.tmdbId}`;
  return castCache.getOrLoad(key, async () => {
    const path =
      input.mediaType === 'tv'
        ? `/shows/tmdb/${input.tmdbId}/people`
        : `/movies/tmdb/${input.tmdbId}/people`;
    const payload = await traktGet<TraktPeoplePayload>(path, { extended: 'full' });
    const people: WatchlistCastMember[] = [];
    const seen = new Set<number>();
    for (const row of payload.cast ?? []) {
      const id = tmdbIdFromTraktIds(row.person?.ids);
      const name = (row.person?.name ?? '').trim();
      if (id == null || !name || seen.has(id)) continue;
      seen.add(id);
      const character = (row.characters?.[0] || row.character || '').trim().slice(0, 80) || null;
      people.push({
        id,
        name: name.slice(0, 120),
        character,
        profilePath: row.person?.images?.headshot?.[0] ?? null,
      });
      if (people.length >= TOP_CAST_LIMIT) break;
    }
    return people;
  });
}

export async function watchlistPersonMovies(personId: number): Promise<{
  name: string;
  profilePath: string | null;
  results: WatchlistPersonCredit[];
}> {
  if (!Number.isInteger(personId) || personId <= 0) {
    throw Object.assign(new Error('A person id is required'), { status: 400 });
  }
  return personCache.getOrLoad(`person:${personId}`, async () => {
    const [person, credits] = await Promise.all([
      traktGet<TraktPerson>(`/people/tmdb/${personId}`, { extended: 'full' }),
      traktGet<{ cast?: TraktPersonMovieCredit[] }>(`/people/tmdb/${personId}/movies`, {
        extended: 'full',
      }),
    ]);
    const results: WatchlistPersonCredit[] = [];
    const seen = new Set<number>();
    for (const row of credits.cast ?? []) {
      const hit = hitFromTraktMovie(row.movie);
      if (!hit || seen.has(hit.tmdbId)) continue;
      seen.add(hit.tmdbId);
      const role = (row.characters?.[0] || row.character || '').trim().slice(0, 80) || null;
      results.push({ ...(await enrichHitPoster(hit)), role });
      if (results.length >= 40) break;
    }
    return {
      name: ((person.name ?? '').trim() || 'This person').slice(0, 120),
      profilePath: person.images?.headshot?.[0] ?? null,
      results,
    };
  });
}

/** Import matching stays on TMDB so CSV/IMDb ids keep the same confidence rules. */
export async function matchWatchlistImportRows(input: {
  rows: readonly WatchlistImportMatchRow[];
  country?: string;
}): Promise<WatchlistImportMatchResult[]> {
  return tmdbMatchWatchlistImportRows(input);
}

