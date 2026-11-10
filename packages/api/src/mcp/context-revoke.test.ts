import { afterEach, describe, expect, it, vi } from 'vitest';

import * as auth from '../auth.js';
import { resolveMcpCaller } from './context.js';

describe('resolveMcpCaller revoke gate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects tokens for a revoked connection', async () => {
    const token = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'user-a', client_id: 'client-1' })).toString('base64url'),
      'sig',
    ].join('.');

    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }),
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
                            client_name: 'Claude',
                            platform: 'claude',
                            scopes: [],
                            revoked_at: new Date().toISOString(),
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

    vi.spyOn(auth, 'readBearerToken').mockReturnValue(token);
    vi.spyOn(auth, 'createUserClient').mockReturnValue(client as never);

    const resolved = await resolveMcpCaller(
      new Request('http://localhost/ai/mcp', { headers: { Authorization: `Bearer ${token}` } }),
    );
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.status).toBe(401);
      expect(resolved.error).toMatch(/revoked/i);
    }
  });
});
