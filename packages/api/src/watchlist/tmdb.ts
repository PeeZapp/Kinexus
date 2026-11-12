import {
  audienceFromCertification,
  certificationAllowed,
  isWatchlistGenre,
  isWatchlistMediaType,
  isWatchlistOfferType,
  mergeStreamingServices,
  normalizeImdbId,
  resolveStreamingDisplayPriority,
  normalizeCountryCode,
  normalizeStreamingProviderIds,
  parseWatchlistUrl,
  pickYoutubeTrailerUrl,
  rankWatchlistSuggestions,
  titleStreamsOn,
  titleYearMatchConfidence,
  watchlistListError,
  watchlistTasteBand,
  watchlistTitleKey,
  yearFromDate,
  type StreamingServiceOption,
  type WatchlistAudience,
  type WatchlistMediaType,
  type WatchlistProvider,
  type WatchlistRecommendSeed,
  type WatchlistResolvedTitle,
  type WatchlistSearchHit,
  type WatchlistSuggestion,
  type WatchlistTasteCandidate,
  type WatchlistTasteSeed,
} from '@kinexus/domain';

import type { WatchlistWatchingContext } from '../watchlist-watching.js';

export const WATCHLIST_IMPORT_MATCH_BATCH_CAP = 40;
const MATCH_CACHE_TTL_MS = 10 * 60 * 1000;
const CERT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
};

type AuCertCacheEntry = { at: number; certification: string | null };
const auCertCache = new Map<string, AuCertCacheEntry>();
const auCertInflight = new Map<string, Promise<string | null>>();

function auCertCacheKey(mediaType: WatchlistMediaType, tmdbId: number): string {
  return `${mediaType}-${tmdbId}`;
}

/** AU-only certification for a title. Cached; missing AU cert → null (no US fallback). */
export async function fetchAuCertification(
  mediaType: WatchlistMediaType,
  tmdbId: number,
): Promise<string | null> {
  const key = auCertCacheKey(mediaType, tmdbId);
  const cached = auCertCache.get(key);
  if (cached && Date.now() - cached.at < CERT_CACHE_TTL_MS) return cached.certification;
  const pending = auCertInflight.get(key);
  if (pending) return pending;

  const load = (async () => {
    try {
      const path = mediaType === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
      const append = mediaType === 'tv' ? 'content_ratings' : 'release_dates';
      const payload = await tmdbGet<TmdbTitlePayload>(path, {
        append_to_response: append,
        language: 'en-US',
      });
      let certification: string | null = null;
      if (mediaType === 'movie') {
        const region = (payload.release_dates?.results ?? []).find((row) => row.iso_3166_1 === 'AU');
        certification =
          region?.release_dates?.map((row) => row.certification?.trim()).find((value) => value) ?? null;
      } else {
        const region = (payload.content_ratings?.results ?? []).find((row) => row.iso_3166_1 === 'AU');
        certification = region?.rating?.trim() || null;
      }
      auCertCache.set(key, { at: Date.now(), certification });
      return certification;
    } catch {
      auCertCache.set(key, { at: Date.now(), certification: null });
      return null;
    } finally {
      auCertInflight.delete(key);
    }
  })();

  auCertInflight.set(key, load);
  return load;
}

