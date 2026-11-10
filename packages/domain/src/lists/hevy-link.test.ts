import { describe, expect, it } from 'vitest';

import {
  HEVY_LINK_PUBLIC_ERROR,
  acceptHevyLinkExerciseMatch,
  buildImportPlanFromHevyLink,
  classifyHevyWorkoutImportUrl,
  findMatchingLibraryWorkout,
  isHevyWorkoutImportUrl,
  keepHevyLinkAsCustom,
  mapHevyLinkIntensities,
  matchHevyLinkExercises,
  parseHevyShareHtml,
} from './parse-hevy-link';

const CATALOG = [
  { id: 'ex-bench', name: 'Bench Press', category: 'Chest' },
  { id: 'ex-squat', name: 'Barbell Squat', category: 'Legs' },
  { id: 'ex-row', name: 'Bent Over Row', category: 'Back' },
  { id: 'ex-run', name: 'Running', category: 'Cardio' },
  { id: 'ex-stretch', name: 'Hip Flexor Stretch', category: 'Mobility' },
];

function nextDataPage(pageProps: Record<string, unknown>): string {
  const payload = {
    props: { pageProps },
    page: '/workout/[id]',
    query: { id: 'abc' },
    buildId: 'test',
  };
  return `<!doctype html><html><head><title>Hevy</title></head><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>
</body></html>`;
}

const WORKOUT_FIXTURE = nextDataPage({
  workout: {
    id: 'w1',
    title: 'Push Strength',
    exercises: [
      {
        title: 'Bench Press (Barbell)',
        sets: [
          { type: 'normal', weight_kg: 80, reps: 8 },
          { type: 'normal', weight_kg: 80, reps: 8 },
          { type: 'normal', weight_kg: 82.5, reps: 6 },
        ],
      },
      {
        title: 'Bent Over Row',
        sets: [
          { type: 'normal', weight_kg: 60, reps: 10 },
          { type: 'normal', weight_kg: 60, reps: 10 },
        ],
      },
      {
        title: 'Push-up',
        sets: [
          { type: 'normal', weight_kg: 0, reps: 15 },
          { type: 'normal', weight_kg: 0, reps: 12 },
        ],
      },
      {
        title: 'Running',
        sets: [{ type: 'normal', duration_seconds: 600, distance_meters: 1600 }],
      },
      {
        title: 'Mystery Band Pull XYZ',
        sets: [{ type: 'normal', weight_kg: 40, reps: 12 }],
      },
    ],
  },
});

const ROUTINE_FIXTURE = nextDataPage({
  routine: {
    title: 'Leg Day Template',
    exercises: [
      {
        title: 'Barbell Squat',
        sets: [
          { type: 'normal', weight_kg: 100, reps: 5 },
          { type: 'warmup', weight_kg: 40, reps: 8 },
          { type: 'normal', weight_kg: 100, reps: 5 },
        ],
      },
    ],
  },
});

describe('classifyHevyWorkoutImportUrl', () => {
  it('accepts hevy.com workout and routine paths', () => {
    expect(classifyHevyWorkoutImportUrl('https://hevy.com/workout/9zxJ5CLFduN')).toEqual({
      kind: 'workout',
      id: '9zxJ5CLFduN',
      canonicalUrl: 'https://hevy.com/workout/9zxJ5CLFduN',
    });
    expect(classifyHevyWorkoutImportUrl('https://www.hevy.com/routine/abc123')).toEqual({
      kind: 'routine',
      id: 'abc123',
      canonicalUrl: 'https://hevy.com/routine/abc123',
    });
    expect(isHevyWorkoutImportUrl('https://hevy.app/x/shorty')).toBe(true);
    expect(classifyHevyWorkoutImportUrl('https://hevy.app/x/shorty')?.kind).toBe('short');
    expect(isHevyWorkoutImportUrl('https://imdb.com/list/ls1')).toBe(false);
  });
});

