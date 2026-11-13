import { describe, expect, it } from 'vitest';

import {
  buildRemixWorkoutLabel,
  encodeRemixSplit,
  exerciseMatchesRemixCategory,
  generateFromCategoryMix,
  isCompoundExercise,
  normalizeRemixSliderWeights,
  parseRemixSplit,
  remixCategoryOf,
  remixExerciseCount,
  nextSimilarExercise,
  swapSimilarExercises,
} from './remix';
import type { CatalogExercise } from './types';

function exercise(
  id: string,
  name: string,
  bodyPart: string,
  targetMuscle: string,
  extras?: Partial<CatalogExercise>,
): CatalogExercise {
  return { id, name, bodyPart, equipment: 'barbell', targetMuscle, ...extras };
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
    // Strength categories get a compound+isolation floor (2) when the session has room.
    expect(chest).toHaveLength(3);
    expect(legs).toHaveLength(2);
    expect(picks.some((pick) => pick.exerciseId === 'g')).toBe(false);
    expect(picks[0]?.exerciseId.startsWith('c')).toBe(true);
    expect(picks[1]?.exerciseId.startsWith('l')).toBe(true);
    expect(chest[0]?.targetSets).toBe(4);
    expect(chest[0]?.targetReps).toBe('10');
    expect(legs[0]?.targetReps).toBe('12');
  });

  it('keeps a 70/30 mix chest-heavy at nine slots (not floor-skewed to 5/4)', () => {
    const pool: CatalogExercise[] = [
      ...Array.from({ length: 12 }, (_, index) =>
        exercise(`c${index}`, `Bench press ${index}`, 'chest', 'pectorals', { category: 'Chest', isCompound: true }),
      ),
      ...Array.from({ length: 12 }, (_, index) =>
        exercise(`t${index}`, `Triceps pushdown ${index}`, 'triceps', 'triceps', {
          category: 'Triceps',
          isCompound: false,
        }),
      ),
    ];
    // Real slider values from a user report that previously allocated 5/4.
    const picks = generateFromCategoryMix(['Chest', 'Triceps'], [179, 78], 60, pool, () => 0.5);
    const chest = picks.filter((pick) => pick.exerciseId.startsWith('c'));
    const tris = picks.filter((pick) => pick.exerciseId.startsWith('t'));
    expect(picks).toHaveLength(9);
    expect(chest).toHaveLength(6);
    expect(tris).toHaveLength(3);
  });

  it('pairs a compound and isolation for each strength category', () => {
    const pool: CatalogExercise[] = [
      exercise('bench', 'Barbell bench press', 'chest', 'pectorals', { isCompound: true }),
      exercise('fly', 'Cable fly', 'chest', 'pectorals', { isCompound: false }),
      exercise('pushdown', 'Triceps pushdown', 'triceps', 'triceps', { isCompound: false }),
      exercise('cg-bench', 'Close grip bench press', 'triceps', 'triceps', { isCompound: true }),
      exercise('reverse', 'Dumbbell reverse fly', 'shoulders', 'deltoids', { category: 'Chest', isCompound: false }),
    ];
    const picks = generateFromCategoryMix(['Chest', 'Triceps'], [100, 100], 40, pool, () => 0.5);
    expect(picks.some((pick) => pick.exerciseId === 'reverse')).toBe(false);
    const chestIds = picks.filter((pick) => pick.exerciseId === 'bench' || pick.exerciseId === 'fly').map((p) => p.exerciseId);
    const triIds = picks
      .filter((pick) => pick.exerciseId === 'pushdown' || pick.exerciseId === 'cg-bench')
      .map((p) => p.exerciseId);
    expect(chestIds).toEqual(expect.arrayContaining(['bench', 'fly']));
    expect(triIds).toEqual(expect.arrayContaining(['cg-bench', 'pushdown']));
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

  it('keeps reverse / rear-delt flies in Shoulders even when stamped Chest', () => {
    const stamped: CatalogExercise = {
      id: 'rev',
      name: 'Reverse Flyes',
      bodyPart: 'shoulders',
      equipment: 'dumbbell',
      targetMuscle: 'deltoids',
      category: 'Chest',
    };
    const untagged = exercise('rev2', 'Dumbbell Bent-Over Reverse Fly', 'other', '');
    const chestFly = exercise('cf', 'Dumbbell Flyes', 'chest', 'pectorals');
    expect(remixCategoryOf(stamped)).toBe('Shoulders');
    expect(remixCategoryOf(untagged)).toBe('Shoulders');
    expect(remixCategoryOf(chestFly)).toBe('Chest');
    expect(exerciseMatchesRemixCategory(stamped, 'Chest')).toBe(false);
    expect(exerciseMatchesRemixCategory(stamped, 'Shoulders')).toBe(true);
  });

  it('corrects other enrich mis-stamps by name', () => {
    expect(
      remixCategoryOf({
        id: '1',
        name: 'Face Pull',
        bodyPart: 'back',
        equipment: 'cable',
        targetMuscle: 'upper back',
        category: 'Back',
      }),
    ).toBe('Shoulders');
    expect(
      remixCategoryOf({
        id: '2',
        name: 'JM Press',
        bodyPart: 'triceps',
        equipment: 'barbell',
        targetMuscle: 'triceps',
        category: 'Chest',
      }),
    ).toBe('Triceps');
    expect(
      remixCategoryOf({
        id: '3',
        name: 'Butterfly Sit Up',
        bodyPart: 'chest',
        equipment: '',
        targetMuscle: 'pectorals',
        category: 'Chest',
      }),
    ).toBe('Core');
    expect(
      remixCategoryOf({
        id: '4',
        name: 'Close-Grip Barbell Bench Press',
        bodyPart: 'chest',
        equipment: 'barbell',
        targetMuscle: 'pectorals',
        category: 'Chest',
      }),
    ).toBe('Triceps');
    expect(
      remixCategoryOf({
        id: '5',
        name: 'dumbbell over bench wrist curl',
        bodyPart: 'forearms',
        equipment: 'dumbbell',
        targetMuscle: 'forearms',
        category: 'Chest',
      }),
    ).toBeNull();
    expect(
      remixCategoryOf({
        id: '6',
        name: 'lying leg raise flat bench',
        bodyPart: 'core',
        equipment: 'bodyweight',
        targetMuscle: 'abdominals',
        category: 'Chest',
      }),
    ).toBe('Core');
    expect(
      remixCategoryOf({
        id: '7',
        name: 'push-up inside leg kick',
        bodyPart: 'legs',
        equipment: 'bodyweight',
        targetMuscle: 'glutes',
        category: 'Chest',
      }),
    ).toBe('Chest');
    expect(
      remixCategoryOf({
        id: '8',
        name: 'bench hip extension',
        bodyPart: 'legs',
        equipment: 'bodyweight',
        targetMuscle: 'glutes',
        category: 'Chest',
      }),
    ).toBe('Legs');
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

  it('classifies compound vs isolation from name and override', () => {
    expect(isCompoundExercise(exercise('b', 'Barbell bench press', 'chest', 'pectorals'))).toBe(true);
    expect(isCompoundExercise(exercise('f', 'Cable fly', 'chest', 'pectorals', { isCompound: false }))).toBe(false);
    expect(isCompoundExercise(exercise('d', 'Parallel bar dip', 'chest', 'pectorals'))).toBe(true);
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
