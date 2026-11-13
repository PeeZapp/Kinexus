import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_CANDIDATES = [
  join(root, 'seeds', 'workout-seed-catalogue.json'),
  join(root, 'seed', 'workout-seed-catalogue.json'),
];
const DEFAULT_OUT = join(root, 'supabase', 'migrations', '20261112151809_seed_kinexus_workouts.sql');

const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const GOALS = new Set(['strength', 'hypertrophy', 'conditioning', 'mobility', 'fat_loss']);
const EQUIPMENT = new Set([
  'bodyweight',
  'dumbbells',
  'barbell',
  'kettlebell',
  'bands',
  'machines',
  'cable',
  'other',
]);
const TRACKING = new Set(['reps', 'time', 'intervals', 'distance']);
const UNITS = new Set(['reps', 'sec', 'min', 'km', 'm']);

export function uuidFromSlug(slug) {
  const bytes = Buffer.from(
    createHash('sha1').update(`kinexus.workout.system.${slug}`).digest().subarray(0, 16),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildExerciseNote(exercise) {
  const rest =
    exercise.rest_sec != null && Number.isFinite(Number(exercise.rest_sec))
      ? `Rest ${Number(exercise.rest_sec)}s`
      : '';
  const extra = typeof exercise.note === 'string' ? exercise.note.trim() : '';
  let note = '';
  if (rest && extra) note = `${rest} · ${extra}`;
  else if (rest) note = rest;
  else if (extra) note = extra;
  if (note.length > 160) {
    throw new Error(`note exceeds 160 chars for ${exercise.name}: ${note.length}`);
  }
  return note;
}

function sqlStr(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlTextArray(values) {
  if (!values?.length) return `'{}'::text[]`;
  return `array[${values.map((v) => sqlStr(v)).join(', ')}]::text[]`;
}

function sqlNum(value) {
  if (value === null || value === undefined || value === '') return 'null';
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`invalid number: ${value}`);
  return String(n);
}

export function validateWorkout(workout) {
  if (!workout?.slug || typeof workout.slug !== 'string') throw new Error('workout.slug required');
  if (!workout.title || typeof workout.title !== 'string') throw new Error(`title required for ${workout.slug}`);
  if (workout.description != null && String(workout.description).length > 300) {
    throw new Error(`description > 300 for ${workout.slug}`);
  }
  if (!LEVELS.has(workout.level)) throw new Error(`bad level for ${workout.slug}: ${workout.level}`);
  if (!GOALS.has(workout.goal)) throw new Error(`bad goal for ${workout.slug}: ${workout.goal}`);
  if (!Array.isArray(workout.equipment) || workout.equipment.length === 0) {
    throw new Error(`equipment required for ${workout.slug}`);
  }
  for (const item of workout.equipment) {
    if (!EQUIPMENT.has(item)) throw new Error(`bad equipment ${item} for ${workout.slug}`);
  }
  const minutes = Number(workout.est_minutes);
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new Error(`bad est_minutes for ${workout.slug}`);
  }
  if (!Array.isArray(workout.exercises) || workout.exercises.length === 0) {
    throw new Error(`exercises required for ${workout.slug}`);
  }
  for (const exercise of workout.exercises) {
    if (!exercise.catalog_id) throw new Error(`catalog_id required in ${workout.slug}`);
    if (!exercise.name) throw new Error(`exercise name required in ${workout.slug}`);
    if (!Number.isInteger(exercise.position) || exercise.position < 0) {
      throw new Error(`bad position in ${workout.slug}`);
    }
    const sets = Number(exercise.sets);
    if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
      throw new Error(`bad sets in ${workout.slug}/${exercise.name}`);
    }
    if (!TRACKING.has(exercise.tracking)) {
      throw new Error(`bad tracking in ${workout.slug}/${exercise.name}`);
    }
    if (!UNITS.has(exercise.target_unit)) {
      throw new Error(`bad target_unit in ${workout.slug}/${exercise.name}`);
    }
    if (exercise.target_reps != null && String(exercise.target_reps).length > 40) {
      throw new Error(`target_reps too long in ${workout.slug}/${exercise.name}`);
    }
    if (exercise.duration_sec != null) {
      const d = Number(exercise.duration_sec);
      if (!Number.isInteger(d) || d < 1 || d > 86400) {
        throw new Error(`bad duration_sec in ${workout.slug}/${exercise.name}`);
      }
    }
    if (exercise.distance_km != null) {
      const d = Number(exercise.distance_km);
      if (!Number.isFinite(d) || d < 0) {
        throw new Error(`bad distance_km in ${workout.slug}/${exercise.name}`);
      }
    }
    buildExerciseNote(exercise);
  }
}

