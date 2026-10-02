import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';

import type { Database } from '@kinexus/db';
import {
  canViewWatchlist,
  normalizeCountryCode,
  providersAreStale,
  serializeWatchlistProviders,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistResolvedTitle,
  type WatchlistSearchHit,
  type WatchlistTitle,
  normalizeListShare,
  type StashListVisibility,
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
    trailer_url: title.trailerUrl,
    providers: serializeWatchlistProviders(title.providers),
    providers_country: title.providersCountry,
    providers_fetched_at: new Date().toISOString(),
  };
}

export function useWatchlistSync() {
  const { activeHousehold, people, role } = useHousehold();
  const { user } = useAuth();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const userId = user && !user.isDevBypass ? user.id : null;
  const country = normalizeCountryCode(activeHousehold?.country);
  const ready = Boolean(householdId && supabase && online);

  const listPeopleQuery = useQuery({
    queryKey: householdId ? ['watchlist', 'people', householdId] : ['watchlist', 'people', 'none'],
    enabled: ready,
    queryFn: async () => {
      if (!supabase || !householdId) return [];
      const { data, error } = await supabase.from('watchlist_list_people').select('*').eq('household_id', householdId);
      if (error) throw error;
      return (data ?? []).map((row) => ({ listId: row.list_id, personId: row.person_id }));
    },
  });
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

  const replaceWatchlistPeople = useCallback(
    async (listId: string, personIds: string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error: delError } = await supabase.from('watchlist_list_people').delete().eq('list_id', listId);
      throwIfError(delError);
      if (personIds.length === 0) return;
      const { error } = await supabase.from('watchlist_list_people').insert(
        personIds.map((personId) => ({ household_id: householdId, list_id: listId, person_id: personId })),
      );
      throwIfError(error);
    },
    [householdId],
  );

  const createList = useCallback(
    async (name: string, share: { visibility: StashListVisibility; personIds: string[] }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the list a name');
      const next = normalizeListShare(share.visibility, share.personIds);
      if (next.visibility === 'private' && !userId) throw new Error('Sign in to create a private watchlist');
      if (next.visibility === 'people' && next.personIds.length === 0) throw new Error('Pick at least one person to share with');
      const id = Crypto.randomUUID();
      const { error } = await supabase.from('watchlist_lists').insert({
        id,
        household_id: householdId,
        created_by: userId,
        name: trimmed,
        visibility: next.visibility,
      });
      throwIfError(error);
      if (next.personIds.length > 0) await replaceWatchlistPeople(id, next.personIds);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: ['watchlist', 'people', householdId] });
      return id;
    },
    [householdId, queryClient, replaceWatchlistPeople, userId],
  );

  const updateList = useCallback(
    async (id: string, patch: { name?: string; share?: { visibility: StashListVisibility; personIds: string[] } }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const next: Database['public']['Tables']['watchlist_lists']['Update'] = {};
      if (patch.name != null) {
        const trimmed = patch.name.trim();
        if (!trimmed) throw new Error('Give the list a name');
        next.name = trimmed;
      }
      if (patch.share) {
        const share = normalizeListShare(patch.share.visibility, patch.share.personIds);
        if (share.visibility === 'private' && !userId) throw new Error('Sign in to keep a private watchlist');
        if (share.visibility === 'people' && share.personIds.length === 0) throw new Error('Pick at least one person to share with');
        next.visibility = share.visibility;
        await replaceWatchlistPeople(id, share.personIds);
      }
      const { error } = await supabase.from('watchlist_lists').update(next).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: ['watchlist', 'people', householdId] });
    },
    [householdId, queryClient, replaceWatchlistPeople, userId],
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
        trailerUrl: null,
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
      if (!force && !providersAreStale(title, country) && title.trailerUrl) return title;
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

  const viewerId = user?.id ?? null;
  const personId = people.find((person) => person.userId === viewerId)?.id ?? null;
  const lists = (listsQuery.data ?? [])
    .map((list) => ({
      ...list,
      personIds: (listPeopleQuery.data ?? []).filter((row) => row.listId === list.id).map((row) => row.personId),
    }))
    .filter((list) => canViewWatchlist(list, { role, userId: viewerId, personId }));
  const visibleListIds = new Set(lists.map((list) => list.id));

  return {
    lists,
    titles: titlesQuery.data ?? [],
    items: (itemsQuery.data ?? []).filter((item) => visibleListIds.has(item.listId)),
    country,
    userId,
    online,
    loading: listsQuery.isLoading || listPeopleQuery.isLoading || titlesQuery.isLoading || itemsQuery.isLoading,
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
