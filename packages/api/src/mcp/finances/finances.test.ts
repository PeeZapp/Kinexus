import { describe, expect, it } from 'vitest';

import { assertRegistryAnnotations, MCP_TOOL_REGISTRY } from '../registry.js';
import type { McpCaller } from '../context.js';
import { FINANCES_MCP_TOOLS } from './tools.js';
import { getBudgetMonth, listBudgetTransactions } from './reads.js';
import { commitFinancesPreview, previewAddBudgetTxn } from './writes.js';

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

function financesClient(opts: {
  userId: string;
  householdId: string;
  role?: string;
  lines?: Row[];
  txns?: Row[];
  carries?: Row[];
  events?: Row[];
}) {
  const lines = [...(opts.lines ?? [])];
  const txns = [...(opts.txns ?? [])];
  const carries = [...(opts.carries ?? [])];
  const events = [...(opts.events ?? [])];
  const budgets: Row[] = [
    {
      id: 'bud-1',
      household_id: opts.householdId,
      notes: null,
      setup_completed_at: '2026-01-01',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];
  const previews = previewStore();
  let idSeq = 1;
  const nextId = (p: string) => `${p}-${idSeq++}`;

  function tableApi(rows: Row[]) {
    return {
      select(_cols?: string) {
        const state = { rows: [...rows] };
        const api = {
          eq(f: string, v: unknown) {
            state.rows = state.rows.filter((row) => row[f] === v);
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
          rows.push({ id: item.id ?? nextId('row'), ...item });
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
    };
  }

  return {
    from(table: string) {
      if (table === 'mcp_previews') return previews.from(table);
      if (table === 'mcp_audit_log') {
        return { async insert() { return { error: null }; } };
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
      if (table === 'finance_budgets') return tableApi(budgets);
      if (table === 'finance_budget_lines') return tableApi(lines);
      if (table === 'finance_budget_txns') return tableApi(txns);
      if (table === 'finance_budget_carry') return tableApi(carries);
      if (table === 'finance_budget_carry_events') return tableApi(events);
      throw new Error(`unexpected table ${table}`);
    },
    async rpc(name: string) {
      if (name === 'ensure_finance_budget') return { data: 'bud-1', error: null };
      return { data: null, error: null };
    },
    _txns: txns,
  };
}

function callerFor(client: ReturnType<typeof financesClient>): McpCaller {
  return {
    userId: 'user-a',
    accessToken: 'tok',
    client: client as never,
    clientId: 'client-1',
    clientName: 'test',
    platform: 'other',
    connectionId: 'conn-1',
    scopes: ['finances:read', 'finances:write'],
  };
}

describe('finances MCP', () => {
  it('registers finances tools', () => {
    expect(() => assertRegistryAnnotations(MCP_TOOL_REGISTRY)).not.toThrow();
    expect(FINANCES_MCP_TOOLS.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'get_budget_month',
        'list_budget_transactions',
        'get_budget_carry',
        'preview_add_budget_txn',
        'preview_apply_budget_carry',
        'preview_clear_budget_carry',
        'preview_transfer_budget_carry',
        'list_investment_watchlist',
        'get_investment_item',
        'preview_add_investment_idea',
        'list_trade_journal',
        'preview_add_trade',
        'list_investment_alerts',
      ]),
    );
  });

  it('get_budget_month and list txns, add txn via preview→commit', async () => {
    const client = financesClient({
      userId: 'user-a',
      householdId: 'hh-a',
      lines: [
        {
          id: 'line-1',
          household_id: 'hh-a',
          budget_id: 'bud-1',
          kind: 'expense',
          name: 'Groceries',
          planned: 200,
          spent: 0,
          position: 0,
          cadence: 'monthly',
          anchor_month: 1,
          parent_id: null,
          auto_apply: false,
          auto_applied_month: null,
          capture_surplus: false,
        },
      ],
      txns: [
        {
          id: 'txn-1',
          household_id: 'hh-a',
          budget_id: 'bud-1',
          line_id: 'line-1',
          txn_date: '2026-11-05',
          description: 'Woolies',
          merchant_key: 'WOOLIES',
          amount: -40,
          ignored: false,
          source: 'manual',
          created_by: 'user-a',
        },
      ],
      carries: [],
      events: [],
    });

    const month = await getBudgetMonth(client as never, 'user-a', { month: '2026-11' });
    expect(month.monthStart).toBe('2026-11-01');
    expect(month.categories[0]?.name).toBe('Groceries');
    expect(month.categories[0]?.spent).toBe(40);

    const listed = await listBudgetTransactions(client as never, 'user-a', { month: '2026-11-01' });
    expect(listed.transactions).toHaveLength(1);

    const caller = callerFor(client);
    const preview = await previewAddBudgetTxn(caller, {
      lineId: 'line-1',
      description: 'Coles',
      amount: 25,
      date: '2026-11-10',
      entryKind: 'spend',
      month: '2026-11',
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    const committed = await commitFinancesPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(client._txns.some((t) => t.description === 'Coles' && t.amount === -25)).toBe(true);
  });

  it('denies teen role', async () => {
    const client = financesClient({
      userId: 'user-a',
      householdId: 'hh-a',
      role: 'teen',
      lines: [],
      txns: [],
    });
    await expect(getBudgetMonth(client as never, 'user-a', { month: '2026-11' })).rejects.toThrow(
      /cannot access finances/i,
    );
  });
});
