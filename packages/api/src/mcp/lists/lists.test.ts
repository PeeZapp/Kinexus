import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRegistryAnnotations, MCP_TOOL_REGISTRY } from '../registry.js';
import { commitWritePreview, createWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import { commitTool } from '../commit-tool.js';
import { LISTS_MCP_TOOLS } from './tools.js';
import { getWatchlist, getWishlist, listWatchlists, listWishlists } from './reads.js';
import {
  commitListsPreview,
  previewAddToWatchlist,
  previewWishlistPriceUpdate,
} from './writes.js';

vi.mock('../../watchlist.js', () => ({
  searchWatchlistTitles: vi.fn(),
  lookupWatchlistTitle: vi.fn(),
}));

import { lookupWatchlistTitle, searchWatchlistTitles } from '../../watchlist.js';

const searchMock = vi.mocked(searchWatchlistTitles);
const lookupMock = vi.mocked(lookupWatchlistTitle);

type Row = Record<string, unknown>;

function previewStore() {
  const store = new Map<string, Row>();
  return {
    store,
    from(table: string) {
      if (table !== 'mcp_previews') throw new Error(table);
      return {
        insert(row: Row) {
          store.set(String(row.id), { ...row, committed_at: null });
          return { error: null };
        },
        select() {
          return {
            eq(field: string, value: string) {
              return {
                eq(field2: string, value2: string) {
                  return {
                    async maybeSingle() {
                      for (const row of store.values()) {
                        if (row[field] === value && row[field2] === value2) return { data: row, error: null };
                      }
                      return { data: null, error: null };
                    },
                  };
                },
                async maybeSingle() {
                  for (const row of store.values()) {
                    if (row[field] === value) return { data: row, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(patch: Row) {
          return {
            eq(field: string, value: string) {
              return {
                eq(field2: string, value2: string) {
                  return {
                    is(_col: string, _val: null) {
                      return {
                        select() {
                          return {
                            async maybeSingle() {
                              for (const [id, row] of store) {
                                if (row[field] === value && row[field2] === value2 && row.committed_at == null) {
                                  const next = { ...row, ...patch };
                                  store.set(id, next);
                                  return { data: next, error: null };
                                }
                              }
                              return { data: null, error: null };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function listsClient(opts: {
  userId: string;
  householdId: string;
  role?: string;
  watchlists?: Row[];
  watchlistItems?: Row[];
  watchlistTitles?: Row[];
  wishlists?: Row[];
  wishlistProducts?: Row[];
  wishlistJoins?: Row[];
  people?: Row[];
}) {
  const watchlists = [...(opts.watchlists ?? [])];
  const watchlistItems = [...(opts.watchlistItems ?? [])];
  const watchlistTitles = [...(opts.watchlistTitles ?? [])];
  const wishlists = [...(opts.wishlists ?? [])];
  const wishlistProducts = [...(opts.wishlistProducts ?? [])];
  const wishlistJoins = [...(opts.wishlistJoins ?? [])];
  const people = [...(opts.people ?? [])];
  const previews = previewStore();
  const audit: Row[] = [];
  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

  function filterEq(rows: Row[], field: string, value: unknown) {
    return rows.filter((row) => row[field] === value);
  }

  function tableApi(table: string, rows: Row[], opts?: { upsertKey?: string[] }) {
    return {
      select(_cols?: string) {
        const state = { rows: [...rows], filters: [] as { f: string; v: unknown }[], inFilters: [] as { f: string; vs: unknown[] }[] };
        const api = {
          eq(f: string, v: unknown) {
            state.filters.push({ f, v });
            state.rows = filterEq(state.rows, f, v);
            return api;
          },
          in(f: string, vs: unknown[]) {
            state.inFilters.push({ f, vs });
            state.rows = state.rows.filter((row) => vs.includes(row[f]));
            return api;
          },
          order() {
            return api;
          },
          async maybeSingle() {
            return { data: state.rows[0] ?? null, error: null };
          },
          async single() {
            return { data: state.rows[0] ?? null, error: null };
          },
          then(resolve: (v: { data: Row[]; error: null }) => unknown) {
            return Promise.resolve({ data: state.rows, error: null }).then(resolve);
          },
        };
        return api;
      },
      insert(row: Row | Row[]) {
        const list = Array.isArray(row) ? row : [row];
        for (const item of list) {
          const withId = { id: item.id ?? nextId(table), ...item };
          rows.push(withId);
        }
        return {
          select() {
            return {
              async single() {
                return { data: rows[rows.length - 1] ?? null, error: null };
              },
            };
          },
          error: null,
        };
      },
      upsert(row: Row) {
        rows.push({ id: row.id ?? nextId(table), ...row });
        return {
          select() {
            return {
              async single() {
                return { data: rows[rows.length - 1] ?? null, error: null };
              },
            };
          },
        };
      },
      update(patch: Row) {
        return {
          eq(f: string, v: unknown) {
            return {
              eq(f2: string, v2: unknown) {
                for (const row of rows) {
                  if (row[f] === v && row[f2] === v2) Object.assign(row, patch);
                }
                return {
                  select() {
                    return {
                      async maybeSingle() {
                        return { data: rows.find((r) => r[f] === v && r[f2] === v2) ?? null, error: null };
                      },
                    };
                  },
                  error: null,
                };
              },
              select() {
                return {
                  async maybeSingle() {
                    return { data: rows.find((r) => r[f] === v) ?? null, error: null };
                  },
                };
              },
              then(resolve: (v: { error: null }) => unknown) {
                for (const row of rows) {
                  if (row[f] === v) Object.assign(row, patch);
                }
                return Promise.resolve({ error: null }).then(resolve);
              },
              error: null,
            };
          },
        };
      },
      delete() {
        return {
          eq(f: string, v: unknown) {
            return {
              eq(f2: string, v2: unknown) {
                const kept: Row[] = [];
                const removed: Row[] = [];
                for (const row of rows) {
                  if (row[f] === v && row[f2] === v2) removed.push(row);
                  else kept.push(row);
                }
                rows.length = 0;
                rows.push(...kept);
                return {
                  select() {
                    return {
                      then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                        return Promise.resolve({ data: removed, error: null }).then(resolve);
                      },
                    };
                  },
                };
              },
              select() {
                const removed = rows.filter((row) => row[f] === v);
                const kept = rows.filter((row) => row[f] !== v);
                rows.length = 0;
                rows.push(...kept);
                return {
                  then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                    return Promise.resolve({ data: removed, error: null }).then(resolve);
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  const client = {
    from(table: string) {
      if (table === 'mcp_previews') return previews.from(table);
      if (table === 'mcp_audit_log') {
        return {
          async insert(row: Row) {
            audit.push(row);
            return { error: null };
          },
        };
      }
      if (table === 'household_members') {
        return {
          select() {
            return {
              eq(_f: string, userId: string) {
                return {
                  order() {
                    return {
                      limit() {
                        return {
                          async maybeSingle() {
                            if (userId !== opts.userId) return { data: null, error: null };
                            return {
                              data: { role: opts.role ?? 'owner', household_id: opts.householdId },
                              error: null,
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'households') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: { country: 'AU' }, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'household_people') {
        return tableApi('household_people', people);
      }
      if (table === 'watchlist_lists') return tableApi('watchlist_lists', watchlists);
      if (table === 'watchlist_items') return tableApi('watchlist_items', watchlistItems);
      if (table === 'watchlist_titles') return tableApi('watchlist_titles', watchlistTitles);
      if (table === 'watchlist_list_people') {
        return {
          select() {
            return {
              eq() {
                return {
                  then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                    return Promise.resolve({ data: [], error: null }).then(resolve);
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'stash_lists') return tableApi('stash_lists', wishlists);
      if (table === 'stash_products') return tableApi('stash_products', wishlistProducts);
      if (table === 'stash_list_products') return tableApi('stash_list_products', wishlistJoins);
      if (table === 'stash_list_people') {
        return {
          select() {
            return {
              eq() {
                return {
                  then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                    return Promise.resolve({ data: [], error: null }).then(resolve);
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    _watchlists: watchlists,
    _watchlistItems: watchlistItems,
    _watchlistTitles: watchlistTitles,
    _wishlists: wishlists,
    _wishlistProducts: wishlistProducts,
    _wishlistJoins: wishlistJoins,
    _audit: audit,
    _previews: previews.store,
  };

  return client;
}

function callerFor(client: ReturnType<typeof listsClient>, scopes = ['watchlists:read', 'watchlists:write', 'wishlists:read', 'wishlists:write']): McpCaller {
  return {
    userId: 'user-a',
    accessToken: 'tok',
    client: client as never,
    clientId: 'client-1',
    clientName: 'test',
    platform: 'other',
    connectionId: 'conn-1',
    scopes,
  };
}

describe('lists MCP', () => {
  beforeEach(() => {
    searchMock.mockReset();
    lookupMock.mockReset();
  });

  it('registers title + annotations for every lists tool', () => {
    expect(() => assertRegistryAnnotations(MCP_TOOL_REGISTRY)).not.toThrow();
    expect(LISTS_MCP_TOOLS.length).toBe(13);
    for (const tool of LISTS_MCP_TOOLS) {
      expect(tool.title.trim().length).toBeGreaterThan(0);
      expect(tool.annotations).toEqual(
        expect.objectContaining({
          readOnlyHint: expect.any(Boolean),
          destructiveHint: expect.any(Boolean),
          openWorldHint: expect.any(Boolean),
        }),
      );
      expect(
        tool.scope === 'watchlists:read' ||
          tool.scope === 'watchlists:write' ||
          tool.scope === 'wishlists:read' ||
          tool.scope === 'wishlists:write',
      ).toBe(true);
    }
    expect(commitTool.name).toBe('commit');
    const cheaper = LISTS_MCP_TOOLS.find((t) => t.name === 'preview_wishlist_price_update');
    expect(cheaper?.annotations.openWorldHint).toBe(true);
  });

  it('ambiguous title name returns candidates and does not write', async () => {
    searchMock.mockResolvedValue([
      {
        tmdbId: 1,
        mediaType: 'movie',
        title: 'Dune',
        year: 2021,
        overview: 'A',
        posterPath: null,
        backdropPath: null,
        imdbId: null,
      },
      {
        tmdbId: 2,
        mediaType: 'movie',
        title: 'Dune',
        year: 1984,
        overview: 'B',
        posterPath: null,
        backdropPath: null,
        imdbId: null,
      },
    ]);
    const client = listsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      watchlists: [
        {
          id: 'wl-1',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Queue',
          visibility: 'household',
          kind: 'custom',
          audience: 'all',
          blurb: null,
          sample_poster_paths: [],
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    });
    const caller = callerFor(client);
    const preview = await previewAddToWatchlist(caller, { listId: 'wl-1', name: 'Dune' });
    expect(preview.kind).toBe('dedupe');
    if (preview.kind !== 'dedupe') return;
    expect(preview.candidates).toHaveLength(2);
    expect(client._watchlistItems).toHaveLength(0);
    expect(client._previews.size).toBe(0);
  });

  it('cheaper-find rejects non-AUD, higher price, and unreachable URL', async () => {
    const client = listsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      wishlists: [
        {
          id: 'wish-1',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Gifts',
          kind: 'wishlist',
          visibility: 'household',
          personIds: [],
          parent_list_id: null,
          is_shared: false,
          share_token: null,
          emoji: null,
          theme: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      wishlistProducts: [
        {
          id: 'p1',
          household_id: 'hh-a',
          title: 'Shoes',
          current_price: 100,
          source_url: 'https://old.example/shoes',
          store_name: 'Old',
          original_price: null,
          is_on_sale: false,
          is_owned: false,
          notes: null,
        },
      ],
      wishlistJoins: [{ list_id: 'wish-1', product_id: 'p1', household_id: 'hh-a' }],
    });
    const caller = callerFor(client);

    const nonAud = await previewWishlistPriceUpdate(caller, {
      itemId: 'p1',
      url: 'https://shop.example/shoes',
      price: 80,
      currency: 'USD',
    });
    expect(nonAud.kind).toBe('blocked');
    expect(String((nonAud as { message: string }).message)).toMatch(/AUD/i);

    const higher = await previewWishlistPriceUpdate(
      caller,
      { itemId: 'p1', url: 'https://shop.example/shoes', price: 120, currency: 'AUD' },
      async () => new Response(null, { status: 200 }) as never,
    );
    expect(higher.kind).toBe('blocked');
    expect(String((higher as { message: string }).message)).toMatch(/not strictly lower/i);

    const unreachable = await previewWishlistPriceUpdate(
      caller,
      { itemId: 'p1', url: 'https://shop.example/shoes', price: 80, currency: 'AUD' },
      async () => {
        throw new Error('network');
      },
    );
    expect(unreachable.kind).toBe('blocked');
    expect(String((unreachable as { message: string }).message)).toMatch(/reach/i);
  });

  it('preview shows old vs new; commit keeps original link; Switch swaps', async () => {
    const client = listsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      wishlists: [
        {
          id: 'wish-1',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Gifts',
          kind: 'wishlist',
          visibility: 'household',
          parent_list_id: null,
          is_shared: false,
          share_token: null,
          emoji: null,
          theme: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      wishlistProducts: [
        {
          id: 'p1',
          household_id: 'hh-a',
          title: 'Shoes',
          current_price: 100,
          source_url: 'https://old.example/shoes',
          store_name: 'Old',
          original_price: null,
          is_on_sale: false,
          is_owned: false,
          notes: null,
          candidate_source_url: null,
          candidate_price: null,
          candidate_store_name: null,
          candidate_currency: null,
          previous_source_url: null,
          previous_price: null,
          previous_store_name: null,
        },
      ],
      wishlistJoins: [{ list_id: 'wish-1', product_id: 'p1', household_id: 'hh-a' }],
    });
    const caller = callerFor(client);
    const preview = await previewWishlistPriceUpdate(
      caller,
      { itemId: 'p1', url: 'https://new.example/shoes', price: 70, currency: 'AUD' },
      async () => new Response(null, { status: 200 }) as never,
    );
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    expect(preview.summary).toMatch(/100/);
    expect(preview.summary).toMatch(/70/);
    expect(preview.steps?.some((s) => /Keep original/i.test(s))).toBe(true);

    const committed = await commitListsPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    const product = client._wishlistProducts[0]!;
    expect(product.source_url).toBe('https://old.example/shoes');
    expect(product.current_price).toBe(100);
    expect(product.candidate_source_url).toBe('https://new.example/shoes');
    expect(product.candidate_price).toBe(70);

    // Switch (same logic as app)
    Object.assign(product, {
      previous_source_url: product.source_url,
      previous_price: product.current_price,
      previous_store_name: product.store_name,
      source_url: product.candidate_source_url,
      current_price: product.candidate_price,
      store_name: product.candidate_store_name,
      candidate_source_url: null,
      candidate_price: null,
      candidate_store_name: null,
      candidate_currency: null,
    });
    expect(product.source_url).toBe('https://new.example/shoes');
    expect(product.current_price).toBe(70);
    expect(product.previous_source_url).toBe('https://old.example/shoes');
    expect(product.previous_price).toBe(100);
  });

  it('rejects stale preview', async () => {
    const client = listsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      wishlists: [
        {
          id: 'wish-1',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Gifts',
          kind: 'wishlist',
          visibility: 'household',
          parent_list_id: null,
          is_shared: false,
          share_token: null,
          emoji: null,
          theme: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    });
    const caller = callerFor(client);
    const { previewId } = await createWritePreview(caller.client, {
      userId: caller.userId,
      householdId: 'hh-a',
      tool: 'preview_add_wishlist_item',
      payload: {
        action: 'add_wishlist_item',
        listId: 'wish-1',
        title: 'X',
        sourceUrl: '',
        currentPrice: null,
        originalPrice: null,
        storeName: null,
        notes: null,
        imageUrl: null,
      },
    });
    const mismatch = await commitWritePreview(caller.client, {
      userId: caller.userId,
      previewId,
      tool: 'preview_remove_wishlist_item',
    });
    expect(mismatch).toEqual({ ok: false, reason: 'mismatched' });
    const missing = await commitListsPreview(caller, { previewId: 'nope' }).catch((err: Error) => err);
    expect(missing).toBeInstanceOf(Error);
    expect(String(missing)).toMatch(/Preview missing|Preview mismatched|Preview expired/i);
  });

  it('RLS isolation: other household lists/items are not found', async () => {
    const client = listsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      watchlists: [
        {
          id: 'ours',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Ours',
          visibility: 'household',
          kind: 'custom',
          audience: 'all',
          blurb: null,
          sample_poster_paths: [],
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'theirs',
          household_id: 'hh-b',
          created_by: 'user-b',
          name: 'Theirs',
          visibility: 'household',
          kind: 'custom',
          audience: 'all',
          blurb: null,
          sample_poster_paths: [],
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      wishlists: [
        {
          id: 'w-ours',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Ours',
          kind: 'wishlist',
          visibility: 'household',
          parent_list_id: null,
          is_shared: false,
          share_token: null,
          emoji: null,
          theme: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'w-theirs',
          household_id: 'hh-b',
          created_by: 'user-b',
          name: 'Theirs',
          kind: 'wishlist',
          visibility: 'household',
          parent_list_id: null,
          is_shared: false,
          share_token: null,
          emoji: null,
          theme: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    });
    const listed = await listWatchlists(client as never, 'user-a');
    expect(listed.watchlists.map((w) => w.id)).toEqual(['ours']);
    await expect(getWatchlist(client as never, 'user-a', 'theirs')).rejects.toThrow(/not found/i);

    const wish = await listWishlists(client as never, 'user-a');
    expect(wish.wishlists.map((w) => w.id)).toEqual(['w-ours']);
    await expect(getWishlist(client as never, 'user-a', 'w-theirs')).rejects.toThrow(/not found/i);
  });

  it('add_to_watchlist with tmdbId creates a preview that commits', async () => {
    lookupMock.mockResolvedValue({
      tmdbId: 42,
      mediaType: 'movie',
      title: 'Arrival',
      year: 2016,
      overview: null,
      posterPath: null,
      backdropPath: null,
      imdbId: null,
      sourceUrl: null,
      tmdbWatchUrl: null,
      trailerUrl: null,
      contentRating: null,
      audience: null,
      providers: [],
      providersCountry: 'AU',
    });
    const client = listsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      watchlists: [
        {
          id: 'wl-1',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Queue',
          visibility: 'household',
          kind: 'custom',
          audience: 'all',
          blurb: null,
          sample_poster_paths: [],
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    });
    const caller = callerFor(client);
    const preview = await previewAddToWatchlist(caller, {
      listId: 'wl-1',
      tmdbId: 42,
      mediaType: 'movie',
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    const committed = await commitListsPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(client._watchlistTitles.some((t) => t.tmdb_id === 42)).toBe(true);
    expect(client._watchlistItems).toHaveLength(1);
  });
});