export function loadCatalogue(path = SEED_CANDIDATES.find((p) => existsSync(p))) {
  if (!path) throw new Error('workout-seed-catalogue.json not found under packages/db/seeds or seed');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const workouts = raw.workouts ?? raw;
  if (!Array.isArray(workouts)) throw new Error('catalogue must contain a workouts array');
  return workouts;
}

export function buildSeedSql(workouts) {
  if (workouts.length !== 74) {
    throw new Error(`expected 74 workouts, got ${workouts.length}`);
  }
  const ids = new Set();
  const lines = [
    '-- Seeded official Kinexus global workouts (is_system).',
    '-- Generated by packages/db/scripts/build-workout-seed.mjs — do not hand-edit.',
    '-- Idempotent: workouts on conflict (id) do nothing; exercises skipped when already present.',
    '',
  ];

  for (const workout of workouts) {
    validateWorkout(workout);
    const id = uuidFromSlug(workout.slug);
    if (ids.has(id)) throw new Error(`duplicate uuid for ${workout.slug}`);
    ids.add(id);

    lines.push(`-- ${workout.slug}`);
    lines.push(`insert into public.workouts (`);
    lines.push(
      `  id, household_id, created_by, name, description, visibility, level, goal, equipment,`,
    );
    lines.push(`  duration_min, is_system, in_library, plan_only, is_shared`);
    lines.push(`) values (`);
    lines.push(
      `  ${sqlStr(id)}, null, null, ${sqlStr(workout.title)}, ${sqlStr(workout.description ?? null)},`,
    );
    lines.push(
      `  'global', ${sqlStr(workout.level)}, ${sqlStr(workout.goal)}, ${sqlTextArray(workout.equipment)},`,
    );
    lines.push(
      `  ${sqlNum(workout.est_minutes)}, true, true, false, false`,
    );
    lines.push(`) on conflict (id) do nothing;`);
    lines.push('');

    lines.push(`insert into public.workout_exercises (`);
    lines.push(
      `  workout_id, household_id, exercise_id, name, position, target_sets, target_reps, tracking, target_unit,`,
    );
    lines.push(`  target_duration_sec, target_distance_km, note`);
    lines.push(`)`);
    lines.push(`select`);
    lines.push(`  v.workout_id::uuid,`);
    lines.push(`  null::uuid,`);
    lines.push(`  v.exercise_id::uuid,`);
    lines.push(`  v.name,`);
    lines.push(`  v.position::integer,`);
    lines.push(`  v.target_sets::integer,`);
    lines.push(`  v.target_reps,`);
    lines.push(`  v.tracking,`);
    lines.push(`  v.target_unit,`);
    lines.push(`  v.target_duration_sec::integer,`);
    lines.push(`  v.target_distance_km::numeric,`);
    lines.push(`  v.note`);
    lines.push(`from (values`);

    const valueRows = workout.exercises.map((exercise, index) => {
      const note = buildExerciseNote(exercise);
      const reps =
        exercise.reps_target == null || exercise.reps_target === ''
          ? '10'
          : String(exercise.reps_target);
      const duration = exercise.duration_sec == null ? 'null' : sqlNum(exercise.duration_sec);
      const distance = exercise.distance_km == null ? 'null' : sqlNum(exercise.distance_km);
      const cols = [
        sqlStr(id),
        sqlStr(exercise.catalog_id),
        sqlStr(exercise.name),
        sqlNum(exercise.position ?? index),
        sqlNum(exercise.sets),
        sqlStr(reps),
        sqlStr(exercise.tracking),
        sqlStr(exercise.target_unit),
        duration,
        distance,
        note ? sqlStr(note) : 'null',
      ];
      return `  (${cols.join(', ')})`;
    });
    lines.push(valueRows.join(',\n'));
    lines.push(`) as v(`);
    lines.push(
      `  workout_id, exercise_id, name, position, target_sets, target_reps, tracking, target_unit,`,
    );
    lines.push(`  target_duration_sec, target_distance_km, note`);
    lines.push(`)`);
    lines.push(`where not exists (`);
    lines.push(`  select 1 from public.workout_exercises we where we.workout_id = ${sqlStr(id)}::uuid`);
    lines.push(`);`);
    lines.push('');
  }

  lines.push(`notify pgrst, 'reload schema';`);
  lines.push('');
  return lines.join('\n');
}

export function writeSeedMigration(outPath = DEFAULT_OUT, cataloguePath) {
  const workouts = loadCatalogue(cataloguePath);
  const sql = buildSeedSql(workouts);
  writeFileSync(outPath, sql, 'utf8');
  return { outPath, count: workouts.length, ids: workouts.map((w) => uuidFromSlug(w.slug)) };
}

const invokedAsMain =
  Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedAsMain) {
  const result = writeSeedMigration();
  console.log(`Wrote ${result.count} workouts to ${result.outPath}`);
}
