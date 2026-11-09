import { describe, expect, it, vi } from 'vitest';

import {
  dayDateIso,
  handleAttachWorkoutToPlanDay,
  isRegeneratableDay,
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
      if (prop === 'select' || prop === 'eq') {
        return () => self;
      }
      if (prop === 'update') {
        return (payload?: unknown) => {
          opts?.track?.('update', payload);
          return self;
        };
      }
      return () => self;
    },
  });
  return self;
}

describe('plan-week helpers', () => {
  it('maps week days to ISO dates', () => {
    expect(dayDateIso('2026-11-02', 'monday')).toBe('2026-11-02');
    expect(dayDateIso('2026-11-02', 'wednesday')).toBe('2026-11-04');
    expect(dayDateIso('2026-11-02', 'sunday')).toBe('2026-11-08');
  });

  it('only regenerates future planned days', () => {
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
        status: 'planned',
        todayIso: '2026-11-04',
      }),
    ).toBe(true);
    expect(
      isRegeneratableDay({
        weekStart: '2026-11-02',
        day: 'friday',
        status: 'skipped',
        todayIso: '2026-11-04',
      }),
    ).toBe(false);
  });
});

describe('handleAttachWorkoutToPlanDay', () => {
  it('attaches a workout and clears rest', async () => {
    let payload: unknown;
    const from = vi.fn(() =>
      chain(
        { data: { id: 'day1', workout_id: 'w1' }, error: null },
        {
          track: (op, body) => {
            if (op === 'update') payload = body;
          },
        },
      ),
    );
    const result = await handleAttachWorkoutToPlanDay({ from } as PlanWeekDbClient, {
      authUserId: 'u1',
      dayId: 'day1',
      workoutId: 'w1',
    });
    expect(result).toEqual({ status: 200, body: { id: 'day1', workoutId: 'w1' } });
    expect(payload).toEqual({ workout_id: 'w1', rest_day: false });
  });

  it('clears workout for intent-only days', async () => {
    let payload: unknown;
    const from = vi.fn(() =>
      chain(
        { data: { id: 'day1', workout_id: null }, error: null },
        {
          track: (op, body) => {
            if (op === 'update') payload = body;
          },
        },
      ),
    );
    const result = await handleAttachWorkoutToPlanDay({ from } as PlanWeekDbClient, {
      authUserId: 'u1',
      dayId: 'day1',
      workoutId: null,
    });
    expect(result).toEqual({ status: 200, body: { id: 'day1', workoutId: null } });
    expect(payload).toEqual({ workout_id: null });
  });
});
