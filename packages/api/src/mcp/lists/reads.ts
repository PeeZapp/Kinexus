import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isWatchlistMediaType,
  listsOfKind,
  type StashList,
  type WatchlistItemStatus,
  type WatchlistList,
  type WatchlistMediaType,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import { searchWatchlistTitles } from '../../watchlist.js';
import {
  WATCHLIST_ITEM_NOT_FOUND,
  WATCHLIST_NOT_FOUND,
  WISHLIST_ITEM_NOT_FOUND,
  WISHLIST_NOT_FOUND,
  accessOpts,
  assertCanViewWatchlist,
  assertCanViewWishlist,
  resolveCallerCountry,
  resolveCallerHousehold,
  resolveCallerPersonId,
} from './shared.js';

export type WatchlistListSummary = {
  id: string;
  name: string;
  kind: string;
  visibility: string;
  itemCount: number;
  createdBy: string | null;
};

export type WatchlistItemSummary = {
  id: string;
  listId: string;
  titleId: string;
  status: WatchlistItemStatus;
  notes: string | null;
  tmdbId: number;
  mediaType: WatchlistMediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
};

export type WatchlistDetail = WatchlistListSummary & {
  items: WatchlistItemSummary[];
};

export type WishlistListSummary = {
  id: string;
  name: string;
  visibility: string;
  emoji: string | null;
  itemCount: number;
  createdBy: string | null;
  parentListId: string | null;
};

export type WishlistItemSummary = {
  id: string;
  listIds: string[];
  title: string;
  currentPrice: number | null;
  originalPrice: number | null;
  sourceUrl: string;
  storeName: string | null;
  notes: string | null;
  isOwned: boolean;
  candidateSourceUrl: string | null;
  candidatePrice: number | null;
  candidateStoreName: string | null;
  candidateCurrency: string | null;
  previousSourceUrl: string | null;
  previousPrice: number | null;
  previousStoreName: string | null;
};

export type WishlistDetail = WishlistListSummary & {
  items: WishlistItemSummary[];
};

function asNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapWatchlistList(row: Record<string, unknown>, personIds: string[], itemCount: number): WatchlistListSummary {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    kind: String(row.kind ?? 'custom'),
    visibility: String(row.visibility ?? 'household'),
    itemCount,
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
  };
}

function toWatchlistList(row: Record<string, unknown>, personIds: string[]): WatchlistList {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    name: String(row.name ?? ''),
    visibility: (row.visibility as WatchlistList['visibility']) ?? 'household',
    kind: (row.kind as WatchlistList['kind']) ?? 'custom',
    audience: (row.audience as WatchlistList['audience']) ?? 'all',
    blurb: typeof row.blurb === 'string' ? row.blurb : null,
    samplePosterPaths: Array.isArray(row.sample_poster_paths)
      ? (row.sample_poster_paths as string[])
      : [],
    personIds,
    shareToken: typeof row.share_token === 'string' ? row.share_token : null,
    isShared: Boolean(row.is_shared),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function toStashList(row: Record<string, unknown>, personIds: string[]): StashList {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    name: String(row.name ?? ''),
    kind: row.kind === 'checklist' ? 'checklist' : 'wishlist',
    visibility: (row.visibility as StashList['visibility']) ?? 'household',
    personIds,
    parentListId: typeof row.parent_list_id === 'string' ? row.parent_list_id : null,
    shareToken: typeof row.share_token === 'string' ? row.share_token : null,
    isShared: Boolean(row.is_shared),
    emoji: typeof row.emoji === 'string' ? row.emoji : null,
    theme: typeof row.theme === 'string' ? row.theme : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

async function loadWatchlistPeopleMap(
  client: SupabaseClient,
  householdId: string,
): Promise<Map<string, string[]>> {
  const { data, error } = await client
    .from('watchlist_list_people')
    .select('list_id, person_id')
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const listId = String((row as { list_id: string }).list_id);
    const personId = String((row as { person_id: string }).person_id);
    const existing = map.get(listId) ?? [];
    existing.push(personId);
    map.set(listId, existing);
  }
  return map;
}

async function loadWishlistPeopleMap(
  client: SupabaseClient,
  householdId: string,
): Promise<Map<string, string[]>> {
  const { data, error } = await client
    .from('stash_list_people')
    .select('list_id, person_id')
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const listId = String((row as { list_id: string }).list_id);
    const personId = String((row as { person_id: string }).person_id);
    const existing = map.get(listId) ?? [];
    existing.push(personId);
    map.set(listId, existing);
  }
  return map;
}

