import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  detailStatusForSave,
  isSale,
  isWatchlistMediaType,
  type WatchedScope,
  type WatchlistMediaType,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import { createWritePreview, commitWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import { lookupWatchlistTitle, searchWatchlistTitles } from '../../watchlist.js';
import {
  loadWatchlistItemOrThrow,
  loadWatchlistListOrThrow,
  loadWatchlistPeopleMap,
  loadWishlistListOrThrow,
  loadWishlistPeopleMap,
  loadWishlistProductOrThrow,
} from './reads.js';
import {
  TITLE_NOT_FOUND,
  WATCHLIST_ITEM_NOT_FOUND,
  WISHLIST_ITEM_NOT_FOUND,
  accessOpts,
  assertCanEditWishlist,
  assertCanManageWatchlist,
  parseWatchedScope,
  resolveCallerCountry,
  resolveCallerHousehold,
  resolveCallerPersonId,
  storeNameFromUrl,
  titleFieldsFromResolved,
  urlIsReachable,
} from './shared.js';

export type ListsWriteAction =
  | {
      action: 'add_to_watchlist';
      listId: string;
      tmdbId: number;
      mediaType: WatchlistMediaType;
      status: 'want' | 'watching' | 'watched';
      title: string;
    }
  | { action: 'remove_from_watchlist'; itemId: string; title: string; listId: string }
  | {
      action: 'mark_watched';
      tmdbId: number;
      mediaType: WatchlistMediaType;
      scope: WatchedScope;
      title: string;
      sourceItemId?: string | null;
      queueListId?: string | null;
    }
  | {
      action: 'unmark_watched';
      itemId: string;
      title: string;
      scope: WatchedScope;
    }
  | {
      action: 'add_wishlist_item';
      listId: string;
      title: string;
      sourceUrl: string;
      currentPrice: number | null;
      originalPrice: number | null;
      storeName: string | null;
      notes: string | null;
      imageUrl: string | null;
    }
  | {
      action: 'update_wishlist_item';
      itemId: string;
      title?: string;
      sourceUrl?: string;
      currentPrice?: number | null;
      originalPrice?: number | null;
      storeName?: string | null;
      notes?: string | null;
      isOwned?: boolean;
    }
  | { action: 'remove_wishlist_item'; itemId: string; title: string }
  | {
      action: 'wishlist_price_update';
      itemId: string;
      title: string;
      candidateSourceUrl: string;
      candidatePrice: number;
      candidateStoreName: string;
      candidateCurrency: 'AUD';
      currentPrice: number | null;
      currentSourceUrl: string;
    };

export type PreviewResult =
  | {
      kind: 'preview';
      previewId: string;
      expiresAt: string;
      tool: string;
      summary: string;
      steps: string[];
    }
  | {
      kind: 'dedupe';
      summary: string;
      candidates: { id: string; name: string; detail?: string }[];
      message: string;
    }
  | {
      kind: 'blocked';
      summary: string;
      message: string;
    }
  | {
      kind: 'noop';
      summary: string;
      message: string;
      itemId?: string;
    };

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: ListsWriteAction,
  summary: string,
  steps: string[],
): Promise<PreviewResult> {
  const { previewId, expiresAt } = await createWritePreview(caller.client, {
    userId: caller.userId,
    householdId,
    clientId: caller.clientId,
    tool,
    payload,
  });
  return { kind: 'preview', previewId, expiresAt, tool, summary, steps };
}

function hitLabel(hit: WatchlistSearchHit): string {
  const year = hit.year ? ` (${hit.year})` : '';
  return `${hit.title}${year} · ${hit.mediaType}`;
}

async function resolveTitleByIdOrName(
  client: SupabaseClient,
  householdId: string,
  input: { tmdbId?: number; mediaType?: string; name?: string },
): Promise<
  | { kind: 'resolved'; tmdbId: number; mediaType: WatchlistMediaType; title: string }
  | { kind: 'candidates'; hits: WatchlistSearchHit[] }
  | { kind: 'blocked'; message: string }
