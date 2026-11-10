import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  normalizeReadlistShare,
  readlistEntries,
  type ReadlistVisibility,
  type ReadStatus,
} from '@kinexus/domain';

import {
  addReadlistItem,
  createReadlistList,
  deleteReadlistList,
  ensureDefaultReadlist,
  removeReadlistItem,
  renameReadlistList,
  setReadlistItemStatus,
  updateReadlistItem,
  upsertReadlistProgress,
  upsertReadlistReview,
} from '@/src/features/readlist/readlist-api';
import {
  readlistEditionFromRow,
  readlistItemFromRow,
  readlistListFromRow,
  readlistProgressFromRow,
  readlistReviewFromRow,
  readlistWorkFromRow,
} from '@/src/features/readlist/readlist-mappers';
import { buildShareUrl } from '@/src/features/share/share-url';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { supabase } from '@/src/lib/supabase';

function listsKey(householdId: string) {
  return ['readlist', 'lists', householdId] as const;
}
function itemsKey(householdId: string) {
  return ['readlist', 'items', householdId] as const;
}
function worksKey(householdId: string) {
  return ['readlist', 'works', householdId] as const;
}
function editionsKey(householdId: string) {
  return ['readlist', 'editions', householdId] as const;
}
function progressKey(userId: string) {
  return ['readlist', 'progress', userId] as const;
}
function reviewsKey(userId: string) {
  return ['readlist', 'reviews', userId] as const;
}

