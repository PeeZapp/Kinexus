import { describe, expect, it } from 'vitest';

import {
  abandonWorkoutSessionCall,
  isStaleEmptySession,
  sessionHasLoggedSets,
  updateWorkoutSetCall,
} from './session-writes.js';

describe('session-writes helpers', () => {
  it('builds abandon_workout_session rpc args', () => {
    expect(abandonWorkoutSessionCall('sess-1')).toEqual({
      rpc: 'abandon_workout_session',
      args: { p_session_id: 'sess-1' },
    });
  });

  it('passes duration and distance update flags', () => {
    expect(
      updateWorkoutSetCall('set-1', {
        done: true,
        durationSec: 1800,
        distanceKm: 5,
      }),
    ).toEqual({
      rpc: 'update_workout_set',
      args: {
        p_set_id: 'set-1',
        p_weight: null,
        p_reps: null,
        p_done: true,
        p_duration_sec: 1800,
        p_distance_km: 5,
        p_update_duration: true,
        p_update_distance: true,
      },
    });
  });

  it('flags logged sets and 12h stale empties', () => {
    expect(sessionHasLoggedSets([{ done: true }])).toBe(true);
    expect(sessionHasLoggedSets([{ done: false }])).toBe(false);
    const stale = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    expect(isStaleEmptySession({ startedAt: stale, hasLoggedSets: false })).toBe(true);
    expect(
      isStaleEmptySession({
        startedAt: new Date().toISOString(),
        hasLoggedSets: false,
      }),
    ).toBe(false);
  });
});
