import { z } from 'zod';

import type { McpToolDefinition } from '../registry.js';
import type { McpCaller } from '../context.js';
import { getWatchlist, getWishlist, listWatchlists, listWishlists, searchTitles } from './reads.js';
import { resolveCallerHousehold, withListsAudit } from './shared.js';
import {
  previewAddToWatchlist,
  previewAddWishlistItem,
  previewMarkWatched,
  previewRemoveFromWatchlist,
  previewRemoveWishlistItem,
  previewUnmarkWatched,
  previewUpdateWishlistItem,
  previewWishlistPriceUpdate,
  type PreviewResult,
} from './writes.js';

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
} as const;

const openWorldWriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
} as const;

const previewResultSchema = z.object({
  kind: z.enum(['preview', 'dedupe', 'blocked', 'noop']),
  previewId: z.string().optional(),
  expiresAt: z.string().optional(),
  tool: z.string().optional(),
  summary: z.string(),
  steps: z.array(z.string()).optional(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
  message: z.string().optional(),
  itemId: z.string().optional(),
});

const watchlistListOut = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  visibility: z.string(),
  itemCount: z.number(),
  createdBy: z.string().nullable(),
});

const watchlistItemOut = z.object({
  id: z.string(),
  listId: z.string(),
  titleId: z.string(),
  status: z.enum(['want', 'watching', 'watched']),
  notes: z.string().nullable(),
  tmdbId: z.number(),
  mediaType: z.enum(['movie', 'tv']),
  title: z.string(),
  year: z.number().nullable(),
  posterPath: z.string().nullable(),
});

const wishlistListOut = z.object({
  id: z.string(),
  name: z.string(),
  visibility: z.string(),
  emoji: z.string().nullable(),
  itemCount: z.number(),
  createdBy: z.string().nullable(),
  parentListId: z.string().nullable(),
});

const wishlistItemOut = z.object({
  id: z.string(),
  listIds: z.array(z.string()),
  title: z.string(),
  currentPrice: z.number().nullable(),
  originalPrice: z.number().nullable(),
  sourceUrl: z.string(),
  storeName: z.string().nullable(),
  notes: z.string().nullable(),
  isOwned: z.boolean(),
  candidateSourceUrl: z.string().nullable(),
  candidatePrice: z.number().nullable(),
  candidateStoreName: z.string().nullable(),
  candidateCurrency: z.string().nullable(),
  previousSourceUrl: z.string().nullable(),
  previousPrice: z.number().nullable(),
  previousStoreName: z.string().nullable(),
});

const searchHitOut = z.object({
  tmdbId: z.number(),
  mediaType: z.enum(['movie', 'tv']),
  title: z.string(),
  year: z.number().nullable(),
  overview: z.string().nullable(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  imdbId: z.string().nullable(),
  director: z.string().optional(),
});

async function householdIdOrNull(caller: McpCaller): Promise<string | null> {
  try {
    return (await resolveCallerHousehold(caller.client, caller.userId)).householdId;
  } catch {
    return null;
  }
}

function asPreviewResult(value: PreviewResult): z.infer<typeof previewResultSchema> {
  return value;
}

async function auditedPreview(
  caller: McpCaller,
  tool: string,
  run: () => Promise<PreviewResult>,
): Promise<z.infer<typeof previewResultSchema>> {
  const householdId = await householdIdOrNull(caller);
  return withListsAudit(caller, { tool, mode: 'write', householdId }, async () =>
    asPreviewResult(await run()),
  );
}

const listWatchlistsInput = z.object({});
const listWatchlistsOutput = z.object({
  householdId: z.string(),
  watchlists: z.array(watchlistListOut),
});

export const listWatchlistsTool: McpToolDefinition<typeof listWatchlistsInput, typeof listWatchlistsOutput> = {
  name: 'list_watchlists',
  title: 'List watchlists',
  description: 'List watchlists visible to the caller in their household (includes watched lists).',
  inputSchema: listWatchlistsInput,
  outputSchema: listWatchlistsOutput,
  scope: 'watchlists:read',
  annotations: readAnnotations,
  handler: async (_args, caller) =>
    withListsAudit(caller, { tool: 'list_watchlists', mode: 'read' }, () =>
      listWatchlists(caller.client, caller.userId),
    ),
};

const getWatchlistInput = z.object({ listId: z.string() });
const getWatchlistOutput = z.object({
  householdId: z.string(),
  watchlist: watchlistListOut.extend({ items: z.array(watchlistItemOut) }),
});

export const getWatchlistTool: McpToolDefinition<typeof getWatchlistInput, typeof getWatchlistOutput> = {
  name: 'get_watchlist',
  title: 'Get watchlist',
  description: 'Get one watchlist with titles (TMDB ids). Not found if missing or not visible.',
  inputSchema: getWatchlistInput,
  outputSchema: getWatchlistOutput,
  scope: 'watchlists:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withListsAudit(caller, { tool: 'get_watchlist', mode: 'read' }, () =>
      getWatchlist(caller.client, caller.userId, args.listId),
    ),
};