async function filterByAuCertification<T extends { tmdbId: number; mediaType: WatchlistMediaType }>(
  rows: readonly T[],
  watching: WatchlistWatchingContext | null | undefined,
): Promise<T[]> {
  if (!watching) return [...rows];
  const kept: T[] = [];
  const queue = [...rows];
  while (queue.length > 0) {
    const batch = queue.splice(0, 6);
    const certs = await Promise.all(batch.map((row) => fetchAuCertification(row.mediaType, row.tmdbId)));
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

function genreIdsOf(row: TmdbSearchItem): number[] {
  return (row.genre_ids ?? []).filter((id) => Number.isInteger(id) && id > 0);
}

function tasteBoostPoints(
  key: string,
  genreIds: readonly number[],
  watching: WatchlistWatchingContext | null | undefined,
): number {
  if (!watching) return 0;
  let points = 0;
  if (watching.taste.likedTitles.some((row) => watchlistTitleKey(row.mediaType, row.tmdbId) === key)) {
    points += 20;
  }
  const liked = new Set(watching.taste.likedGenreIds);
  const disliked = new Set(watching.taste.dislikedGenreIds);
  for (const id of genreIds) {
    if (liked.has(id)) points += 4;
    if (disliked.has(id)) points -= 6;
  }
  return points;
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

function discoverCertificationParams(
  mediaType: WatchlistMediaType,
  watching: WatchlistWatchingContext | null | undefined,
): Record<string, string> {
  if (!watching || mediaType !== 'movie') return {};
  if (watching.maxCertification === 'R18+') return {};
  return {
    certification_country: 'AU',
    'certification.lte': watching.maxCertification,
  };
}

type TmdbProviderOffer = {
  provider_id?: number;
  provider_name?: string;
  logo_path?: string | null;
  display_priority?: number;
  display_priorities?: Record<string, number>;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Undici hides timeouts and connection errors behind the message "fetch failed". */
export function fetchFailureDetail(err: unknown): string {
  if (!(err instanceof Error)) return 'network error';
  const cause = err.cause;
  if (cause instanceof Error && cause.message) {
    const code = typeof (cause as { code?: unknown }).code === 'string' ? (cause as { code: string }).code : '';
    const detail = code && !cause.message.includes(code) ? `${cause.message} (${code})` : cause.message;
    if (detail !== 'fetch failed') return detail;
  }
  if (err.name === 'TimeoutError' || /timeout|aborted/i.test(err.message)) return 'timed out';
  if (err.message && err.message !== 'fetch failed') return err.message;
  return 'network error';
}

function isTransientTmdbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message.includes('rejected the API key')) return false;
  const http = err.message.match(/^TMDB request failed \(HTTP (\d+)\)$/);
  if (http) return http[1] === '429' || http[1].startsWith('5');
  return err.message === 'fetch failed' || err.name === 'TimeoutError' || err.name === 'AbortError';
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
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('TMDB rejected the API key. Check TMDB_API_KEY.');
      }
      if (!response.ok) {
        throw new Error(`TMDB request failed (HTTP ${response.status})`);
      }
      return (await response.json()) as T;
    } catch (err) {
      lastError = err;
      if (!isTransientTmdbError(err) || attempt === 2) break;
      await sleep(300 * (attempt + 1));
    }
  }
  if (
    lastError instanceof Error &&
    (lastError.message === 'fetch failed' || lastError.name === 'TimeoutError' || lastError.name === 'AbortError')
  ) {
    throw new Error(`Could not reach TMDB (${fetchFailureDetail(lastError)})`);
  }
  throw lastError;
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

type TmdbDirectorCandidate = {
  id?: number;
  name?: string;
  known_for_department?: string;
};

type TmdbCrewCredit = TmdbSearchItem & {
  job?: string | null;
};

const DIRECTOR_SEARCH_CAP = 20;
/** Exact title is ~0.93 and a prefix title is ~0.84 from titleYearMatchConfidence. */
const STRONG_TITLE_MATCH = 0.8;

function matchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Surname, full name, or a long prefix of the person's name. Substrings inside a token do not count. */
export function isStrongDirectorNameMatch(query: string, name: string): boolean {
  const q = matchText(query);
  const person = matchText(name);
  if (q.length < 2 || !person) return false;
  if (q === person) return true;
  const nameTokens = person.split(' ');
  const queryTokens = q.split(' ');
  if (queryTokens.length >= 2 && queryTokens.every((token) => nameTokens.includes(token))) return true;
  if (queryTokens.length === 1 && queryTokens[0].length >= 4 && nameTokens.includes(queryTokens[0])) return true;
  return q.length >= 4 && person.startsWith(`${q} `);
}

function isStrongTitleMatch(query: string, title: string): boolean {
  return titleYearMatchConfidence({ title: query, year: null }, { title, year: null }) >= STRONG_TITLE_MATCH;
}

