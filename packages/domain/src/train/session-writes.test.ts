import { describe, expect, it } from 'vitest';

import {
  abandonWorkoutSessionCall,
  isStaleEmptySession,
  sessionHasLoggedSets,
} from './session-writes.js';

describe('session-writes helpers', () => {
  it('builds abandon_workout_session rpc args', () => {
    expect(abandonWorkoutSessionCall('sess-1')).toEqual({
      rpc: 'abandon_workout_session',
      args: { p_session_id: 'sess-1' },
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
