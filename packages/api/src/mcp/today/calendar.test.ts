import { describe, expect, it } from 'vitest';

import type { McpCaller } from '../context.js';
import { getCalendar } from './calendar-reads.js';
import {
  commitCalendarPreview,
  previewCreateCalendarEvent,
  previewDeleteCalendarEvent,
  previewUpdateCalendarEvent,
} from './calendar-writes.js';

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

function calendarClient(opts: {
  userId: string;
  householdId: string;
  events?: Row[];
  people?: Row[];
}) {
  const events = [...(opts.events ?? [])];
  const people = [...(opts.people ?? [])];
  const previews = previewStore();
  const rpcs: { name: string; args: Row }[] = [];
  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

  function filterEq(rows: Row[], field: string, value: unknown) {
    return rows.filter((row) => row[field] === value);
  }

  function tableApi(rows: Row[]) {
    return {
      select(_cols?: string) {
        const state = {
          rows: [...rows],
        };
        const api = {
          eq(f: string, v: unknown) {
            state.rows = filterEq(state.rows, f, v);
            return api;
          },
          in(f: string, vs: unknown[]) {
            state.rows = state.rows.filter((row) => vs.includes(row[f]));
            return api;
          },
          lte(f: string, v: unknown) {
            state.rows = state.rows.filter((row) => String(row[f] ?? '') <= String(v));
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
        const inserted: Row[] = [];
        for (const item of list) {
          const withId = {
            id: item.id ?? nextId('evt'),
            created_at: '2026-11-15T00:00:00.000Z',
            updated_at: '2026-11-15T00:00:00.000Z',
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
                      async single() {
                        return { data: rows.find((r) => r[f] === v && r[f2] === v2) ?? null, error: null };
                      },
                      async maybeSingle() {
                        return { data: rows.find((r) => r[f] === v && r[f2] === v2) ?? null, error: null };
                      },
                    };
                  },
                  error: null,
                };
              },
            };
          },
        };
      },
      delete() {
        return {
          eq(f: string, v: unknown) {
            let candidate = rows.filter((row) => row[f] === v);
            const apply = () => {
              const ids = new Set(candidate.map((row) => row));
              const kept = rows.filter((row) => !ids.has(row));
              rows.length = 0;
              rows.push(...kept);
            };
            const api = {
              eq(f2: string, v2: unknown) {
                candidate = candidate.filter((row) => row[f2] === v2);
                return api;
              },
              select() {
                return {
                  then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                    const removed = [...candidate];
                    apply();
                    return Promise.resolve({ data: removed, error: null }).then(resolve);
                  },
                };
              },
              then(resolve: (v: { data: Row[] | null; error: null }) => unknown) {
                apply();
                return Promise.resolve({ data: null, error: null }).then(resolve);
              },
              error: null,
            };
            return api;
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
          async insert() {
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
      if (table === 'household_events') return tableApi(events);
      if (table === 'household_event_people') return tableApi(people);
      throw new Error(`unexpected table ${table}`);
    },
    async rpc(name: string, args: Row) {
      rpcs.push({ name, args });
      return { data: null, error: null };
    },
    _events: events,
    _people: people,
    _rpcs: rpcs,
  };

  return client;
}

function callerFor(client: ReturnType<typeof calendarClient>): McpCaller {
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

describe('calendar MCP', () => {
  it('get_calendar returns day events and hides other households', async () => {
    const client = calendarClient({
      userId: 'user-a',
      householdId: 'hh-a',
      events: [
        {
          id: 'e1',
          household_id: 'hh-a',
          title: 'Dentist',
          notes: '',
          location: '',
          all_day: true,
          starts_on: '2026-11-15',
          ends_on: '2026-11-15',
          start_time: null,
          end_time: null,
          color: 'teal',
          remind_minutes: null,
          recurrence: 'none',
          until_on: null,
          created_by: 'user-a',
          created_at: '2026-11-01',
          updated_at: '2026-11-01',
        },
        {
          id: 'e-other',
          household_id: 'hh-b',
          title: 'Secret',
          notes: '',
          location: '',
          all_day: true,
          starts_on: '2026-11-15',
          ends_on: '2026-11-15',
          start_time: null,
          end_time: null,
          color: 'rose',
          remind_minutes: null,
          recurrence: 'none',
          until_on: null,
          created_by: 'user-b',
          created_at: '2026-11-01',
          updated_at: '2026-11-01',
        },
      ],
    });
    const result = await getCalendar(client as never, 'user-a', { date: '2026-11-15' });
    expect(result.events.map((e) => e.id)).toEqual(['e1']);
  });

  it('create / update / delete via preview→commit', async () => {
    const client = calendarClient({
      userId: 'user-a',
      householdId: 'hh-a',
      events: [
        {
          id: 'e1',
          household_id: 'hh-a',
          title: 'Old',
          notes: '',
          location: '',
          all_day: true,
          starts_on: '2026-11-16',
          ends_on: '2026-11-16',
          start_time: null,
          end_time: null,
          color: 'teal',
          remind_minutes: null,
          recurrence: 'none',
          until_on: null,
          created_by: 'user-a',
          created_at: '2026-11-01',
          updated_at: '2026-11-01',
        },
      ],
    });
    const caller = callerFor(client);

    const create = await previewCreateCalendarEvent(caller, {
      title: 'Picnic',
      startsOn: '2026-11-20',
      personIds: ['person-1'],
    });
    expect(create.kind).toBe('preview');
    if (create.kind !== 'preview') return;
    const created = await commitCalendarPreview(caller, { previewId: create.previewId });
    expect(created.ok).toBe(true);
    expect(client._events.some((e) => e.title === 'Picnic')).toBe(true);
    expect(client._rpcs.some((r) => r.name === 'notify_household_alert')).toBe(true);
    expect(client._people.some((p) => p.person_id === 'person-1')).toBe(true);

    const update = await previewUpdateCalendarEvent(caller, { eventId: 'e1', title: 'Renamed' });
    expect(update.kind).toBe('preview');
    if (update.kind !== 'preview') return;
    await commitCalendarPreview(caller, { previewId: update.previewId });
    expect(client._events.find((e) => e.id === 'e1')?.title).toBe('Renamed');

    const del = await previewDeleteCalendarEvent(caller, { eventId: 'e1' });
    expect(del.kind).toBe('preview');
    if (del.kind !== 'preview') return;
    await commitCalendarPreview(caller, { previewId: del.previewId });
    expect(client._events.find((e) => e.id === 'e1')).toBeUndefined();
  });

  it('blocks empty title', async () => {
    const client = calendarClient({ userId: 'user-a', householdId: 'hh-a' });
    const caller = callerFor(client);
    const blocked = await previewCreateCalendarEvent(caller, { title: '  ', startsOn: '2026-11-15' });
    expect(blocked.kind).toBe('blocked');
  });
});