export function directorHitsFromCrew(
  directorName: string,
  crew: readonly TmdbCrewCredit[] | undefined,
): WatchlistSearchHit[] {
  const director = directorName.trim().slice(0, 120);
  const byId = new Map<number, { hit: WatchlistSearchHit; popularity: number }>();
  for (const row of crew ?? []) {
    if ((row.job ?? '').trim() !== 'Director') continue;
    const hit = hitFromTmdb(row, 'movie');
    if (!hit) continue;
    const popularity = Number(row.popularity) || 0;
    const prev = byId.get(hit.tmdbId);
    if (prev && prev.popularity >= popularity) continue;
    byId.set(hit.tmdbId, {
      hit: director ? { ...hit, director } : hit,
      popularity,
    });
  }
  return [...byId.values()]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, DIRECTOR_SEARCH_CAP)
    .map((row) => row.hit);
}

function hitKey(hit: WatchlistSearchHit): string {
  return `${hit.mediaType}:${hit.tmdbId}`;
}

/** Strong title hits, then director films, then weaker title hits. Same tmdb id is kept once. */
export function mergeWatchlistDirectorHits(
  query: string,
  titles: readonly WatchlistSearchHit[],
  directorMovies: readonly WatchlistSearchHit[],
): WatchlistSearchHit[] {
  const strong: WatchlistSearchHit[] = [];
  const rest: WatchlistSearchHit[] = [];
  for (const hit of titles) {
    if (isStrongTitleMatch(query, hit.title)) strong.push(hit);
    else rest.push(hit);
  }
  const directedById = new Map(directorMovies.map((hit) => [hitKey(hit), hit]));
  const seen = new Set<string>();
  const out: WatchlistSearchHit[] = [];
  const push = (hit: WatchlistSearchHit) => {
    const key = hitKey(hit);
    if (seen.has(key)) return;
    seen.add(key);
    const director = hit.director ?? directedById.get(key)?.director;
    out.push(director && !hit.director ? { ...hit, director } : hit);
  };
  for (const hit of strong) push(hit);
  for (const hit of directorMovies) push(hit);
  for (const hit of rest) push(hit);
  return out;
}

function topDirectingPerson(
  query: string,
  people: readonly TmdbDirectorCandidate[],
): { id: number; name: string } | null {
  const top = people[0];
  if (!top || top.known_for_department !== 'Directing') return null;
  const id = Number(top.id);
  const name = (top.name ?? '').trim();
  if (!Number.isInteger(id) || id <= 0 || !name) return null;
  if (!isStrongDirectorNameMatch(query, name)) return null;
  return { id, name: name.slice(0, 120) };
}

export async function searchWatchlistTitles(query: string, country: string): Promise<WatchlistSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) throw new Error('Type at least two characters');
  if (q.length > 120) throw new Error('Search is too long');
  const region = normalizeCountryCode(country);
  const [payload, people] = await Promise.all([
    tmdbGet<{ results?: TmdbSearchItem[] }>('/search/multi', {
      query: q,
      include_adult: 'false',
      language: 'en-US',
      region,
    }),
    tmdbGet<{ results?: TmdbDirectorCandidate[] }>('/search/person', {
      query: q,
      include_adult: 'false',
      language: 'en-US',
    }).catch(() => ({ results: [] as TmdbDirectorCandidate[] })),
  ]);
  const hits: WatchlistSearchHit[] = [];
  for (const row of payload.results ?? []) {
    if (!isWatchlistMediaType(row.media_type ?? '')) continue;
    const hit = hitFromTmdb(row, row.media_type as WatchlistMediaType);
    if (hit) hits.push(hit);
    if (hits.length >= 12) break;
  }
  const director = topDirectingPerson(q, people.results ?? []);
  if (!director) return hits;
  try {
    const credits = await tmdbGet<{ crew?: TmdbCrewCredit[] }>(`/person/${director.id}/movie_credits`, {
      language: 'en-US',
    });
    return mergeWatchlistDirectorHits(q, hits, directorHitsFromCrew(director.name, credits.crew));
  } catch {
    return hits;
  }
}

type TmdbTitlePayload = TmdbSearchItem & {
  external_ids?: { imdb_id?: string | null };
  'watch/providers'?: { results?: Record<string, TmdbWatchProviders> };
  release_dates?: {
    results?: { iso_3166_1?: string; release_dates?: { certification?: string | null }[] }[];
  };
  content_ratings?: {
    results?: { iso_3166_1?: string; rating?: string | null }[];
  };
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
  credits?: {
    crew?: { job?: string | null; name?: string | null }[];
  };
};