const searchTitlesInput = z.object({
  query: z.string(),
  limit: z.number().int().positive().max(20).optional(),
});
const searchTitlesOutput = z.object({
  householdId: z.string(),
  results: z.array(searchHitOut),
});

export const searchTitlesTool: McpToolDefinition<typeof searchTitlesInput, typeof searchTitlesOutput> = {
  name: 'search_titles',
  title: 'Search titles',
  description:
    'Search TMDB for movies/TV and return real TMDB ids. Never invent titles — always resolve via this or tmdbId.',
  inputSchema: searchTitlesInput,
  outputSchema: searchTitlesOutput,
  scope: 'watchlists:read',
  annotations: { ...readAnnotations, openWorldHint: true },
  handler: async (args, caller) =>
    withListsAudit(caller, { tool: 'search_titles', mode: 'read' }, () =>
      searchTitles(caller.client, caller.userId, args),
    ),
};

const addToWatchlistInput = z.object({
  listId: z.string(),
  tmdbId: z.number().int().positive().optional(),
  mediaType: z.enum(['movie', 'tv']).optional(),
  name: z.string().optional(),
  status: z.enum(['want', 'watching', 'watched']).optional(),
});

export const previewAddToWatchlistTool: McpToolDefinition<typeof addToWatchlistInput, typeof previewResultSchema> = {
  name: 'preview_add_to_watchlist',
  title: 'Preview add to watchlist',
  description:
    'Preview adding a title by TMDB id. If only a name is given and it is ambiguous, returns candidates and does not write.',
  inputSchema: addToWatchlistInput,
  outputSchema: previewResultSchema,
  scope: 'watchlists:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_add_to_watchlist', () => previewAddToWatchlist(caller, args)),
};

const removeFromWatchlistInput = z.object({ itemId: z.string() });

export const previewRemoveFromWatchlistTool: McpToolDefinition<
  typeof removeFromWatchlistInput,
  typeof previewResultSchema
> = {
  name: 'preview_remove_from_watchlist',
  title: 'Preview remove from watchlist',
  description: 'Preview removing a watchlist item by item id.',
  inputSchema: removeFromWatchlistInput,
  outputSchema: previewResultSchema,
  scope: 'watchlists:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_remove_from_watchlist', () => previewRemoveFromWatchlist(caller, args)),
};

const markWatchedInput = z.object({
  tmdbId: z.number().int().positive().optional(),
  mediaType: z.enum(['movie', 'tv']).optional(),
  name: z.string().optional(),
  scope: z.enum(['family', 'private']),
  sourceItemId: z.string().nullable().optional(),
  queueListId: z.string().nullable().optional(),
});

export const previewMarkWatchedTool: McpToolDefinition<typeof markWatchedInput, typeof previewResultSchema> = {
  name: 'preview_mark_watched',
  title: 'Preview mark watched',
  description:
    'Preview marking a title watched on family or private (same who\'s-watching rules as the app). Ambiguous names return candidates only.',
  inputSchema: markWatchedInput,
  outputSchema: previewResultSchema,
  scope: 'watchlists:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_mark_watched', () => previewMarkWatched(caller, args)),
};

const unmarkWatchedInput = z.object({ itemId: z.string() });

export const previewUnmarkWatchedTool: McpToolDefinition<typeof unmarkWatchedInput, typeof previewResultSchema> = {
  name: 'preview_unmark_watched',
  title: 'Preview unmark watched',
  description: 'Preview removing a title from the family or private watched list.',
  inputSchema: unmarkWatchedInput,
  outputSchema: previewResultSchema,
  scope: 'watchlists:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_unmark_watched', () => previewUnmarkWatched(caller, args)),
};

const listWishlistsInput = z.object({});
const listWishlistsOutput = z.object({
  householdId: z.string(),
  wishlists: z.array(wishlistListOut),
});

