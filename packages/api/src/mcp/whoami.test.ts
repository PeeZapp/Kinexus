import { describe, expect, it, vi } from 'vitest';

import { runWhoami } from './whoami.js';
import { whoamiTool } from './registry.js';
import type { McpCaller } from './context.js';

function profileClient(rows: {
  userId: string;
  username?: string;
  global_handle?: string;
  householdName?: string;
  role?: string;
}) {
  return {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq(_f: string, id: string) {
                return {
                  async maybeSingle() {
                    if (id !== rows.userId) return { data: null, error: null };
                    return {
                      data: { username: rows.username ?? null, global_handle: rows.global_handle ?? null },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'household_members') {
        return {
          select() {
            return {
              eq(_f: string, id: string) {
                return {
                  order() {
                    return {
                      limit() {
                        return {
                          async maybeSingle() {
                            if (id !== rows.userId) return { data: null, error: null };
                            return {
                              data: {
                                role: rows.role ?? 'adult',
                                households: { name: rows.householdName ?? 'Home' },
                              },
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
      if (table === 'mcp_audit_log') {
        return {
          async insert() {
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected ${table}`);
    },
  };
}

describe('whoami', () => {
  it('returns only the caller handle, household name, and role', async () => {
    const client = profileClient({
      userId: 'user-a',
      username: 'alice',
      householdName: 'Alice House',
      role: 'owner',
    }) as never;
    const result = await runWhoami(client, 'user-a');
    expect(result).toEqual({ handle: 'alice', householdName: 'Alice House', role: 'owner' });
    expect(Object.keys(result).sort()).toEqual(['handle', 'householdName', 'role']);
  });

  it("user A's client cannot read user B household via whoami", async () => {
    const client = profileClient({
      userId: 'user-a',
      username: 'alice',
      householdName: 'Alice House',
      role: 'owner',
    }) as never;
    const forB = await runWhoami(client, 'user-b');
    expect(forB.handle).toBe('user-b');
    expect(forB.householdName).toBe('');
    expect(forB.role).toBe('');
  });

  it('tool handler uses caller user id only', async () => {
    const client = profileClient({
      userId: 'user-a',
      username: 'alice',
      householdName: 'Alice House',
      role: 'admin',
    }) as never;
    const caller = {
      userId: 'user-a',
      accessToken: 'tok',
      client,
      clientId: 'client-a',
      clientName: 'Inspector',
      platform: 'inspector',
      connectionId: 'c1',
      scopes: [],
    } satisfies McpCaller;
    const spy = vi.spyOn(client, 'from');
    const out = await whoamiTool.handler({}, caller);
    expect(out).toEqual({ handle: 'alice', householdName: 'Alice House', role: 'admin' });
    expect(spy).toHaveBeenCalled();
  });
});