export async function listWatchlists(
  client: SupabaseClient,
  userId: string,
): Promise<{ householdId: string; watchlists: WatchlistListSummary[] }> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  const personId = await resolveCallerPersonId(client, householdId, userId);
  const opts = accessOpts(role, userId, personId);
  const peopleMap = await loadWatchlistPeopleMap(client, householdId);

  const { data, error } = await client
    .from('watchlist_lists')
    .select('*')
    .eq('household_id', householdId)
    .order('name');
  if (error) throw new Error(error.message);

  const { data: items, error: itemsError } = await client
    .from('watchlist_items')
    .select('list_id')
    .eq('household_id', householdId);
  if (itemsError) throw new Error(itemsError.message);
  const counts = new Map<string, number>();
  for (const row of items ?? []) {
    const listId = String((row as { list_id: string }).list_id);
    counts.set(listId, (counts.get(listId) ?? 0) + 1);
  }

  const watchlists: WatchlistListSummary[] = [];
  for (const row of data ?? []) {
    const rec = row as Record<string, unknown>;
    const list = toWatchlistList(rec, peopleMap.get(String(rec.id)) ?? []);
    if (!canViewFiltered(list, opts)) continue;
    watchlists.push(mapWatchlistList(rec, list.personIds, counts.get(list.id) ?? 0));
  }
  return { householdId, watchlists };
}

function canViewFiltered(list: WatchlistList, opts: ReturnType<typeof accessOpts>): boolean {
  try {
    assertCanViewWatchlist(list, opts);
    return true;
  } catch {
    return false;
  }
}

