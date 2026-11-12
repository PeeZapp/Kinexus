import { describe, expect, it } from 'vitest';

import {
  buildRemixWorkoutLabel,
  encodeRemixSplit,
  exerciseMatchesRemixCategory,
  generateFromCategoryMix,
  normalizeRemixSliderWeights,
  parseRemixSplit,
  remixCategoryOf,
  remixExerciseCount,
  nextSimilarExercise,
  swapSimilarExercises,
} from './remix';
import type { CatalogExercise } from './types';

function exercise(id: string, name: string, bodyPart: string, targetMuscle: string): CatalogExercise {
  return { id, name, bodyPart, equipment: 'barbell', targetMuscle };
}

const catalog: CatalogExercise[] = [
  ...Array.from({ length: 8 }, (_, index) => exercise(`c${index}`, `Bench ${index}`, 'chest', 'pectorals')),
  ...Array.from({ length: 8 }, (_, index) => exercise(`l${index}`, `Squat ${index}`, 'legs', 'quads')),
  exercise('g', 'Hip thrust', 'legs', 'glutes'),
  exercise('m', '90/90 Breathing', 'other', ''),
  exercise('p', '4-count burpees', 'other', ''),
];

describe('generateFromCategoryMix', () => {
  it('splits the session by category weight and keeps glutes out of legs', () => {
    const picks = generateFromCategoryMix(['Chest', 'Legs'], [200, 50], 40, catalog, () => 0.5);
    const chest = picks.filter((pick) => pick.exerciseId.startsWith('c'));
    const legs = picks.filter((pick) => pick.exerciseId.startsWith('l'));
    expect(picks).toHaveLength(5);
    expect(chest).toHaveLength(4);
    expect(legs).toHaveLength(1);
    expect(picks.some((pick) => pick.exerciseId === 'g')).toBe(false);
    expect(picks[0]?.exerciseId.startsWith('c')).toBe(true);
    expect(picks[1]?.exerciseId.startsWith('l')).toBe(true);
    expect(chest[0]?.targetSets).toBe(4);
    expect(chest[0]?.targetReps).toBe('10');
    expect(legs[0]?.targetReps).toBe('12');
  });

  it('sizes a short session to at least three exercises', () => {
    expect(remixExerciseCount(['Chest'], 5)).toBe(3);
  });
});

describe('remix categories', () => {
  it('matches catalog body parts and untagged names', () => {
    expect(exerciseMatchesRemixCategory(catalog[0]!, 'Chest')).toBe(true);
    expect(exerciseMatchesRemixCategory(catalog.find((item) => item.id === 'g')!, 'Glutes')).toBe(true);
    expect(exerciseMatchesRemixCategory(catalog.find((item) => item.id === 'g')!, 'Legs')).toBe(false);
    expect(exerciseMatchesRemixCategory(catalog.find((item) => item.id === 'm')!, 'Mobility')).toBe(true);
    expect(exerciseMatchesRemixCategory(catalog.find((item) => item.id === 'p')!, 'Plyometrics')).toBe(true);
  });

  it('honours explicit category on custom exercises', () => {
    const custom: CatalogExercise = {
      id: 'custom-1',
      name: 'Weird Cable Thing',
      bodyPart: 'other',
      equipment: 'cable',
      targetMuscle: '',
      category: 'Shoulders',
    };
    expect(remixCategoryOf(custom)).toBe('Shoulders');
    expect(exerciseMatchesRemixCategory(custom, 'Shoulders')).toBe(true);
    const picks = generateFromCategoryMix(['Shoulders'], [100], 20, [custom, ...catalog], () => 0.1);
    expect(picks.some((pick) => pick.exerciseId === 'custom-1')).toBe(true);
  });

  it('normalizes slider weights and round-trips the saved mix', () => {
    expect(normalizeRemixSliderWeights([100, 100])).toEqual([0.5, 0.5]);
    const encoded = encodeRemixSplit(['Full Body', 'Legs'], [100, 80]);
    expect(parseRemixSplit(encoded)).toEqual({ categories: ['Full Body', 'Legs'], weights: [100, 80] });
    expect(buildRemixWorkoutLabel(['Chest', 'Triceps'], 40)).toBe('Chest · Triceps · 40m');
  });
});

describe('swapSimilarExercises tracking', () => {
  it('uses defaults when swapping reps → time', () => {
    const pool: CatalogExercise[] = [
      { id: 'squat', name: 'Back squat', bodyPart: 'legs', equipment: 'barbell', targetMuscle: 'quads', category: 'Legs' },
      {
        id: 'walk',
        name: 'Outdoor Walk',
        bodyPart: 'cardio',
        equipment: 'bodyweight',
        targetMuscle: '',
        category: 'Cardio',
      },
      {
        id: 'jog',
        name: 'Treadmill Jog',
        bodyPart: 'cardio',
        equipment: 'machine',
        targetMuscle: '',
        category: 'Cardio',
      },
    ];
    // Same-category Cardio swap: plank-like reps target should not copy onto a walk.
    const swapped = swapSimilarExercises(
      [
        {
          exerciseId: 'walk',
          name: 'Outdoor Walk',
          tracking: 'reps',
          targetUnit: 'reps',
          targetSets: 3,
          targetReps: '8-10',
          targetDurationSec: null,
          targetDistanceKm: null,
        },
      ],
      pool,
      () => 0,
    );
    expect(swapped.changed).toBe(1);
    expect(swapped.exercises[0]?.exerciseId).toBe('jog');
    expect(swapped.exercises[0]?.targetUnit).toBe('min');
    expect(swapped.exercises[0]?.tracking).toBe('time');
    expect(swapped.exercises[0]?.targetDurationSec).toBe(30 * 60);
    expect(swapped.exercises[0]?.targetReps).toBe('30 min');
  });
});

describe('nextSimilarExercise', () => {
  const pool = [
    exercise('bench', 'Bench press', 'chest', 'pectorals'),
    exercise('fly', 'Cable fly', 'chest', 'pectorals'),
    exercise('dip', 'Chest dip', 'chest', 'pectorals'),
    exercise('squat', 'Squat', 'legs', 'quads'),
  ];

  it('walks unseen exercises in the same category before repeating', () => {
    const first = nextSimilarExercise('bench', pool, ['bench'], ['squat'], () => 0);
    expect(first?.exercise.id).toBe('fly');
    const second = nextSimilarExercise('fly', pool, first?.offeredIds ?? [], ['squat'], () => 0);
    expect(second?.exercise.id).toBe('dip');
    expect(second?.offeredIds).toEqual(['bench', 'fly', 'dip']);
    const third = nextSimilarExercise('dip', pool, second?.offeredIds ?? [], ['squat'], () => 0);
    expect(['bench', 'fly']).toContain(third?.exercise.id);
    expect(third?.offeredIds).toEqual(['dip', third?.exercise.id]);
  });

  it('returns nothing when the category has no other exercise', () => {
    expect(nextSimilarExercise('squat', pool, ['squat'], [], () => 0)).toBeNull();
  });
});
