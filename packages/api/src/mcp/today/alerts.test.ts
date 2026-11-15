import { describe, expect, it } from 'vitest';

import type { McpCaller } from '../context.js';
import { getUnreadAlerts, listAlerts } from './alerts-reads.js';
import {
  commitAlertsPreview,
  previewMarkAlertRead,
  previewMarkAllAlertsRead,
} from './alerts-writes.js';

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

function alertsClient(opts: { userId: string; householdId: string; alerts?: Row[] }) {
  const alerts = [...(opts.alerts ?? [])];
  const previews = previewStore();

  function tableApi(rows: Row[]) {
    return {
      select(_cols?: string, selectOpts?: { count?: string; head?: boolean }) {
        const state = { rows: [...rows] };
        const api = {
          eq(f: string, v: unknown) {
            state.rows = state.rows.filter((row) => row[f] === v);
            return api;
          },
          is(f: string, v: null) {
            state.rows = state.rows.filter((row) => row[f] == null);
            return api;
          },
          order() {
            return api;
          },
          limit(n: number) {
            state.rows = state.rows.slice(0, n);
            return api;
          },
          async maybeSingle() {
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
      update(patch: Row) {
        return {
          eq(f: string, v: unknown) {
            const api = {
              eq(f2: string, v2: unknown) {
                for (const row of rows) {
                  if (row[f] === v && row[f2] === v2) Object.assign(row, patch);
                }
                return {
                  is(f3: string, v3: null) {
                    for (const row of rows) {
                      if (row[f] === v && row[f2] === v2 && row[f3] == null) Object.assign(row, patch);
                    }
                    return {
                      select() {
                        return {
                          then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                            return Promise.resolve({
                              data: rows.filter((r) => r[f] === v && r[f2] === v2),
                              error: null,
                            }).then(resolve);
                          },
                        };
                      },
                    };
                  },
                  select() {
                    return {
                      then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                        const matched = rows.filter((r) => r[f] === v && r[f2] === v2);
                        return Promise.resolve({ data: matched, error: null }).then(resolve);
                      },
                    };
                  },
                };
              },
              is(f2: string, _v2: null) {
                for (const row of rows) {
                  if (row[f] === v && row[f2] == null) Object.assign(row, patch);
                }
                return {
                  select() {
                    return {
                      then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                        const matched = rows.filter((r) => r[f] === v);
                        return Promise.resolve({ data: matched, error: null }).then(resolve);
                      },
                    };
                  },
                };
              },
            };
            return api;
          },
        };
      },
    };
  }

  return {
    from(table: string) {
      if (table === 'mcp_previews') return previews.from(table);
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
                              data: { role: 'owner', household_id: opts.householdId },
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
      if (table === 'user_alerts') return tableApi(alerts);
      throw new Error(`unexpected table ${table}`);
    },
    _alerts: alerts,
  };
}

function callerFor(client: ReturnType<typeof alertsClient>): McpCaller {
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

describe('alerts MCP', () => {
  it('lists unread only for the signed-in user and marks read via commit', async () => {
    const client = alertsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      alerts: [
        {
          id: 'a1',
          user_id: 'user-a',
          title: 'Mine',
          segment: 'talk',
          body: null,
          href: '/today',
          read_at: null,
          created_at: '2026-11-15T00:00:00.000Z',
        },
        {
          id: 'a2',
          user_id: 'user-b',
          title: 'Theirs',
          segment: 'talk',
          body: null,
          href: '/today',
          read_at: null,
          created_at: '2026-11-15T00:00:00.000Z',
        },
      ],
    });
    const listed = await listAlerts(client as never, 'user-a', { unreadOnly: true });
    expect(listed.alerts.map((a) => a.id)).toEqual(['a1']);
    const unread = await getUnreadAlerts(client as never, 'user-a');
    expect(unread.unreadCount).toBe(1);

    const caller = callerFor(client);
    const preview = await previewMarkAlertRead(caller, { alertId: 'a1' });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    await commitAlertsPreview(caller, { previewId: preview.previewId });
    expect(client._alerts.find((a) => a.id === 'a1')?.read_at).toBeTruthy();

    await expect(previewMarkAlertRead(caller, { alertId: 'a2' })).rejects.toThrow(/not found/i);

    // Reset for mark-all
    client._alerts[0]!.read_at = null;
    const all = await previewMarkAllAlertsRead(caller);
    expect(all.kind).toBe('preview');
    if (all.kind !== 'preview') return;
    await commitAlertsPreview(caller, { previewId: all.previewId });
    expect(client._alerts.find((a) => a.id === 'a1')?.read_at).toBeTruthy();
  });
});