export async function getWatchlist(
  client: SupabaseClient,
  userId: string,
  listId: string,
): Promise<{ householdId: string; watchlist: WatchlistDetail }> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  const personId = await resolveCallerPersonId(client, householdId, userId);
  const opts = accessOpts(role, userId, personId);
  const peopleMap = await loadWatchlistPeopleMap(client, householdId);

  const { data, error } = await client.from('watchlist_lists').select('*').eq('id', listId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(WATCHLIST_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(WATCHLIST_NOT_FOUND);
  const list = toWatchlistList(rec, peopleMap.get(listId) ?? []);
  assertCanViewWatchlist(list, opts);

  const { data: itemRows, error: itemsError } = await client
    .from('watchlist_items')
    .select('*')
    .eq('household_id', householdId)
    .eq('list_id', listId)
    .order('added_at', { ascending: false });
  if (itemsError) throw new Error(itemsError.message);

  const titleIds = [...new Set((itemRows ?? []).map((row) => String((row as { title_id: string }).title_id)))];
  const titlesById = new Map<string, Record<string, unknown>>();
  if (titleIds.length > 0) {
    const { data: titles, error: titlesError } = await client
      .from('watchlist_titles')
      .select('*')
      .eq('household_id', householdId)
      .in('id', titleIds);
    if (titlesError) throw new Error(titlesError.message);
    for (const title of titles ?? []) {
      const t = title as Record<string, unknown>;
      titlesById.set(String(t.id), t);
    }
  }

  const items: WatchlistItemSummary[] = [];
  for (const row of itemRows ?? []) {
    const item = row as Record<string, unknown>;
    const title = titlesById.get(String(item.title_id));
    if (!title) continue;
    const mediaType = String(title.media_type);
    if (!isWatchlistMediaType(mediaType)) continue;
    items.push({
      id: String(item.id),
      listId: String(item.list_id),
      titleId: String(item.title_id),
      status: (item.status as WatchlistItemStatus) ?? 'want',
      notes: typeof item.notes === 'string' ? item.notes : null,
      tmdbId: Number(title.tmdb_id),
      mediaType,
      title: String(title.title ?? ''),
      year: typeof title.year === 'number' ? title.year : null,
      posterPath: typeof title.poster_path === 'string' ? title.poster_path : null,
    });
  }

  return {
    householdId,
    watchlist: {
      ...mapWatchlistList(rec, list.personIds, items.length),
      items,
    },
  };
}

export async function searchTitles(
  client: SupabaseClient,
  userId: string,
  opts: { query: string; limit?: number },
): Promise<{ householdId: string; results: WatchlistSearchHit[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const country = await resolveCallerCountry(client, householdId);
  const results = await searchWatchlistTitles(opts.query, country);
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 20);
  return { householdId, results: results.slice(0, limit) };
}

export async function listWishlists(
  client: SupabaseClient,
  userId: string,
): Promise<{ householdId: string; wishlists: WishlistListSummary[] }> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  const personId = await resolveCallerPersonId(client, householdId, userId);
  const opts = accessOpts(role, userId, personId);
  const peopleMap = await loadWishlistPeopleMap(client, householdId);

  const { data, error } = await client
    .from('stash_lists')
    .select('*')
    .eq('household_id', householdId)
    .order('name');
  if (error) throw new Error(error.message);

  const lists = (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    return toStashList(rec, peopleMap.get(String(rec.id)) ?? []);
  });
  const wishlistsOnly = listsOfKind(lists, 'wishlist').filter((list) => {
    try {
      assertCanViewWishlist(list, opts);
      return true;
    } catch {
      return false;
    }
  });

  const { data: joins, error: joinError } = await client
    .from('stash_list_products')
    .select('list_id')
    .eq('household_id', householdId);
  if (joinError) throw new Error(joinError.message);
  const counts = new Map<string, number>();
  for (const row of joins ?? []) {
    const listId = String((row as { list_id: string }).list_id);
    counts.set(listId, (counts.get(listId) ?? 0) + 1);
  }

  return {
    householdId,
    wishlists: wishlistsOnly.map((list) => ({
      id: list.id,
      name: list.name,
      visibility: list.visibility,
      emoji: list.emoji,
      itemCount: counts.get(list.id) ?? 0,
      createdBy: list.createdBy,
      parentListId: list.parentListId,
    })),
  };
}

