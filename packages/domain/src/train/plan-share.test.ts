import { describe, expect, it, vi } from 'vitest';

import {
  handleCopySharedTrainingPlan,
  handleUpdateTrainingPlanVisibility,
  type PlanWeekDbClient,
} from './plan-week.js';

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

describe('handleUpdateTrainingPlanVisibility', () => {
  it('rejects non-owner and writes buddy shares for pick-buddies', async () => {
    const inserts: unknown[] = [];
    const from = vi.fn((table: string) => {
      if (table === 'training_plans') {
        return chain(
          { data: { id: 'plan-1', household_id: 'hh1', owner_id: 'owner' }, error: null },
          {
            track: (op, payload) => {
              if (op === 'update') inserts.push({ table, op, payload });
            },
          },
        );
      }
      if (table === 'training_plan_days') {
        return chain(
          { data: [{ id: 'day-1' }], error: null },
          {
            track: (op, payload) => {
              inserts.push({ table, op, payload });
            },
          },
        );
      }
      if (table === 'training_plan_day_buddy_shares') {
        return chain(
          { data: null, error: null },
          {
            track: (op, payload) => {
              inserts.push({ table, op, payload });
            },
          },
        );
      }
      throw new Error(`unexpected ${table}`);
    });

    const denied = await handleUpdateTrainingPlanVisibility({ from } as PlanWeekDbClient, {
      authUserId: 'buddy',
      planId: 'plan-1',
      day: 'monday',
      visibility: 'global',
    });
    expect(denied.status).toBe(403);

    const ok = await handleUpdateTrainingPlanVisibility({ from } as PlanWeekDbClient, {
      authUserId: 'owner',
      planId: 'plan-1',
      day: 'monday',
      visibility: 'buddies_selected',
      buddyUserIds: ['buddy-a', 'buddy-a'],
    });
    expect(ok.status).toBe(200);
    if (ok.status === 200) expect(ok.body.buddyUserIds).toEqual(['buddy-a']);
    expect(inserts.some((row) => (row as { table: string }).table === 'training_plan_day_buddy_shares')).toBe(
      true,
    );
  });
});

describe('handleCopySharedTrainingPlan', () => {
  it('creates private owner-owned plan + workout rows', async () => {
    const inserts: Array<{ table: string; payload: unknown }> = [];
    let planInserts = 0;
    const from = vi.fn((table: string) => {
      if (table === 'training_plans') {
        return chain(
          { data: { id: `plan-${++planInserts}` }, error: null },
          {
            track: (op, payload) => {
              if (op === 'insert') inserts.push({ table, payload });
            },
          },
        );
      }
      if (table === 'workouts' || table === 'workout_exercises' || table === 'training_plan_days') {
        return chain(
          { data: table === 'workouts' ? { id: 'w1' } : null, error: null },
          {
            track: (op, payload) => {
              if (op === 'insert') inserts.push({ table, payload });
            },
          },
        );
      }
      throw new Error(`unexpected ${table}`);
    });

    const result = await handleCopySharedTrainingPlan({ from } as PlanWeekDbClient, {
      householdId: 'hh-me',
      ownerId: 'user-me',
      authUserId: 'user-me',
      name: 'Push week',
      weekStart: '2026-11-02',
      days: [
        {
          day: 'monday',
          restDay: false,
          focus: ['Push'],
          durationMin: 40,
          exercises: [
            {
              name: 'Bench',
              sets: 3,
              reps: '8',
              effort: null,
              rpe: 8,
              note: '',
              supersetId: null,
            },
          ],
        },
        {
          day: 'tuesday',
          restDay: true,
          focus: [],
          durationMin: null,
          exercises: [],
        },
      ],
    });

    expect(result.status).toBe(200);
    const planInsert = inserts.find((row) => row.table === 'training_plans')?.payload as Record<string, unknown>;
    expect(planInsert).toMatchObject({
      household_id: 'hh-me',
      owner_id: 'user-me',
      visibility: 'private',
      is_shared: false,
      share_token: null,
    });
    expect(inserts.some((row) => row.table === 'workouts')).toBe(true);
    expect(inserts.some((row) => row.table === 'training_plan_days')).toBe(true);
  });
});