export const listWishlistsTool: McpToolDefinition<typeof listWishlistsInput, typeof listWishlistsOutput> = {
  name: 'list_wishlists',
  title: 'List wishlists',
  description: 'List wishlists visible to the caller in their household.',
  inputSchema: listWishlistsInput,
  outputSchema: listWishlistsOutput,
  scope: 'wishlists:read',
  annotations: readAnnotations,
  handler: async (_args, caller) =>
    withListsAudit(caller, { tool: 'list_wishlists', mode: 'read' }, () =>
      listWishlists(caller.client, caller.userId),
    ),
};

const getWishlistInput = z.object({ listId: z.string() });
const getWishlistOutput = z.object({
  householdId: z.string(),
  wishlist: wishlistListOut.extend({ items: z.array(wishlistItemOut) }),
});

export const getWishlistTool: McpToolDefinition<typeof getWishlistInput, typeof getWishlistOutput> = {
  name: 'get_wishlist',
  title: 'Get wishlist',
  description: 'Get one wishlist with products. Not found if missing or not visible.',
  inputSchema: getWishlistInput,
  outputSchema: getWishlistOutput,
  scope: 'wishlists:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withListsAudit(caller, { tool: 'get_wishlist', mode: 'read' }, () =>
      getWishlist(caller.client, caller.userId, args.listId),
    ),
};

const addWishlistItemInput = z.object({
  listId: z.string(),
  title: z.string(),
  sourceUrl: z.string().optional(),
  currentPrice: z.number().nullable().optional(),
  originalPrice: z.number().nullable().optional(),
  storeName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const previewAddWishlistItemTool: McpToolDefinition<typeof addWishlistItemInput, typeof previewResultSchema> = {
  name: 'preview_add_wishlist_item',
  title: 'Preview add wishlist item',
  description: 'Preview adding a product to a wishlist.',
  inputSchema: addWishlistItemInput,
  outputSchema: previewResultSchema,
  scope: 'wishlists:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_add_wishlist_item', () => previewAddWishlistItem(caller, args)),
};

const updateWishlistItemInput = z.object({
  itemId: z.string(),
  title: z.string().optional(),
  sourceUrl: z.string().optional(),
  currentPrice: z.number().nullable().optional(),
  originalPrice: z.number().nullable().optional(),
  storeName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isOwned: z.boolean().optional(),
});

export const previewUpdateWishlistItemTool: McpToolDefinition<
  typeof updateWishlistItemInput,
  typeof previewResultSchema
> = {
  name: 'preview_update_wishlist_item',
  title: 'Preview update wishlist item',
  description: 'Preview updating a wishlist product (title, price, link, notes, owned).',
  inputSchema: updateWishlistItemInput,
  outputSchema: previewResultSchema,
  scope: 'wishlists:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_update_wishlist_item', () => previewUpdateWishlistItem(caller, args)),
};

const removeWishlistItemInput = z.object({ itemId: z.string() });

export const previewRemoveWishlistItemTool: McpToolDefinition<
  typeof removeWishlistItemInput,
  typeof previewResultSchema
> = {
  name: 'preview_remove_wishlist_item',
  title: 'Preview remove wishlist item',
  description: 'Preview deleting a wishlist product.',
  inputSchema: removeWishlistItemInput,
  outputSchema: previewResultSchema,
  scope: 'wishlists:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_remove_wishlist_item', () => previewRemoveWishlistItem(caller, args)),
};

const priceUpdateInput = z.object({
  itemId: z.string(),
  url: z.string(),
  price: z.number(),
  currency: z.string(),
});

export const previewWishlistPriceUpdateTool: McpToolDefinition<typeof priceUpdateInput, typeof previewResultSchema> = {
  name: 'preview_wishlist_price_update',
  title: 'Preview wishlist cheaper-find',
  description:
    'Preview a cheaper candidate offer (AUD only, URL reachable, price strictly lower). Commit stores candidate without overwriting the original link/price.',
  inputSchema: priceUpdateInput,
  outputSchema: previewResultSchema,
  scope: 'wishlists:write',
  annotations: openWorldWriteAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_wishlist_price_update', () => previewWishlistPriceUpdate(caller, args)),
};

export const LISTS_MCP_TOOLS = [
  listWatchlistsTool,
  getWatchlistTool,
  searchTitlesTool,
  previewAddToWatchlistTool,
  previewRemoveFromWatchlistTool,
  previewMarkWatchedTool,
  previewUnmarkWatchedTool,
  listWishlistsTool,
  getWishlistTool,
  previewAddWishlistItemTool,
  previewUpdateWishlistItemTool,
  previewRemoveWishlistItemTool,
  previewWishlistPriceUpdateTool,
] as const;