> {
  if (input.tmdbId != null) {
    if (!Number.isInteger(input.tmdbId) || input.tmdbId <= 0) {
      return { kind: 'blocked', message: 'A valid TMDB id is required' };
    }
    const mediaType = input.mediaType?.trim() ?? '';
    if (!isWatchlistMediaType(mediaType)) {
      return { kind: 'blocked', message: 'mediaType must be movie or tv when using tmdbId' };
    }
    const country = await resolveCallerCountry(client, householdId);
    try {
      const resolved = await lookupWatchlistTitle({
        tmdbId: input.tmdbId,
        mediaType,
        country,
      });
      return { kind: 'resolved', tmdbId: resolved.tmdbId, mediaType: resolved.mediaType, title: resolved.title };
    } catch {
      return { kind: 'blocked', message: TITLE_NOT_FOUND };
    }
  }

  const name = input.name?.trim() ?? '';
  if (!name) return { kind: 'blocked', message: 'Provide tmdbId + mediaType, or a title name to search' };
  const country = await resolveCallerCountry(client, householdId);
  const hits = await searchWatchlistTitles(name, country);
  if (hits.length === 0) return { kind: 'blocked', message: TITLE_NOT_FOUND };
  if (hits.length === 1) {
    const hit = hits[0]!;
    return { kind: 'resolved', tmdbId: hit.tmdbId, mediaType: hit.mediaType, title: hit.title };
  }
  const exact = hits.filter((hit) => hit.title.trim().toLowerCase() === name.toLowerCase());
  if (exact.length === 1) {
    const hit = exact[0]!;
    return { kind: 'resolved', tmdbId: hit.tmdbId, mediaType: hit.mediaType, title: hit.title };
  }
  return { kind: 'candidates', hits };
}

