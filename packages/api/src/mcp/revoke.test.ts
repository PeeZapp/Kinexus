import { afterEach, describe, expect, it, vi } from 'vitest';

import * as auth from '../auth.js';
import { handleRevokeMcpConnection } from './connections.js';

describe('mcp revoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks connection revoked and kills the OAuth grant', async () => {
    const state = { revoked: false, grantRevoked: false };
    const client = {
      auth: {
        oauth: {
          revokeGrant: async () => {
            state.grantRevoked = true;
            return { error: null };
          },
        },
      },
      from(table: string) {
        if (table !== 'mcp_connections') throw new Error(table);
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return {
                          data: {
                            id: 'conn-1',
                            client_id: 'client-1',
                            revoked_at: state.revoked ? new Date().toISOString() : null,
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
          update(patch: { revoked_at?: string }) {
            return {
              eq() {
                return {
                  async eq() {
                    if (patch.revoked_at) state.revoked = true;
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      },
    };

    vi.spyOn(auth, 'userFromRequest').mockResolvedValue({ user: { id: 'user-a' } });
    vi.spyOn(auth, 'readBearerToken').mockReturnValue('tok');
    vi.spyOn(auth, 'createUserClient').mockReturnValue(client as never);

    const result = await handleRevokeMcpConnection(
      new Request('http://localhost/mcp/connections/conn-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok' },
      }),
      'conn-1',
    );
    expect(result.status).toBe(200);
    expect(state.revoked).toBe(true);
    expect(state.grantRevoked).toBe(true);
  });
});
