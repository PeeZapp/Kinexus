import { describe, expect, it, vi } from 'vitest';

import { handleGetSharedWorkout } from './shared-workout.js';
import { handleGetSharedTrainingPlan } from './shared-training-plan.js';
import { handleGetSharedWatchlist } from './shared-watchlist-link.js';

type QueryResult = { data: unknown; error: { message: string } | null };

function chain(result: QueryResult) {
  const api: Record<string, unknown> = {};
  const self = new Proxy(api, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return async () => result;
      }
      return () => self;
    },
  });
  return self;
}

function leakKeys(value: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const next = path ? `${path}.${key}` : key;
      if (
        /household|person|user_id|created_by|session|record|private|email|display_name|notes|status|visibility/i.test(
          key,
        )
      ) {
        found.push(next);
      }
      walk(child, next);
    }
  };
  walk(value, '');
  return found;
}

describe('handleGetSharedWorkout', () => {
  it('requires a token and configured service role', async () => {
    expect(await handleGetSharedWorkout('  ', { isConfigured: () => true, createClient: () => ({}) as never })).toEqual({
      status: 400,
      body: { error: 'Share token required' },
    });
    expect(await handleGetSharedWorkout('tok', { isConfigured: () => false, createClient: () => ({}) as never })).toEqual({
      status: 503,
      body: { error: 'Shared workouts are not configured' },
    });
  });

  it('404s when sharing is off and never returns household or personal fields', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'workouts') {
        return chain({ data: null, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });
    const result = await handleGetSharedWorkout('old-token', {
      isConfigured: () => true,
      createClient: () => ({ from } as never),
    });
    expect(result.status).toBe(404);
    expect(leakKeys(result.body)).toEqual([]);
  });

  it('returns public exercise plan only', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'workouts') {
        return chain({
          data: { id: 'w1', name: 'Push Day', duration_min: 45, is_shared: true, household_id: 'hh-secret' },
          error: null,
        });
      }
      if (table === 'workout_exercises') {
        return chain({
          data: [
            {
              name: 'Bench',
              position: 0,
              target_sets: 3,
              target_reps: '8',
              target_effort: 'heavy',
              target_rpe: 8,
              note: 'Pause',
              superset_id: 'ss1',
              exercise_id: 'e1',
              household_id: 'hh-secret',
              exercises: { media_url: 'https://cdn.example/bench.gif', media_urls: [] },
            },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await handleGetSharedWorkout('tok', {
      isConfigured: () => true,
      createClient: () => ({ from } as never),
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      name: 'Push Day',
      durationMin: 45,
      exercises: [
        {
          name: 'Bench',
          sets: 3,
          reps: '8',
          effort: 'heavy',
          rpe: 8,
          note: 'Pause',
          supersetId: 'ss1',
          mediaUrls: ['https://cdn.example/bench.gif'],
        },
      ],
    });
    expect(leakKeys(result.body)).toEqual([]);
    expect(JSON.stringify(result.body)).not.toMatch(/hh-secret|household|person/i);
  });
});

describe('handleGetSharedTrainingPlan', () => {
  it('returns week grid + exercises without personal fields', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'training_plans') {
        return chain({
          data: {
            id: 'p1',
            name: 'Hypertrophy week',
            week_start: '2026-11-02',
            is_shared: true,
            household_id: 'hh-secret',
            owner_id: 'u-secret',
            visibility: 'private',
            audience_person_ids: ['person-secret'],
            scheduled_time: '07:00',
          },
          error: null,
        });
      }
      if (table === 'training_plan_days') {
        return chain({
          data: [
            {
              day: 'monday',
              position: 0,
              rest_day: false,
              focus: ['Push'],
              duration_min: 40,
              generated_spec: null,
              workout_id: 'w1',
              scheduled_time: '07:00',
              status: 'planned',
              session_id: 'sess-secret',
            },
            {
              day: 'tuesday',
              position: 1,
              rest_day: true,
              focus: [],
              duration_min: null,
              generated_spec: null,
              workout_id: null,
            },
          ],
          error: null,
        });
      }
      if (table === 'workout_exercises') {
        return chain({
          data: [
            {
              workout_id: 'w1',
              name: 'Bench',
              position: 0,
              target_sets: 3,
              target_reps: '8',
              target_effort: null,
              target_rpe: 8,
              note: '',
              superset_id: null,
              household_id: 'hh-secret',
            },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await handleGetSharedTrainingPlan('tok', {
      isConfigured: () => true,
      createClient: () => ({ from } as never),
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      name: 'Hypertrophy week',
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
    expect(leakKeys(result.body)).toEqual([]);
    expect(JSON.stringify(result.body)).not.toMatch(/hh-secret|person-secret|scheduled|session|visibility|audience/i);
  });
});

describe('handleGetSharedWatchlist', () => {
  it('404s when sharing is off / reset and strips private fields', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'watchlist_lists') return chain({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const result = await handleGetSharedWatchlist('revoked', {
      isConfigured: () => true,
      createClient: () => ({ from, rpc: vi.fn() } as never),
    });
    expect(result.status).toBe(404);
    expect(leakKeys(result.body)).toEqual([]);
  });

  it('returns list titles + @username without household or person data', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ id: 'u1', username: 'paul', global_handle: 'Swift-Oak-42', avatar_url: null, is_verified_creator: false }],
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'watchlist_lists') {
        return chain({
          data: {
            id: 'l1',
            name: 'Friday night',
            created_by: 'u1',
            is_shared: true,
            kind: 'custom',
            household_id: 'hh-secret',
          },
          error: null,
        });
      }
      if (table === 'watchlist_items') {
        return chain({
          data: [{ title_id: 't1', household_id: 'hh-secret', notes: 'secret', status: 'want', added_by: 'u1' }],
          error: null,
        });
      }
      if (table === 'watchlist_titles') {
        return chain({
          data: [
            {
              tmdb_id: 42,
              media_type: 'movie',
              title: 'Arrival',
              year: 2016,
              poster_path: '/a.jpg',
              household_id: 'hh-secret',
              overview: 'secret overview',
            },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await handleGetSharedWatchlist('tok', {
      isConfigured: () => true,
      createClient: () => ({ from, rpc } as never),
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      name: 'Friday night',
      ownerUsername: 'paul',
      titles: [{ tmdbId: 42, mediaType: 'movie', title: 'Arrival', year: 2016, posterPath: '/a.jpg' }],
    });
    expect(leakKeys(result.body)).toEqual([]);
    expect(JSON.stringify(result.body)).not.toMatch(/hh-secret|household|person|overview|notes|status/i);
    expect(rpc).toHaveBeenCalledWith('public_profiles', { p_ids: ['u1'] });
  });
});
