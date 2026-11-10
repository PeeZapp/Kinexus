import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRegistryAnnotations, MCP_TOOL_REGISTRY } from '../registry.js';
import { commitWritePreview, createWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import { recipeNutrition, recipesShareKeyIngredients, titleMatches } from './shared.js';
import {
  commitMealsPreview,
  previewCreateRecipe,
  previewAddMeal,
} from './writes.js';
import { getRecipe, getPantry, searchRecipes } from './reads.js';
import { MEALS_MCP_TOOLS } from './tools.js';

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

function mealsClient(opts: {
  userId: string;
  householdId: string;
  role?: string;
  recipes?: Row[];
  slots?: Row[];
  plans?: Row[];
  otherHouseholdId?: string;
}) {
  const recipes = [...(opts.recipes ?? [])];
  const slots = [...(opts.slots ?? [])];
  const plans = [...(opts.plans ?? [])];
  const previews = previewStore();
  const audit: Row[] = [];
  const shopping: Row[] = [];

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
      if (table === 'recipes') {
        return {
          select() {
            const filters: { field: string; value: unknown; op: string }[] = [];
            const api = {
              or() {
                return api;
              },
              eq(field: string, value: unknown) {
                filters.push({ field, value, op: 'eq' });
                return api;
              },
              ilike(field: string, value: string) {
                filters.push({ field, value: String(value).replace(/%/g, '').toLowerCase(), op: 'ilike' });
                return api;
              },
              order() {
                return api;
              },
              limit() {
                return api;
              },
              async maybeSingle() {
                const idFilter = filters.find((f) => f.field === 'id');
                const row = recipes.find((r) => r.id === idFilter?.value);
                if (!row) return { data: null, error: null };
                if (row.household_id && row.household_id !== opts.householdId && row.household_id !== null) {
                  return { data: null, error: null };
                }
                return { data: row, error: null };
              },
              then(resolve: (v: { data: Row[]; error: null }) => void) {
                let rows = recipes.filter(
                  (r) => r.household_id === opts.householdId || r.household_id == null,
                );
                for (const f of filters) {
                  if (f.op === 'eq' && f.field === 'removed') rows = rows.filter((r) => Boolean(r.removed) === f.value);
                  if (f.op === 'ilike' && f.field === 'name') {
                    rows = rows.filter((r) => String(r.name).toLowerCase().includes(String(f.value)));
                  }
                }
                resolve({ data: rows, error: null });
              },
            };
            return api;
          },
          insert(row: Row) {
            const saved = { ...row, id: row.id ?? `recipe-${recipes.length + 1}` };
            recipes.push(saved);
            return {
              select() {
                return {
                  async single() {
                    return { data: saved, error: null };
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
                      select() {
                        return {
                          async maybeSingle() {
                            const idx = recipes.findIndex((r) => r[field] === value && r[field2] === value2);
                            if (idx < 0) return { data: null, error: null };
                            recipes[idx] = { ...recipes[idx], ...patch };
                            return { data: recipes[idx], error: null };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          delete() {
            return {
              eq(field: string, value: string) {
                return {
                  eq(field2: string, value2: string) {
                    const before = recipes.length;
                    for (let i = recipes.length - 1; i >= 0; i--) {
                      if (recipes[i]![field] === value && recipes[i]![field2] === value2) recipes.splice(i, 1);
                    }
                    return { error: before === recipes.length ? null : null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'meal_plans') {
        return {
          select() {
            return {
              eq(field: string, value: string) {
                return {
                  eq(field2: string, value2: string) {
                    return {
                      async maybeSingle() {
                        const row = plans.find((p) => p[field] === value && p[field2] === value2);
                        return { data: row ?? null, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'meal_slots') {
        return {
          select() {
            const filters: { field: string; value: unknown }[] = [];
            const api = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return api;
              },
              then(resolve: (v: { data: Row[]; error: null }) => void) {
                let rows = slots;
                for (const f of filters) rows = rows.filter((r) => r[f.field] === f.value);
                resolve({ data: rows, error: null });
              },
            };
            return api;
          },
          insert(row: Row) {
            const saved = { ...row, id: row.id ?? `slot-${slots.length + 1}` };
            slots.push(saved);
            return {
              select() {
                return {
                  async single() {
                    return { data: saved, error: null };
                  },
                };
              },
            };
          },
          update(patch: Row) {
            return {
              eq(field: string, value: string) {
                return {
                  eq(field2?: string, value2?: string) {
                    const apply = () => {
                      const idx = slots.findIndex((r) => {
                        if (r[field] !== value) return false;
                        if (field2) return r[field2!] === value2;
                        return true;
                      });
                      if (idx < 0) return null;
                      slots[idx] = { ...slots[idx], ...patch };
                      return slots[idx];
                    };
                    if (field2) {
                      return {
                        select() {
                          return {
                            async maybeSingle() {
                              return { data: apply(), error: null };
                            },
                          };
                        },
                      };
                    }
                    return {
                      select() {
                        return {
                          async maybeSingle() {
                            return { data: apply(), error: null };
                          },
                        };
                      },
                      async then(resolve: (v: { error: null }) => void) {
                        apply();
                        resolve({ error: null });
                      },
                    };
                  },
                  select() {
                    return {
                      async maybeSingle() {
                        const idx = slots.findIndex((r) => r[field] === value);
                        if (idx < 0) return { data: null, error: null };
                        slots[idx] = { ...slots[idx], ...patch };
                        return { data: slots[idx], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'shopping_items') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      order() {
                        return {
                          then(resolve: (v: { data: Row[]; error: null }) => void) {
                            resolve({ data: shopping, error: null });
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          insert(row: Row) {
            const saved = { ...row, id: `shop-${shopping.length + 1}` };
            shopping.push(saved);
            return {
              select() {
                return {
                  async single() {
                    return { data: saved, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'household_person_slot_recipes') {
        return {
          select() {
            return {
              eq() {
                return {
                  then(resolve: (v: { data: Row[]; error: null }) => void) {
                    resolve({ data: [], error: null });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc(name: string, args: Row) {
      if (name !== 'get_or_create_meal_plan') throw new Error(name);
      const weekStart = args.p_week_start;
      let plan = plans.find((p) => p.household_id === opts.householdId && p.week_start === weekStart);
      if (!plan) {
        plan = { id: `plan-${plans.length + 1}`, household_id: opts.householdId, week_start: weekStart };
        plans.push(plan);
      }
      return Promise.resolve({ data: plan.id, error: null });
    },
    _recipes: recipes,
    _slots: slots,
    _audit: audit,
    _previews: previews.store,
  };

  return client;
}

function callerFor(client: ReturnType<typeof mealsClient>, userId = 'user-a'): McpCaller {
  return {
    userId,
    accessToken: 'tok',
    client: client as never,
    clientId: 'client-a',
    clientName: 'Inspector',
    platform: 'inspector',
    connectionId: 'c1',
    scopes: ['meals:read', 'meals:write'],
  };
}

describe('meals MCP tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers title + annotations for every meals tool', () => {
    expect(() => assertRegistryAnnotations(MCP_TOOL_REGISTRY)).not.toThrow();
    expect(MEALS_MCP_TOOLS.length).toBeGreaterThan(10);
    for (const tool of MEALS_MCP_TOOLS) {
      expect(tool.title.trim().length).toBeGreaterThan(0);
      expect(tool.annotations).toEqual(
        expect.objectContaining({
          readOnlyHint: expect.any(Boolean),
          destructiveHint: expect.any(Boolean),
          openWorldHint: expect.any(Boolean),
        }),
      );
    }
  });

  it('labels stored vs estimate nutrition and never invents when uncovered', () => {
    expect(
      recipeNutrition({
        calories: 400,
        protein: 30,
        carbs: 20,
        fat: 10,
        servings: 2,
        ingredients: [],
      }),
    ).toMatchObject({ source: 'stored', calories: 400 });

    const estimate = recipeNutrition({
      ingredients: [
        { name: 'chicken breast', amount: '200g' },
        { name: 'rice', amount: '100g' },
      ],
      servings: 2,
    });
    expect(estimate.source).toBe('estimate');

    const missing = recipeNutrition({
      ingredients: [{ name: 'mystery dust from mars', amount: '1 pinch' }],
      servings: 1,
    });
    expect(missing).toEqual({
      source: 'missing',
      message: 'Nutrition is not stored and could not be estimated',
    });
  });

  it('dedupes by title + key ingredients', () => {
    expect(titleMatches('Chicken Stir Fry', 'chicken stir-fry')).toBe(true);
    expect(
      recipesShareKeyIngredients(
        [
          { name: 'chicken breast' },
          { name: 'soy sauce' },
          { name: 'broccoli' },
        ],
        [
          { name: 'chicken breasts' },
          { name: 'soy sauce' },
          { name: 'broccolini' },
        ],
      ),
    ).toBe(true);
  });

  it('preview→commit create_recipe with no plan', async () => {
    const client = mealsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      recipes: [],
    });
    const caller = callerFor(client);
    const preview = await previewCreateRecipe(caller, {
      name: 'Bean Tacos',
      ingredients: [
        { name: 'black beans', amount: '1 can' },
        { name: 'tortillas', amount: '8' },
      ],
      method: ['Warm tortillas', 'Fill with beans'],
      decision: 'create_new',
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    expect(preview.steps.some((s) => s.includes('Create household recipe'))).toBe(true);

    const committed = await commitMealsPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(committed.affectedIds.length).toBe(1);
    expect(client._recipes[0]?.name).toBe('Bean Tacos');
    expect(client._recipes[0]?.household_id).toBe('hh-a');
    expect(client._recipes[0]?.is_public).toBe(false);
  });

  it('preview→commit combined recipe + plan in one confirmation', async () => {
    const client = mealsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      recipes: [],
      plans: [],
      slots: [],
    });
    const caller = callerFor(client);
    const preview = await previewCreateRecipe(caller, {
      name: 'Tuesday Pasta',
      ingredients: [
        { name: 'pasta', amount: '400g' },
        { name: 'tomato', amount: '2' },
      ],
      method: ['Boil', 'Sauce'],
      decision: 'create_new',
      plan: [{ date: '2026-11-10', slotKey: 'dinner' }],
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    expect(preview.summary.toLowerCase()).toContain('add to');
    expect(preview.steps.length).toBeGreaterThan(1);

    const committed = await commitMealsPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(client._recipes[0]?.name).toBe('Tuesday Pasta');
    expect(client._slots.some((s) => s.slot_key === 'dinner' && s.recipe_name === 'Tuesday Pasta')).toBe(true);
  });

  it('rejects stale or mismatched preview on commit', async () => {
    const client = mealsClient({ userId: 'user-a', householdId: 'hh-a' });
    const caller = callerFor(client);
    const { previewId } = await createWritePreview(caller.client, {
      userId: caller.userId,
      householdId: 'hh-a',
      tool: 'preview_create_recipe',
      payload: {
        action: 'create_recipe',
        draft: { name: 'Soup', ingredients: [], method: [] },
      },
    });

    const mismatch = await commitWritePreview(caller.client, {
      userId: caller.userId,
      previewId,
      tool: 'preview_delete_recipe',
    });
    expect(mismatch).toEqual({ ok: false, reason: 'mismatched' });

    const missing = await commitMealsPreview(caller, { previewId: 'nope' }).catch((err: Error) => err);
    expect(missing).toBeInstanceOf(Error);
    expect(String(missing)).toMatch(/Preview missing|Preview mismatched|Preview expired/i);
  });

  it('returns dedupe candidates instead of creating immediately', async () => {
    const client = mealsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      recipes: [
        {
          id: 'r1',
          household_id: 'hh-a',
          name: 'Chicken Stir Fry',
          ingredients: [
            { name: 'chicken breast' },
            { name: 'soy sauce' },
            { name: 'broccoli' },
          ],
          method: [],
          meal_slots: ['dinner'],
          removed: false,
          is_public: false,
        },
      ],
    });
    const caller = callerFor(client);
    const preview = await previewCreateRecipe(caller, {
      name: 'Chicken Stir Fry',
      ingredients: [
        { name: 'chicken breasts' },
        { name: 'soy sauce' },
        { name: 'broccoli' },
      ],
      method: ['Stir'],
    });
    expect(preview.kind).toBe('dedupe');
    if (preview.kind !== 'dedupe') return;
    expect(preview.candidates[0]?.id).toBe('r1');
  });

  it('blocks overwrite of filled slots unless preview says so', async () => {
    const client = mealsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      recipes: [
        {
          id: 'r-new',
          household_id: 'hh-a',
          name: 'New Dish',
          ingredients: [],
          method: [],
          meal_slots: ['dinner'],
          removed: false,
        },
      ],
      plans: [{ id: 'plan-1', household_id: 'hh-a', week_start: '2026-11-09' }],
      slots: [
        {
          id: 'slot-1',
          meal_plan_id: 'plan-1',
          household_id: 'hh-a',
          day: 'tuesday',
          slot_key: 'dinner',
          recipe_id: 'r-old',
          recipe_name: 'Leftovers',
          audience_person_ids: [],
          hidden: false,
        },
      ],
    });
    const caller = callerFor(client);
    const blocked = await previewAddMeal(caller, {
      date: '2026-11-10',
      slotKey: 'dinner',
      recipeId: 'r-new',
    });
    expect(blocked.kind).toBe('blocked');

    const allowed = await previewAddMeal(caller, {
      date: '2026-11-10',
      slotKey: 'dinner',
      recipeId: 'r-new',
      overwrite: true,
    });
    expect(allowed.kind).toBe('preview');
    if (allowed.kind !== 'preview') return;
    expect(allowed.steps.some((s) => s.includes('overwrite'))).toBe(true);
  });

  it('get_recipe returns not-found for another household (RLS-shaped client)', async () => {
    const client = mealsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      recipes: [
        {
          id: 'secret',
          household_id: 'hh-b',
          name: 'Private',
          ingredients: [],
          method: [],
          meal_slots: [],
          removed: false,
        },
      ],
    });
    await expect(getRecipe(client as never, 'user-a', 'secret')).rejects.toThrow(/not found/i);
  });

  it('user A search does not surface household B recipes', async () => {
    const client = mealsClient({
      userId: 'user-a',
      householdId: 'hh-a',
      recipes: [
        {
          id: 'a1',
          household_id: 'hh-a',
          name: 'Ours',
          ingredients: [],
          method: [],
          meal_slots: [],
          removed: false,
        },
        {
          id: 'b1',
          household_id: 'hh-b',
          name: 'Theirs',
          ingredients: [],
          method: [],
          meal_slots: [],
          removed: false,
        },
      ],
    });
    const result = await searchRecipes(client as never, 'user-a', { query: '' });
    expect(result.recipes.map((r) => r.id)).toEqual(['a1']);
  });

  it('get_pantry reports device-local unavailability', async () => {
    await expect(getPantry()).resolves.toMatchObject({ available: false });
  });
});
