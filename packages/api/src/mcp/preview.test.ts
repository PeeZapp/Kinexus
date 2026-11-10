import { beforeEach, describe, expect, it, vi } from 'vitest';

import { commitWritePreview, createWritePreview, hashPreviewPayload } from './preview.js';

function mockClient(store: Map<string, Record<string, unknown>>) {
  return {
    from(table: string) {
      if (table !== 'mcp_previews') throw new Error(`unexpected table ${table}`);
      return {
        insert(row: Record<string, unknown>) {
          store.set(String(row.id), { ...row, committed_at: null });
          return {
            then: undefined,
            error: null,
          };
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
        update(patch: Record<string, unknown>) {
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
                              for (const [id, row] of store.entries()) {
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

describe('mcp write preview/commit', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('rejects commit without a valid preview', async () => {
    const store = new Map<string, Record<string, unknown>>();
    const client = mockClient(store) as never;
    const missing = await commitWritePreview(client, {
      userId: 'u1',
      previewId: 'missing',
      tool: 'add_meal',
    });
    expect(missing).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects expired and mismatched previews', async () => {
    const store = new Map<string, Record<string, unknown>>();
    const client = mockClient(store) as never;
    const { previewId } = await createWritePreview(client, {
      userId: 'u1',
      householdId: 'h1',
      tool: 'add_meal',
      payload: { title: 'Soup' },
    });

    const mismatch = await commitWritePreview(client, {
      userId: 'u1',
      previewId,
      tool: 'other_tool',
    });
    expect(mismatch).toEqual({ ok: false, reason: 'mismatched' });

    const payloadMismatch = await commitWritePreview(client, {
      userId: 'u1',
      previewId,
      tool: 'add_meal',
      payload: { title: 'Different' },
    });
    expect(payloadMismatch).toEqual({ ok: false, reason: 'mismatched' });

    const row = store.get(previewId)!;
    row.expires_at = new Date(Date.now() - 1000).toISOString();
    const expired = await commitWritePreview(client, {
      userId: 'u1',
      previewId,
      tool: 'add_meal',
      payload: { title: 'Soup' },
    });
    expect(expired).toEqual({ ok: false, reason: 'expired' });
  });

  it('commits a matching preview once', async () => {
    const store = new Map<string, Record<string, unknown>>();
    const client = mockClient(store) as never;
    const payload = { title: 'Soup' };
    const { previewId } = await createWritePreview(client, {
      userId: 'u1',
      householdId: 'h1',
      tool: 'add_meal',
      payload,
    });
    const first = await commitWritePreview(client, {
      userId: 'u1',
      previewId,
      tool: 'add_meal',
      payload,
    });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.preview.committed_at).toBeTruthy();

    const second = await commitWritePreview(client, {
      userId: 'u1',
      previewId,
      tool: 'add_meal',
      payload,
    });
    expect(second).toEqual({ ok: false, reason: 'already_committed' });
    expect(hashPreviewPayload(payload)).toHaveLength(64);
  });
});
