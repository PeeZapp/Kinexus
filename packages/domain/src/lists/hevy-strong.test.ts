import { describe, expect, it } from 'vitest';

import { detectListSource } from './detect';
import { buildImportPlan } from './import-plan';
import {
  MATCH_AUTO_ACCEPT,
  MATCH_NEEDS_CONFIRM,
  classifyMatchConfidence,
} from './match-confidence';
import {
  exerciseMatchConfidence,
  matchWorkoutExercises,
  rankExerciseMatches,
} from './match-exercise';
import { looksLikeHevyCsv, parseHevyCsv } from './parse-hevy';
import { looksLikeStrongCsv, parseStrongCsv } from './parse-strong';
import {
  applyHistoryDedupe,
  applyRoutineDedupe,
  parseStrongDurationToMinutes,
  routinesFromSessions,
} from './workout-import';

/** Hevy headers: title, start_time, end_time, description, exercise_title, superset_id,
 * exercise_notes, set_index, set_type, weight_kg|weight_lbs, reps, distance_*, duration_seconds, rpe */
const HEVY_KG = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
Push Day,"5 Jan 2026, 17:00","5 Jan 2026, 18:10",,"Bench Press (Barbell)",,,"0",normal,60,8,,,7.5
Push Day,"5 Jan 2026, 17:00","5 Jan 2026, 18:10",,"Bench Press (Barbell)",,,"1",normal,60,8,,,
Push Day,"5 Jan 2026, 17:00","5 Jan 2026, 18:10",,"Bench Press (Barbell)",,,"2",normal,62.5,6,,,
Push Day,"5 Jan 2026, 17:00","5 Jan 2026, 18:10",,"Plank",,,"0",normal,,,45,60,
Leg Day,"6 Jan 2026, 09:00","6 Jan 2026, 10:00",,"Back Squat",,,"0",warmup,40,5,,,
Leg Day,"6 Jan 2026, 09:00","6 Jan 2026, 10:00",,"Back Squat",,,"1",normal,100,5,,,8
`;

const HEVY_LB = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe
Upper,"28 Mar 2025, 17:29","28 Mar 2025, 18:52",,"Bench Press (Barbell)",,,"0",normal,135,8,,,
Upper,"28 Mar 2025, 17:29","28 Mar 2025, 18:52",,"Treadmill",,,"0",normal,,,1.5,900,
`;

/** Strong headers: Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps, Distance, Seconds, Notes, Workout Notes, RPE */
const STRONG_KG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2021-07-24 10:37:18,Legs and Core,1h 9m,Back Squat,1,100,5,,,Belt,,8
2021-07-24 10:37:18,Legs and Core,1h 9m,Back Squat,2,100,5,,,,,
2021-07-24 10:37:18,Legs and Core,1h 9m,Plank,1,,,,45,,,
2021-07-25 08:00:00,Push A,45m,Bench Press (Barbell),1,60,8,,,,,7
`;

const STRONG_LB_SEMI = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight (lbs);Reps;Distance;Seconds;Notes;Workout Notes;RPE
2021-07-24 10:37:18;Upper;1h 9m;Bench Press (Barbell);1;225;5;;;;;
2021-07-24 10:37:18;Upper;1h 9m;Bench Press (Barbell);2;225;5;;;;;
2021-07-24 10:37:18;Upper;1h 9m;Run;1;;;1;600;;;
`;

const IMDB_WATCHLIST = `Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
1,tt1375666,2020-01-01,2020-01-01,,Inception,https://www.imdb.com/title/tt1375666/,movie,8.8,148,2010,Action,2000000,2010-07-16,Christopher Nolan
`;

const LB_WATCHLIST = `Date,Name,Year,Letterboxd URI,Rating
2024-01-01,Inception,2010,https://boxd.it/1Skk,
`;

const GENERIC_CSV = `title,sets,reps,weight
Back Squat,3,5,100
`;

const CATALOG = [
  { id: 'ex-bench', name: 'Barbell Bench Press' },
  { id: 'ex-squat', name: 'Barbell Back Squat' },
  { id: 'ex-plank', name: 'Plank' },
  { id: 'ex-curl', name: 'Dumbbell Curl' },
];

describe('Hevy CSV', () => {
  it('detects known headers', () => {
    expect(looksLikeHevyCsv(HEVY_KG.split('\n')[0]!.split(','))).toBe(true);
    expect(detectListSource({ fileName: 'workout_data.csv', text: HEVY_KG })).toBe('hevy-csv');
  });

  it('parses kg multi-set + duration cardio and groups workouts', () => {
    const parsed = parseHevyCsv(HEVY_KG);
    expect(parsed.sourceWeightUnit).toBe('kg');
    expect(parsed.sessions).toHaveLength(2);
    const push = parsed.sessions.find((session) => session.name === 'Push Day')!;
    expect(push.exercises).toHaveLength(2);
    const bench = push.exercises.find((exercise) => exercise.name.includes('Bench'))!;
    expect(bench.targetSets).toBe(3);
    expect(bench.targetWeightKg).toBe(62.5);
    expect(bench.sets).toHaveLength(3);
    const plank = push.exercises.find((exercise) => exercise.name === 'Plank')!;
    expect(plank.sets[0]?.durationSec).toBe(60);
    const legs = parsed.sessions.find((session) => session.name === 'Leg Day')!;
    const squat = legs.exercises[0]!;
    // warmup excluded from target sets
    expect(squat.targetSets).toBe(1);
    expect(squat.targetWeightKg).toBe(100);
    expect(squat.targetRpe).toBe(8);
  });

  it('parses lb + distance miles into canonical kg/meters', () => {
    const parsed = parseHevyCsv(HEVY_LB);
    expect(parsed.sourceWeightUnit).toBe('lb');
    const bench = parsed.sessions[0]!.exercises[0]!;
    expect(bench.targetWeightKg).toBeGreaterThan(60);
    expect(bench.targetWeightKg).toBeLessThan(65);
    const cardio = parsed.sessions[0]!.exercises[1]!;
    expect(cardio.sets[0]?.distanceM).toBeGreaterThan(2000);
    expect(cardio.sets[0]?.durationSec).toBe(900);
  });
});

