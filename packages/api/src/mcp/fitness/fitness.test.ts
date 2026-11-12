import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRegistryAnnotations, MCP_TOOL_REGISTRY } from '../registry.js';
import { commitWritePreview, createWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import { commitTool } from '../commit-tool.js';
import { FITNESS_MCP_TOOLS } from './tools.js';
import {
  commitFitnessPreview,
  previewCreateCustomExercise,
  previewCreateTrainingPlan,
  previewCreateWorkout,
  previewFillPlanDay,
} from './writes.js';
import { getWorkout, listWorkouts } from './reads.js';

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

function fitnessClient(opts: {
  userId: string;
  householdId: string;
  role?: string;
  approvedCreator?: boolean;
  workouts?: Row[];
  workoutExercises?: Row[];
  exercises?: Row[];
  plans?: Row[];
  planDays?: Row[];
  sessions?: Row[];
}) {
  const workouts = [...(opts.workouts ?? [])];
  const workoutExercises = [...(opts.workoutExercises ?? [])];
  const exercises = [...(opts.exercises ?? [])];
  const plans = [...(opts.plans ?? [])];
  const planDays = [...(opts.planDays ?? [])];
  const sessions = [...(opts.sessions ?? [])];
  const previews = previewStore();
  const audit: Row[] = [];
  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

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
      if (table === 'workouts') {
        return {
          select(_cols?: string) {
            const filters: { field: string; value: unknown }[] = [];
            const api = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return api;
              },
              ilike(field: string, value: string) {
                filters.push({ field, value: String(value).replace(/%/g, '') });
                return api;
              },
              order() {
                return api;
              },
              limit() {
                return api;
              },
              in(field: string, values: string[]) {
                filters.push({ field, value: values });
                return {
                  async then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                    return resolve({
                      data: workouts.filter((w) => (values as string[]).includes(String(w.id))),
                      error: null,
                    });
                  },
                };
              },
              async maybeSingle() {
                let rows = [...workouts];
                for (const f of filters) {
                  rows = rows.filter((r) => r[f.field] === f.value || String(r[f.field] ?? '').toLowerCase().includes(String(f.value).toLowerCase()));
                }
                const row = rows[0];
                if (!row) return { data: null, error: null };
                return {
                  data: {
                    ...row,
                    workout_exercises: workoutExercises.filter((ex) => ex.workout_id === row.id),
                  },
                  error: null,
                };
              },
              then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                let rows = [...workouts];
                for (const f of filters) {
                  if (Array.isArray(f.value)) {
                    rows = rows.filter((r) => (f.value as unknown[]).includes(r[f.field]));
                  } else if (f.field === 'name') {
                    rows = rows.filter((r) =>
                      String(r.name ?? '')
                        .toLowerCase()
                        .includes(String(f.value).toLowerCase()),
                    );
                  } else {
                    rows = rows.filter((r) => r[f.field] === f.value);
                  }
                }
                return Promise.resolve(
                  resolve({
                    data: rows.map((row) => ({
                      ...row,
                      workout_exercises: workoutExercises.filter((ex) => ex.workout_id === row.id),
                    })),
                    error: null,
                  }),
                );
              },
            };
            return api;
          },
          insert(row: Row) {
            const id = nextId('w');
            const full = { ...row, id, updated_at: new Date().toISOString() };
            workouts.push(full);
            return {
              select() {
                return {
                  async single() {
                    return { data: full, error: null };
                  },
                };
              },
            };
          },
          update(patch: Row) {
            return {
              eq(field: string, value: unknown) {
                return {
                  eq(field2: string, value2: unknown) {
                    for (const row of workouts) {
                      if (row[field] === value && row[field2] === value2) Object.assign(row, patch);
                    }
                    return { error: null };
                  },
                  then(resolve: (v: { error: null }) => unknown) {
                    for (const row of workouts) {
                      if (row[field] === value) Object.assign(row, patch);
                    }
                    return Promise.resolve(resolve({ error: null }));
                  },
                };
              },
            };
          },
          delete() {
            return {
              eq(field: string, value: unknown) {
                return {
                  eq(field2: string, value2: unknown) {
                    return {
                      select() {
                        const kept: Row[] = [];
                        const removed: Row[] = [];
                        for (const row of workouts) {
                          if (row[field] === value && row[field2] === value2) removed.push(row);
                          else kept.push(row);
                        }
                        workouts.length = 0;
                        workouts.push(...kept);
                        return Promise.resolve({ data: removed.map((r) => ({ id: r.id })), error: null });
                      },
                    };
                  },
                  select() {
                    const kept: Row[] = [];
                    const removed: Row[] = [];
                    for (const row of workouts) {
                      if (row[field] === value) removed.push(row);
                      else kept.push(row);
                    }
                    workouts.length = 0;
                    workouts.push(...kept);
                    return Promise.resolve({ data: removed.map((r) => ({ id: r.id })), error: null });
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'workout_exercises') {
        return {
          delete() {
            return {
              eq(field: string, value: unknown) {
                const kept = workoutExercises.filter((row) => row[field] !== value);
                workoutExercises.length = 0;
                workoutExercises.push(...kept);
                return Promise.resolve({ error: null });
              },
            };
          },
          async insert(rows: Row | Row[]) {
            const list = Array.isArray(rows) ? rows : [rows];
            for (const row of list) {
              workoutExercises.push({ ...row, id: nextId('we') });
            }
            return { error: null };
          },
        };
      }
      if (table === 'exercises') {
        return {
          select(_cols?: string) {
            const filters: { field: string; value: unknown; op?: string }[] = [];
            const api = {
              is(field: string, value: null) {
                filters.push({ field, value, op: 'is' });
                return api;
              },
              eq(field: string, value: unknown) {
                filters.push({ field, value, op: 'eq' });
                return api;
              },
              ilike(field: string, value: string) {
                filters.push({ field, value: String(value).replace(/%/g, ''), op: 'ilike' });
                return api;
              },
              order() {
                return api;
              },
              limit() {
                return api;
              },
              range() {
                return Promise.resolve({ data: applyExerciseFilters(), error: null });
              },
              async maybeSingle() {
                const rows = applyExerciseFilters();
                return { data: rows[0] ?? null, error: null };
              },
              then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                return Promise.resolve(resolve({ data: applyExerciseFilters(), error: null }));
              },
            };
            function applyExerciseFilters() {
              let rows = [...exercises];
              for (const f of filters) {
                if (f.op === 'is') rows = rows.filter((r) => r[f.field] == null);
                else if (f.op === 'ilike') {
                  rows = rows.filter((r) =>
                    String(r[f.field] ?? '')
                      .toLowerCase()
                      .includes(String(f.value).toLowerCase()),
                  );
                } else rows = rows.filter((r) => r[f.field] === f.value);
              }
              return rows;
            }
            return api;
          },
          insert(row: Row) {
            const id = nextId('ex');
            const full = { ...row, id, status: 'active', merged_into: null };
            exercises.push(full);
            return {
              select() {
                return {
                  async single() {
                    return { data: full, error: null };
                  },
                };
              },
            };
          },
          update(patch: Row) {
            return {
              eq(field: string, value: unknown) {
                for (const row of exercises) {
                  if (row[field] === value) Object.assign(row, patch);
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === 'training_plans') {
        return {
          select(_cols?: string) {
            const filters: { field: string; value: unknown }[] = [];
            const api = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return api;
              },
              order() {
                return api;
              },
              limit() {
                return api;
              },
              async maybeSingle() {
                let rows = [...plans];
                for (const f of filters) rows = rows.filter((r) => r[f.field] === f.value);
                const row = rows[0];
                if (!row) return { data: null, error: null };
                return {
                  data: {
                    ...row,
                    training_plan_days: planDays.filter((d) => d.plan_id === row.id),
                  },
                  error: null,
                };
              },
              then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                let rows = [...plans];
                for (const f of filters) rows = rows.filter((r) => r[f.field] === f.value);
                return Promise.resolve(
                  resolve({
                    data: rows.map((row) => ({
                      ...row,
                      training_plan_days: planDays.filter((d) => d.plan_id === row.id),
                    })),
                    error: null,
                  }),
                );
              },
            };
            return api;
          },
          insert(row: Row) {
            const id = typeof row.id === 'string' ? row.id : nextId('plan');
            const full = { ...row, id };
            plans.push(full);
            return {
              select() {
                return {
                  async single() {
                    return { data: { id }, error: null };
                  },
                };
              },
              then(resolve: (v: { error: null }) => unknown) {
                return Promise.resolve(resolve({ error: null }));
              },
            };
          },
          delete() {
            return {
              eq(field: string, value: unknown) {
                const kept = plans.filter((p) => p[field] !== value);
                plans.length = 0;
                plans.push(...kept);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === 'training_plan_days') {
        return {
          select(_cols?: string) {
            const filters: { field: string; value: unknown }[] = [];
            const api = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return api;
              },
              in(field: string, values: string[]) {
                return {
                  then(resolve: (v: { error: null }) => unknown) {
                    for (const row of planDays) {
                      if ((values as string[]).includes(String(row[field]))) {
                        // no-op for mark
                      }
                    }
                    return Promise.resolve(resolve({ error: null }));
                  },
                };
              },
              async maybeSingle() {
                let rows = [...planDays];
                for (const f of filters) rows = rows.filter((r) => r[f.field] === f.value);
                return { data: rows[0] ?? null, error: null };
              },
              then(resolve: (v: { data: Row[]; error: null }) => unknown) {
                let rows = [...planDays];
                for (const f of filters) rows = rows.filter((r) => r[f.field] === f.value);
                return Promise.resolve(resolve({ data: rows, error: null }));
              },
            };
            return api;
          },
          insert(row: Row | Row[]) {
            const list = Array.isArray(row) ? row : [row];
            for (const item of list) {
              planDays.push({ ...item, id: typeof item.id === 'string' ? item.id : nextId('day') });
            }
            return {
              select() {
                return {
                  async maybeSingle() {
                    return { data: planDays[planDays.length - 1] ?? null, error: null };
                  },
                  async single() {
                    return { data: planDays[planDays.length - 1] ?? null, error: null };
                  },
                };
              },
              then(resolve: (v: { error: null }) => unknown) {
                return Promise.resolve(resolve({ error: null }));
              },
            };
          },
          update(patch: Row) {
            return {
              eq(field: string, value: unknown) {
                return {
                  select() {
                    return {
                      async maybeSingle() {
                        const row = planDays.find((d) => d[field] === value);
                        if (!row) return { data: null, error: null };
                        Object.assign(row, patch);
                        return { data: row, error: null };
                      },
                    };
                  },
                  in(field2: string, values: string[]) {
                    for (const row of planDays) {
                      if ((values as string[]).includes(String(row[field2]))) Object.assign(row, patch);
                    }
                    return Promise.resolve({ error: null });
                  },
                  then(resolve: (v: { error: null }) => unknown) {
                    for (const row of planDays) {
                      if (row[field] === value) Object.assign(row, patch);
                    }
                    return Promise.resolve(resolve({ error: null }));
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'workout_sessions') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      not() {
                        return {
                          order() {
                            return {
                              limit() {
                                return Promise.resolve({ data: sessions, error: null });
                              },
                            };
                          },
                        };
                      },
                      async maybeSingle() {
                        return { data: sessions[0] ?? null, error: null };
                      },
                    };
                  },
                  async maybeSingle() {
                    return { data: sessions[0] ?? null, error: null };
                  },
                };
              },
            };
          },
          insert(row: Row) {
            const id = nextId('sess');
            const full = { ...row, id };
            sessions.push(full);
            return {
              select() {
                return {
                  async single() {
                    return { data: full, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'workout_sets') {
        return {
          async insert() {
            return { error: null };
          },
        };
      }
      if (table === 'training_plan_buddy_shares') {
        return {
          async insert() {
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    async rpc(name: string, args: Row) {
      if (name === 'is_approved_creator') {
        return { data: Boolean(opts.approvedCreator), error: null };
      }
      if (name === 'create_private_workout') {
        const id = nextId('w');
        workouts.push({
          id,
          household_id: args.p_household_id,
          created_by: opts.userId,
          name: args.p_name,
          visibility: 'private',
          duration_min: args.p_duration_min,
          plan_only: false,
          updated_at: new Date().toISOString(),
        });
        return { data: id, error: null };
      }
      if (name === 'create_training_plan') {
        const id = nextId('plan');
        plans.push({
          id,
          household_id: args.p_household_id,
          owner_id: opts.userId,
          name: args.p_name,
          week_start: args.p_week_start,
          visibility: args.p_visibility ?? 'private',
          prefs: args.p_prefs ?? {},
        });
        return { data: id, error: null };
      }
      if (name === 'save_workout_to_library') {
        for (const row of workouts) {
          if (row.id === args.p_workout_id) row.plan_only = false;
        }
        return { data: null, error: null };
      }
      if (name === 'publish_global_exercise') {
        if (!opts.approvedCreator) {
          return { data: null, error: { message: 'Only approved creators can publish exercises' } };
        }
        const id = nextId('exg');
        exercises.push({
          id,
          name: 'Published',
          scope: 'global',
          source: 'creator',
          status: 'active',
          merged_into: null,
          body_part: 'other',
          equipment: 'body weight',
          target_muscle: 'other',
          category: null,
        });
        return { data: id, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${name}` } };
    },
    _workouts: workouts,
    _workoutExercises: workoutExercises,
    _exercises: exercises,
    _plans: plans,
    _planDays: planDays,
    _audit: audit,
    _previews: previews.store,
  };

  return client;
}

function callerFor(client: ReturnType<typeof fitnessClient>, userId = 'user-a'): McpCaller {
  return {
    userId,
    accessToken: 'tok',
    client: client as never,
    clientId: 'client-a',
    clientName: 'Inspector',
    platform: 'inspector',
    connectionId: 'c1',
    scopes: ['fitness:read', 'fitness:write', 'meals:read', 'meals:write'],
  };
}

describe('fitness MCP tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers title + annotations for every fitness tool', () => {
    expect(() => assertRegistryAnnotations(MCP_TOOL_REGISTRY)).not.toThrow();
    expect(FITNESS_MCP_TOOLS.length).toBeGreaterThan(15);
    for (const tool of FITNESS_MCP_TOOLS) {
      expect(tool.title.trim().length).toBeGreaterThan(0);
      expect(tool.annotations).toEqual(
        expect.objectContaining({
          readOnlyHint: expect.any(Boolean),
          destructiveHint: expect.any(Boolean),
          openWorldHint: expect.any(Boolean),
        }),
      );
      expect(tool.scope === 'fitness:read' || tool.scope === 'fitness:write').toBe(true);
    }
    expect(commitTool.name).toBe('commit');
    expect(commitTool.annotations).toBeTruthy();
  });

  it('create_workout with no plan lands in the library (plan_only false)', async () => {
    const client = fitnessClient({
      userId: 'user-a',
      householdId: 'hh-a',
      exercises: [
        {
          id: 'ex-1',
          name: 'Bench Press',
          status: 'active',
          merged_into: null,
          scope: 'global',
          source: 'kinexus',
          body_part: 'chest',
          equipment: 'barbell',
          target_muscle: 'pectorals',
          category: null,
        },
      ],
    });
    const caller = callerFor(client);
    const preview = await previewCreateWorkout(caller, {
      name: 'Push Day',
      exercises: [{ name: 'Bench Press', targetSets: 3, targetReps: '8', intensity: 'medium' }],
      decision: 'create_new',
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    const committed = await commitFitnessPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(client._workouts[0]?.plan_only).toBe(false);
    expect(client._workouts[0]?.visibility).toBe('private');
    expect(client._workoutExercises.length).toBe(1);
    expect(client._workoutExercises[0]?.target_effort).toBe('moderate');
  });

  it('create workout accepts unit/amount/distance_km targets', async () => {
    const client = fitnessClient({
      userId: 'user-a',
      householdId: 'hh-a',
      exercises: [
        {
          id: 'ex-walk',
          name: 'Treadmill Walk',
          status: 'active',
          merged_into: null,
          scope: 'global',
          source: 'kinexus',
          body_part: 'cardio',
          equipment: 'machine',
          target_muscle: 'cardiovascular system',
          category: 'Cardio',
        },
      ],
    });
    const caller = callerFor(client);
    const preview = await previewCreateWorkout(caller, {
      name: 'Walk Day',
      exercises: [{ name: 'Treadmill Walk', unit: 'min', amount: 45, distance_km: 5 }],
      decision: 'create_new',
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    expect(preview.steps.some((step) => /45 min.*5 km/i.test(step))).toBe(true);
    const committed = await commitFitnessPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(client._workoutExercises[0]).toMatchObject({
      tracking: 'time',
      target_unit: 'min',
      target_duration_sec: 2700,
      target_distance_km: 5,
    });
  });

  it('create_training_plan creates intent days with no workouts', async () => {
    const client = fitnessClient({ userId: 'user-a', householdId: 'hh-a' });
    const caller = callerFor(client);
    const preview = await previewCreateTrainingPlan(caller, {
      name: 'Week A',
      weekStart: '2026-11-09',
      days: ['monday', 'wednesday', 'friday'],
      durationMin: 40,
      goal: 'hypertrophy',
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    expect(preview.summary.toLowerCase()).toContain('no workouts');
    const committed = await commitFitnessPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(client._plans).toHaveLength(1);
    expect(client._workouts).toHaveLength(0);
    const activeDays = client._planDays.filter((d) => !d.rest_day);
    expect(activeDays.length).toBe(3);
    expect(activeDays.every((d) => d.workout_id == null)).toBe(true);
    expect(activeDays.every((d) => Array.isArray(d.focus) && d.focus.length > 0)).toBe(true);
  });

  it('fill_plan_day creates a plan_only workout for that day only', async () => {
    const client = fitnessClient({
      userId: 'user-a',
      householdId: 'hh-a',
      plans: [{ id: 'plan-1', household_id: 'hh-a', owner_id: 'user-a', name: 'Plan', week_start: '2026-11-09' }],
      planDays: [
        {
          id: 'day-1',
          plan_id: 'plan-1',
          day: 'monday',
          position: 0,
          rest_day: false,
          focus: ['Upper Push'],
          duration_min: 40,
          workout_id: null,
          status: 'planned',
        },
        {
          id: 'day-2',
          plan_id: 'plan-1',
          day: 'tuesday',
          position: 1,
          rest_day: false,
          focus: ['Walk'],
          duration_min: 30,
          workout_id: null,
          status: 'planned',
        },
      ],
      exercises: [
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `c${i}`,
          name: `Bench ${i}`,
          status: 'active',
          merged_into: null,
          scope: 'global',
          source: 'kinexus',
          body_part: 'chest',
          equipment: 'dumbbell',
          target_muscle: 'pectorals',
          category: 'Chest',
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `s${i}`,
          name: `Raise ${i}`,
          status: 'active',
          merged_into: null,
          scope: 'global',
          source: 'kinexus',
          body_part: 'shoulders',
          equipment: 'dumbbell',
          target_muscle: 'delts',
          category: 'Shoulders',
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `t${i}`,
          name: `Pushdown ${i}`,
          status: 'active',
          merged_into: null,
          scope: 'global',
          source: 'kinexus',
          body_part: 'upper arms',
          equipment: 'cable',
          target_muscle: 'triceps',
          category: 'Triceps',
        })),
      ],
    });
    const caller = callerFor(client);
    const preview = await previewFillPlanDay(caller, { dayId: 'day-1' });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    const committed = await commitFitnessPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(client._workouts).toHaveLength(1);
    expect(client._workouts[0]?.plan_only).toBe(true);
    const monday = client._planDays.find((d) => d.id === 'day-1');
    const tuesday = client._planDays.find((d) => d.id === 'day-2');
    expect(monday?.workout_id).toBe(client._workouts[0]?.id);
    expect(tuesday?.workout_id).toBeNull();
  });

  it('returns dedupe candidates for similar workouts', async () => {
    const client = fitnessClient({
      userId: 'user-a',
      householdId: 'hh-a',
      workouts: [
        {
          id: 'w1',
          household_id: 'hh-a',
          name: 'Push Day',
          plan_only: false,
          visibility: 'private',
          duration_min: 40,
          created_by: 'user-a',
        },
      ],
      workoutExercises: [
        { id: 'we1', workout_id: 'w1', name: 'Bench Press', position: 0, target_sets: 3, target_reps: '8' },
        { id: 'we2', workout_id: 'w1', name: 'Overhead Press', position: 1, target_sets: 3, target_reps: '10' },
      ],
      exercises: [
        {
          id: 'ex-1',
          name: 'Bench Press',
          status: 'active',
          merged_into: null,
          scope: 'global',
          source: 'kinexus',
          body_part: 'chest',
          equipment: 'barbell',
          target_muscle: 'pectorals',
          category: null,
        },
        {
          id: 'ex-2',
          name: 'Overhead Press',
          status: 'active',
          merged_into: null,
          scope: 'global',
          source: 'kinexus',
          body_part: 'shoulders',
          equipment: 'barbell',
          target_muscle: 'delts',
          category: null,
        },
      ],
    });
    const caller = callerFor(client);
    const preview = await previewCreateWorkout(caller, {
      name: 'Push Day',
      exercises: [
        { name: 'Bench Press' },
        { name: 'Overhead Press' },
      ],
    });
    expect(preview.kind).toBe('dedupe');
    if (preview.kind !== 'dedupe') return;
    expect(preview.candidates[0]?.id).toBe('w1');
  });

  it('missing exercise proposes create and commits in one transaction', async () => {
    const client = fitnessClient({ userId: 'user-a', householdId: 'hh-a', exercises: [] });
    const caller = callerFor(client);
    const preview = await previewCreateWorkout(caller, {
      name: 'Weird Day',
      exercises: [{ name: 'Totally Custom Fly', targetSets: 3, targetReps: '12', intensity: 'light' }],
      decision: 'create_new',
    });
    expect(preview.kind).toBe('preview');
    if (preview.kind !== 'preview') return;
    expect(preview.steps.some((s) => s.includes('Create custom exercise'))).toBe(true);
    expect(preview.steps.some((s) => s.includes('library workout'))).toBe(true);
    const committed = await commitFitnessPreview(caller, { previewId: preview.previewId });
    expect(committed.ok).toBe(true);
    expect(client._exercises.some((e) => e.name === 'Totally Custom Fly')).toBe(true);
    expect(client._workouts).toHaveLength(1);
    expect(client._workoutExercises[0]?.exercise_id).toBeTruthy();
  });

  it('rejects creator-global for non-creators', async () => {
    const client = fitnessClient({
      userId: 'user-a',
      householdId: 'hh-a',
      approvedCreator: false,
    });
    const caller = callerFor(client);
    await expect(
      previewCreateCustomExercise(caller, {
        name: 'Creator Move',
        scope: 'creator-global',
        decision: 'create_new',
      }),
    ).rejects.toThrow(/approved creators/i);
  });

  it('rejects stale or mismatched preview on commit', async () => {
    const client = fitnessClient({ userId: 'user-a', householdId: 'hh-a' });
    const caller = callerFor(client);
    const { previewId } = await createWritePreview(caller.client, {
      userId: caller.userId,
      householdId: 'hh-a',
      tool: 'preview_create_workout',
      payload: {
        action: 'create_workout',
        name: 'X',
        durationMin: null,
        exercises: [],
        customExercises: [],
      },
    });
    const mismatch = await commitWritePreview(caller.client, {
      userId: caller.userId,
      previewId,
      tool: 'preview_delete_workout',
    });
    expect(mismatch).toEqual({ ok: false, reason: 'mismatched' });
    const missing = await commitFitnessPreview(caller, { previewId: 'nope' }).catch((err: Error) => err);
    expect(missing).toBeInstanceOf(Error);
    expect(String(missing)).toMatch(/Preview missing|Preview mismatched|Preview expired/i);
  });

  it('list/get workout isolates other households', async () => {
    const client = fitnessClient({
      userId: 'user-a',
      householdId: 'hh-a',
      workouts: [
        {
          id: 'ours',
          household_id: 'hh-a',
          name: 'Ours',
          plan_only: false,
          visibility: 'private',
          duration_min: 30,
          created_by: 'user-a',
        },
        {
          id: 'theirs',
          household_id: 'hh-b',
          name: 'Theirs',
          plan_only: false,
          visibility: 'private',
          duration_min: 30,
          created_by: 'user-b',
        },
      ],
    });
    const listed = await listWorkouts(client as never, 'user-a', {});
    expect(listed.workouts.map((w) => w.id)).toEqual(['ours']);
    await expect(getWorkout(client as never, 'user-a', 'theirs')).rejects.toThrow(/not found/i);
  });
});
