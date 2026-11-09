import { describe, expect, it } from 'vitest';

import type { CatalogExercise } from './types.js';
import {
  canFillSessionType,
  displayFocusLabel,
  fillWorkoutFromSessionType,
  fillWorkoutFromSessionTypeWidened,
  sessionTypeIdFromFocus,
  widenSessionTypeIds,
} from './workout-templates.js';
import { isStaleEmptySession, sessionHasLoggedSets } from './session-writes.js';

function ex(
  id: string,
  name: string,
  bodyPart: string,
  targetMuscle: string,
  opts?: Partial<CatalogExercise>,
): CatalogExercise {
  return {
    id,
    name,
    bodyPart,
    equipment: opts?.equipment ?? 'dumbbell',
    targetMuscle,
    canonicalKey: opts?.canonicalKey ?? null,
    category: opts?.category ?? null,
    isCompound: opts?.isCompound ?? null,
  };
}

const catalogue: CatalogExercise[] = [
  ex('walk1', 'Outdoor Walk', 'cardio', '', { canonicalKey: 'outdoor walk', category: 'Cardio', equipment: 'bodyweight' }),
  ex('bike1', 'Assault Bike', 'cardio', '', { canonicalKey: 'assault bike', category: 'Cardio', equipment: 'machine' }),
  ...Array.from({ length: 6 }, (_, i) => ex(`c${i}`, `Bench ${i}`, 'chest', 'pectorals', { category: 'Chest' })),
  ...Array.from({ length: 6 }, (_, i) => ex(`t${i}`, `Pushdown ${i}`, 'triceps', 'triceps', { category: 'Triceps', equipment: 'cable' })),
  ...Array.from({ length: 6 }, (_, i) => ex(`s${i}`, `Raise ${i}`, 'shoulders', 'delts', { category: 'Shoulders' })),
];

describe('workout-templates', () => {
  it('maps legacy focuses onto session types', () => {
    expect(sessionTypeIdFromFocus('Push')).toBe('upper_push');
    expect(sessionTypeIdFromFocus('Upper Push')).toBe('upper_push');
    expect(displayFocusLabel('Push')).toBe('Upper Push');
  });

  it('fills duration modalities from preferred keys', () => {
    const filled = fillWorkoutFromSessionType({
      sessionTypeId: 'assault_bike',
      durationMin: 25,
      catalogue,
      seed: 1,
    });
    expect(filled).toHaveLength(1);
    expect(filled[0]?.name).toBe('Assault Bike');
    expect(filled[0]?.targetReps).toBe('25 min');
    expect(filled[0]?.targetSets).toBe(1);
  });

  it('fills strength session types from categories', () => {
    const filled = fillWorkoutFromSessionType({
      sessionTypeId: 'upper_push',
      durationMin: 40,
      catalogue,
      goal: 'hypertrophy',
      level: 'intermediate',
      seed: 3,
    });
    expect(filled.length).toBeGreaterThanOrEqual(3);
    expect(canFillSessionType('upper_push', catalogue)).toBe(true);
    expect(canFillSessionType('swim', catalogue)).toBe(true);
  });

  it('Start-fill returns exercises for Upper Push and a duration target for Walk', () => {
    const pushId = sessionTypeIdFromFocus('Upper Push');
    expect(pushId).toBe('upper_push');
    const push = fillWorkoutFromSessionType({
      sessionTypeId: pushId!,
      durationMin: 45,
      catalogue,
      goal: 'hypertrophy',
      level: 'intermediate',
      seed: 11,
    });
    expect(push.length).toBeGreaterThan(0);

    const walkId = sessionTypeIdFromFocus('Walk');
    expect(walkId).toBe('walk');
    const walk = fillWorkoutFromSessionType({
      sessionTypeId: walkId!,
      durationMin: 30,
      catalogue,
      seed: 2,
    });
    expect(walk).toHaveLength(1);
    expect(walk[0]?.targetReps).toBe('30 min');
    expect(walk[0]?.targetSets).toBe(1);
    expect(walk[0]?.name.toLowerCase()).toContain('walk');
  });

  it('quietly widens Upper Push when the narrow pool is empty', () => {
    expect(widenSessionTypeIds('upper_push')).toEqual(['upper_push', 'upper']);
    const backOnly = [
      ...Array.from({ length: 6 }, (_, i) =>
        ex(`b${i}`, `Row ${i}`, 'back', 'lats', { category: 'Back' }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        ex(`bi${i}`, `Curl ${i}`, 'biceps', 'biceps', { category: 'Biceps' }),
      ),
    ];
    expect(canFillSessionType('upper_push', backOnly)).toBe(false);
    expect(canFillSessionType('upper', backOnly)).toBe(true);
    const filled = fillWorkoutFromSessionTypeWidened({
      sessionTypeId: 'upper_push',
      durationMin: 40,
      catalogue: backOnly,
      seed: 5,
    });
    expect(filled.length).toBeGreaterThan(0);
  });

  it('detects logged sets and stale empty sessions', () => {
    expect(sessionHasLoggedSets([{ done: false }, { done: true }])).toBe(true);
    expect(sessionHasLoggedSets([{ done: false }])).toBe(false);
    const startedAt = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    expect(isStaleEmptySession({ startedAt, hasLoggedSets: false })).toBe(true);
    expect(isStaleEmptySession({ startedAt, hasLoggedSets: true })).toBe(false);
  });
});
