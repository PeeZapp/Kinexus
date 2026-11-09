import { describe, expect, it, vi } from 'vitest';

import {
  handleDuplicateTrainingPlanToNextWeek,
  handleMarkTrainingPlanDayFromSession,
  handleRegenerateRemainingDays,
  handleSetTrainingPlanDayStatus,
  isRegeneratableDay,
  type PlanWeekDbClient,
} from './training-plan-week.js';

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

function chain(result: QueryResult, opts?: { track?: (op: string, payload?: unknown) => void }) {
  const api: Record<string, unknown> = {};
  const self = new Proxy(api, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return async () => result;
      }
      if (prop === 'select' || prop === 'eq' || prop === 'in' || prop === 'order' || prop === 'is' || prop === 'not') {
        return (...args: unknown[]) => {
          opts?.track?.(String(prop), args);
          return self;
        };
      }
      if (prop === 'insert' || prop === 'upsert' || prop === 'update' || prop === 'delete') {
        return (payload?: unknown) => {
          opts?.track?.(String(prop), payload);
          return self;
        };
      }
      return () => self;
    },
  });
  return self;
}

const planRow = {
  id: 'plan-1',
  household_id: 'hh1',
  owner_id: 'user-a',
  name: 'Week',
  week_start: '2026-11-02',
  visibility: 'private',
  audience_person_ids: [],
  prefs: {
    goal: 'hypertrophy',
    level: 'intermediate',
    daysPerWeek: 3,
    days: ['monday', 'wednesday', 'friday'],
    durationMin: 40,
    preferSavedWorkouts: false,
  },
  calendar_auto_sync: false,
  share_token: null,
  is_shared: false,
  training_plan_days: [
    {
      id: 'day-mon',
      day: 'monday',
      position: 0,
      workout_id: 'w-mon',
      generated_spec: { focus: ['Push'] },
      rest_day: false,
      scheduled_time: '07:00',
      duration_min: 40,
      focus: ['Push'],
      status: 'done',
      session_id: 'sess-old',
    },
    {
      id: 'day-tue',
      day: 'tuesday',
      position: 1,
      workout_id: null,
      generated_spec: null,
      rest_day: true,
      scheduled_time: null,
      duration_min: null,
      focus: [],
      status: 'planned',
      session_id: null,
    },
    {
      id: 'day-wed',
      day: 'wednesday',
      position: 2,
      workout_id: 'w-wed',
      generated_spec: { focus: ['Pull'] },
      rest_day: false,
      scheduled_time: '07:00',
      duration_min: 40,
      focus: ['Pull'],
      status: 'planned',
      session_id: null,
    },
    {
      id: 'day-fri',
      day: 'friday',
      position: 3,
      workout_id: 'w-fri',
      generated_spec: { focus: ['Legs'] },
      rest_day: false,
      scheduled_time: null,
      duration_min: 40,
      focus: ['Legs'],
      status: 'skipped',
      session_id: null,
    },
  ],
  training_plan_buddy_shares: [{ buddy_user_id: 'buddy-1' }],
};

describe('handleSetTrainingPlanDayStatus', () => {
  it('updates status', async () => {
    const from = vi.fn(() =>
      chain({ data: { id: 'day-1', status: 'skipped', session_id: null }, error: null }, {}),
    );
    const result = await handleSetTrainingPlanDayStatus({ from } as unknown as PlanWeekDbClient, {
      authUserId: 'user-a',
      dayId: 'day-1',
      status: 'skipped',
    });
    expect(result).toEqual({
      status: 200,
      body: { id: 'day-1', status: 'skipped', sessionId: null },
    });
  });

  it('maps RLS rejection for a non-member to 403', async () => {
    const from = vi.fn(() =>
      chain({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } }),
    );
    const result = await handleSetTrainingPlanDayStatus({ from } as unknown as PlanWeekDbClient, {
      authUserId: 'outsider',
      dayId: 'day-1',
      status: 'done',
    });
    expect(result.status).toBe(403);
  });
});

describe('handleMarkTrainingPlanDayFromSession', () => {
  it('marks planned days done and is idempotent for the same session', async () => {
    const ops: { op: string; payload?: unknown }[] = [];
    let pass = 0;
    const from = vi.fn((table: string) => {
      if (table !== 'training_plan_days') return chain({ data: null, error: null });
      pass += 1;
      if (pass === 1 || pass === 3) {
        return chain(
          {
            data: [
              { id: 'day-1', status: pass === 1 ? 'planned' : 'done', session_id: pass === 1 ? null : 'sess-1' },
            ],
            error: null,
          },
          { track: (op, payload) => ops.push({ op, payload }) },
        );
      }
      return chain(
        { data: null, error: null },
        { track: (op, payload) => ops.push({ op, payload }) },
      );
    });

    const first = await handleMarkTrainingPlanDayFromSession({ from } as unknown as PlanWeekDbClient, {
      authUserId: 'user-a',
      sessionId: 'sess-1',
      workoutId: 'w-1',
    });
    expect(first).toEqual({ status: 200, body: { updated: 1, dayIds: ['day-1'] } });
    expect(ops.some((row) => row.op === 'update')).toBe(true);

    ops.length = 0;
    const second = await handleMarkTrainingPlanDayFromSession({ from } as unknown as PlanWeekDbClient, {
      authUserId: 'user-a',
      sessionId: 'sess-1',
      workoutId: 'w-1',
    });
    expect(second).toEqual({ status: 200, body: { updated: 0, dayIds: ['day-1'] } });
    expect(ops.some((row) => row.op === 'update')).toBe(false);
  });
});

