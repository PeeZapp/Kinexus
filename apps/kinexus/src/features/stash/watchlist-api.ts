import { Platform } from 'react-native';

import type {
  StreamingServiceOption,
  WatchlistMediaType,
  WatchlistRecommendSeed,
  WatchlistResolvedTitle,
  WatchlistSearchHit,
  WatchlistSuggestion,
} from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export function isWatchlistApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!isWatchlistApiConfigured()) {
    throw new Error('Watchlist API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  let res: Response;
  try {
    res = await fetch(`${configuredUrl()}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && /failed to fetch|networkerror|econnrefused/i.test(err.message))) {
      throw new Error('Could not reach the watchlist API. Restart with npm run dev so the API on port 5301 is running.');
    }
    throw err;
  }
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
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

export async function searchWatchlistPeople(query: string): Promise<WatchlistPersonHit[]> {
  const payload = await post<{ people?: WatchlistPersonHit[] }>('/watchlist/people', { query });
  return payload.people ?? [];
}

export type WatchlistCastMember = {
  id: number;
  name: string;
  character: string | null;
  profilePath: string | null;
};

export async function loadWatchlistTitleCast(
  tmdbId: number,
  mediaType: WatchlistMediaType,
): Promise<WatchlistCastMember[]> {
  const payload = await post<{ cast?: WatchlistCastMember[] }>('/watchlist/cast', { tmdbId, mediaType });
  return payload.cast ?? [];
}

export async function loadWatchlistPersonMovies(personId: number): Promise<{
  name: string;
  profilePath: string | null;
  results: WatchlistPersonCredit[];
}> {
  const payload = await post<{ name?: string; profilePath?: string | null; results?: WatchlistPersonCredit[] }>(
    '/watchlist/person',
    { personId },
  );
  return {
    name: payload.name ?? 'This person',
    profilePath: payload.profilePath ?? null,
    results: payload.results ?? [],
  };
}

export async function searchWatchlistCatalog(query: string, country: string): Promise<WatchlistSearchHit[]> {
  const payload = await post<{ results?: WatchlistSearchHit[] }>('/watchlist/search', { query, country });
  return payload.results ?? [];
}

export type WatchlistSearchHitWithRole = WatchlistSearchHit & {
  role?: string | null;
};

export type WatchlistPeopleSearchResult = {
  results: WatchlistSearchHitWithRole[];
  people: WatchlistPersonHit[];
  personId: number | null;
  personName: string | null;
};

function watchlistHitKey(hit: WatchlistSearchHit): string {
  return `${hit.mediaType}-${hit.tmdbId}`;
}

function isStrongPersonMatch(query: string, person: WatchlistPersonHit): boolean {
  const q = query.trim().toLowerCase();
  const name = person.name.trim().toLowerCase();
  if (!q || !name) return false;
  if (name === q || q.startsWith(name)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && tokens.every((token) => name.includes(token))) return true;
  return q.length >= 4 && name.startsWith(q);
}

/** Title search plus optional person filmography when the query looks like a star name. */
export async function searchWatchlistWithPeople(
  query: string,
  country: string,
  opts: { personId?: number | null } = {},
): Promise<WatchlistPeopleSearchResult> {
  const [titles, people] = await Promise.all([
    searchWatchlistCatalog(query, country),
    searchWatchlistPeople(query).catch(() => [] as WatchlistPersonHit[]),
  ]);

  let personId = opts.personId ?? null;
  if (personId != null && !people.some((person) => person.id === personId)) {
    personId = null;
  }
  if (personId == null) {
    const strong = people.find((person) => isStrongPersonMatch(query, person));
    if (strong) personId = strong.id;
    else if (titles.length === 0 && people[0]) personId = people[0].id;
  }

  const forcedPerson = opts.personId != null && personId === opts.personId;
  const strongSelected =
    personId != null && people.some((person) => person.id === personId && isStrongPersonMatch(query, person));
  const preferPerson = personId != null && (forcedPerson || strongSelected || titles.length === 0);

  let personName: string | null = null;
  let credits: WatchlistPersonCredit[] = [];
  if (preferPerson && personId != null) {
    const payload = await loadWatchlistPersonMovies(personId);
    personName = payload.name;
    credits = payload.results;
  } else {
    personId = preferPerson ? personId : null;
  }

  const seen = new Set<string>();
  const results: WatchlistSearchHitWithRole[] = [];
  const primary = preferPerson ? credits : titles;
  const secondary = preferPerson ? titles : [];

  for (const hit of primary) {
    const key = watchlistHitKey(hit);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(hit);
  }
  for (const hit of secondary) {
    const key = watchlistHitKey(hit);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(hit);
  }

  return {
    results,
    people: preferPerson ? people : [],
    personId,
    personName,
  };
}

export async function lookupWatchlistCatalog(input: {
  tmdbId: number;
  mediaType: WatchlistMediaType;
  country: string;
  sourceUrl?: string | null;
}): Promise<WatchlistResolvedTitle> {
  const payload = await post<{ title?: WatchlistResolvedTitle }>('/watchlist/lookup', input);
  if (!payload.title) throw new Error('No catalog match for that title');
  return payload.title;
}

export async function resolveWatchlistLink(url: string, country: string): Promise<WatchlistSearchHit[]> {
  const payload = await post<{ results?: WatchlistSearchHit[] }>('/watchlist/resolve', { url, country });
  return payload.results ?? [];
}

export async function listStreamingServices(country: string): Promise<StreamingServiceOption[]> {
  const payload = await post<{ services?: StreamingServiceOption[] }>('/watchlist/services', { country });
  return payload.services ?? [];
}

export async function recommendWatchlistTitles(input: {
  seeds: WatchlistRecommendSeed[];
  exclude: { tmdbId: number; mediaType: WatchlistMediaType }[];
  country?: string;
  providerIds?: number[];
}): Promise<{ band: number | null; results: WatchlistSuggestion[] }> {
  const payload = await post<{ band?: number | null; results?: WatchlistSuggestion[] }>('/watchlist/recommend', input);
  return { band: payload.band ?? null, results: payload.results ?? [] };
}

export async function discoverWatchlistTitles(input: {
  mediaType: WatchlistMediaType;
  genreId: number | null;
  mode: 'browse' | 'surprise';
  country?: string;
  providerIds?: number[];
}): Promise<WatchlistSuggestion[]> {
  const payload = await post<{ results?: WatchlistSuggestion[] }>('/watchlist/discover', input);
  return payload.results ?? [];
}
