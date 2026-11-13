import { describe, expect, it } from 'vitest';

import {
  bestSessionTypeForFocuses,
  jointSessionAlertMessage,
  jointSessionPlanLabel,
  resolveJointSessionVotes,
  workoutMatchesSessionTypes,
} from './joint-session';

describe('resolveJointSessionVotes', () => {
  it('returns no_picks when invitees only blank-accept', () => {
    expect(
      resolveJointSessionVotes({
        inviterId: 'me',
        inviterSessionTypeId: 'upper_push',
        inviterWorkoutId: null,
        acceptedPicks: [{ userId: 'a', sessionTypeId: null, workoutId: null }],
      }),
    ).toEqual({ kind: 'no_picks' });
  });

  it('resolves when a buddy pick agrees with inviter', () => {
    expect(
      resolveJointSessionVotes({
        inviterId: 'me',
        inviterSessionTypeId: 'upper_push',
        inviterWorkoutId: 'w1',
        acceptedPicks: [{ userId: 'a', sessionTypeId: 'upper_push', workoutId: 'w1' }],
      }),
    ).toEqual({ kind: 'resolved', sessionTypeId: 'upper_push', workoutId: 'w1' });
  });

  it('ties when inviter and buddy disagree', () => {
    expect(
      resolveJointSessionVotes({
        inviterId: 'me',
        inviterSessionTypeId: 'legs',
        inviterWorkoutId: null,
        acceptedPicks: [{ userId: 'a', sessionTypeId: 'upper_push', workoutId: null }],
      }),
    ).toEqual({ kind: 'tie', sessionTypeIds: ['legs', 'upper_push'] });
  });
});

describe('workoutMatchesSessionTypes', () => {
  it('matches primary focus against session categories', () => {
    expect(workoutMatchesSessionTypes(['Chest', 'Triceps'], ['chest_tris'])).toBe(true);
    expect(workoutMatchesSessionTypes(['Back'], ['chest_tris'])).toBe(false);
  });
});

describe('bestSessionTypeForFocuses', () => {
  it('picks the offered type that matches the workout focus', () => {
    expect(bestSessionTypeForFocuses(['Back', 'Biceps'], ['legs', 'upper_pull'])).toBe('upper_pull');
    expect(bestSessionTypeForFocuses(['Legs', 'Glutes'], ['legs', 'upper_pull'])).toBe('legs');
  });

  it('returns null when no offered type matches', () => {
    expect(bestSessionTypeForFocuses(['Chest'], ['legs', 'upper_pull'])).toBeNull();
  });
});

describe('labels', () => {
  it('builds plan and alert copy', () => {
    expect(
      jointSessionPlanLabel({
        resolvedSessionTypeId: null,
        resolvedWorkoutName: null,
        buddyNames: ['Alex', 'Sam'],
      }),
    ).toBe('Session with Alex & Sam');
    expect(jointSessionAlertMessage({ missingSessionType: true, missingWorkout: false })).toMatch(
      /session type/i,
    );
  });
});
