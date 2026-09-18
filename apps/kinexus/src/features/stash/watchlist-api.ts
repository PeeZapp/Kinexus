import { Platform } from 'react-native';

import type { WatchlistMediaType, WatchlistResolvedTitle, WatchlistSearchHit } from '@kinexus/domain';

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

export async function searchWatchlistCatalog(query: string, country: string): Promise<WatchlistSearchHit[]> {
  const payload = await post<{ results?: WatchlistSearchHit[] }>('/watchlist/search', { query, country });
  return payload.results ?? [];
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
