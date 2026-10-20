import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef } from 'react';

import type { Database } from '@kinexus/db';
import {
  canViewAudience,
  canViewWatchlist,
  isWatchedList,
  listAudienceFromTitles,
  normalizeCountryCode,
  normalizeSamplePosterPaths,
  normalizeWatchlistBlurb,
  normalizeWatchlistShare,
  providersAreStale,
  serializeWatchlistProviders,
  viewerAudience,
  watchlistGlobalPublishError,
  type WatchedScope,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistResolvedTitle,
  type WatchlistReview,
  type WatchlistSearchHit,
  type WatchlistTitle,
  type WatchlistVisibility,
  isWatchlistScore,
  WATCHLIST_REVIEW_LIMIT,
} from '@kinexus/domain';

import { lookupWatchlistCatalog } from '@/src/features/stash/watchlist-api';
import { ensureSocialAlias } from '@/src/features/stash/watchlist-social';
import { watchlistItemFromRow, watchlistListFromRow, watchlistReviewFromRow, watchlistTitleFromRow } from '@/src/features/stash/watchlist-mappers';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { supabase } from '@/src/lib/supabase';

export type WatchlistGlobalPublish = {
  blurb: string;
  samplePosterPaths: string[];
};

function listsKey(householdId: string) {
  return ['watchlist', 'lists', householdId] as const;
}
function titlesKey(householdId: string) {
  return ['watchlist', 'titles', householdId] as const;
}
function itemsKey(householdId: string) {
  return ['watchlist', 'items', householdId] as const;
}
function reviewsKey(householdId: string) {
  return ['watchlist', 'reviews', householdId] as const;
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

async function fetchReviews(householdId: string): Promise<WatchlistReview[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('watchlist_reviews')
    .select('*')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(watchlistReviewFromRow);
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
    content_rating: title.contentRating,
    audience: title.audience,
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
  const reviewsQuery = useQuery({
    queryKey: householdId ? reviewsKey(householdId) : ['watchlist', 'reviews', 'none'],
    enabled: ready,
    queryFn: () => fetchReviews(householdId!),
  });
  const ensuredHousehold = useRef<string | null>(null);

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
    async (
      name: string,
      share: { visibility: WatchlistVisibility; personIds: string[] },
      publish?: WatchlistGlobalPublish,
    ) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the list a name');
      const next = normalizeWatchlistShare(share.visibility, share.personIds);
      if (next.visibility === 'private' && !userId) throw new Error('Sign in to create a private watchlist');
      if (next.visibility === 'people' && next.personIds.length === 0) throw new Error('Pick at least one person to share with');
      if (next.visibility === 'global' && !userId) throw new Error('Sign in to share a list with everyone');
      let blurb: string | null = null;
      let samplePosterPaths: string[] = [];
      if (next.visibility === 'global') {
        const publishError = watchlistGlobalPublishError({
          name: trimmed,
          blurb: publish?.blurb,
          samplePosterPaths: publish?.samplePosterPaths ?? [],
        });
        if (publishError) throw new Error(publishError);
        blurb = normalizeWatchlistBlurb(publish?.blurb);
        samplePosterPaths = normalizeSamplePosterPaths(publish?.samplePosterPaths ?? []);
        await ensureSocialAlias(userId!);
      }
      const id = Crypto.randomUUID();
      const { error } = await supabase.from('watchlist_lists').insert({
        id,
        household_id: householdId,
        created_by: userId,
        name: trimmed,
        visibility: next.visibility,
        kind: 'custom',
        audience: '18+',
        blurb,
        sample_poster_paths: samplePosterPaths,
      });
      throwIfError(error);
      if (next.personIds.length > 0) await replaceWatchlistPeople(id, next.personIds);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: ['watchlist', 'people', householdId] });
      await queryClient.invalidateQueries({ queryKey: ['watchlist', 'global-lists'] });
      return id;
    },
    [householdId, queryClient, replaceWatchlistPeople, userId],
  );

  const updateList = useCallback(
    async (
      id: string,
      patch: {
        name?: string;
        share?: { visibility: WatchlistVisibility; personIds: string[] };
        publish?: WatchlistGlobalPublish;
      },
    ) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if ((listsQuery.data ?? []).some((list) => list.id === id && isWatchedList(list))) {
        throw new Error('Watched lists stay as they are');
      }
      const next: Database['public']['Tables']['watchlist_lists']['Update'] = {};
      if (patch.name != null) {
        const trimmed = patch.name.trim();
        if (!trimmed) throw new Error('Give the list a name');
        next.name = trimmed;
      }
      if (patch.share) {
        const share = normalizeWatchlistShare(patch.share.visibility, patch.share.personIds);
        if (share.visibility === 'private' && !userId) throw new Error('Sign in to keep a private watchlist');
        if (share.visibility === 'people' && share.personIds.length === 0) throw new Error('Pick at least one person to share with');
        if (share.visibility === 'global' && !userId) throw new Error('Sign in to share a list with everyone');
        next.visibility = share.visibility;
        if (share.visibility === 'global') {
          const titleIds = (itemsQuery.data ?? []).filter((item) => item.listId === id).map((item) => item.titleId);
          const titles = (titlesQuery.data ?? []).filter((title) => titleIds.includes(title.id));
          next.audience = listAudienceFromTitles(titles);
          const publishError = watchlistGlobalPublishError({
            name: patch.name ?? (listsQuery.data ?? []).find((list) => list.id === id)?.name ?? '',
            blurb: patch.publish?.blurb,
            samplePosterPaths: patch.publish?.samplePosterPaths ?? [],
          });
          if (publishError) throw new Error(publishError);
          next.blurb = normalizeWatchlistBlurb(patch.publish?.blurb);
          next.sample_poster_paths = normalizeSamplePosterPaths(patch.publish?.samplePosterPaths ?? []);
          await ensureSocialAlias(userId!);
        } else {
          next.blurb = null;
          next.sample_poster_paths = [];
        }
        await replaceWatchlistPeople(id, share.personIds);
      } else if (patch.publish) {
        next.blurb = normalizeWatchlistBlurb(patch.publish.blurb);
        next.sample_poster_paths = normalizeSamplePosterPaths(patch.publish.samplePosterPaths);
      }
      const { error } = await supabase.from('watchlist_lists').update(next).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: ['watchlist', 'people', householdId] });
      await queryClient.invalidateQueries({ queryKey: ['watchlist', 'global-lists'] });
    },
    [householdId, itemsQuery.data, listsQuery.data, queryClient, replaceWatchlistPeople, titlesQuery.data, userId],
  );

  const deleteList = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if ((listsQuery.data ?? []).some((list) => list.id === id && isWatchedList(list))) {
        throw new Error('Watched lists stay as they are');
      }
      const { error } = await supabase.from('watchlist_lists').delete().eq('id', id);
      throwIfError(error);
      await invalidate();
    },
    [householdId, invalidate, listsQuery.data],
  );

  const ensureWatchedLists = useCallback(async (): Promise<{ familyId: string; privateId: string }> => {
    if (!householdId || !supabase || !userId) throw new Error('Sign in to keep a watched list');

    async function loadId(kind: 'watched_family' | 'watched_private'): Promise<string | null> {
      let query = supabase!
        .from('watchlist_lists')
        .select('id')
        .eq('household_id', householdId!)
        .eq('kind', kind);
      if (kind === 'watched_private') query = query.eq('created_by', userId!);
      const found = await query.maybeSingle();
      throwIfError(found.error);
      return found.data?.id ?? null;
    }

    async function ensure(
      kind: 'watched_family' | 'watched_private',
      name: string,
      visibility: 'household' | 'private',
    ): Promise<string> {
      const existing = await loadId(kind);
      if (existing) return existing;
      const id = Crypto.randomUUID();
      const inserted = await supabase!.from('watchlist_lists').insert({
        id,
        household_id: householdId!,
        created_by: userId,
        name,
        visibility,
        kind,
      });
      if (inserted.error) {
        if (inserted.error.code === '23505') {
          const again = await loadId(kind);
          if (again) return again;
        }
        throw new Error(inserted.error.message);
      }
      return id;
    }

    const familyId = await ensure('watched_family', 'Family', 'household');
    const privateId = await ensure('watched_private', 'Private', 'private');
    await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
    return { familyId, privateId };
  }, [householdId, queryClient, userId]);

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

  const placeWatched = useCallback(
    async (input: {
      hit: WatchlistSearchHit;
      sourceUrl?: string | null;
      scope: WatchedScope;
      sourceItemId?: string | null;
      queueListId?: string | null;
    }): Promise<string> => {
      if (!householdId || !supabase || !userId) throw new Error('Sign in to keep a watched list');
      const { familyId, privateId } = await ensureWatchedLists();
      const targetId = input.scope === 'family' ? familyId : privateId;
      const otherId = input.scope === 'family' ? privateId : familyId;
      const resolved = await lookupWatchlistCatalog({
        tmdbId: input.hit.tmdbId,
        mediaType: input.hit.mediaType,
        country,
        sourceUrl: input.sourceUrl ?? null,
      }).catch((): WatchlistResolvedTitle => ({
        ...input.hit,
        sourceUrl: input.sourceUrl ?? null,
        tmdbWatchUrl: null,
        trailerUrl: null,
        contentRating: null,
        audience: null,
        providers: [],
        providersCountry: country,
      }));
      const titleId = await upsertTitle(resolved);
      const { data: rows, error } = await supabase
        .from('watchlist_items')
        .select('id, list_id, status')
        .eq('household_id', householdId)
        .eq('title_id', titleId);
      throwIfError(error);
      const saved = rows ?? [];
      const target = saved.find((row) => row.list_id === targetId);
      if (!target) {
        const { error: insertError } = await supabase.from('watchlist_items').insert({
          id: Crypto.randomUUID(),
          household_id: householdId,
          list_id: targetId,
          title_id: titleId,
          added_by: userId,
          status: 'watched',
        });
        throwIfError(insertError);
      } else if (target.status !== 'watched') {
        const { error: updateError } = await supabase.from('watchlist_items').update({ status: 'watched' }).eq('id', target.id);
        throwIfError(updateError);
      }
      const other = saved.find((row) => row.list_id === otherId);
      if (other) {
        const { error: deleteError } = await supabase.from('watchlist_items').delete().eq('id', other.id);
        throwIfError(deleteError);
      }
      if (input.sourceItemId && input.sourceItemId !== other?.id && input.sourceItemId !== target?.id) {
        const { error: statusError } = await supabase
          .from('watchlist_items')
          .update({ status: 'watched' })
          .eq('id', input.sourceItemId);
        throwIfError(statusError);
      }
      if (input.queueListId && input.queueListId !== targetId && input.queueListId !== otherId) {
        const queued = saved.find((row) => row.list_id === input.queueListId);
        if (!queued) {
          const { error: queueError } = await supabase.from('watchlist_items').insert({
            id: Crypto.randomUUID(),
            household_id: householdId,
            list_id: input.queueListId,
            title_id: titleId,
            added_by: userId,
            status: 'watched',
          });
          throwIfError(queueError);
        } else if (queued.status !== 'watched') {
          const { error: queueUpdate } = await supabase
            .from('watchlist_items')
            .update({ status: 'watched' })
            .eq('id', queued.id);
          throwIfError(queueUpdate);
        }
      }
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: titlesKey(householdId) });
      return titleId;
    },
    [country, ensureWatchedLists, householdId, queryClient, upsertTitle, userId],
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
        contentRating: null,
        audience: null,
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
      const list = (listsQuery.data ?? []).find((row) => row.id === listId);
      if (list?.visibility === 'global') {
        const titleIds = new Set(
          (itemsQuery.data ?? []).filter((item) => item.listId === listId).map((item) => item.titleId),
        );
        titleIds.add(titleId);
        const onList = (titlesQuery.data ?? [])
          .filter((title) => titleIds.has(title.id))
          .map((title) => (title.id === titleId ? { ...title, audience: resolved.audience } : title));
        if (!onList.some((title) => title.id === titleId)) {
          onList.push({ audience: resolved.audience } as WatchlistTitle);
        }
        const { error: audienceError } = await supabase
          .from('watchlist_lists')
          .update({ audience: listAudienceFromTitles(onList) })
          .eq('id', listId);
        throwIfError(audienceError);
        await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
        await queryClient.invalidateQueries({ queryKey: ['watchlist', 'global-lists'] });
      }
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      return id;
    },
    [country, householdId, itemsQuery.data, listsQuery.data, queryClient, titlesQuery.data, upsertTitle, userId],
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

  const saveReview = useCallback(
    async (titleId: string, personIdToSave: string, score: number, body: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!isWatchlistScore(score)) throw new Error('Score must be from 1 to 10');
      const text = body.trim();
      if (text.length > WATCHLIST_REVIEW_LIMIT) throw new Error('Review is too long');
      const existing = (reviewsQuery.data ?? []).find(
        (review) => review.titleId === titleId && review.personId === personIdToSave,
      );
      if (existing) {
        const { data, error } = await supabase
          .from('watchlist_reviews')
          .update({ score, body: text || null })
          .eq('id', existing.id)
          .select('id');
        throwIfError(error);
        if (!data?.length) throw new Error('Could not update that review');
      } else {
        const { error } = await supabase.from('watchlist_reviews').insert({
          id: Crypto.randomUUID(),
          household_id: householdId,
          title_id: titleId,
          person_id: personIdToSave,
          score,
          body: text || null,
        });
        throwIfError(error);
      }
      await queryClient.invalidateQueries({ queryKey: reviewsKey(householdId) });
    },
    [householdId, queryClient, reviewsQuery.data],
  );

  const deleteReview = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { data, error } = await supabase.from('watchlist_reviews').delete().eq('id', id).select('id');
      throwIfError(error);
      if (!data?.length) throw new Error('Could not delete that review');
      await queryClient.invalidateQueries({ queryKey: reviewsKey(householdId) });
    },
    [householdId, queryClient],
  );

  useEffect(() => {
    if (!ready || !householdId || !userId || !listsQuery.isSuccess) return;
    if (ensuredHousehold.current === householdId) return;
    ensuredHousehold.current = householdId;
    void ensureWatchedLists().catch(() => {
      ensuredHousehold.current = null;
    });
  }, [ensureWatchedLists, householdId, listsQuery.isSuccess, ready, userId]);

  useEffect(() => {
    if (!userId || !supabase) return;
    void ensureSocialAlias(userId).catch(() => undefined);
  }, [userId]);

  const viewerId = user?.id ?? null;
  const selfPerson = people.find((person) => person.userId === viewerId) ?? null;
  const personId = selfPerson?.id ?? null;
  const allowedAudience = viewerAudience({ role, birthday: selfPerson?.birthday ?? null });
  const lists = (listsQuery.data ?? [])
    .map((list) => ({
      ...list,
      personIds: (listPeopleQuery.data ?? []).filter((row) => row.listId === list.id).map((row) => row.personId),
    }))
    .filter((list) => canViewWatchlist(list, { role, userId: viewerId, personId }))
    .filter((list) => list.visibility !== 'global' || canViewAudience(allowedAudience, list.audience));
  const visibleListIds = new Set(lists.map((list) => list.id));
  const titles = (titlesQuery.data ?? []).filter(
    (title) => !title.audience || canViewAudience(allowedAudience, title.audience),
  );
  const allowedTitleIds = new Set(titles.map((title) => title.id));
  const visibleTitleIds = new Set(
    (itemsQuery.data ?? [])
      .filter((item) => visibleListIds.has(item.listId) && allowedTitleIds.has(item.titleId))
      .map((item) => item.titleId),
  );

  return {
    lists,
    titles,
    reviews: (reviewsQuery.data ?? []).filter((review) => visibleTitleIds.has(review.titleId)),
    items: (itemsQuery.data ?? []).filter(
      (item) => visibleListIds.has(item.listId) && allowedTitleIds.has(item.titleId),
    ),
    allowedAudience,
    country,
    userId,
    online,
    loading: listsQuery.isLoading || listPeopleQuery.isLoading || titlesQuery.isLoading || itemsQuery.isLoading || reviewsQuery.isLoading,
    error: listsQuery.error ?? titlesQuery.error ?? itemsQuery.error ?? reviewsQuery.error,
    createList,
    updateList,
    deleteList,
    addTitleToList,
    updateItem,
    removeItem,
    refreshTitle,
    saveReview,
    deleteReview,
    ensureWatchedLists,
    placeWatched,
  };
}
