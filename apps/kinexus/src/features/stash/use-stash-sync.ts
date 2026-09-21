import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect } from 'react';

import type { Database } from '@kinexus/db';
import {
  canonicalizeUrl,
  inferLinkType,
  isSale,
  normalizeListShare,
  parseMoney,
  type SavedLink,
  type SavedLinkCollection,
  type SavedLinkStatus,
  type SavedLinkType,
  type StashList,
  type StashListItem,
  type StashListItemPriority,
  type StashListKind,
  type StashListProduct,
  type StashListRecurrence,
  type StashListVisibility,
  type StashProduct,
} from '@kinexus/domain';

import {
  collectionFromRow,
  linkFromRow,
  listFromRow,
  listItemFromRow,
  listProductFromRow,
  productFromRow,
} from '@/src/features/stash/mappers';
import { scrapeStashLink, scrapeStashProduct } from '@/src/features/stash/stash-api';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { retainPostgresChannel } from '@/src/lib/realtime';
import { supabase } from '@/src/lib/supabase';

function productsKey(householdId: string) {
  return ['stash', 'products', householdId] as const;
}
function listsKey(householdId: string) {
  return ['stash', 'lists', householdId] as const;
}
function listPeopleKey(householdId: string) {
  return ['stash', 'list-people', householdId] as const;
}
function membershipsKey(householdId: string) {
  return ['stash', 'memberships', householdId] as const;
}
function itemsKey(householdId: string) {
  return ['stash', 'items', householdId] as const;
}
function linksKey(householdId: string) {
  return ['stash', 'links', householdId] as const;
}
function collectionsKey(householdId: string) {
  return ['stash', 'collections', householdId] as const;
}
function collectionItemsKey(householdId: string) {
  return ['stash', 'collection-items', householdId] as const;
}

type CollectionItem = { collectionId: string; linkId: string };

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function actionErrorMessage(err: unknown, fallback = 'Could not save that'): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message;
  }
  return fallback;
}

async function fetchProducts(householdId: string): Promise<StashProduct[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('stash_products').select('*').eq('household_id', householdId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(productFromRow);
}

async function fetchLists(householdId: string): Promise<StashList[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('stash_lists').select('*').eq('household_id', householdId).order('name');
  if (error) throw error;
  return (data ?? []).map((row) => listFromRow(row));
}

type ListPerson = { listId: string; personId: string };

async function fetchListPeople(householdId: string): Promise<ListPerson[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('stash_list_people').select('*').eq('household_id', householdId);
  if (error) throw error;
  return (data ?? []).map((row) => ({ listId: row.list_id, personId: row.person_id }));
}

async function fetchMemberships(householdId: string): Promise<StashListProduct[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('stash_list_products').select('*').eq('household_id', householdId);
  if (error) throw error;
  return (data ?? []).map(listProductFromRow);
}

async function fetchItems(householdId: string): Promise<StashListItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('stash_list_items').select('*').eq('household_id', householdId).order('position');
  if (error) throw error;
  return (data ?? []).map(listItemFromRow);
}

async function fetchCollections(householdId: string): Promise<SavedLinkCollection[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('stash_link_collections').select('*').eq('household_id', householdId).order('position').order('name');
  if (error) throw error;
  return (data ?? []).map(collectionFromRow);
}

async function fetchCollectionItems(householdId: string): Promise<CollectionItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('stash_link_collection_items').select('*').eq('household_id', householdId);
  if (error) throw error;
  return (data ?? []).map((row) => ({ collectionId: row.collection_id, linkId: row.link_id }));
}

async function fetchLinks(householdId: string): Promise<Database['public']['Tables']['stash_links']['Row'][]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('stash_links').select('*').eq('household_id', householdId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type ListShareDraft = {
  visibility: StashListVisibility;
  personIds: string[];
};

export type ChecklistItemDraft = {
  title: string;
  notes?: string | null;
  category?: string | null;
  priority?: StashListItemPriority;
  dueOn?: string | null;
  recurrence?: StashListRecurrence;
  assignedPersonId?: string | null;
  isChecked?: boolean;
};

export type ProductDraft = {
  title: string;
  sourceUrl?: string;
  currentPrice?: string;
  originalPrice?: string;
  imageUrl?: string;
  storeName?: string;
  description?: string;
  sku?: string;
  notes?: string;
  isOwned?: boolean;
  listId?: string | null;
  priceSource?: 'manual' | 'scraped';
};

export type LinkDraft = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  faviconUrl?: string;
  linkType?: SavedLinkType;
  collectionId?: string | null;
  notes?: string;
};

