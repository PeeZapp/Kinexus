import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';

import type { Database } from '@kinexus/db';
import {
  normalizeCountryCode,
  providersAreStale,
  serializeWatchlistProviders,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistResolvedTitle,
  type WatchlistSearchHit,
  type WatchlistTitle,
  type WatchlistVisibility,
} from '@kinexus/domain';

import { lookupWatchlistCatalog } from '@/src/features/stash/watchlist-api';
import { watchlistItemFromRow, watchlistListFromRow, watchlistTitleFromRow } from '@/src/features/stash/watchlist-mappers';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { supabase } from '@/src/lib/supabase';

function listsKey(householdId: string) {
  return ['watchlist', 'lists', householdId] as const;
}
function titlesKey(householdId: string) {
  return ['watchlist', 'titles', householdId] as const;
}
function itemsKey(householdId: string) {
  return ['watchlist', 'items', householdId] as const;
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function watchlistActionError(err: unknown, fallback = 'Could not save that'): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message;
  }
  return fallback;
}

async function fetchLists(householdId: string): Promise<WatchlistList[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('watchlist_lists').select('*').eq('household_id', householdId).order('name');
  if (error) throw error;
  return (data ?? []).map(watchlistListFromRow);
}

async function fetchTitles(householdId: string): Promise<WatchlistTitle[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('watchlist_titles').select('*').eq('household_id', householdId).order('title');
  if (error) throw error;
  return (data ?? []).map(watchlistTitleFromRow);
}

async function fetchItems(householdId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('watchlist_items').select('*').eq('household_id', householdId).order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(watchlistItemFromRow);
}

function providersPatch(title: WatchlistResolvedTitle) {
  return {
    title: title.title,
    year: title.year,
    overview: title.overview,
    poster_path: title.posterPath,
    backdrop_path: title.backdropPath,
    imdb_id: title.imdbId,
    source_url: title.sourceUrl,
    tmdb_watch_url: title.tmdbWatchUrl,
    providers: serializeWatchlistProviders(title.providers),
    providers_country: title.providersCountry,
    providers_fetched_at: new Date().toISOString(),
  };
}