export async function getWishlist(
  client: SupabaseClient,
  userId: string,
  listId: string,
): Promise<{ householdId: string; wishlist: WishlistDetail }> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  const personId = await resolveCallerPersonId(client, householdId, userId);
  const opts = accessOpts(role, userId, personId);
  const peopleMap = await loadWishlistPeopleMap(client, householdId);

  const { data, error } = await client.from('stash_lists').select('*').eq('id', listId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(WISHLIST_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(WISHLIST_NOT_FOUND);
  const list = toStashList(rec, peopleMap.get(listId) ?? []);
  if (list.kind !== 'wishlist') throw new Error(WISHLIST_NOT_FOUND);
  assertCanViewWishlist(list, opts);

  const { data: joins, error: joinError } = await client
    .from('stash_list_products')
    .select('product_id')
    .eq('household_id', householdId)
    .eq('list_id', listId);
  if (joinError) throw new Error(joinError.message);
  const productIds = (joins ?? []).map((row) => String((row as { product_id: string }).product_id));

  const items: WishlistItemSummary[] = [];
  if (productIds.length > 0) {
    const { data: products, error: productsError } = await client
      .from('stash_products')
      .select('*')
      .eq('household_id', householdId)
      .in('id', productIds)
      .order('created_at', { ascending: false });
    if (productsError) throw new Error(productsError.message);

    const { data: allJoins, error: allJoinError } = await client
      .from('stash_list_products')
      .select('list_id, product_id')
      .eq('household_id', householdId)
      .in('product_id', productIds);
    if (allJoinError) throw new Error(allJoinError.message);
    const listIdsByProduct = new Map<string, string[]>();
    for (const row of allJoins ?? []) {
      const productId = String((row as { product_id: string }).product_id);
      const lid = String((row as { list_id: string }).list_id);
      const existing = listIdsByProduct.get(productId) ?? [];
      existing.push(lid);
      listIdsByProduct.set(productId, existing);
    }

    for (const row of products ?? []) {
      const product = row as Record<string, unknown>;
      items.push(mapWishlistItem(product, listIdsByProduct.get(String(product.id)) ?? [listId]));
    }
  }

  return {
    householdId,
    wishlist: {
      id: list.id,
      name: list.name,
      visibility: list.visibility,
      emoji: list.emoji,
      itemCount: items.length,
      createdBy: list.createdBy,
      parentListId: list.parentListId,
      items,
    },
  };
}

export function mapWishlistItem(product: Record<string, unknown>, listIds: string[]): WishlistItemSummary {
  return {
    id: String(product.id),
    listIds,
    title: String(product.title ?? ''),
    currentPrice: asNum(product.current_price),
    originalPrice: asNum(product.original_price),
    sourceUrl: String(product.source_url ?? ''),
    storeName: typeof product.store_name === 'string' ? product.store_name : null,
    notes: typeof product.notes === 'string' ? product.notes : null,
    isOwned: Boolean(product.is_owned),
    candidateSourceUrl: typeof product.candidate_source_url === 'string' ? product.candidate_source_url : null,
    candidatePrice: asNum(product.candidate_price),
    candidateStoreName: typeof product.candidate_store_name === 'string' ? product.candidate_store_name : null,
    candidateCurrency: typeof product.candidate_currency === 'string' ? product.candidate_currency : null,
    previousSourceUrl: typeof product.previous_source_url === 'string' ? product.previous_source_url : null,
    previousPrice: asNum(product.previous_price),
    previousStoreName: typeof product.previous_store_name === 'string' ? product.previous_store_name : null,
  };
}

export async function loadWatchlistListOrThrow(
  client: SupabaseClient,
  householdId: string,
  listId: string,
  peopleMap: Map<string, string[]>,
): Promise<WatchlistList> {
  const { data, error } = await client.from('watchlist_lists').select('*').eq('id', listId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(WATCHLIST_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(WATCHLIST_NOT_FOUND);
  return toWatchlistList(rec, peopleMap.get(listId) ?? []);
}

export async function loadWishlistListOrThrow(
  client: SupabaseClient,
  householdId: string,
  listId: string,
  peopleMap: Map<string, string[]>,
): Promise<StashList> {
  const { data, error } = await client.from('stash_lists').select('*').eq('id', listId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(WISHLIST_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(WISHLIST_NOT_FOUND);
  const list = toStashList(rec, peopleMap.get(listId) ?? []);
  if (list.kind !== 'wishlist') throw new Error(WISHLIST_NOT_FOUND);
  return list;
}

export async function loadWishlistProductOrThrow(
  client: SupabaseClient,
  householdId: string,
  itemId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client.from('stash_products').select('*').eq('id', itemId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(WISHLIST_ITEM_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(WISHLIST_ITEM_NOT_FOUND);
  return rec;
}

export async function loadWatchlistItemOrThrow(
  client: SupabaseClient,
  householdId: string,
  itemId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client.from('watchlist_items').select('*').eq('id', itemId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(WATCHLIST_ITEM_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(WATCHLIST_ITEM_NOT_FOUND);
  return rec;
}

export { loadWatchlistPeopleMap, loadWishlistPeopleMap, toWatchlistList, toStashList };
