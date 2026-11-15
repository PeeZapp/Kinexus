import { describe, expect, it } from 'vitest';

import { assertRegistryAnnotations, MCP_TOOL_REGISTRY } from '../registry.js';
import type { McpCaller } from '../context.js';
import { TODAY_MCP_TOOLS } from './tools.js';
import { listTalkItems } from './talk-reads.js';
import {
  commitTalkPreview,
  previewAddTalkItem,
  previewRemoveTalkItem,
  previewSetTalkItemDone,
} from './talk-writes.js';

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

function talkClient(opts: {
  userId: string;
  householdId: string;
  role?: string;
  items?: Row[];
}) {
  const items = [...(opts.items ?? [])];
  const previews = previewStore();
  const audit: Row[] = [];
  const rpcs: { name: string; args: Row }[] = [];
  let idSeq = 1;
  const nextId = () => `talk-${idSeq++}`;

  function filterEq(rows: Row[], field: string, value: unknown) {
    return rows.filter((row) => row[field] === value);
  }

  function tableApi(rows: Row[]) {
    return {
      select(_cols?: string, selectOpts?: { count?: string; head?: boolean }) {
        const state = { rows: [...rows], filters: [] as { f: string; v: unknown }[] };
        const api = {
          eq(f: string, v: unknown) {
            state.filters.push({ f, v });
            state.rows = filterEq(state.rows, f, v);
            return api;
          },
          order() {
            return api;
          },
          limit() {
            return api;
          },
          async maybeSingle() {
            return { data: state.rows[0] ?? null, error: null, count: null };
          },
          async single() {
            return { data: state.rows[0] ?? null, error: null, count: null };
          },
          then(resolve: (v: { data: Row[] | null; error: null; count: number | null }) => unknown) {
            const count = selectOpts?.count === 'exact' ? state.rows.length : null;
            const data = selectOpts?.head ? null : state.rows;
            return Promise.resolve({ data, error: null, count }).then(resolve);
          },
        };
        return api;
      },
      insert(row: Row | Row[]) {
        const list = Array.isArray(row) ? row : [row];
        const inserted: Row[] = [];
        for (const item of list) {
          const withId = {
            id: item.id ?? nextId(),
            done: false,
            created_at: '2026-11-15T00:00:00.000Z',
            ...item,
          };
          rows.push(withId);
          inserted.push(withId);
        }
        return {
          select() {
            return {
              async single() {
                return { data: inserted[inserted.length - 1] ?? null, error: null };
              },
            };
          },
          error: null,
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
      if (table === 'household_talk_items') return tableApi(items);
      throw new Error(`unexpected table ${table}`);
    },
    async rpc(name: string, args: Row) {
      rpcs.push({ name, args });
      return { data: null, error: null };
    },
    _items: items,
    _rpcs: rpcs,
    _audit: audit,
  };

  return client;
}

function callerFor(client: ReturnType<typeof talkClient>): McpCaller {
  return {
    userId: 'user-a',
    accessToken: 'tok',
    client: client as never,
    clientId: 'client-1',
    clientName: 'test',
    platform: 'other',
    connectionId: 'conn-1',
    scopes: ['today:read', 'today:write'],
  };
}

describe('talk MCP', () => {
  it('registers today talk tools with annotations', () => {
    expect(() => assertRegistryAnnotations(MCP_TOOL_REGISTRY)).not.toThrow();
    expect(TODAY_MCP_TOOLS.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'list_talk_items',
        'get_talk_items',
        'preview_add_talk_item',
        'preview_set_talk_item_done',
        'preview_remove_talk_item',
        'get_calendar',
        'preview_create_calendar_event',
        'preview_update_calendar_event',
        'preview_delete_calendar_event',
      ]),
    );
    for (const tool of TODAY_MCP_TOOLS) {
      expect(tool.scope === 'today:read' || tool.scope === 'today:write').toBe(true);
    }
  });

  it('lists open and recent done items for the household only', async () => {
    const client = talkClient({
      userId: 'user-a',
      householdId: 'hh-a',
      items: [
        {
          id: 't1',
          household_id: 'hh-a',
          body: 'School pickup',
          done: false,
          created_by: 'user-a',
          created_at: '2026-11-14T00:00:00.000Z',
        },
        {
          id: 't2',
          household_id: 'hh-a',
          body: 'Done already',
          done: true,
          created_by: 'user-b',
          created_at: '2026-11-13T00:00:00.000Z',
        },
        {
          id: 't-other',
          household_id: 'hh-b',
          body: 'Other hh',
          done: false,
          created_by: 'user-c',
          created_at: '2026-11-14T00:00:00.000Z',
        },
      ],
    });
    const listed = await listTalkItems(client as never, 'user-a');
    expect(listed.householdId).toBe('hh-a');
    expect(listed.open.map((i) => i.id)).toEqual(['t1']);
    expect(listed.recentDone.map((i) => i.id)).toEqual(['t2']);
  });

  it('add / set done / remove via preview→commit and notifies on add', async () => {
    const client = talkClient({
      userId: 'user-a',
      householdId: 'hh-a',
      items: [
        {
          id: 't1',
          household_id: 'hh-a',
          body: 'Existing',
          done: false,
          created_by: 'user-a',
          created_at: '2026-11-14T00:00:00.000Z',
        },
      ],
    });
    const caller = callerFor(client);

    const add = await previewAddTalkItem(caller, { body: '  Budget chat  ' });
    expect(add.kind).toBe('preview');
    if (add.kind !== 'preview') return;
    const added = await commitTalkPreview(caller, { previewId: add.previewId });
    expect(added.ok).toBe(true);
    expect(client._items.some((i) => i.body === 'Budget chat')).toBe(true);
    expect(client._rpcs.some((r) => r.name === 'notify_household_alert' && r.args.p_segment === 'talk')).toBe(
      true,
    );

    const done = await previewSetTalkItemDone(caller, { itemId: 't1', done: true });
    expect(done.kind).toBe('preview');
    if (done.kind !== 'preview') return;
    await commitTalkPreview(caller, { previewId: done.previewId });
    expect(client._items.find((i) => i.id === 't1')?.done).toBe(true);

    const noop = await previewSetTalkItemDone(caller, { itemId: 't1', done: true });
    expect(noop.kind).toBe('noop');

    const remove = await previewRemoveTalkItem(caller, { itemId: 't1' });
    expect(remove.kind).toBe('preview');
    if (remove.kind !== 'preview') return;
    await commitTalkPreview(caller, { previewId: remove.previewId });
    expect(client._items.find((i) => i.id === 't1')).toBeUndefined();
  });

  it('blocks empty and full talk list', async () => {
    const client = talkClient({
      userId: 'user-a',
      householdId: 'hh-a',
      items: Array.from({ length: 40 }, (_, i) => ({
        id: `full-${i}`,
        household_id: 'hh-a',
        body: `Item ${i}`,
        done: false,
        created_by: 'user-a',
        created_at: '2026-11-14T00:00:00.000Z',
      })),
    });
    const caller = callerFor(client);
    const empty = await previewAddTalkItem(caller, { body: '   ' });
    expect(empty).toMatchObject({ kind: 'blocked' });
    const full = await previewAddTalkItem(caller, { body: 'One more' });
    expect(full).toMatchObject({ kind: 'blocked', message: expect.stringMatching(/full/i) });
  });
});