describe('parseHevyShareHtml', () => {
  it('parses exercises and sets from __NEXT_DATA__ workout pages', () => {
    const parsed = parseHevyShareHtml(WORKOUT_FIXTURE, 'https://hevy.com/workout/abc');
    expect(parsed.privateOrBlocked).toBe(false);
    expect(parsed.title).toBe('Push Strength');
    expect(parsed.exercises).toHaveLength(5);
    expect(parsed.exercises[0]?.name).toBe('Bench Press (Barbell)');
    expect(parsed.exercises[0]?.sets).toHaveLength(3);
    expect(parsed.exercises[0]?.sets[2]?.weightKg).toBe(82.5);
    expect(parsed.exercises[0]?.sets[2]?.reps).toBe('6');
    expect(parsed.exercises[3]?.sets[0]?.durationSec).toBe(600);
    expect(parsed.exercises[3]?.sets[0]?.distanceM).toBe(1600);
  });

  it('parses routine pages and skips warmup sets', () => {
    const parsed = parseHevyShareHtml(ROUTINE_FIXTURE);
    expect(parsed.title).toBe('Leg Day Template');
    expect(parsed.exercises[0]?.sets).toHaveLength(2);
  });

  it('flags private/unreadable pages', () => {
    const parsed = parseHevyShareHtml('<html><body>This workout is private.</body></html>');
    expect(parsed.privateOrBlocked).toBe(true);
    expect(parsed.exercises).toHaveLength(0);
    expect(HEVY_LINK_PUBLIC_ERROR).toMatch(/isn't public/i);
  });

  it('reads ld+json when NEXT_DATA is absent', () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      '@type': 'ExercisePlan',
      name: 'Quick Circuit',
      exercise: [{ name: 'Burpee' }, { name: 'Plank' }],
    })}</script></body></html>`;
    const parsed = parseHevyShareHtml(html);
    expect(parsed.title).toBe('Quick Circuit');
    expect(parsed.exercises.map((ex) => ex.name)).toEqual(['Burpee', 'Plank']);
  });
});

describe('match + intensity', () => {
  it('maps matcher statuses to matched / likely / missing', () => {
    const parsed = parseHevyShareHtml(WORKOUT_FIXTURE);
    const matched = matchHevyLinkExercises(parsed, CATALOG);
    expect(matched.find((ex) => ex.sourceName.includes('Bench'))?.matchStatus).toBe('matched');
    expect(matched.find((ex) => ex.sourceName === 'Bent Over Row')?.matchStatus).toBe('matched');
    expect(matched.find((ex) => ex.sourceName === 'Mystery Band Pull XYZ')?.matchStatus).toBe('missing');
    expect(matched.find((ex) => ex.sourceName === 'Mystery Band Pull XYZ')?.willCreateCustom).toBe(true);
    expect(matched.find((ex) => ex.sourceName === 'Running')?.matchStatus).toBe('matched');
  });

  it('maps Load heavy/medium/light + bodyweight Light; cardio Effort Medium', () => {
    const parsed = parseHevyShareHtml(WORKOUT_FIXTURE);
    const intensities = mapHevyLinkIntensities(parsed.exercises, new Map([
      ['bench press', 'Chest'],
      ['bent over row', 'Back'],
      ['push up', 'Chest'],
      ['running', 'Cardio'],
      ['mystery band pull xyz', 'Back'],
    ]));
    // Weights present: bench 82.5, row 60, mystery 40 — top/mid/bottom; push-up bodyweight light; running effort medium
    const byName = Object.fromEntries(parsed.exercises.map((ex, i) => [ex.name, intensities[i]]));
    expect(byName['Bench Press (Barbell)']).toBe('heavy');
    expect(byName['Bent Over Row']).toBe('moderate');
    expect(byName['Mystery Band Pull XYZ']).toBe('light');
    expect(byName['Push-up']).toBe('light');
    expect(byName.Running).toBe('moderate');
  });

  it('accepting a likely/missing pick clears willCreateCustom', () => {
    const parsed = parseHevyShareHtml(WORKOUT_FIXTURE);
    const matched = matchHevyLinkExercises(parsed, CATALOG);
    const plan = buildImportPlanFromHevyLink({
      title: parsed.title,
      url: 'https://hevy.com/workout/abc',
      exercises: matched,
    });
    expect(plan.format).toBe('hevy-link');
    expect(plan.customExercisesSupported).toBe(true);
    const missingIndex = matched.findIndex((ex) => ex.matchStatus === 'missing');
    const next = acceptHevyLinkExerciseMatch(plan, missingIndex, {
      exerciseId: 'ex-row',
      name: 'Bent Over Row',
      confidence: 0.95,
    });
    const exercise = next.workoutRoutines?.[0]?.exercises[missingIndex] as {
      matchStatus?: string;
      willCreateCustom?: boolean;
      exerciseId?: string | null;
    };
    expect(exercise.matchStatus).toBe('matched');
    expect(exercise.willCreateCustom).toBe(false);
    expect(exercise.exerciseId).toBe('ex-row');

    const custom = keepHevyLinkAsCustom(plan, missingIndex);
    expect((custom.workoutRoutines?.[0]?.exercises[missingIndex] as { willCreateCustom?: boolean }).willCreateCustom).toBe(
      true,
    );
  });
});

describe('library dedupe', () => {
  it('offers existing when title + exercise set match', () => {
    const hit = findMatchingLibraryWorkout(
      'Push Strength',
      ['Bench Press', 'Bent Over Row', 'Push-up'],
      [
        {
          id: 'w-existing',
          name: 'Push Strength',
          exerciseNames: ['Push-up', 'Bench Press', 'Bent Over Row'],
        },
      ],
    );
    expect(hit?.id).toBe('w-existing');
    expect(
      findMatchingLibraryWorkout('Push Strength', ['Bench Press'], [
        { id: 'w-existing', name: 'Push Strength', exerciseNames: ['Bench Press', 'Row'] },
      ]),
    ).toBeNull();
  });
});
