import { describe, expect, it, vi } from 'vitest';

import {
  handleApplyTrainingPlan,
  handleSaveGeneratePrefs,
  type ApplyDbClient,
  type ApplyTrainingPlanDay,
} from './apply-plan.js';

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };

function chain(result: QueryResult, opts?: { track?: (op: string, payload?: unknown) => void; op?: string }) {
  const api: Record<string, unknown> = {};
  const self = new Proxy(api, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return async () => result;
      }
      if (prop === 'select') {
        return () => self;
      }
      if (prop === 'eq') {
        return () => self;
      }
      if (prop === 'insert' || prop === 'upsert' || prop === 'delete') {
        return (payload?: unknown) => {
          opts?.track?.(String(prop), payload);
          return self;
        };
      }
      return () => self;
    },
  });
  if (opts?.op) opts.track?.(opts.op);
  return self;
}

const sampleDay = (overrides?: Partial<ApplyTrainingPlanDay>): ApplyTrainingPlanDay => ({
  day: 'monday',
  restDay: false,
  focus: ['Push'],
  durationMin: 45,
  exercises: [
    {
      exerciseId: 'ex1',
      name: 'Bench Press',
      tracking: 'reps',
      targetUnit: 'reps',
      targetSets: 3,
      targetReps: '8-12',
      targetDurationSec: null,
      targetDistanceKm: null,
      targetRpe: 7,
      category: 'Chest',
    },
  ],
  workoutId: null,
  explanation: 'Push',
  scheduledTime: '07:00',
  ...overrides,
});

describe('handleApplyTrainingPlan', () => {
  it('rejects ownership mismatch without writing', async () => {
    const from = vi.fn();
    const result = await handleApplyTrainingPlan({ from } as unknown as ApplyDbClient, {
      householdId: 'hh1',
      ownerId: 'user-a',
      authUserId: 'user-b',
      weekStart: '2026-11-02',
      visibility: 'private',
      days: [sampleDay()],
    });
    expect(result).toEqual({
      status: 403,
      body: { error: 'You can only create training plans you own' },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('maps RLS plan insert failure to 403', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'training_plans') {
        return chain({
          data: null,
          error: { message: 'new row violates row-level security policy', code: '42501' },
        });
      }
      throw new Error(`unexpected ${table}`);
    });
    const result = await handleApplyTrainingPlan({ from } as unknown as ApplyDbClient, {
      householdId: 'hh1',
      ownerId: 'user-a',
      authUserId: 'user-a',
      weekStart: '2026-11-02',
      visibility: 'private',
      days: [sampleDay()],
    });
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/^Not allowed to create this training plan/);
  });

  it('creates plan, workouts, days, and buddy shares on happy path', async () => {
    const inserts: { table: string; payload: unknown }[] = [];
    const from = vi.fn((table: string) => {
      if (table === 'training_plans') {
        return chain(
          { data: { id: 'plan1' }, error: null },
          {
            track: (op, payload) => {
              if (op === 'insert') inserts.push({ table, payload });
            },
          },
        );
      }
      if (table === 'workouts') {
        return chain(
          { data: { id: 'w1' }, error: null },
          {
            track: (op, payload) => {
              if (op === 'insert') inserts.push({ table, payload });
            },
          },
        );
      }
      if (table === 'workout_exercises' || table === 'training_plan_days' || table === 'training_plan_buddy_shares') {
        return chain(
          { data: null, error: null },
          {
            track: (op, payload) => {
              if (op === 'insert') inserts.push({ table, payload });
            },
          },
        );
      }
      throw new Error(`unexpected ${table}`);
    });

    const result = await handleApplyTrainingPlan({ from } as unknown as ApplyDbClient, {
      householdId: 'hh1',
      ownerId: 'user-a',
      authUserId: 'user-a',
      weekStart: '2026-11-02',
      visibility: 'buddies_selected',
      buddyUserIds: ['buddy-1'],
      days: [
        sampleDay(),
        sampleDay({ day: 'wednesday', restDay: true, exercises: [], focus: [], explanation: 'Rest' }),
      ],
    });

    expect(result).toEqual({
      status: 200,
      body: { planId: 'plan1', workoutIds: { monday: 'w1' } },
    });
    expect(inserts.some((row) => row.table === 'training_plans')).toBe(true);
    expect(inserts.some((row) => row.table === 'workouts')).toBe(true);
    expect(inserts.some((row) => row.table === 'workout_exercises')).toBe(true);
    expect(inserts.some((row) => row.table === 'training_plan_days')).toBe(true);
    expect(inserts.some((row) => row.table === 'training_plan_buddy_shares')).toBe(true);
    const workout = inserts.find((row) => row.table === 'workouts')?.payload as {
      name?: string;
      plan_only?: boolean;
    };
    expect(workout?.name).toBe('Mon · Push');
    expect(workout?.plan_only).toBe(true);
  });

  it('creates intent-only days without workouts when exercises are empty', async () => {
    const inserts: { table: string; payload: unknown }[] = [];
    const from = vi.fn((table: string) => {
      if (table === 'training_plans') {
        return chain(
          { data: { id: 'plan1' }, error: null },
          {
            track: (op, payload) => {
              if (op === 'insert') inserts.push({ table, payload });
            },
          },
        );
      }
      if (table === 'training_plan_days') {
        return chain(
          { data: null, error: null },
          {
            track: (op, payload) => {
              if (op === 'insert') inserts.push({ table, payload });
            },
          },
        );
      }
      if (table === 'workouts' || table === 'workout_exercises') {
        throw new Error(`unexpected ${table}`);
      }
      throw new Error(`unexpected ${table}`);
    });

    const result = await handleApplyTrainingPlan({ from } as unknown as ApplyDbClient, {
      householdId: 'hh1',
      ownerId: 'user-a',
      authUserId: 'user-a',
      weekStart: '2026-11-02',
      visibility: 'private',
      days: [
        sampleDay({
          exercises: [],
          focus: ['Upper Push'],
          explanation: 'Intent only',
          workoutId: null,
        }),
      ],
    });

    expect(result).toEqual({ status: 200, body: { planId: 'plan1', workoutIds: {} } });
    const dayInsert = inserts.find((row) => row.table === 'training_plan_days')?.payload as {
      workout_id?: string | null;
      focus?: string[];
      rest_day?: boolean;
    };
    expect(dayInsert?.workout_id).toBeNull();
    expect(dayInsert?.focus).toEqual(['Upper Push']);
    expect(dayInsert?.rest_day).toBe(false);
  });
});

describe('handleSaveGeneratePrefs', () => {
  it('rejects writing another user prefs', async () => {
    const from = vi.fn();
    const result = await handleSaveGeneratePrefs({ from } as unknown as ApplyDbClient, {
      userId: 'a',
      authUserId: 'b',
      prefs: { goal: 'strength' },
    });
    expect(result.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it('upserts generate_prefs for the signed-in user', async () => {
    let payload: unknown;
    const from = vi.fn((table: string) => {
      expect(table).toBe('user_train_prefs');
      return chain(
        { data: { user_id: 'a' }, error: null },
        {
          track: (op, body) => {
            if (op === 'upsert') payload = body;
          },
        },
      );
    });
    const result = await handleSaveGeneratePrefs({ from } as unknown as ApplyDbClient, {
      userId: 'a',
      authUserId: 'a',
      prefs: { goal: 'hypertrophy', durationMin: 40 },
    });
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(payload).toEqual({
      user_id: 'a',
      generate_prefs: { goal: 'hypertrophy', durationMin: 40 },
    });
  });
});