describe('handleDuplicateTrainingPlanToNextWeek', () => {
  it('copies plan + days to week_start+7 reusing workout ids', async () => {
    const inserts: { table: string; payload: unknown }[] = [];
    const from = vi.fn((table: string) => {
      const track = (op: string, payload?: unknown) => {
        if (op === 'insert') inserts.push({ table, payload });
      };
      if (table === 'training_plans') {
        const api: Record<string, unknown> = {};
        const self = new Proxy(api, {
          get(_target, prop) {
            if (prop === 'then') {
              return (resolve: (value: QueryResult) => unknown) =>
                Promise.resolve({ data: planRow, error: null }).then(resolve);
            }
            if (prop === 'maybeSingle') {
              return async () => ({ data: planRow, error: null });
            }
            if (prop === 'single') {
              return async () => ({ data: { id: 'plan-2' }, error: null });
            }
            if (prop === 'select' || prop === 'eq') return () => self;
            if (prop === 'insert') {
              return (payload?: unknown) => {
                track('insert', payload);
                return self;
              };
            }
            if (prop === 'delete') return () => self;
            return () => self;
          },
        });
        return self;
      }
      return chain({ data: null, error: null }, { track });
    });

    const result = await handleDuplicateTrainingPlanToNextWeek({ from } as unknown as PlanWeekDbClient, {
      authUserId: 'user-a',
      planId: 'plan-1',
    });
    expect(result).toEqual({ status: 200, body: { planId: 'plan-2', weekStart: '2026-11-09' } });
    const planInsert = inserts.find((row) => row.table === 'training_plans');
    expect(planInsert?.payload).toMatchObject({ week_start: '2026-11-09', owner_id: 'user-a' });
    const dayInsert = inserts.find((row) => row.table === 'training_plan_days');
    expect(Array.isArray(dayInsert?.payload)).toBe(true);
    const days = dayInsert?.payload as { workout_id: string | null; status: string }[];
    expect(days.some((day) => day.workout_id === 'w-mon')).toBe(true);
    expect(days.every((day) => day.status === 'planned')).toBe(true);
    expect(inserts.some((row) => row.table === 'training_plan_buddy_shares')).toBe(true);
  });
});

describe('handleRegenerateRemainingDays', () => {
  it('leaves done/skipped/past days untouched when confirming', async () => {
    const updatedIds: string[] = [];
    const from = vi.fn((table: string) => {
      if (table === 'training_plans') {
        return chain({ data: planRow, error: null });
      }
      if (table === 'workouts') {
        return chain({ data: { id: 'w-new' }, error: null });
      }
      if (table === 'workout_exercises') {
        return chain({ data: null, error: null });
      }
      const api: Record<string, unknown> = {};
      let pendingUpdate = false;
      const self = new Proxy(api, {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (value: QueryResult) => unknown) =>
              Promise.resolve({ data: null, error: null }).then(resolve);
          }
          if (prop === 'update') {
            return () => {
              pendingUpdate = true;
              return self;
            };
          }
          if (prop === 'eq') {
            return (col: string, val: unknown) => {
              if (pendingUpdate && col === 'id' && typeof val === 'string') {
                updatedIds.push(val);
                pendingUpdate = false;
              }
              return self;
            };
          }
          return () => self;
        },
      });
      return self;
    });

    const result = await handleRegenerateRemainingDays({ from } as unknown as PlanWeekDbClient, {
      authUserId: 'user-a',
      planId: 'plan-1',
      catalogue: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Bench Press',
          bodyPart: 'chest',
          equipment: 'barbell',
          targetMuscle: 'pectorals',
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          name: 'Row',
          bodyPart: 'back',
          equipment: 'barbell',
          targetMuscle: 'lats',
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          name: 'Squat',
          bodyPart: 'legs',
          equipment: 'barbell',
          targetMuscle: 'quads',
        },
      ],
      seed: 42,
      todayIso: '2026-11-04', // Wednesday
      confirm: true,
    });

    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect(result.body.remainingDays).toEqual(['wednesday']);
    expect(result.body.lockedDays).toEqual(expect.arrayContaining(['monday', 'tuesday', 'friday']));
    expect(result.body.applied).toBe(true);

    expect(updatedIds).toEqual(['day-wed']);
    expect(updatedIds).not.toContain('day-mon');
    expect(updatedIds).not.toContain('day-tue');
    expect(updatedIds).not.toContain('day-fri');
  });
});

describe('isRegeneratableDay', () => {
  it('locks past and non-planned days', () => {
    expect(
      isRegeneratableDay({
        weekStart: '2026-11-02',
        day: 'monday',
        status: 'planned',
        todayIso: '2026-11-04',
      }),
    ).toBe(false);
    expect(
      isRegeneratableDay({
        weekStart: '2026-11-02',
        day: 'wednesday',
        status: 'done',
        todayIso: '2026-11-04',
      }),
    ).toBe(false);
    expect(
      isRegeneratableDay({
        weekStart: '2026-11-02',
        day: 'wednesday',
        status: 'planned',
        todayIso: '2026-11-04',
      }),
    ).toBe(true);
  });
});