export async function previewAddToWatchlist(
  caller: McpCaller,
  input: {
    listId: string;
    tmdbId?: number;
    mediaType?: string;
    name?: string;
    status?: 'want' | 'watching' | 'watched';
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const peopleMap = await loadWatchlistPeopleMap(caller.client, householdId);
  const list = await loadWatchlistListOrThrow(caller.client, householdId, input.listId, peopleMap);
  assertCanManageWatchlist(list, opts);

  const resolved = await resolveTitleByIdOrName(caller.client, householdId, input);
  if (resolved.kind === 'blocked') {
    return { kind: 'blocked', summary: 'Could not add title', message: resolved.message };
  }
  if (resolved.kind === 'candidates') {
    return {
      kind: 'dedupe',
      summary: `Multiple matches for "${input.name?.trim()}"`,
      message: 'Pick a TMDB id and call again with tmdbId + mediaType. No write was made.',
      candidates: resolved.hits.map((hit) => ({
        id: `${hit.mediaType}:${hit.tmdbId}`,
        name: hitLabel(hit),
        detail: hit.overview?.slice(0, 120),
      })),
    };
  }

  const status = input.status ?? 'want';
  return savePreview(
    caller,
    householdId,
    'preview_add_to_watchlist',
    {
      action: 'add_to_watchlist',
      listId: list.id,
      tmdbId: resolved.tmdbId,
      mediaType: resolved.mediaType,
      status,
      title: resolved.title,
    },
    `Add "${resolved.title}" to ${list.name}`,
    [`Upsert TMDB ${resolved.mediaType}/${resolved.tmdbId}`, `Add to watchlist ${list.name} as ${status}`],
  );
}

export async function previewRemoveFromWatchlist(
  caller: McpCaller,
  input: { itemId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const item = await loadWatchlistItemOrThrow(caller.client, householdId, input.itemId);
  const peopleMap = await loadWatchlistPeopleMap(caller.client, householdId);
  const list = await loadWatchlistListOrThrow(caller.client, householdId, String(item.list_id), peopleMap);
  assertCanManageWatchlist(list, opts);

  const { data: title } = await caller.client
    .from('watchlist_titles')
    .select('title')
    .eq('id', String(item.title_id))
    .maybeSingle();
  const titleName = typeof title?.title === 'string' ? title.title : 'title';

  return savePreview(
    caller,
    householdId,
    'preview_remove_from_watchlist',
    {
      action: 'remove_from_watchlist',
      itemId: String(item.id),
      title: titleName,
      listId: list.id,
    },
    `Remove "${titleName}" from ${list.name}`,
    [`Delete watchlist item ${item.id}`],
  );
}

export async function previewMarkWatched(
  caller: McpCaller,
  input: {
    tmdbId?: number;
    mediaType?: string;
    name?: string;
    scope: string;
    sourceItemId?: string | null;
    queueListId?: string | null;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const scope = parseWatchedScope(input.scope);

  const resolved = await resolveTitleByIdOrName(caller.client, householdId, input);
  if (resolved.kind === 'blocked') {
    return { kind: 'blocked', summary: 'Could not mark watched', message: resolved.message };
  }
  if (resolved.kind === 'candidates') {
    return {
      kind: 'dedupe',
      summary: `Multiple matches for "${input.name?.trim()}"`,
      message: 'Pick a TMDB id and call again with tmdbId + mediaType. No write was made.',
      candidates: resolved.hits.map((hit) => ({
        id: `${hit.mediaType}:${hit.tmdbId}`,
        name: hitLabel(hit),
        detail: hit.overview?.slice(0, 120),
      })),
    };
  }

  // Ensure caller can manage the target watched list once it exists / is created.
  const peopleMap = await loadWatchlistPeopleMap(caller.client, householdId);
  const kind = scope === 'family' ? 'watched_family' : 'watched_private';
  const { data: existing } = await caller.client
    .from('watchlist_lists')
    .select('*')
    .eq('household_id', householdId)
    .eq('kind', kind)
    .maybeSingle();
  if (existing) {
    const list = await loadWatchlistListOrThrow(caller.client, householdId, String((existing as { id: string }).id), peopleMap);
    assertCanManageWatchlist(list, opts);
  } else if (opts.role === 'child') {
    return { kind: 'blocked', summary: 'Could not mark watched', message: WRITE_DENIED_MSG };
  }

  return savePreview(
    caller,
    householdId,
    'preview_mark_watched',
    {
      action: 'mark_watched',
      tmdbId: resolved.tmdbId,
      mediaType: resolved.mediaType,
      scope,
      title: resolved.title,
      sourceItemId: input.sourceItemId ?? null,
      queueListId: input.queueListId ?? null,
    },
    `Mark "${resolved.title}" watched (${scope})`,
    [`Place on ${scope} watched list`, 'Apply same who\'s-watching rules as the app'],
  );
}

const WRITE_DENIED_MSG = 'You cannot change this list';

export async function previewUnmarkWatched(
  caller: McpCaller,
  input: { itemId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const item = await loadWatchlistItemOrThrow(caller.client, householdId, input.itemId);
  const peopleMap = await loadWatchlistPeopleMap(caller.client, householdId);
  const list = await loadWatchlistListOrThrow(caller.client, householdId, String(item.list_id), peopleMap);
  assertCanManageWatchlist(list, opts);
  if (list.kind !== 'watched_family' && list.kind !== 'watched_private') {
    return {
      kind: 'blocked',
      summary: 'Not a watched item',
      message: 'unmark_watched only removes items from family/private watched lists',
    };
  }

  const { data: title } = await caller.client
    .from('watchlist_titles')
    .select('title')
    .eq('id', String(item.title_id))
    .maybeSingle();
  const titleName = typeof title?.title === 'string' ? title.title : 'title';
  const scope: WatchedScope = list.kind === 'watched_family' ? 'family' : 'private';

  return savePreview(
    caller,
    householdId,
    'preview_unmark_watched',
    {
      action: 'unmark_watched',
      itemId: String(item.id),
      title: titleName,
      scope,
    },
    `Remove "${titleName}" from ${scope} watched`,
    [`Delete watched item ${item.id}`],
  );
}

export async function previewAddWishlistItem(
  caller: McpCaller,
  input: {
    listId: string;
    title: string;
    sourceUrl?: string;
    currentPrice?: number | null;
    originalPrice?: number | null;
    storeName?: string | null;
    notes?: string | null;
    imageUrl?: string | null;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const peopleMap = await loadWishlistPeopleMap(caller.client, householdId);
  const list = await loadWishlistListOrThrow(caller.client, householdId, input.listId, peopleMap);
  assertCanEditWishlist(list, opts);

  const title = input.title.trim();
  if (!title) {
    return { kind: 'blocked', summary: 'Could not add item', message: 'Give the item a name' };
  }

  return savePreview(
    caller,
    householdId,
    'preview_add_wishlist_item',
    {
      action: 'add_wishlist_item',
      listId: list.id,
      title,
      sourceUrl: input.sourceUrl?.trim() ?? '',
      currentPrice: input.currentPrice ?? null,
      originalPrice: input.originalPrice ?? null,
      storeName: input.storeName?.trim() || null,
      notes: input.notes?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
    },
    `Add "${title}" to ${list.name}`,
    [`Create wishlist product`, `Link to list ${list.name}`],
  );
}

export async function previewUpdateWishlistItem(
  caller: McpCaller,
  input: {
    itemId: string;
    title?: string;
    sourceUrl?: string;
    currentPrice?: number | null;
    originalPrice?: number | null;
    storeName?: string | null;
    notes?: string | null;
    isOwned?: boolean;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const product = await loadWishlistProductOrThrow(caller.client, householdId, input.itemId);
  await assertCanEditAnyWishlistContaining(caller.client, householdId, String(product.id), opts);

  if (input.title !== undefined && !input.title.trim()) {
    return { kind: 'blocked', summary: 'Could not update item', message: 'Give the item a name' };
  }

  return savePreview(
    caller,
    householdId,
    'preview_update_wishlist_item',
    {
      action: 'update_wishlist_item',
      itemId: String(product.id),
      title: input.title?.trim(),
      sourceUrl: input.sourceUrl?.trim(),
      currentPrice: input.currentPrice,
      originalPrice: input.originalPrice,
      storeName: input.storeName === undefined ? undefined : input.storeName?.trim() || null,
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
      isOwned: input.isOwned,
    },
    `Update "${String(product.title)}"`,
    [`Patch wishlist item ${product.id}`],
  );
}

export async function previewRemoveWishlistItem(
  caller: McpCaller,
  input: { itemId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const product = await loadWishlistProductOrThrow(caller.client, householdId, input.itemId);
  await assertCanEditAnyWishlistContaining(caller.client, householdId, String(product.id), opts);

  return savePreview(
    caller,
    householdId,
    'preview_remove_wishlist_item',
    {
      action: 'remove_wishlist_item',
      itemId: String(product.id),
      title: String(product.title),
    },
    `Remove "${String(product.title)}"`,
    [`Delete wishlist product ${product.id}`],
  );
}

export type PriceUpdateFetch = typeof fetch;

export async function previewWishlistPriceUpdate(
  caller: McpCaller,
  input: { itemId: string; url: string; price: number; currency: string },
  fetchImpl: PriceUpdateFetch = fetch,
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const product = await loadWishlistProductOrThrow(caller.client, householdId, input.itemId);
  await assertCanEditAnyWishlistContaining(caller.client, householdId, String(product.id), opts);

  const currency = input.currency.trim().toUpperCase();
  if (currency !== 'AUD') {
    return {
      kind: 'blocked',
      summary: 'Currency not supported',
      message: 'Cheaper-find only accepts AUD in v1',
    };
  }

  const url = input.url.trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { kind: 'blocked', summary: 'Invalid URL', message: 'URL must be http(s)' };
    }
  } catch {
    return { kind: 'blocked', summary: 'Invalid URL', message: 'URL must be a full http(s) link' };
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { kind: 'blocked', summary: 'Invalid price', message: 'Price must be a positive number' };
  }

  const currentPrice =
    typeof product.current_price === 'number'
      ? product.current_price
      : product.current_price != null
        ? Number(product.current_price)
        : null;
  if (currentPrice == null || !Number.isFinite(currentPrice)) {
    return {
      kind: 'blocked',
      summary: 'No current price',
      message: 'Item has no current price to compare against',
    };
  }
  if (!(input.price < currentPrice)) {
    return {
      kind: 'blocked',
      summary: 'Not cheaper',
      message: `Price ${input.price} is not strictly lower than current ${currentPrice}`,
    };
  }

  const reachable = await urlIsReachable(url, fetchImpl);
  if (!reachable) {
    return {
      kind: 'blocked',
      summary: 'URL unreachable',
      message: 'Could not reach that URL (HEAD/GET timed out or failed)',
    };
  }

  const storeName = storeNameFromUrl(url);
  const title = String(product.title);
  const currentSourceUrl = String(product.source_url ?? '');

  return savePreview(
    caller,
    householdId,
    'preview_wishlist_price_update',
    {
      action: 'wishlist_price_update',
      itemId: String(product.id),
      title,
      candidateSourceUrl: url,
      candidatePrice: input.price,
      candidateStoreName: storeName,
      candidateCurrency: 'AUD',
      currentPrice,
      currentSourceUrl,
    },
    `Cheaper find for "${title}": ${currentPrice} → ${input.price} AUD at ${storeName}`,
    [
      `Keep original link/price (${currentSourceUrl || 'none'} @ ${currentPrice})`,
      `Store candidate offer ${url} @ ${input.price} AUD`,
    ],
  );
}

async function assertCanEditAnyWishlistContaining(
  client: SupabaseClient,
  householdId: string,
  productId: string,
  opts: ReturnType<typeof accessOpts>,
): Promise<void> {
  const peopleMap = await loadWishlistPeopleMap(client, householdId);
  const { data: joins, error } = await client
    .from('stash_list_products')
    .select('list_id')
    .eq('household_id', householdId)
    .eq('product_id', productId);
  if (error) throw new Error(error.message);
  if (!joins?.length) throw new Error(WISHLIST_ITEM_NOT_FOUND);
  let allowed = false;
  let seen = false;
  for (const row of joins) {
    const list = await loadWishlistListOrThrow(client, householdId, String((row as { list_id: string }).list_id), peopleMap);
    seen = true;
    try {
      assertCanEditWishlist(list, opts);
      allowed = true;
      break;
    } catch {
      // try next list
    }
  }
  if (!seen) throw new Error(WISHLIST_ITEM_NOT_FOUND);
  if (!allowed) throw new Error(WRITE_DENIED_MSG);
}

async function peekPreviewTool(
  client: SupabaseClient,
  userId: string,
  previewId: string,
): Promise<string> {
  const { data, error } = await client
    .from('mcp_previews')
    .select('tool')
    .eq('id', previewId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tool) throw new Error('Preview missing');
  return data.tool as string;
}

async function upsertWatchlistTitle(
  client: SupabaseClient,
  householdId: string,
  userId: string,
  tmdbId: number,
  mediaType: WatchlistMediaType,
): Promise<{ titleId: string; title: string }> {
  const country = await resolveCallerCountry(client, householdId);
  const resolved = await lookupWatchlistTitle({ tmdbId, mediaType, country });
  const fields = titleFieldsFromResolved(resolved);

  const { data: existing } = await client
    .from('watchlist_titles')
    .select('id')
    .eq('household_id', householdId)
    .eq('tmdb_id', tmdbId)
    .eq('media_type', mediaType)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client.from('watchlist_titles').update(fields).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return { titleId: String(existing.id), title: resolved.title };
  }

  const { data, error } = await client
    .from('watchlist_titles')
    .upsert(
      {
        household_id: householdId,
        created_by: userId,
        tmdb_id: tmdbId,
        media_type: mediaType,
        ...fields,
      },
      { onConflict: 'household_id,tmdb_id,media_type' },
    )
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error(TITLE_NOT_FOUND);
  return { titleId: String(data.id), title: resolved.title };
}

async function ensureWatchedLists(
  client: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<{ familyId: string; privateId: string }> {
  async function loadId(kind: 'watched_family' | 'watched_private'): Promise<string | null> {
    let query = client.from('watchlist_lists').select('id').eq('household_id', householdId).eq('kind', kind);
    if (kind === 'watched_private') query = query.eq('created_by', userId);
    const found = await query.maybeSingle();
    if (found.error) throw new Error(found.error.message);
    return found.data?.id ?? null;
  }

  async function ensure(
    kind: 'watched_family' | 'watched_private',
    name: string,
    visibility: 'household' | 'private',
  ): Promise<string> {
    const existing = await loadId(kind);
    if (existing) return existing;
    const id = randomUUID();
    const inserted = await client.from('watchlist_lists').insert({
      id,
      household_id: householdId,
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
  return { familyId, privateId };
}

async function executeWrite(
  caller: McpCaller,
  householdId: string,
  payload: ListsWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  const client = caller.client;
  const userId = caller.userId;

  switch (payload.action) {
    case 'add_to_watchlist': {
      const { titleId } = await upsertWatchlistTitle(
        client,
        householdId,
        userId,
        payload.tmdbId,
        payload.mediaType,
      );
      const { data: existing } = await client
        .from('watchlist_items')
        .select('id')
        .eq('household_id', householdId)
        .eq('list_id', payload.listId)
        .eq('title_id', titleId)
        .maybeSingle();
      if (existing?.id) {
        return { affectedIds: [String(existing.id)], result: { itemId: existing.id, titleId, already: true } };
      }
      const id = randomUUID();
      const { error } = await client.from('watchlist_items').insert({
        id,
        household_id: householdId,
        list_id: payload.listId,
        title_id: titleId,
        added_by: userId,
        status: payload.status,
      });
      if (error) throw new Error(error.message);
      return { affectedIds: [id], result: { itemId: id, titleId } };
    }
    case 'remove_from_watchlist':
    case 'unmark_watched': {
      const { data, error } = await client
        .from('watchlist_items')
        .delete()
        .eq('id', payload.itemId)
        .eq('household_id', householdId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(WATCHLIST_ITEM_NOT_FOUND);
      return { affectedIds: [payload.itemId], result: { deleted: payload.itemId } };
    }
    case 'mark_watched': {
      const { familyId, privateId } = await ensureWatchedLists(client, householdId, userId);
      const targetId = payload.scope === 'family' ? familyId : privateId;
      const otherId = payload.scope === 'family' ? privateId : familyId;
      const { titleId } = await upsertWatchlistTitle(
        client,
        householdId,
        userId,
        payload.tmdbId,
        payload.mediaType,
      );
      const { data: rows, error } = await client
        .from('watchlist_items')
        .select('id, list_id, status')
        .eq('household_id', householdId)
        .eq('title_id', titleId);
      if (error) throw new Error(error.message);
      const saved = rows ?? [];
      const target = saved.find((row) => row.list_id === targetId);
      if (!target) {
        const { error: insertError } = await client.from('watchlist_items').insert({
          id: randomUUID(),
          household_id: householdId,
          list_id: targetId,
          title_id: titleId,
          added_by: userId,
          status: 'watched',
        });
        if (insertError) throw new Error(insertError.message);
      } else if (target.status !== 'watched') {
        const { error: updateError } = await client
          .from('watchlist_items')
          .update({ status: 'watched' })
          .eq('id', target.id);
        if (updateError) throw new Error(updateError.message);
      }
      const other = saved.find((row) => row.list_id === otherId);
      if (other) {
        const { error: deleteError } = await client.from('watchlist_items').delete().eq('id', other.id);
        if (deleteError) throw new Error(deleteError.message);
      }
      if (payload.sourceItemId && payload.sourceItemId !== other?.id && payload.sourceItemId !== target?.id) {
        const { error: statusError } = await client
          .from('watchlist_items')
          .update({ status: 'watched' })
          .eq('id', payload.sourceItemId);
        if (statusError) throw new Error(statusError.message);
      }
      if (payload.queueListId && payload.queueListId !== targetId && payload.queueListId !== otherId) {
        const queued = saved.find((row) => row.list_id === payload.queueListId);
        if (!queued) {
          const { error: queueError } = await client.from('watchlist_items').insert({
            id: randomUUID(),
            household_id: householdId,
            list_id: payload.queueListId,
            title_id: titleId,
            added_by: userId,
            status: 'watched',
          });
          if (queueError) throw new Error(queueError.message);
        } else if (queued.status !== 'watched') {
          const { error: queueUpdate } = await client
            .from('watchlist_items')
            .update({ status: 'watched' })
            .eq('id', queued.id);
          if (queueUpdate) throw new Error(queueUpdate.message);
        }
      }
      return { affectedIds: [titleId, targetId], result: { titleId, listId: targetId, scope: payload.scope } };
    }
    case 'add_wishlist_item': {
      const detailStatus = detailStatusForSave(payload.sourceUrl, payload.currentPrice);
      const { data, error } = await client
        .from('stash_products')
        .insert({
          household_id: householdId,
          created_by: userId,
          title: payload.title,
          source_url: payload.sourceUrl,
          current_price: payload.currentPrice,
          original_price: payload.originalPrice,
          is_on_sale: isSale(payload.currentPrice, payload.originalPrice),
          image_url: payload.imageUrl,
          store_name: payload.storeName,
          notes: payload.notes,
          is_owned: false,
          price_source: payload.sourceUrl ? 'scraped' : 'manual',
          detail_status: detailStatus,
          detail_attempts: 0,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      const productId = String((data as { id: string }).id);
      const { error: joinError } = await client.from('stash_list_products').insert({
        household_id: householdId,
        list_id: payload.listId,
        product_id: productId,
        added_by: userId,
      });
      if (joinError) throw new Error(joinError.message);
      return { affectedIds: [productId], result: { itemId: productId, listId: payload.listId } };
    }
    case 'update_wishlist_item': {
      const existing = await loadWishlistProductOrThrow(client, householdId, payload.itemId);
      const patch: Record<string, unknown> = {};
      if (payload.title !== undefined) patch.title = payload.title;
      if (payload.sourceUrl !== undefined) patch.source_url = payload.sourceUrl;
      if (payload.currentPrice !== undefined) patch.current_price = payload.currentPrice;
      if (payload.originalPrice !== undefined) patch.original_price = payload.originalPrice;
      if (payload.storeName !== undefined) patch.store_name = payload.storeName;
      if (payload.notes !== undefined) patch.notes = payload.notes;
      if (payload.isOwned !== undefined) patch.is_owned = payload.isOwned;
      if (payload.currentPrice !== undefined || payload.originalPrice !== undefined) {
        const current =
          payload.currentPrice !== undefined ? payload.currentPrice : asNum(existing.current_price);
        const original =
          payload.originalPrice !== undefined ? payload.originalPrice : asNum(existing.original_price);
        patch.is_on_sale = isSale(current, original);
      }
      if (payload.currentPrice !== undefined || payload.sourceUrl !== undefined) {
        const sourceUrl =
          payload.sourceUrl !== undefined ? payload.sourceUrl : String(existing.source_url ?? '');
        const current =
          payload.currentPrice !== undefined ? payload.currentPrice : asNum(existing.current_price);
        const nextStatus = detailStatusForSave(sourceUrl, current);
        patch.detail_status = nextStatus;
        if (nextStatus === 'ready') patch.detail_attempts = 0;
      }
      const { error } = await client.from('stash_products').update(patch).eq('id', payload.itemId);
      if (error) throw new Error(error.message);
      return { affectedIds: [payload.itemId], result: { itemId: payload.itemId } };
    }
    case 'remove_wishlist_item': {
      const { data, error } = await client
        .from('stash_products')
        .delete()
        .eq('id', payload.itemId)
        .eq('household_id', householdId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(WISHLIST_ITEM_NOT_FOUND);
      return { affectedIds: [payload.itemId], result: { deleted: payload.itemId } };
    }
    case 'wishlist_price_update': {
      const existing = await loadWishlistProductOrThrow(client, householdId, payload.itemId);
      // Candidate only — never overwrite the live link/price.
      const { error } = await client
        .from('stash_products')
        .update({
          candidate_source_url: payload.candidateSourceUrl,
          candidate_price: payload.candidatePrice,
          candidate_store_name: payload.candidateStoreName,
          candidate_currency: payload.candidateCurrency,
        })
        .eq('id', payload.itemId)
        .eq('household_id', householdId);
      if (error) throw new Error(error.message);
      return {
        affectedIds: [payload.itemId],
        result: {
          itemId: payload.itemId,
          candidateSourceUrl: payload.candidateSourceUrl,
          candidatePrice: payload.candidatePrice,
          originalSourceUrl: String(existing.source_url ?? ''),
          originalPrice: asNum(existing.current_price),
        },
      };
    }
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown lists action ${(_exhaustive as { action: string }).action}`);
    }
  }
}

function asNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function commitListsPreview(
  caller: McpCaller,
  input: { previewId: string },
): Promise<{
  ok: true;
  tool: string;
  affectedIds: string[];
  result: Record<string, unknown>;
}> {
  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  if (!input.previewId) throw new Error('previewId is required');

  const tool = await peekPreviewTool(caller.client, caller.userId, input.previewId);
  const committed = await commitWritePreview(caller.client, {
    userId: caller.userId,
    previewId: input.previewId,
    tool,
  });
  if (!committed.ok) throw new Error(`Preview ${committed.reason}`);

  const payload = committed.preview.payload as ListsWriteAction;
  const executed = await executeWrite(caller, householdId, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

export const LISTS_PREVIEW_TOOLS = [
  'preview_add_to_watchlist',
  'preview_remove_from_watchlist',
  'preview_mark_watched',
  'preview_unmark_watched',
  'preview_add_wishlist_item',
  'preview_update_wishlist_item',
  'preview_remove_wishlist_item',
  'preview_wishlist_price_update',
] as const;
