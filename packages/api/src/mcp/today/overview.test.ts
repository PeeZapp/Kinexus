import { describe, expect, it } from 'vitest';

import type { McpCaller } from '../context.js';
import { getTodayOverview } from './overview.js';

type Row = Record<string, unknown>;

function overviewClient(opts: {
  userId: string;
  householdId: string;
  tasks?: unknown;
  talk?: Row[];
  events?: Row[];
  alerts?: Row[];
}) {
  const talk = [...(opts.talk ?? [])];
  const events = [...(opts.events ?? [])];
  const alerts = [...(opts.alerts ?? [])];

  function filterEq(rows: Row[], field: string, value: unknown) {
    return rows.filter((row) => row[field] === value);
  }

  function tableApi(rows: Row[]) {
    return {
      select(_cols?: string, selectOpts?: { count?: string; head?: boolean }) {
        const state = { rows: [...rows] };
        const api = {
          eq(f: string, v: unknown) {
            state.rows = filterEq(state.rows, f, v);
            return api;
          },
          in(f: string, vs: unknown[]) {
            state.rows = state.rows.filter((row) => vs.includes(row[f]));
            return api;
          },
          is(f: string, v: null) {
            state.rows = state.rows.filter((row) => row[f] == null);
            return api;
          },
          lte(f: string, v: unknown) {
            state.rows = state.rows.filter((row) => String(row[f] ?? '') <= String(v));
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
    };
  }

  return {
    from(table: string) {
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
      if (table === 'user_days') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return {
                          data: opts.tasks !== undefined ? { tasks: opts.tasks } : null,
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
      }
      if (table === 'household_day_tasks') return tableApi([]);
      if (table === 'household_talk_items') return tableApi(talk);
      if (table === 'household_events') return tableApi(events);
      if (table === 'household_event_people') return tableApi([]);
      if (table === 'user_alerts') return tableApi(alerts);
      if (table === 'mcp_audit_log') {
        return { async insert() { return { error: null }; } };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function callerFor(client: ReturnType<typeof overviewClient>, scopes = ['today:read']): McpCaller {
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

describe('get_today overview', () => {
  it('returns tasks/talk/calendar/alerts and omits meals/train without scopes', async () => {
    const client = overviewClient({
      userId: 'user-a',
      householdId: 'hh-a',
      tasks: [{ id: 'task-1', label: 'Call mum', done: false }],
      talk: [
        {
          id: 'talk-1',
          household_id: 'hh-a',
          body: 'School fees',
          done: false,
          created_by: 'user-a',
          created_at: '2026-11-15T00:00:00.000Z',
        },
      ],
      events: [
        {
          id: 'e1',
          household_id: 'hh-a',
          title: 'Soccer',
          notes: '',
          location: 'Park',
          all_day: false,
          starts_on: '2026-11-15',
          ends_on: '2026-11-15',
          start_time: '16:00',
          end_time: '17:00',
          color: 'teal',
          remind_minutes: null,
          recurrence: 'none',
          until_on: null,
          created_by: 'user-a',
          created_at: '2026-11-01',
          updated_at: '2026-11-01',
        },
      ],
      alerts: [
        {
          id: 'a1',
          user_id: 'user-a',
          title: 'New talk item',
          segment: 'talk',
          created_at: '2026-11-15T01:00:00.000Z',
          read_at: null,
        },
      ],
    });
    const overview = await getTodayOverview(callerFor(client), { date: '2026-11-15' });
    expect(overview.date).toBe('2026-11-15');
    expect(overview.tasks).toEqual([
      { id: 'task-1', label: 'Call mum', done: false, scope: 'personal', assignedTo: null },
    ]);
    expect(overview.talk.map((t) => t.body)).toEqual(['School fees']);
    expect(overview.calendar.map((e) => e.title)).toEqual(['Soccer']);
    expect(overview.alerts.unreadCount).toBe(1);
    expect(overview.alerts.latest[0]?.title).toBe('New talk item');
    expect(overview.meals.available).toBe(false);
    expect(overview.shopping.available).toBe(false);
    expect(overview.train.available).toBe(false);
    expect(overview.excluded).toContain('private_journal');
  });
});