export function useStashSync() {
  const { activeHousehold } = useHousehold();
  const { user } = useAuth();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const userId = user && !user.isDevBypass ? user.id : null;
  const currency = activeHousehold?.currency || 'AUD';
  const ready = Boolean(householdId && supabase && online);

  const productsQuery = useQuery({
    queryKey: householdId ? productsKey(householdId) : ['stash', 'products', 'none'],
    enabled: ready,
    queryFn: () => fetchProducts(householdId!),
  });
  const listsQuery = useQuery({
    queryKey: householdId ? listsKey(householdId) : ['stash', 'lists', 'none'],
    enabled: ready,
    queryFn: () => fetchLists(householdId!),
  });
  const listPeopleQuery = useQuery({
    queryKey: householdId ? listPeopleKey(householdId) : ['stash', 'list-people', 'none'],
    enabled: ready,
    queryFn: () => fetchListPeople(householdId!),
  });
  const membershipsQuery = useQuery({
    queryKey: householdId ? membershipsKey(householdId) : ['stash', 'memberships', 'none'],
    enabled: ready,
    queryFn: () => fetchMemberships(householdId!),
  });
  const itemsQuery = useQuery({
    queryKey: householdId ? itemsKey(householdId) : ['stash', 'items', 'none'],
    enabled: ready,
    queryFn: () => fetchItems(householdId!),
  });
  const collectionsQuery = useQuery({
    queryKey: householdId ? collectionsKey(householdId) : ['stash', 'collections', 'none'],
    enabled: ready,
    queryFn: () => fetchCollections(householdId!),
  });
  const collectionItemsQuery = useQuery({
    queryKey: householdId ? collectionItemsKey(householdId) : ['stash', 'collection-items', 'none'],
    enabled: ready,
    queryFn: () => fetchCollectionItems(householdId!),
  });
  const linksQuery = useQuery({
    queryKey: householdId ? linksKey(householdId) : ['stash', 'links', 'none'],
    enabled: ready,
    queryFn: () => fetchLinks(householdId!),
  });

  useEffect(() => {
    if (!householdId || !online || !supabase) return;
    const client = supabase;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: productsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: listPeopleKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: membershipsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: linksKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: collectionsKey(householdId) });
      void queryClient.invalidateQueries({ queryKey: collectionItemsKey(householdId) });
    };
    return retainPostgresChannel(client, `stash-sync:${householdId}`, (channel) =>
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stash_products', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stash_lists', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stash_list_people', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stash_list_products', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stash_list_items', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stash_links', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stash_link_collections', filter: `household_id=eq.${householdId}` }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stash_link_collection_items', filter: `household_id=eq.${householdId}` }, invalidate),
    );
  }, [householdId, online, queryClient]);

  const products = productsQuery.data ?? [];
  const listPeople = listPeopleQuery.data ?? [];
  const lists = (listsQuery.data ?? []).map((list) => ({
    ...list,
    personIds: listPeople.filter((row) => row.listId === list.id).map((row) => row.personId),
  }));
  const memberships = membershipsQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const collections = collectionsQuery.data ?? [];
  const collectionItems = collectionItemsQuery.data ?? [];
  const links = (linksQuery.data ?? []).map((row) => {
    const collectionIds = collectionItems.filter((item) => item.linkId === row.id).map((item) => item.collectionId);
    return linkFromRow(row, collectionIds);
  });

  const refreshAll = useCallback(async () => {
    if (!householdId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: listsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: listPeopleKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: membershipsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: itemsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: linksKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: collectionsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: collectionItemsKey(householdId) }),
    ]);
  }, [householdId, queryClient]);

  const replaceListPeople = useCallback(
    async (listId: string, personIds: string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error: delError } = await supabase.from('stash_list_people').delete().eq('list_id', listId);
      if (delError) throwIfError(delError);
      if (personIds.length === 0) return;
      const { error } = await supabase.from('stash_list_people').insert(
        personIds.map((personId) => ({
          household_id: householdId,
          list_id: listId,
          person_id: personId,
        })),
      );
      throwIfError(error);
    },
    [householdId],
  );

  const createList = useCallback(
    async (name: string, share: ListShareDraft, opts: { kind: StashListKind; parentListId?: string | null }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the list a name');
      const next = normalizeListShare(share.visibility, share.personIds);
      if (next.visibility === 'people' && next.personIds.length === 0) {
        throw new Error('Pick at least one person to share with');
      }
      const id = Crypto.randomUUID();
      const { error } = await supabase.from('stash_lists').insert({
        id,
        household_id: householdId,
        created_by: userId,
        name: trimmed,
        kind: opts.kind,
        visibility: next.visibility,
        parent_list_id: opts.parentListId ?? null,
      });
      throwIfError(error);
      if (next.personIds.length > 0) await replaceListPeople(id, next.personIds);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: listPeopleKey(householdId) });
      return id;
    },
    [householdId, queryClient, replaceListPeople, userId],
  );

  const renameList = useCallback(
    async (id: string, name: string, share?: ListShareDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the list a name');
      const patch: Database['public']['Tables']['stash_lists']['Update'] = { name: trimmed };
      if (share) {
        const next = normalizeListShare(share.visibility, share.personIds);
        if (next.visibility === 'people' && next.personIds.length === 0) {
          throw new Error('Pick at least one person to share with');
        }
        patch.visibility = next.visibility;
        await replaceListPeople(id, next.personIds);
      }
      const { error } = await supabase.from('stash_lists').update(patch).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: listPeopleKey(householdId) });
    },
    [householdId, queryClient, replaceListPeople],
  );

  const deleteList = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('stash_lists').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: listsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: membershipsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const createItem = useCallback(
    async (listId: string, draft: ChecklistItemDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const title = draft.title.trim();
      if (!title) throw new Error('Give the item a title');
      const position =
        items.filter((item) => item.listId === listId).reduce((max, item) => Math.max(max, item.position), -1) + 1;
      const { error } = await supabase.from('stash_list_items').insert({
        household_id: householdId,
        list_id: listId,
        created_by: userId,
        title,
        notes: draft.notes?.trim() || null,
        category: draft.category?.trim() || null,
        priority: draft.priority ?? 0,
        due_on: draft.dueOn || null,
        recurrence: draft.recurrence ?? 'none',
        assigned_person_id: draft.assignedPersonId || null,
        is_checked: Boolean(draft.isChecked),
        position,
      });
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
    },
    [householdId, items, queryClient, userId],
  );

  const updateItem = useCallback(
    async (id: string, draft: Partial<ChecklistItemDraft>) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const patch: Database['public']['Tables']['stash_list_items']['Update'] = {};
      if (draft.title !== undefined) {
        const title = draft.title.trim();
        if (!title) throw new Error('Give the item a title');
        patch.title = title;
      }
      if (draft.notes !== undefined) patch.notes = draft.notes?.trim() || null;
      if (draft.category !== undefined) patch.category = draft.category?.trim() || null;
      if (draft.priority !== undefined) patch.priority = draft.priority;
      if (draft.dueOn !== undefined) patch.due_on = draft.dueOn || null;
      if (draft.recurrence !== undefined) patch.recurrence = draft.recurrence;
      if (draft.assignedPersonId !== undefined) patch.assigned_person_id = draft.assignedPersonId || null;
      if (draft.isChecked !== undefined) patch.is_checked = draft.isChecked;
      const { error } = await supabase.from('stash_list_items').update(patch).eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('stash_list_items').delete().eq('id', id);
      throwIfError(error);
      await queryClient.invalidateQueries({ queryKey: itemsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const addProductToList = useCallback(
    async (productId: string, listId: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const product = products.find((item) => item.id === productId);
      const list = lists.find((item) => item.id === listId);
      if (!product || !list) throw new Error('List or item missing');
      const { error } = await supabase.from('stash_list_products').upsert({
        household_id: householdId,
        list_id: listId,
        product_id: productId,
        added_by: userId,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: membershipsKey(householdId) });
    },
    [householdId, lists, products, queryClient, userId],
  );

  const removeProductFromList = useCallback(
    async (productId: string, listId: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('stash_list_products').delete().eq('list_id', listId).eq('product_id', productId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: membershipsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const createProduct = useCallback(
    async (draft: ProductDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const title = draft.title.trim();
      if (!title) throw new Error('Give the item a name');
      const currentPrice = parseMoney(draft.currentPrice);
      const originalPrice = parseMoney(draft.originalPrice);
      const row: Database['public']['Tables']['stash_products']['Insert'] = {
        household_id: householdId,
        created_by: userId,
        title,
        source_url: draft.sourceUrl?.trim() ?? '',
        current_price: currentPrice,
        original_price: originalPrice,
        is_on_sale: isSale(currentPrice, originalPrice),
        image_url: draft.imageUrl?.trim() || null,
        store_name: draft.storeName?.trim() || null,
        description: draft.description?.trim() || null,
        sku: draft.sku?.trim() || null,
        notes: draft.notes?.trim() || null,
        is_owned: Boolean(draft.isOwned),
        price_source: draft.priceSource ?? (draft.sourceUrl?.trim() ? 'scraped' : 'manual'),
      };
      const { data, error } = await supabase.from('stash_products').insert(row).select('*').single();
      if (error) throw error;
      if (draft.listId && data) {
        const join = await supabase.from('stash_list_products').insert({
          household_id: householdId,
          list_id: draft.listId,
          product_id: data.id,
          added_by: userId,
        });
        if (join.error) throw join.error;
      }
      await refreshAll();
      return productFromRow(data);
    },
    [householdId, refreshAll, userId],
  );

  const updateProduct = useCallback(
    async (id: string, draft: Partial<ProductDraft> & { isOwned?: boolean }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const currentPrice = draft.currentPrice !== undefined ? parseMoney(draft.currentPrice) : undefined;
      const originalPrice = draft.originalPrice !== undefined ? parseMoney(draft.originalPrice) : undefined;
      const patch: Database['public']['Tables']['stash_products']['Update'] = {};
      if (draft.title !== undefined) {
        const title = draft.title.trim();
        if (!title) throw new Error('Give the item a name');
        patch.title = title;
      }
      if (draft.sourceUrl !== undefined) patch.source_url = draft.sourceUrl.trim();
      if (currentPrice !== undefined) patch.current_price = currentPrice;
      if (originalPrice !== undefined) patch.original_price = originalPrice;
      if (currentPrice !== undefined || originalPrice !== undefined) {
        const product = products.find((item) => item.id === id);
        patch.is_on_sale = isSale(currentPrice ?? product?.currentPrice ?? null, originalPrice ?? product?.originalPrice ?? null);
      }
      if (draft.imageUrl !== undefined) patch.image_url = draft.imageUrl.trim() || null;
      if (draft.storeName !== undefined) patch.store_name = draft.storeName.trim() || null;
      if (draft.description !== undefined) patch.description = draft.description.trim() || null;
      if (draft.sku !== undefined) patch.sku = draft.sku.trim() || null;
      if (draft.notes !== undefined) patch.notes = draft.notes.trim() || null;
      if (draft.isOwned !== undefined) patch.is_owned = draft.isOwned;
      if (draft.priceSource !== undefined) patch.price_source = draft.priceSource;
      const { error } = await supabase.from('stash_products').update(patch).eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: productsKey(householdId) });
    },
    [householdId, products, queryClient],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('stash_products').delete().eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: productsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: membershipsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const scrapeProduct = useCallback(async (url: string) => {
    const result = await scrapeStashProduct(url.trim());
    if (result.source === 'blocked') throw new Error('That site blocked the lookup. Fill the details in yourself.');
    return result.product;
  }, []);

  const refreshProductFromUrl = useCallback(
    async (id: string) => {
      const product = products.find((item) => item.id === id);
      if (!product?.sourceUrl) throw new Error('This item has no URL to refresh');
      const scraped = await scrapeProduct(product.sourceUrl);
      await updateProduct(id, {
        title: scraped.title || product.title,
        currentPrice: scraped.currentPrice != null ? String(scraped.currentPrice) : undefined,
        originalPrice: scraped.originalPrice != null ? String(scraped.originalPrice) : undefined,
        imageUrl: scraped.imageUrl ?? product.imageUrl ?? undefined,
        storeName: scraped.storeName ?? product.storeName ?? undefined,
        description: scraped.description ?? product.description ?? undefined,
        sku: scraped.sku ?? product.sku ?? undefined,
        priceSource: 'scraped',
      });
    },
    [products, scrapeProduct, updateProduct],
  );

  const createCollection = useCallback(
    async (name: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the collection a name');
      const { error } = await supabase.from('stash_link_collections').insert({
        household_id: householdId,
        created_by: userId,
        name: trimmed,
        position: collections.length,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: collectionsKey(householdId) });
    },
    [collections.length, householdId, queryClient, userId],
  );

  const renameCollection = useCallback(
    async (id: string, name: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the collection a name');
      const { error } = await supabase.from('stash_link_collections').update({ name: trimmed }).eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: collectionsKey(householdId) });
    },
    [householdId, queryClient],
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('stash_link_collections').delete().eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: collectionsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: collectionItemsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: linksKey(householdId) });
    },
    [householdId, queryClient],
  );

  const setLinkCollections = useCallback(
    async (linkId: string, collectionIds: string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error: delError } = await supabase.from('stash_link_collection_items').delete().eq('link_id', linkId);
      if (delError) throw delError;
      if (collectionIds.length > 0) {
        const { error } = await supabase.from('stash_link_collection_items').insert(
          collectionIds.map((collectionId) => ({
            household_id: householdId,
            collection_id: collectionId,
            link_id: linkId,
          })),
        );
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: collectionItemsKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: linksKey(householdId) });
    },
    [householdId, queryClient],
  );

  const createLink = useCallback(
    async (draft: LinkDraft) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const url = draft.url.trim();
      if (!url) throw new Error('Paste a URL');
      const canonical = canonicalizeUrl(url);
      const title = (draft.title?.trim() || canonical.replace(/^https?:\/\//, '')).slice(0, 200);
      const { data, error } = await supabase
        .from('stash_links')
        .insert({
          household_id: householdId,
          created_by: userId,
          url,
          canonical_url: canonical,
          title,
          description: draft.description?.trim() || null,
          image_url: draft.imageUrl?.trim() || null,
          site_name: draft.siteName?.trim() || null,
          favicon_url: draft.faviconUrl?.trim() || null,
          link_type: draft.linkType ?? inferLinkType(url),
          notes: draft.notes?.trim() || null,
        })
        .select('*')
        .single();
      if (error) {
        if (error.code === '23505') throw new Error('That link is already saved');
        throw error;
      }
      if (draft.collectionId) await setLinkCollections(data.id, [draft.collectionId]);
      await queryClient.invalidateQueries({ queryKey: linksKey(householdId) });
      return linkFromRow(data, draft.collectionId ? [draft.collectionId] : []);
    },
    [householdId, queryClient, setLinkCollections, userId],
  );

  const updateLink = useCallback(
    async (
      id: string,
      patch: {
        title?: string;
        notes?: string | null;
        status?: SavedLinkStatus;
        linkType?: SavedLinkType;
        collectionIds?: string[];
      },
    ) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const row: Database['public']['Tables']['stash_links']['Update'] = {};
      if (patch.title !== undefined) {
        const title = patch.title.trim();
        if (!title) throw new Error('Give the link a title');
        row.title = title;
      }
      if (patch.notes !== undefined) row.notes = patch.notes?.trim() || null;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.linkType !== undefined) row.link_type = patch.linkType;
      if (Object.keys(row).length > 0) {
        const { error } = await supabase.from('stash_links').update(row).eq('id', id);
        if (error) throw error;
      }
      if (patch.collectionIds) await setLinkCollections(id, patch.collectionIds);
      await queryClient.invalidateQueries({ queryKey: linksKey(householdId) });
    },
    [householdId, queryClient, setLinkCollections],
  );

  const deleteLink = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      const { error } = await supabase.from('stash_links').delete().eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: linksKey(householdId) });
    },
    [householdId, queryClient],
  );

  const scrapeLink = useCallback(async (url: string) => {
    const result = await scrapeStashLink(url.trim());
    if (result.source === 'blocked') throw new Error('That site blocked the lookup. Fill the details in yourself.');
    return result.link;
  }, []);

  const loading =
    productsQuery.isLoading ||
    listsQuery.isLoading ||
    listPeopleQuery.isLoading ||
    membershipsQuery.isLoading ||
    itemsQuery.isLoading ||
    collectionsQuery.isLoading ||
    linksQuery.isLoading;
  const error =
    productsQuery.error?.message ??
    listsQuery.error?.message ??
    membershipsQuery.error?.message ??
    itemsQuery.error?.message ??
    collectionsQuery.error?.message ??
    linksQuery.error?.message ??
    null;

  return {
    householdId,
    currency,
    online,
    loading,
    error,
    products,
    lists,
    memberships,
    items,
    collections,
    links,
    createList,
    renameList,
    deleteList,
    createItem,
    updateItem,
    deleteItem,
    createProduct,
    updateProduct,
    deleteProduct,
    addProductToList,
    removeProductFromList,
    scrapeProduct,
    refreshProductFromUrl,
    createCollection,
    renameCollection,
    deleteCollection,
    createLink,
    updateLink,
    deleteLink,
    scrapeLink,
  };
}