export function useWatchlistSync() {
  const { activeHousehold } = useHousehold();
  const { user } = useAuth();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const userId = user && !user.isDevBypass ? user.id : null;
  const country = normalizeCountryCode(activeHousehold?.country);
  const ready = Boolean(householdId && supabase && online);

  const listsQuery = useQuery({
    queryKey: householdId ? listsKey(householdId) : ['watchlist', 'lists', 'none'],
    enabled: ready,
    queryFn: () => fetchLists(householdId!),
  });
  const titlesQuery = useQuery({
    queryKey: householdId ? titlesKey(householdId) : ['watchlist', 'titles', 'none'],
    enabled: ready,
    queryFn: () => fetchTitles(householdId!),
  });
  const itemsQuery = useQuery({
    queryKey: householdId ? itemsKey(householdId) : ['watchlist', 'items', 'none'],
    enabled: ready,
    queryFn: () => fetchItems(householdId!),
  });

  const invalidate = useCallback(async () => {
    if (!householdId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: listsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: titlesKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: itemsKey(householdId) }),
    ]);
  }, [householdId, queryClient]);

  const createList = useCallback(
    async (name: string, visibility: WatchlistVisibility) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the list a name');
      if (visibility === 'personal' && !userId) throw new Error('Sign in to create a personal watchlist');
      const id = Crypto.randomUUID();
      const { error } = await supabase.from('watchlist_lists').insert({
        id,
        household_id: householdId,
        created_by: userId,
        name: trimmed,
        visibility,
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      return id;
    },
    [householdId, queryClient, userId],
  );

  const updateList = useCallback(
    async (id: string, patch: { name?: string; visibility?: WatchlistVisibility }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const next: Database['public']['Tables']['watchlist_lists']['Update'] = {};
      if (patch.name != null) {
        const trimmed = patch.name.trim();
        if (!trimmed) throw new Error('Give the list a name');
        next.name = trimmed;
      }
      if (patch.visibility) {
        if (patch.visibility === 'personal' && !userId) throw new Error('Sign in to keep a personal watchlist');
        next.visibility = patch.visibility;
      }
      const { error } = await supabase.from('watchlist_lists').update(next).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
    },
    [householdId, queryClient, userId],
  );

  const deleteList = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('watchlist_lists').delete().eq('id', id);
      throwIfError(error);
      await invalidate();
    },
    [householdId, invalidate],
  );

  const upsertTitle = useCallback(
    async (resolved: WatchlistResolvedTitle) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const existing = (titlesQuery.data ?? []).find(
        (row) => row.tmdbId === resolved.tmdbId && row.mediaType === resolved.mediaType,
      );
      const fields = providersPatch(resolved);
      if (existing) {
        const { error } = await supabase.from('watchlist_titles').update(fields).eq('id', existing.id);
        throwIfError(error);
        await queryClient.invalidateQueries({ queryKey: titlesKey(householdId) });
        return existing.id;
      }
      const { data, error } = await supabase
        .from('watchlist_titles')
        .upsert(
          {
            household_id: householdId,
            created_by: userId,
            tmdb_id: resolved.tmdbId,
            media_type: resolved.mediaType,
            ...fields,
          },
          { onConflict: 'household_id,tmdb_id,media_type' },
        )
        .select('id')
        .single();
      throwIfError(error);
      if (!data?.id) throw new Error('Could not save that title');
      await queryClient.invalidateQueries({ queryKey: titlesKey(householdId) });
      return data.id;
    },
    [householdId, queryClient, titlesQuery.data, userId],
  );

  const addTitleToList = useCallback(
    async (listId: string, hit: WatchlistSearchHit, opts?: { sourceUrl?: string | null; status?: WatchlistItemStatus }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const resolved = await lookupWatchlistCatalog({
        tmdbId: hit.tmdbId,
        mediaType: hit.mediaType,
        country,
        sourceUrl: opts?.sourceUrl ?? null,
      }).catch((): WatchlistResolvedTitle => ({
        ...hit,
        sourceUrl: opts?.sourceUrl ?? null,
        tmdbWatchUrl: null,
        providers: [],
        providersCountry: country,
      }));
      const titleId = await upsertTitle(resolved);
      const already = (itemsQuery.data ?? []).find((row) => row.listId === listId && row.titleId === titleId);
      if (already) return already.id;
      const id = Crypto.randomUUID();
      const { error } = await supabase.from('watchlist_items').insert({
        id,
        household_id: householdId,
        list_id: listId,
        title_id: titleId,
        added_by: userId,
        status: opts?.status ?? 'want',
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      return id;
    },
    [country, householdId, itemsQuery.data, queryClient, upsertTitle, userId],
  );

  const updateItem = useCallback(
    async (id: string, patch: { status?: WatchlistItemStatus; notes?: string | null }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const next: Database['public']['Tables']['watchlist_items']['Update'] = {};
      if (patch.status) next.status = patch.status;
      if (patch.notes !== undefined) next.notes = patch.notes?.trim() || null;
      const { error } = await supabase.from('watchlist_items').update(next).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('watchlist_items').delete().eq('id', id);
      throwIfError(error);
      await invalidate();
    },
    [householdId, invalidate],
  );

  const refreshTitle = useCallback(
    async (title: WatchlistTitle, force = false) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!force && !providersAreStale(title, country)) return title;
      const resolved = await lookupWatchlistCatalog({
        tmdbId: title.tmdbId,
        mediaType: title.mediaType,
        country,
        sourceUrl: title.sourceUrl,
      });
      const { error } = await supabase.from('watchlist_titles').update(providersPatch(resolved)).eq('id', title.id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: titlesKey(householdId) });
      return { ...title, ...resolved, providersFetchedAt: new Date().toISOString() };
    },
    [country, householdId, queryClient],
  );

  return {
    lists: listsQuery.data ?? [],
    titles: titlesQuery.data ?? [],
    items: itemsQuery.data ?? [],
    country,
    userId,
    online,
    loading: listsQuery.isLoading || titlesQuery.isLoading || itemsQuery.isLoading,
    error: listsQuery.error ?? titlesQuery.error ?? itemsQuery.error,
    createList,
    updateList,
    deleteList,
    addTitleToList,
    updateItem,
    removeItem,
    refreshTitle,
  };
}
