import {
  audienceFromCertification,
  isWatchlistGenre,
  isWatchlistMediaType,
  isWatchlistOfferType,
  mergeStreamingServices,
  resolveStreamingDisplayPriority,
  normalizeCountryCode,
  normalizeStreamingProviderIds,
  parseWatchlistUrl,
  pickYoutubeTrailerUrl,
  rankWatchlistSuggestions,
  titleStreamsOn,
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
};

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
};

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
      : 'external_ids,watch/providers,videos,release_dates';
  const payload = await tmdbGet<TmdbTitlePayload>(path, {
    append_to_response: append,
    language: 'en-US',
  });
  const hit = hitFromTmdb(payload, input.mediaType, payload.external_ids?.imdb_id ?? null);
  if (!hit) throw new Error('Could not load that title');
  const region = payload['watch/providers']?.results?.[country];
  const rating = pickContentRating(payload, input.mediaType, country);
  return {
    ...hit,
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
}): Promise<{ band: number | null; results: WatchlistSuggestion[] }> {
  const providerIds = normalizeStreamingProviderIds(input.providerIds ?? []);
  const country = normalizeCountryCode(input.country);
  const filtering = providerIds.length > 0;
  const ordered = [...input.seeds]
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
        return { seed, publicScore: publicScoreOf(payload), recs: payload.recommendations?.results ?? [] };
      } catch {
        return null;
      }
    }),
  );

  const tasteSeeds: WatchlistTasteSeed[] = [];
  const buckets = new Map<string, { row: TmdbSearchItem; mediaType: WatchlistMediaType; voteCount: number; sources: string[] }>();
  for (const row of loaded) {
    if (!row) continue;
    const key = watchlistTitleKey(row.seed.mediaType, row.seed.tmdbId);
    tasteSeeds.push({
      key,
      title: row.seed.title,
      userScore: row.seed.userScore,
      publicScore: row.publicScore,
    });
    for (const rec of row.recs.slice(0, filtering ? 18 : 12)) {
      const rawMedia = rec.media_type ?? '';
      const mediaType: WatchlistMediaType = isWatchlistMediaType(rawMedia) ? rawMedia : row.seed.mediaType;
      const hit = hitFromTmdb(rec, mediaType);
      if (!hit) continue;
      const recKey = watchlistTitleKey(hit.mediaType, hit.tmdbId);
      const current = buckets.get(recKey);
      if (!current) {
        buckets.set(recKey, {
          row: rec,
          mediaType,
          voteCount: Number(rec.vote_count) || 0,
          sources: [key],
        });
      } else if (!current.sources.includes(key)) {
        current.sources.push(key);
      }
    }
  }

  const exclude = new Set(input.exclude.map((row) => watchlistTitleKey(row.mediaType, row.tmdbId)));
  const candidates: WatchlistTasteCandidate[] = [...buckets.entries()].map(([key, bucket]) => ({
    key,
    publicScore: publicScoreOf(bucket.row),
    voteCount: bucket.voteCount,
    sources: bucket.sources,
  }));
  const ranked = rankWatchlistSuggestions(tasteSeeds, candidates, exclude, filtering ? 30 : 12);
  const suggestions: WatchlistSuggestion[] = [];
  for (const rank of ranked) {
    const bucket = buckets.get(rank.key);
    if (!bucket) continue;
    const suggestion = suggestionFromRow(bucket.row, bucket.mediaType, rank.reason);
    if (suggestion) suggestions.push(suggestion);
  }
  const results = filtering ? await keepOnServices(suggestions, country, providerIds, 12) : suggestions;
  return { band: watchlistTasteBand(tasteSeeds), results };
}

export async function discoverWatchlistTitles(input: {
  mediaType: WatchlistMediaType;
  genreId: number | null;
  mode: 'browse' | 'surprise';
  country?: string;
  providerIds?: readonly number[];
}): Promise<WatchlistSuggestion[]> {
  if (input.genreId != null && !isWatchlistGenre(input.mediaType, input.genreId)) {
    throw Object.assign(new Error('That genre is not available for this type'), { status: 400 });
  }
  const providerIds = normalizeStreamingProviderIds(input.providerIds ?? []);
  const filtering = providerIds.length > 0;
  const pages = input.mode === 'surprise' ? [filtering ? 1 : 1 + Math.floor(Math.random() * 5)] : [1, 2];
  const rows: TmdbSearchItem[] = [];
  for (const page of pages) {
    const params: Record<string, string> = {
      language: 'en-US',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': filtering ? '40' : input.mode === 'surprise' ? '400' : '80',
      'vote_average.gte': filtering ? '6' : input.mode === 'surprise' ? '7.5' : '6',
      page: String(page),
    };
    if (filtering) {
      params.with_watch_providers = providerIds.join('|');
      params.watch_region = normalizeCountryCode(input.country);
      params.with_watch_monetization_types = 'flatrate|free|ads';
    }
    if (input.genreId != null) params.with_genres = String(input.genreId);
    const path = input.mediaType === 'tv' ? '/discover/tv' : '/discover/movie';
    const payload = await tmdbGet<{ results?: TmdbSearchItem[] }>(path, params);
    rows.push(...(payload.results ?? []));
  }
  const suggestions = rows
    .map((row) => suggestionFromRow(row, input.mediaType, null))
    .filter((row): row is WatchlistSuggestion => row != null);
  if (input.mode !== 'surprise') return suggestions.slice(0, 40);
  if (suggestions.length === 0) return [];
  const pick = suggestions[Math.floor(Math.random() * suggestions.length)];
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
