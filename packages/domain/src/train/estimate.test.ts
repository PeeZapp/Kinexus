import { describe, expect, it } from 'vitest';

import { estimateWorkout } from './estimate';

describe('estimateWorkout', () => {
  it('returns nothing for an empty workout', () => {
    expect(estimateWorkout([])).toEqual({ minutes: 0, calories: 0, focuses: [] });
  });

  it('estimates a single exercise from its sets', () => {
    const estimate = estimateWorkout([{ name: 'Bench press', category: 'Chest', targetSets: 4 }]);
    expect(estimate.minutes).toBe(8);
    expect(estimate.calories).toBe(60);
    expect(estimate.focuses).toEqual(['Chest']);
  });

  it('keeps a superset shorter than the same exercises done apart', () => {
    const exercises = [
      { name: 'Bench press', category: 'Chest' as const, targetSets: 3, supersetId: 'ss' },
      { name: 'Fly', category: 'Chest' as const, targetSets: 3, supersetId: 'ss' },
    ];
    const together = estimateWorkout(exercises);
    const apart = estimateWorkout(exercises.map((exercise) => ({ ...exercise, supersetId: null })));
    expect(together.minutes).toBeLessThan(apart.minutes);
  });

  it('reads a focus from the exercise name', () => {
    expect(estimateWorkout([{ name: 'dumbbell bench press', targetSets: 3 }]).focuses).toEqual(['Chest']);
  });

  it('lists each focus once, in workout order', () => {
    const estimate = estimateWorkout([
      { name: 'Bench', category: 'Chest', targetSets: 3 },
      { name: 'Row', category: 'Back', targetSets: 3 },
      { name: 'Fly', category: 'Chest', targetSets: 3 },
    ]);
    expect(estimate.focuses).toEqual(['Chest', 'Back']);
  });
});
