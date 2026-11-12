import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRegistryAnnotations, MCP_TOOL_REGISTRY } from '../registry.js';
import type { McpCaller } from '../context.js';
import { commitTool } from '../commit-tool.js';
import { hasScope } from '../scopes.js';
import { READLIST_MCP_TOOLS } from './tools.js';
import { getReadlist, recommendBooks, searchBooks } from './reads.js';
import { commitReadlistPreview, previewAddToReadlist } from './writes.js';

vi.mock('../../books/compose.js', () => ({
  getBookProvider: vi.fn(),
}));

vi.mock('../../readlist/recommendations.js', async () => {
  const actual = await vi.importActual<typeof import('../../readlist/recommendations.js')>(
    '../../readlist/recommendations.js',
  );
  return {
    ...actual,
    buildReadlistRecommendations: vi.fn(),
  };
});

import { getBookProvider } from '../../books/compose.js';
import { buildReadlistRecommendations } from '../../readlist/recommendations.js';

const getBookProviderMock = vi.mocked(getBookProvider);
const buildRecsMock = vi.mocked(buildReadlistRecommendations);

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

function readlistClient(opts: {
  userId: string;
  householdId: string;
  role?: string;
  lists?: Row[];
  items?: Row[];
  works?: Row[];
  reviews?: Row[];
  people?: Row[];
  listPeople?: Row[];
}) {
  const lists = [...(opts.lists ?? [])];
  const items = [...(opts.items ?? [])];
  const works = [...(opts.works ?? [])];
  const reviews = [...(opts.reviews ?? [])];
  const people = [...(opts.people ?? [])];
  const listPeople = [...(opts.listPeople ?? [])];
  const previews = previewStore();
  const audit: Row[] = [];
  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

  function filterEq(rows: Row[], field: string, value: unknown) {
    return rows.filter((row) => row[field] === value);
  }

  function tableApi(table: string, rows: Row[]) {
    return {
      select(_cols?: string) {
        const state = {
          rows: [...rows],
          filters: [] as { f: string; v: unknown }[],
        };
        const api = {
          eq(f: string, v: unknown) {
            state.filters.push({ f, v });
            state.rows = filterEq(state.rows, f, v);
            return api;
          },
          in(f: string, vs: unknown[]) {
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
          rows.push({ id: item.id ?? nextId(table), ...item });
        }
        return { error: null };
      },
      update(patch: Row) {
        return {
          eq(f: string, v: unknown) {
            for (const row of rows) {
              if (row[f] === v) Object.assign(row, patch);
            }
            return { error: null };
          },
        };
      },
      delete() {
        return {
          eq(f: string, v: unknown) {
            const kept = rows.filter((row) => row[f] !== v);
            rows.length = 0;
            rows.push(...kept);
            return { error: null };
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
      if (table === 'household_people') return tableApi('household_people', people);
      if (table === 'readlist_lists') return tableApi('readlist_lists', lists);
      if (table === 'readlist_items') return tableApi('readlist_items', items);
      if (table === 'readlist_works') return tableApi('readlist_works', works);
      if (table === 'readlist_reviews') return tableApi('readlist_reviews', reviews);
      if (table === 'readlist_list_people') return tableApi('readlist_list_people', listPeople);
      throw new Error(`unexpected table ${table}`);
    },
    async rpc(name: string, args: Row) {
      if (name === 'ensure_default_readlist') {
        const existing = lists.find(
          (row) =>
            row.household_id === args.p_household_id &&
            row.created_by === opts.userId &&
            row.is_default,
        );
        if (existing) return { data: existing.id, error: null };
        const id = nextId('list');
        lists.push({
          id,
          household_id: args.p_household_id,
          created_by: opts.userId,
          name: 'Reading list',
          visibility: 'private',
          is_default: true,
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        });
        return { data: id, error: null };
      }
      if (name === 'upsert_readlist_work') {
        const work = args.p_work as Row;
        const ol =
          ((work.ids as Row | undefined)?.openLibraryWorkId as string | undefined) ??
          (typeof work.id === 'string' ? work.id : null);
        const existing = works.find((row) => row.ol_work_id === ol || row.id === work.id);
        if (existing) return { data: existing.id, error: null };
        const id = nextId('work');
        works.push({
          id,
          ol_work_id: ol,
          title: work.title,
          authors: work.authors,
          cover_url: work.coverUrl ?? null,
          first_published_year: work.firstPublishedYear ?? null,
        });
        return { data: id, error: null };
      }
      if (name === 'add_readlist_item') {
        const id = nextId('item');
        items.push({
          id,
          list_id: args.p_list_id,
          work_id: args.p_work_id,
          status: args.p_status ?? 'want_to_read',
          preferred_edition_id: args.p_preferred_edition_id ?? null,
          added_by: opts.userId,
          added_at: '2026-01-02',
          updated_at: '2026-01-02',
        });
        return { data: id, error: null };
      }
      if (name === 'set_readlist_item_status') {
        const item = items.find((row) => row.id === args.p_item_id);
        if (!item) return { data: null, error: { message: 'Item not found' } };
        item.status = args.p_status;
        return { data: item.id, error: null };
      }
      if (name === 'remove_readlist_item') {
        const idx = items.findIndex((row) => row.id === args.p_item_id);
        if (idx >= 0) items.splice(idx, 1);
        return { data: null, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
    _lists: lists,
    _items: items,
    _works: works,
    _audit: audit,
    _previews: previews.store,
  };

  return client;
}

function callerFor(
  client: ReturnType<typeof readlistClient>,
  scopes = ['watchlists:read', 'watchlists:write'],
): McpCaller {
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

function sampleWork(id: string, title: string) {
  return {
    id,
    title,
    authors: [{ name: 'Author', openLibraryAuthorId: 'OLA1' }],
    firstPublishedYear: 2020,
    blurb: null,
    coverUrl: null,
    subjects: ['fiction'],
    ids: {
      isbn10: null,
      isbn13: '9780000000001',
      openLibraryWorkId: id,
      openLibraryEditionId: null,
      hardcoverId: null,
      googleVolumeId: null,
      goodreadsId: null,
      asin: null,
    },
    editions: [],
  };
}

describe('readlist MCP', () => {
  beforeEach(() => {
    getBookProviderMock.mockReset();
    buildRecsMock.mockReset();
  });

  it('registers title + annotations for every readlist tool', () => {
    expect(() => assertRegistryAnnotations(MCP_TOOL_REGISTRY)).not.toThrow();
    expect(READLIST_MCP_TOOLS.length).toBe(6);
    for (const tool of READLIST_MCP_TOOLS) {
      expect(tool.title.trim().length).toBeGreaterThan(0);
      expect(tool.annotations).toEqual(
        expect.objectContaining({
          readOnlyHint: expect.any(Boolean),
          destructiveHint: expect.any(Boolean),
          openWorldHint: expect.any(Boolean),
        }),
      );
      expect(tool.scope === 'watchlists:read' || tool.scope === 'watchlists:write').toBe(true);
    }
    expect(commitTool.name).toBe('commit');
  });

  it('search_books returns stable book ids', async () => {
    getBookProviderMock.mockReturnValue({
      searchBooks: vi.fn().mockResolvedValue([
        {
          workId: 'OL1W',
          title: 'Dune',
          authors: ['Frank Herbert'],
          firstPublishedYear: 1965,
          coverUrl: 'https://covers/1.jpg',
          editionCount: 1,
          ids: {
            isbn10: null,
            isbn13: '9780441172719',
            openLibraryWorkId: 'OL1W',
            openLibraryEditionId: null,
            hardcoverId: null,
            googleVolumeId: null,
            goodreadsId: null,
            asin: null,
          },
        },
      ]),
      lookupWork: vi.fn(),
      lookupEdition: vi.fn(),
      listEditionsForWork: vi.fn(),
      resolveBookUrl: vi.fn(),
      getCoverUrl: vi.fn(),
      name: 'composed',
    } as never);

    const client = readlistClient({ userId: 'user-a', householdId: 'hh-a' });
    const out = await searchBooks(client as never, 'user-a', { query: 'dune' });
    expect(out.results).toEqual([
      expect.objectContaining({
        bookId: 'OL1W',
        title: 'Dune',
        authors: ['Frank Herbert'],
        isbn: '9780441172719',
      }),
    ]);
  });

  it('recommend_books excludes books already on the list', async () => {
    buildRecsMock.mockImplementation(async (input) => {
      const blocked = new Set(
        input.listed.flatMap((row) => [row.workId.toUpperCase(), (row.olWorkId ?? '').toUpperCase()]),
      );
      return {
        results: [
          {
            workId: 'OL_NEW',
            title: 'New Book',
            authors: ['A'],
            firstPublishedYear: 2021,
            coverUrl: null,
            reason: 'Because you loved Seed',
            seedTitle: 'Seed',
          },
          {
            workId: 'OL_LISTED',
            title: 'Already Listed',
            authors: ['B'],
            firstPublishedYear: 2020,
            coverUrl: null,
            reason: 'Because you loved Seed',
            seedTitle: 'Seed',
          },
        ].filter((row) => !blocked.has(row.workId.toUpperCase())),
        aiUsed: false,
      };
    });
    getBookProviderMock.mockReturnValue({
      lookupWork: vi.fn().mockResolvedValue(sampleWork('OL_SEED', 'Seed')),
      searchBooks: vi.fn(),
      lookupEdition: vi.fn(),
      listEditionsForWork: vi.fn(),
      resolveBookUrl: vi.fn(),
      getCoverUrl: vi.fn(),
      name: 'composed',
    } as never);

    const client = readlistClient({
      userId: 'user-a',
      householdId: 'hh-a',
      lists: [
        {
          id: 'list-a',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Reading list',
          visibility: 'private',
          is_default: true,
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      works: [{ id: 'work-listed', ol_work_id: 'OL_LISTED', title: 'Already Listed', authors: ['B'] }],
      items: [
        {
          id: 'item-1',
          list_id: 'list-a',
          work_id: 'work-listed',
          status: 'finished',
          added_at: '2026-01-01',
        },
      ],
    });

    const out = await recommendBooks(client as never, 'user-a', { basedOn: ['OL_SEED'] });
    expect(out.results.map((row) => row.bookId)).toEqual(['OL_NEW']);
    expect(buildRecsMock).toHaveBeenCalled();
    const call = buildRecsMock.mock.calls[0]![0];
    await expect(call.deps!.resolveAi!({} as never)).rejects.toMatchObject({ name: 'AiBlockedError' });
  });

  it('multi-add shares one preview and one commit', async () => {
    getBookProviderMock.mockReturnValue({
      lookupWork: vi.fn(async (id: string) => {
        if (id === 'OL1W') return sampleWork('OL1W', 'Book One');
        if (id === 'OL2W') return sampleWork('OL2W', 'Book Two');
        return null;
      }),
      searchBooks: vi.fn(),
      lookupEdition: vi.fn(),
      listEditionsForWork: vi.fn(),
      resolveBookUrl: vi.fn(),
      getCoverUrl: vi.fn(),
      name: 'composed',
    } as never);

    const client = readlistClient({ userId: 'user-a', householdId: 'hh-a' });
    const caller = callerFor(client);
    const preview = await previewAddToReadlist(caller, {
      bookIds: ['OL1W', 'OL2W'],
      status: 'want_to_read',
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    expect(client._previews.size).toBe(1);
    expect(preview.steps?.filter((step) => step.startsWith('Add '))).toHaveLength(2);

    const committed = await commitReadlistPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(committed.affectedIds).toHaveLength(2);
    expect(client._items).toHaveLength(2);
    expect(client._previews.size).toBe(1);
  });

  it('drops unresolvable ids and skips duplicates already on the list', async () => {
    getBookProviderMock.mockReturnValue({
      lookupWork: vi.fn(async (id: string) => {
        if (id === 'OL_GOOD') return sampleWork('OL_GOOD', 'Good Book');
        if (id === 'OL_DUP') return sampleWork('OL_DUP', 'Dup Book');
        return null;
      }),
      searchBooks: vi.fn(),
      lookupEdition: vi.fn(),
      listEditionsForWork: vi.fn(),
      resolveBookUrl: vi.fn(),
      getCoverUrl: vi.fn(),
      name: 'composed',
    } as never);

    const client = readlistClient({
      userId: 'user-a',
      householdId: 'hh-a',
      lists: [
        {
          id: 'list-a',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Reading list',
          visibility: 'private',
          is_default: true,
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      works: [{ id: 'work-dup', ol_work_id: 'OL_DUP', title: 'Dup Book', authors: ['A'] }],
      items: [
        {
          id: 'item-dup',
          list_id: 'list-a',
          work_id: 'work-dup',
          status: 'want_to_read',
          added_at: '2026-01-01',
        },
      ],
    });
    const caller = callerFor(client);
    const preview = await previewAddToReadlist(caller, {
      bookIds: ['OL_GOOD', 'OL_MISSING', 'OL_DUP'],
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    expect(preview.steps).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Add "Good Book"/),
        expect.stringMatching(/Dropped unresolvable id OL_MISSING/),
        expect.stringMatching(/already on your readlist/),
      ]),
    );
    const payload = [...client._previews.values()][0]!.payload as {
      books: { bookId: string }[];
    };
    expect(payload.books.map((book) => book.bookId)).toEqual(['OL_GOOD']);
  });

  it('denies write tools without watchlists:write scope', async () => {
    const client = readlistClient({ userId: 'user-a', householdId: 'hh-a' });
    const caller = callerFor(client, ['watchlists:read']);
    const tool = READLIST_MCP_TOOLS.find((row) => row.name === 'preview_add_to_readlist')!;
    expect(hasScope(caller.scopes, tool.scope)).toBe(false);
    expect(() => {
      if (!hasScope(caller.scopes, tool.scope)) throw new Error(`Missing scope ${tool.scope}`);
    }).toThrow(/Missing scope watchlists:write/);
  });

  it('hides another member private readlist', async () => {
    const client = readlistClient({
      userId: 'user-a',
      householdId: 'hh-a',
      role: 'adult',
      people: [{ id: 'person-a', household_id: 'hh-a', user_id: 'user-a' }],
      lists: [
        {
          id: 'mine',
          household_id: 'hh-a',
          created_by: 'user-a',
          name: 'Mine',
          visibility: 'private',
          is_default: true,
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          id: 'theirs',
          household_id: 'hh-a',
          created_by: 'user-b',
          name: 'Theirs',
          visibility: 'private',
          is_default: true,
          is_shared: false,
          share_token: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
      works: [
        { id: 'work-mine', ol_work_id: 'OL_MINE', title: 'My Book', authors: ['A'] },
        { id: 'work-theirs', ol_work_id: 'OL_THEIRS', title: 'Secret Book', authors: ['B'] },
      ],
      items: [
        {
          id: 'item-mine',
          list_id: 'mine',
          work_id: 'work-mine',
          status: 'want_to_read',
          added_at: '2026-01-02',
        },
        {
          id: 'item-theirs',
          list_id: 'theirs',
          work_id: 'work-theirs',
          status: 'reading',
          added_at: '2026-01-02',
        },
      ],
    });

    const out = await getReadlist(client as never, 'user-a');
    const titles = out.groups.flatMap((group) => group.books.map((book) => book.title));
    expect(titles).toEqual(['My Book']);
    expect(titles).not.toContain('Secret Book');
  });
});
