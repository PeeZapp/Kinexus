import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isWatchlistRecommendScope,
  normalizeStreamingProviderIds,
  type WatchlistRecommendScope,
} from '@kinexus/domain';

import type { AuthUser } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

export type WatchlistStreamingPrefs = {
  providerIds: number[];
  recommendScope: WatchlistRecommendScope;
};

export const EMPTY_STREAMING_PREFS: WatchlistStreamingPrefs = {
  providerIds: [],
  recommendScope: 'all',
};

function storageKey(userId: string) {
  return `kinexus.watchlistStreaming.${userId}`;
}

function usesLocalStore(user: AuthUser) {
  return user.isDevBypass || !supabase;
}

function fromStored(value: unknown): WatchlistStreamingPrefs {
  if (!value || typeof value !== 'object') return EMPTY_STREAMING_PREFS;
  const row = value as Record<string, unknown>;
  const scope = typeof row.recommendScope === 'string' ? row.recommendScope : 'all';
  return {
    providerIds: normalizeStreamingProviderIds(Array.isArray(row.providerIds) ? row.providerIds : []),
    recommendScope: isWatchlistRecommendScope(scope) ? scope : 'all',
  };
}

function explain(error: { message?: string; code?: string }): Error {
  const message = error.message ?? 'Could not save your streaming services.';
  if (error.code === 'PGRST205' || /user_watchlist_prefs|schema cache/i.test(message)) {
    return new Error('Streaming services need the latest database migration before they can be saved.');
  }
  return new Error(message);
}

export async function loadWatchlistStreamingPrefs(user: AuthUser): Promise<WatchlistStreamingPrefs> {
  if (usesLocalStore(user)) {
    const raw = await AsyncStorage.getItem(storageKey(user.id));
    if (!raw) return EMPTY_STREAMING_PREFS;
    try {
      return fromStored(JSON.parse(raw));
    } catch {
      return EMPTY_STREAMING_PREFS;
    }
  }

  const { data, error } = await supabase!
    .from('user_watchlist_prefs')
    .select('provider_ids, recommend_scope')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw explain(error);
  if (!data) return EMPTY_STREAMING_PREFS;
  return fromStored({
    providerIds: data.provider_ids,
    recommendScope: data.recommend_scope,
  });
}

export async function saveWatchlistStreamingPrefs(user: AuthUser, prefs: WatchlistStreamingPrefs): Promise<void> {
  const next = fromStored(prefs);
  if (usesLocalStore(user)) {
    await AsyncStorage.setItem(storageKey(user.id), JSON.stringify(next));
    return;
  }

  const { error } = await supabase!.from('user_watchlist_prefs').upsert(
    {
      user_id: user.id,
      provider_ids: next.providerIds,
      recommend_scope: next.recommendScope,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw explain(error);
}
