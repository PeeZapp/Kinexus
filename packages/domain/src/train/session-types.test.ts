import { describe, expect, it } from 'vitest';

import {
  TRAIN_SESSION_TYPES,
  durationTargetForSessionType,
  isDurationTarget,
  isTrainSessionTypeId,
  preferredExerciseKeysForSessionType,
  resolveSessionTypeFromFocus,
  trainSessionTypeById,
  trainSessionTypesByKind,
} from './session-types.js';

describe('session-types', () => {
  it('includes core strength and cardio intents', () => {
    const ids = TRAIN_SESSION_TYPES.map((row) => row.id);
    expect(ids).toContain('upper_push');
    expect(ids).toContain('chest_tris');
    expect(ids).toContain('walk');
    expect(ids).toContain('swim');
    expect(ids).toContain('assault_bike');
    expect(ids).toContain('circuit');
    expect(ids).toContain('plyometrics');
  });

  it('resolves by id and focus aliases', () => {
    expect(isTrainSessionTypeId('upper_pull')).toBe(true);
    expect(trainSessionTypeById('upper_pull')?.label).toBe('Upper Pull');
    expect(resolveSessionTypeFromFocus('Full Body')?.id).toBe('full_body');
    expect(resolveSessionTypeFromFocus('push')?.id).toBe('push');
    expect(trainSessionTypesByKind('conditioning').some((row) => row.id === 'zone2')).toBe(true);
  });

  it('maps cardio modalities to catalogue keys and duration targets', () => {
    expect(preferredExerciseKeysForSessionType('assault_bike')).toContain('assault bike');
    expect(preferredExerciseKeysForSessionType('walk')[0]).toBe('outdoor walk');
    expect(durationTargetForSessionType('walk', 40)).toEqual({ sets: 1, reps: '40 min' });
  });

  it('detects duration / distance targets vs count reps', () => {
    expect(isDurationTarget('40 min')).toBe(true);
    expect(isDurationTarget('5 km')).toBe(true);
    expect(isDurationTarget('12:30')).toBe(true);
    expect(isDurationTarget('10')).toBe(false);
    expect(isDurationTarget('8-12')).toBe(false);
  });
});
