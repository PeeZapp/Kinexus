import { describe, expect, it } from 'vitest';

import type { CatalogExercise } from './types.js';
import {
  canFillSessionType,
  displayFocusLabel,
  fillWorkoutFromSessionType,
  sessionTypeIdFromFocus,
} from './workout-templates.js';

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
});