function directorsFromCrew(
  crew: readonly { job?: string | null; name?: string | null }[] | undefined,
): string | undefined {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of crew ?? []) {
    if ((row.job ?? '').trim() !== 'Director') continue;
    const name = (row.name ?? '').trim().slice(0, 120);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.length > 0 ? names.join(', ') : undefined;
}

function pickContentRating(payload: TmdbTitlePayload, mediaType: WatchlistMediaType, country: string): {
  contentRating: string | null;
  audience: WatchlistAudience | null;
} {
  let certification: string | null = null;
  if (mediaType === 'movie') {
    const regions = payload.release_dates?.results ?? [];
    const preferred = regions.find((row) => row.iso_3166_1 === country) ?? regions.find((row) => row.iso_3166_1 === 'US');
    certification =
      preferred?.release_dates?.map((row) => row.certification?.trim()).find((value) => value) ?? null;
  } else {
    const regions = payload.content_ratings?.results ?? [];
    const preferred = regions.find((row) => row.iso_3166_1 === country) ?? regions.find((row) => row.iso_3166_1 === 'US');
    certification = preferred?.rating?.trim() || null;
  }
  return { contentRating: certification, audience: audienceFromCertification(certification) };
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
  const path = input.mediaType === 'tv' ? `/tv/${input.tmdbId}` : `/movie/${input.tmdbId}`;
  const append =
    input.mediaType === 'tv'
      ? 'external_ids,watch/providers,videos,content_ratings'
      : 'external_ids,watch/providers,videos,release_dates,credits';
  const payload = await tmdbGet<TmdbTitlePayload>(path, {
    append_to_response: append,
    language: 'en-US',
  });
  const hit = hitFromTmdb(payload, input.mediaType, payload.external_ids?.imdb_id ?? null);
  if (!hit) throw new Error('Could not load that title');
  const region = payload['watch/providers']?.results?.[country];
  const rating = pickContentRating(payload, input.mediaType, country);
  const director = input.mediaType === 'movie' ? directorsFromCrew(payload.credits?.crew) : undefined;
  return {
    ...hit,
    ...(director ? { director } : {}),
    sourceUrl: input.sourceUrl ?? null,
    tmdbWatchUrl: region?.link ?? null,
    trailerUrl: pickYoutubeTrailerUrl(payload.videos?.results ?? []),
    contentRating: rating.contentRating,
    audience: rating.audience,
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

function publicScoreOf(row: TmdbSearchItem): number | null {
  const score = Number(row.vote_average);
  if (!Number.isFinite(score) || score <= 0) return null;
  return Math.round(score * 10) / 10;
}

function suggestionFromRow(
  row: TmdbSearchItem,
  mediaType: WatchlistMediaType,
  reason: string | null,
): WatchlistSuggestion | null {
  const hit = hitFromTmdb(row, mediaType);
  if (!hit) return null;
  return { ...hit, publicScore: publicScoreOf(row), reason };
}

type TmdbWithRecommendations = TmdbSearchItem & {
  recommendations?: { results?: TmdbSearchItem[] };
};

export async function listStreamingServices(country: string): Promise<StreamingServiceOption[]> {
  const region = normalizeCountryCode(country);
  const [movies, shows] = await Promise.all([
    tmdbGet<{ results?: TmdbProviderOffer[] }>('/watch/providers/movie', {
      watch_region: region,
      language: 'en-US',
    }),
    tmdbGet<{ results?: TmdbProviderOffer[] }>('/watch/providers/tv', {
      watch_region: region,
      language: 'en-US',
    }),
  ]);
  const rows = [...(movies.results ?? []), ...(shows.results ?? [])].flatMap((row) => {
    const providerId = Number(row.provider_id);
    const providerName = (row.provider_name ?? '').trim();
    if (!Number.isInteger(providerId) || providerId <= 0 || !providerName) return [];
    return [
      {
        providerId,
        providerName,
        logoPath: row.logo_path ?? null,
        displayPriority: resolveStreamingDisplayPriority(row.display_priorities, region, row.display_priority),
      },
    ];
  });
  return mergeStreamingServices(rows);
}

async function streamsOnSelectedServices(
  hit: { tmdbId: number; mediaType: WatchlistMediaType },
  country: string,
  providerIds: readonly number[],
): Promise<boolean> {
  try {
    const path = hit.mediaType === 'tv' ? `/tv/${hit.tmdbId}/watch/providers` : `/movie/${hit.tmdbId}/watch/providers`;
    const payload = await tmdbGet<{ results?: Record<string, TmdbWatchProviders> }>(path);
    return titleStreamsOn(providersFromRegion(payload.results?.[country]), providerIds);
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
    const batch = queue.splice(0, 6);
    const flags = await Promise.all(batch.map((row) => streamsOnSelectedServices(row, country, providerIds)));
    for (let index = 0; index < batch.length; index += 1) {
      const row = batch[index];
      if (row && flags[index] && kept.length < limit) kept.push(row);
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

  const loaded = await Promise.all(
    ordered.map(async (seed) => {
      try {
        const path = seed.mediaType === 'tv' ? `/tv/${seed.tmdbId}` : `/movie/${seed.tmdbId}`;
        const payload = await tmdbGet<TmdbWithRecommendations>(path, {
          append_to_response: 'recommendations',
          language: 'en-US',
        });
        return {
          seed,
          publicScore: publicScoreOf(payload),
          recs: payload.recommendations?.results ?? [],
          genres: genreIdsOf(payload),
        };
      } catch {
        return null;
      }
    }),
  );

  const tasteSeeds: WatchlistTasteSeed[] = [];
  const buckets = new Map<
    string,
    { row: TmdbSearchItem; mediaType: WatchlistMediaType; voteCount: number; sources: string[]; boost: number }
  >();
  for (const row of loaded) {
    if (!row) continue;
    const key = watchlistTitleKey(row.seed.mediaType, row.seed.tmdbId);
    tasteSeeds.push({
      key,
      title: row.seed.title,
      userScore: row.seed.userScore,
      publicScore: row.publicScore,
    });
    for (const rec of row.recs.slice(0, filtering || watching ? 18 : 12)) {
      const rawMedia = rec.media_type ?? '';
      const mediaType: WatchlistMediaType = isWatchlistMediaType(rawMedia) ? rawMedia : row.seed.mediaType;
      const hit = hitFromTmdb(rec, mediaType);
      if (!hit) continue;
      const recKey = watchlistTitleKey(hit.mediaType, hit.tmdbId);
      const boost = tasteBoostPoints(recKey, genreIdsOf(rec), watching);
      const current = buckets.get(recKey);
      if (!current) {
        buckets.set(recKey, {
          row: rec,
          mediaType,
          voteCount: Number(rec.vote_count) || 0,
          sources: [key],
          boost,
        });
      } else if (!current.sources.includes(key)) {
        current.sources.push(key);
        current.boost = Math.max(current.boost, boost);
      }
    }
  }

  const exclude = applyWatchingExclusions(
    new Set(input.exclude.map((row) => watchlistTitleKey(row.mediaType, row.tmdbId))),
    watching,
  );
  const candidates: WatchlistTasteCandidate[] = [...buckets.entries()].map(([key, bucket]) => ({
    key,
    publicScore: publicScoreOf(bucket.row),
    voteCount: bucket.voteCount,
    sources: bucket.sources,
  }));
  const ranked = rankWatchlistSuggestions(tasteSeeds, candidates, exclude, filtering || watching ? 36 : 12);
  const orderedRanks = ranked
    .map((rank, index) => ({ rank, index, boost: buckets.get(rank.key)?.boost ?? 0 }))
    .sort((a, b) => b.boost - a.boost || a.index - b.index);
  const suggestions: WatchlistSuggestion[] = [];
  for (const row of orderedRanks) {
    const bucket = buckets.get(row.rank.key);
    if (!bucket) continue;
    const suggestion = suggestionFromRow(bucket.row, bucket.mediaType, row.rank.reason);
    if (suggestion) suggestions.push(suggestion);
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
  if (input.genreId != null && !isWatchlistGenre(input.mediaType, input.genreId)) {
    throw Object.assign(new Error('That genre is not available for this type'), { status: 400 });
  }
  const providerIds = normalizeStreamingProviderIds(input.providerIds ?? []);
  const filtering = providerIds.length > 0;
  const watching = input.watching ?? null;
  const pages = input.mode === 'surprise' ? [filtering ? 1 : 1 + Math.floor(Math.random() * 5)] : [1, 2];
  const rows: TmdbSearchItem[] = [];
  const likedGenre = watching?.taste.likedGenreIds[0] ?? null;
  for (const page of pages) {
    const params: Record<string, string> = {
      language: 'en-US',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': filtering ? '40' : input.mode === 'surprise' ? '400' : '80',
      'vote_average.gte': filtering ? '6' : input.mode === 'surprise' ? '7.5' : '6',
      page: String(page),
      ...discoverCertificationParams(input.mediaType, watching),
    };
    if (filtering) {
      params.with_watch_providers = providerIds.join('|');
      params.watch_region = normalizeCountryCode(input.country);
      params.with_watch_monetization_types = 'flatrate|free|ads';
    }
    if (input.genreId != null) params.with_genres = String(input.genreId);
    else if (likedGenre != null) params.with_genres = String(likedGenre);
    const path = input.mediaType === 'tv' ? '/discover/tv' : '/discover/movie';
    const payload = await tmdbGet<{ results?: TmdbSearchItem[] }>(path, params);
    rows.push(...(payload.results ?? []));
  }

  const exclude = applyWatchingExclusions(new Set(), watching);
  const scored = rows
    .map((row) => {
      const suggestion = suggestionFromRow(row, input.mediaType, null);
      if (!suggestion) return null;
      const key = watchlistTitleKey(suggestion.mediaType, suggestion.tmdbId);
      if (exclude.has(key)) return null;
      return { suggestion, boost: tasteBoostPoints(key, genreIdsOf(row), watching) };
    })
    .filter((row): row is { suggestion: WatchlistSuggestion; boost: number } => row != null)
    .sort((a, b) => b.boost - a.boost || (b.suggestion.publicScore ?? 0) - (a.suggestion.publicScore ?? 0));

  const suggestions = scored.map((row) => row.suggestion);
  const ageSafe = await filterByAuCertification(suggestions, watching);
  if (input.mode !== 'surprise') return ageSafe.slice(0, 40);
  if (ageSafe.length === 0) return [];
  const pick = ageSafe[Math.floor(Math.random() * Math.min(ageSafe.length, 12))];
  return pick ? [pick] : [];
}

export type WatchlistPersonHit = {
  id: number;
  name: string;
  knownFor: string | null;
  profilePath: string | null;
};

export type WatchlistPersonCredit = WatchlistSearchHit & {
  role: string | null;
};

type TmdbPersonRow = {
  id?: number;
  name?: string;
  known_for_department?: string;
  profile_path?: string | null;
  known_for?: { title?: string; name?: string }[];
};

type TmdbCastCredit = TmdbSearchItem & {
  character?: string;
  popularity?: number;
};

function requireQuery(query: string): string {
  const q = query.trim();
  if (q.length < 2) throw new Error('Type at least two characters');
  if (q.length > 120) throw new Error('Search is too long');
  return q;
}

export async function searchWatchlistPeople(query: string): Promise<WatchlistPersonHit[]> {
  const q = requireQuery(query);
  const payload = await tmdbGet<{ results?: TmdbPersonRow[] }>('/search/person', {
    query: q,
    include_adult: 'false',
    language: 'en-US',
  });
  const ranked = [...(payload.results ?? [])].sort((a, b) => {
    const aActor = a.known_for_department === 'Acting' ? 0 : 1;
    const bActor = b.known_for_department === 'Acting' ? 0 : 1;
    return aActor - bActor;
  });
  const people: WatchlistPersonHit[] = [];
  for (const row of ranked) {
    const id = Number(row.id);
    const name = (row.name ?? '').trim();
    if (!Number.isInteger(id) || id <= 0 || !name) continue;
    const knownFor = (row.known_for ?? [])
      .map((item) => (item.title || item.name || '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    people.push({
      id,
      name: name.slice(0, 120),
      knownFor: knownFor || null,
      profilePath: row.profile_path ?? null,
    });
    if (people.length >= 6) break;
  }
  return people;
}

export type WatchlistCastMember = {
  id: number;
  name: string;
  character: string | null;
  profilePath: string | null;
};

type TmdbCreditCast = {
  id?: number;
  name?: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
};

const TOP_CAST_LIMIT = 12;

export async function watchlistTitleCast(input: {
  tmdbId: number;
  mediaType: WatchlistMediaType;
}): Promise<WatchlistCastMember[]> {
  if (!Number.isInteger(input.tmdbId) || input.tmdbId <= 0) {
    throw Object.assign(new Error('A TMDB title id is required'), { status: 400 });
  }
  const path = input.mediaType === 'tv' ? `/tv/${input.tmdbId}/credits` : `/movie/${input.tmdbId}/credits`;
  const payload = await tmdbGet<{ cast?: TmdbCreditCast[] }>(path, { language: 'en-US' });
  const ranked = [...(payload.cast ?? [])].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const people: WatchlistCastMember[] = [];
  const seen = new Set<number>();
  for (const row of ranked) {
    const id = Number(row.id);
    const name = (row.name ?? '').trim();
    if (!Number.isInteger(id) || id <= 0 || !name || seen.has(id)) continue;
    seen.add(id);
    const character = row.character?.trim() ? row.character.trim().slice(0, 80) : null;
    people.push({
      id,
      name: name.slice(0, 120),
      character,
      profilePath: row.profile_path ?? null,
    });
    if (people.length >= TOP_CAST_LIMIT) break;
  }
  return people;
}

export async function watchlistPersonMovies(personId: number): Promise<{
  name: string;
  profilePath: string | null;
  results: WatchlistPersonCredit[];
}> {
  if (!Number.isInteger(personId) || personId <= 0) {
    throw Object.assign(new Error('A person id is required'), { status: 400 });
  }
  const [person, credits] = await Promise.all([
    tmdbGet<{ name?: string; profile_path?: string | null }>(`/person/${personId}`, { language: 'en-US' }),
    tmdbGet<{ cast?: TmdbCastCredit[] }>(`/person/${personId}/movie_credits`, { language: 'en-US' }),
  ]);
  const seen = new Set<number>();
  const rows: { credit: WatchlistPersonCredit; popularity: number }[] = [];
  for (const row of credits.cast ?? []) {
    const hit = hitFromTmdb(row, 'movie');
    if (!hit || seen.has(hit.tmdbId)) continue;
    seen.add(hit.tmdbId);
    const role = row.character?.trim() ? row.character.trim().slice(0, 80) : null;
    rows.push({ credit: { ...hit, role }, popularity: Number(row.popularity) || 0 });
  }
  rows.sort((a, b) => b.popularity - a.popularity);
  const name = (person.name ?? '').trim() || 'This person';
  return {
    name: name.slice(0, 120),
    profilePath: person.profile_path ?? null,
    results: rows.slice(0, 40).map((row) => row.credit),
  };
}

export type WatchlistImportMatchRow = {
  /** Client row key / index as string. */
  key: string;
  imdbId?: string | null;
  title?: string | null;
  year?: number | null;
};

export type WatchlistImportMatchCandidate = WatchlistSearchHit & { confidence: number };

export type WatchlistImportMatchResult = {
  key: string;
  confidence: number;
  match: WatchlistSearchHit | null;
  candidates: WatchlistImportMatchCandidate[];
};

type MatchCacheEntry = { expiresAt: number; result: WatchlistImportMatchResult };

const matchCache = new Map<string, MatchCacheEntry>();

export function resetWatchlistImportMatchCache(): void {
  matchCache.clear();
}

function cacheKey(row: WatchlistImportMatchRow, country: string): string {
  const imdb = normalizeImdbId(row.imdbId ?? null);
  if (imdb) return `imdb:${imdb}:${country}`;
  const title = (row.title ?? '').trim().toLowerCase();
  const year = row.year != null && Number.isFinite(row.year) ? String(row.year) : '';
  return `ty:${title}|${year}|${country}`;
}

function getCached(key: string): WatchlistImportMatchResult | null {
  const entry = matchCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    matchCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(key: string, result: WatchlistImportMatchResult): void {
  matchCache.set(key, { expiresAt: Date.now() + MATCH_CACHE_TTL_MS, result });
}

async function matchByImdbId(imdbId: string): Promise<WatchlistImportMatchResult> {
  const found = await tmdbGet<{
    movie_results?: TmdbSearchItem[];
    tv_results?: TmdbSearchItem[];
  }>(`/find/${imdbId}`, { external_source: 'imdb_id' });
  const candidates: WatchlistImportMatchCandidate[] = [];
  for (const row of found.movie_results ?? []) {
    const hit = hitFromTmdb(row, 'movie', imdbId);
    if (hit) candidates.push({ ...hit, confidence: 1 });
  }
  for (const row of found.tv_results ?? []) {
    const hit = hitFromTmdb(row, 'tv', imdbId);
    if (hit) candidates.push({ ...hit, confidence: 1 });
  }
  const match = candidates[0] ?? null;
  return {
    key: '',
    confidence: match ? 1 : 0,
    match,
    candidates: candidates.slice(0, 5),
  };
}

async function matchByTitleYear(
  title: string,
  year: number | null,
  country: string,
): Promise<WatchlistImportMatchResult> {
  const query = year != null ? `${title} ${year}` : title;
  if (query.trim().length < 2) {
    return { key: '', confidence: 0, match: null, candidates: [] };
  }
  const hits = await searchWatchlistTitles(query, country);
  const scored = hits
    .map((hit) => ({
      ...hit,
      confidence: titleYearMatchConfidence({ title, year }, { title: hit.title, year: hit.year }),
    }))
    .sort((a, b) => b.confidence - a.confidence);
  const best = scored[0] ?? null;
  return {
    key: '',
    confidence: best?.confidence ?? 0,
    match: best
      ? {
          tmdbId: best.tmdbId,
          mediaType: best.mediaType,
          title: best.title,
          year: best.year,
          overview: best.overview,
          posterPath: best.posterPath,
          backdropPath: best.backdropPath,
          imdbId: best.imdbId,
        }
      : null,
    candidates: scored.slice(0, 5),
  };
}

export async function matchWatchlistImportRows(input: {
  rows: readonly WatchlistImportMatchRow[];
  country?: string;
}): Promise<WatchlistImportMatchResult[]> {
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw Object.assign(new Error('At least one row is required'), { status: 400 });
  }
  if (input.rows.length > WATCHLIST_IMPORT_MATCH_BATCH_CAP) {
    throw Object.assign(new Error(`Match at most ${WATCHLIST_IMPORT_MATCH_BATCH_CAP} rows per request`), {
      status: 400,
    });
  }
  const country = normalizeCountryCode(input.country);
  const out: WatchlistImportMatchResult[] = [];

  for (const row of input.rows) {
    const key = typeof row.key === 'string' && row.key.trim() ? row.key.trim() : '';
    if (!key) {
      out.push({ key: '', confidence: 0, match: null, candidates: [] });
      continue;
    }
    const imdbId = normalizeImdbId(row.imdbId ?? null);
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const year =
      row.year == null || row.year === ('' as unknown)
        ? null
        : Number.isFinite(Number(row.year))
          ? Math.trunc(Number(row.year))
          : null;

    const ck = cacheKey({ key, imdbId, title, year }, country);
    const cached = getCached(ck);
    if (cached) {
      out.push({ ...cached, key });
      continue;
    }

    let result: WatchlistImportMatchResult;
    try {
      if (imdbId) {
        result = await matchByImdbId(imdbId);
      } else if (title.length >= 1) {
        result = await matchByTitleYear(title, year, country);
      } else {
        result = { key, confidence: 0, match: null, candidates: [] };
      }
    } catch {
      result = { key, confidence: 0, match: null, candidates: [] };
    }
    result = { ...result, key };
    setCached(ck, result);
    out.push(result);
  }

  return out;
}