describe('Strong CSV', () => {
  it('detects known headers and odd delimiters', () => {
    expect(looksLikeStrongCsv(STRONG_KG.split('\n')[0]!.split(','))).toBe(true);
    expect(detectListSource({ fileName: 'strong.csv', text: STRONG_KG })).toBe('strong-csv');
    expect(detectListSource({ fileName: 'strong.csv', text: STRONG_LB_SEMI })).toBe('strong-csv');
  });

  it('parses duration formats and kg sessions', () => {
    expect(parseStrongDurationToMinutes('1h 9m')).toBe(69);
    expect(parseStrongDurationToMinutes('45m')).toBe(45);
    expect(parseStrongDurationToMinutes('90s')).toBe(2);
    const parsed = parseStrongCsv(STRONG_KG);
    expect(parsed.sourceWeightUnit).toBe('kg');
    expect(parsed.sessions).toHaveLength(2);
    const legs = parsed.sessions[0]!;
    expect(legs.durationMin).toBe(69);
    expect(legs.exercises[0]!.targetSets).toBe(2);
    expect(legs.exercises[0]!.targetWeightKg).toBe(100);
    expect(legs.exercises[1]!.sets[0]?.durationSec).toBe(45);
  });

  it('parses semicolon lb export', () => {
    const parsed = parseStrongCsv(STRONG_LB_SEMI);
    expect(parsed.sourceWeightUnit).toBe('lb');
    const bench = parsed.sessions[0]!.exercises[0]!;
    expect(bench.targetWeightKg).toBeGreaterThan(100);
    expect(bench.sets).toHaveLength(2);
  });
});

describe('exercise matching thresholds', () => {
  it('auto-accepts strong catalogue hits', () => {
    const score = exerciseMatchConfidence('Plank', 'Plank');
    expect(classifyMatchConfidence(score)).toBe('auto');
    expect(score).toBeGreaterThanOrEqual(MATCH_AUTO_ACCEPT);
  });

  it('needs confirmation for fuzzy near-matches', () => {
    const ranked = rankExerciseMatches('Bench Press (Barbell)', CATALOG);
    expect(ranked[0]?.exerciseId).toBe('ex-bench');
    expect(ranked[0]!.confidence).toBeGreaterThanOrEqual(MATCH_NEEDS_CONFIRM);
  });

  it('marks low confidence as unmatched free-text', () => {
    const matched = matchWorkoutExercises(
      [
        {
          name: 'Totally Made Up Lift XYZ',
          exerciseId: null,
          matchConfidence: null,
          candidates: null,
          status: 'ready',
          note: null,
          sets: [],
          targetSets: 3,
          targetReps: '8',
          targetWeightKg: null,
          targetRpe: null,
        },
      ],
      CATALOG,
    );
    expect(matched[0]!.status).toBe('needsMatch');
    expect(matched[0]!.exerciseId).toBeNull();
  });
});

describe('dedupe', () => {
  it('dedupes routines by name and history by start+name', () => {
    const parsed = parseHevyCsv(HEVY_KG);
    const routines = applyRoutineDedupe(routinesFromSessions(parsed.sessions), ['Push Day']);
    expect(routines.find((item) => item.name === 'Push Day')?.status).toBe('duplicate');
    expect(routines.find((item) => item.name === 'Leg Day')?.status).toBe('ready');

    const history = applyHistoryDedupe(parsed.sessions, [
      { name: 'Push Day', startedAt: '2026-01-05T17:00:00' },
    ]);
    expect(history.find((item) => item.name === 'Push Day')?.status).toBe('duplicate');
    expect(history.find((item) => item.name === 'Leg Day')?.status).toBe('ready');
  });
});

describe('wizard detection isolation', () => {
  it('does not misdetect IMDb / Letterboxd / generic CSV as Hevy or Strong', () => {
    expect(detectListSource({ fileName: 'watchlist.csv', text: IMDB_WATCHLIST })).toBe('imdb-csv');
    expect(detectListSource({ fileName: 'watchlist.csv', text: LB_WATCHLIST })).toBe('letterboxd-csv');
    expect(detectListSource({ fileName: 'workout.csv', text: GENERIC_CSV })).toBe('csv');
    expect(looksLikeHevyCsv(GENERIC_CSV.split('\n')[0]!.split(','))).toBe(false);
    expect(looksLikeStrongCsv(GENERIC_CSV.split('\n')[0]!.split(','))).toBe(false);
  });

  it('buildImportPlan yields workout routines for Hevy/Strong', async () => {
    const hevy = await buildImportPlan({ fileName: 'hevy.csv', text: HEVY_KG, kindHint: 'workout' });
    expect(hevy.format).toBe('hevy-csv');
    expect(hevy.kind).toBe('workout');
    expect(hevy.supportsHistory).toBe(true);
    expect(hevy.customExercisesSupported).toBe(false);
    expect(hevy.workoutRoutines?.length).toBe(2);

    const strong = await buildImportPlan({ fileName: 'strong.csv', text: STRONG_KG, kindHint: 'workout' });
    expect(strong.format).toBe('strong-csv');
    expect(strong.workoutSessions?.length).toBe(2);
  });
});