export function readlistActionError(err: unknown, fallback = 'Could not save that'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useReadlistSync() {
  const { activeHousehold } = useHousehold();
  const { user } = useAuth();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const userId = user && !user.isDevBypass ? user.id : null;
  const ready = Boolean(householdId && supabase && online);
  const ensured = useRef<string | null>(null);

  const ensureQuery = useQuery({
    queryKey: householdId ? ['readlist', 'ensure', householdId] : ['readlist', 'ensure', 'none'],
    enabled: ready,
    staleTime: Infinity,
    queryFn: async () => {
      if (!householdId) return null;
      const listId = await ensureDefaultReadlist(householdId);
      ensured.current = listId;
      return listId;
    },
  });

  useEffect(() => {
    ensured.current = ensureQuery.data ?? null;
  }, [ensureQuery.data]);

  const listsQuery = useQuery({
    queryKey: householdId ? listsKey(householdId) : ['readlist', 'lists', 'none'],
    enabled: ready && Boolean(ensureQuery.data),
    queryFn: async () => {
      if (!supabase || !householdId) return [];
      const { data, error } = await supabase
        .from('readlist_lists')
        .select('*')
        .eq('household_id', householdId)
        .order('name');
      if (error) throw error;
      const listIds = (data ?? []).map((row) => row.id);
      const peopleByList = new Map<string, string[]>();
      if (listIds.length > 0) {
        const { data: people, error: peopleError } = await supabase
          .from('readlist_list_people')
          .select('*')
          .eq('household_id', householdId)
          .in('list_id', listIds);
        if (peopleError) throw peopleError;
        for (const row of people ?? []) {
          const current = peopleByList.get(row.list_id) ?? [];
          current.push(row.person_id);
          peopleByList.set(row.list_id, current);
        }
      }
      return (data ?? []).map((row) => readlistListFromRow(row, peopleByList.get(row.id) ?? []));
    },
  });

  const defaultListId =
    listsQuery.data?.find((list) => list.isDefault)?.id ??
    ensureQuery.data ??
    null;

  const itemsQuery = useQuery({
    queryKey: householdId ? itemsKey(householdId) : ['readlist', 'items', 'none'],
    enabled: ready && Boolean(listsQuery.data?.length),
    queryFn: async () => {
      if (!supabase || !listsQuery.data?.length) return [];
      const listIds = listsQuery.data.map((list) => list.id);
      const { data, error } = await supabase
        .from('readlist_items')
        .select('*')
        .in('list_id', listIds)
        .order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(readlistItemFromRow);
    },
  });

  const workIds = useMemo(
    () => [...new Set((itemsQuery.data ?? []).map((item) => item.workId))],
    [itemsQuery.data],
  );

  const worksQuery = useQuery({
    queryKey: householdId ? [...worksKey(householdId), workIds.join(',')] : ['readlist', 'works', 'none'],
    enabled: ready && workIds.length > 0,
    queryFn: async () => {
      if (!supabase || workIds.length === 0) return [];
      const { data, error } = await supabase.from('readlist_works').select('*').in('id', workIds);
      if (error) throw error;
      return (data ?? []).map(readlistWorkFromRow);
    },
  });

  const editionsQuery = useQuery({
    queryKey: householdId ? [...editionsKey(householdId), workIds.join(',')] : ['readlist', 'editions', 'none'],
    enabled: ready && workIds.length > 0,
    queryFn: async () => {
      if (!supabase || workIds.length === 0) return [];
      const { data, error } = await supabase.from('readlist_editions').select('*').in('work_id', workIds);
      if (error) throw error;
      return (data ?? []).map(readlistEditionFromRow);
    },
  });

  const progressQuery = useQuery({
    queryKey: userId ? progressKey(userId) : ['readlist', 'progress', 'none'],
    enabled: ready && Boolean(userId),
    queryFn: async () => {
      if (!supabase || !userId) return [];
      const { data, error } = await supabase.from('readlist_progress').select('*').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map(readlistProgressFromRow);
    },
  });

  const reviewsQuery = useQuery({
    queryKey: userId ? reviewsKey(userId) : ['readlist', 'reviews', 'none'],
    enabled: ready && Boolean(userId),
    queryFn: async () => {
      if (!supabase || !userId) return [];
      const { data, error } = await supabase.from('readlist_reviews').select('*').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map(readlistReviewFromRow);
    },
  });

  const invalidate = useCallback(async () => {
    if (!householdId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['readlist', 'ensure', householdId] }),
      queryClient.invalidateQueries({ queryKey: listsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: itemsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: worksKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: editionsKey(householdId) }),
      userId ? queryClient.invalidateQueries({ queryKey: progressKey(userId) }) : Promise.resolve(),
      userId ? queryClient.invalidateQueries({ queryKey: reviewsKey(userId) }) : Promise.resolve(),
    ]);
  }, [householdId, queryClient, userId]);

  const resolveHomeListId = useCallback(async () => {
    if (!householdId) throw new Error('Readlist is not ready');
    const liveDefault = listsQuery.data?.find((list) => list.isDefault)?.id ?? null;
    if (liveDefault) return liveDefault;
    const listId = await ensureDefaultReadlist(householdId);
    queryClient.setQueryData(['readlist', 'ensure', householdId], listId);
    ensured.current = listId;
    await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
    return listId;
  }, [householdId, listsQuery.data, queryClient]);

  const lists = listsQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const works = workIds.length === 0 ? [] : (worksQuery.data ?? []);
  const editions = workIds.length === 0 ? [] : (editionsQuery.data ?? []);
  const progress = progressQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const entries = useMemo(() => readlistEntries(lists, works, items), [items, lists, works]);

  const loading =
    Boolean(ready) &&
    (ensureQuery.isLoading ||
      listsQuery.isLoading ||
      (Boolean(listsQuery.data?.length) && itemsQuery.isLoading));

  return {
    online,
    ready,
    loading,
    error:
      ensureQuery.error ??
      listsQuery.error ??
      itemsQuery.error ??
      worksQuery.error ??
      editionsQuery.error ??
      progressQuery.error ??
      reviewsQuery.error ??
      null,
    householdId,
    userId,
    defaultListId,
    lists,
    items,
    works,
    editions,
    progress,
    reviews,
    entries,
    refresh: invalidate,
    async createList(
      name: string,
      share: { visibility: ReadlistVisibility; personIds: readonly string[] },
    ) {
      if (!householdId) throw new Error('Readlist is not ready');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the list a name');
      const next = normalizeReadlistShare(share.visibility, share.personIds);
      if (next.visibility === 'global') throw new Error('Global readlist visibility is not available yet');
      if (next.visibility === 'people' && next.personIds.length === 0) {
        throw new Error('Pick at least one person to share with');
      }
      const listId = await createReadlistList({
        householdId,
        name: trimmed,
        visibility: next.visibility,
        personIds: next.personIds,
      });
      await invalidate();
      return listId;
    },
    async renameList(listId: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the list a name');
      await renameReadlistList(listId, trimmed);
      await invalidate();
    },
    async deleteList(listId: string) {
      await deleteReadlistList(listId);
      if (householdId) {
        const nextHomeId = await ensureDefaultReadlist(householdId);
        queryClient.setQueryData(['readlist', 'ensure', householdId], nextHomeId);
        ensured.current = nextHomeId;
      }
      await invalidate();
    },
    async addWork(
      workId: string,
      opts?: { listId?: string; preferredEditionFormat?: string | null; status?: ReadStatus },
    ) {
      const listId = opts?.listId ?? (await resolveHomeListId());
      const result = await addReadlistItem({
        listId,
        workId,
        preferredEditionFormat: opts?.preferredEditionFormat,
        status: opts?.status ?? 'want_to_read',
      });
      await invalidate();
      return result;
    },
    async setStatus(itemId: string, status: ReadStatus) {
      await setReadlistItemStatus(itemId, status);
      await invalidate();
    },
    async setEdition(itemId: string, preferredEditionId: string | null) {
      if (preferredEditionId == null) {
        await updateReadlistItem({ itemId, clearPreferredEdition: true });
      } else {
        await updateReadlistItem({ itemId, preferredEditionId });
      }
      await invalidate();
    },
    async removeItem(itemId: string) {
      await removeReadlistItem(itemId);
      await invalidate();
    },
    async saveProgress(input: {
      workId: string;
      editionId?: string | null;
      pagesRead?: number | null;
      percent?: number | null;
      secondsListened?: number | null;
    }) {
      await upsertReadlistProgress(input);
      await invalidate();
    },
    async saveReview(workId: string, score: number, body?: string | null) {
      await upsertReadlistReview({ workId, score, body });
      await invalidate();
    },
    async setVisibility(listId: string, visibility: ReadlistVisibility, personIds: readonly string[] = []) {
      if (!supabase) throw new Error('Not ready');
      if (visibility === 'global') throw new Error('Global readlist visibility is not available yet');
      const next = normalizeReadlistShare(visibility, personIds);
      if (next.visibility === 'people' && next.personIds.length === 0) {
        throw new Error('Pick at least one person to share with');
      }
      const { error } = await supabase.rpc('set_readlist_list_visibility', {
        p_list_id: listId,
        p_visibility: next.visibility,
        p_person_ids: next.personIds,
      });
      if (error) throw error;
      await invalidate();
    },
    async enableLinkShare(listId: string) {
      if (!supabase) throw new Error('Not ready');
      const { data, error } = await supabase.rpc('set_readlist_list_link_share', {
        p_list_id: listId,
        p_enabled: true,
        p_rotate: false,
      });
      if (error) throw error;
      if (typeof data !== 'string' || !data) throw new Error('Could not enable share link');
      await invalidate();
      return buildShareUrl('readlist', data);
    },
    async disableLinkShare(listId: string) {
      if (!supabase) throw new Error('Not ready');
      const { error } = await supabase.rpc('set_readlist_list_link_share', {
        p_list_id: listId,
        p_enabled: false,
        p_rotate: false,
      });
      if (error) throw error;
      await invalidate();
      return null;
    },
    async resetLinkShare(listId: string) {
      if (!supabase) throw new Error('Not ready');
      const { data, error } = await supabase.rpc('set_readlist_list_link_share', {
        p_list_id: listId,
        p_enabled: true,
        p_rotate: true,
      });
      if (error) throw error;
      if (typeof data !== 'string' || !data) throw new Error('Could not reset share link');
      await invalidate();
      return buildShareUrl('readlist', data);
    },
  };
}
