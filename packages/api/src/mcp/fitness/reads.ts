import type { SupabaseClient } from '@supabase/supabase-js';
import { mondayWeekStart, type Day } from '@kinexus/domain';

import {
  EXERCISE_NOT_FOUND,
  PLAN_NOT_FOUND,
  SESSION_NOT_FOUND,
  WORKOUT_NOT_FOUND,
  mapExercise,
  mapWorkout,
  mapWorkoutExercise,
  normalizeName,
  parseIsoDate,
  resolveCallerHousehold,
  titleMatches,
  type ExerciseSummary,
  type PlanDaySummary,
  type SessionSummary,
  type TrainingPlanSummary,
  type WorkoutSummary,
} from './shared.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function listWorkouts(
  client: SupabaseClient,
  userId: string,
  opts?: { query?: string; limit?: number; includePlanOnly?: boolean },
): Promise<{ householdId: string; workouts: WorkoutSummary[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  let builder = client
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false })
    .limit(limit * 2);
  if (!opts?.includePlanOnly) {
    builder = builder.eq('plan_only', false);
  }
  if (opts?.query?.trim()) {
    builder = builder.ilike('name', `%${opts.query.trim()}%`);
  }
  const { data, error } = await builder;
  if (error) throw new Error(error.message);

  const workouts = (data ?? [])
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const exercises = Array.isArray(rec.workout_exercises)
        ? (rec.workout_exercises as Record<string, unknown>[])
            .slice()
            .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
            .map((ex) => mapWorkoutExercise(ex))
        : [];
      return mapWorkout(rec, exercises);
    })
    .slice(0, limit);

  return { householdId, workouts };
}

export async function getWorkout(
  client: SupabaseClient,
  userId: string,
  workoutId: string,
): Promise<{ householdId: string; workout: WorkoutSummary }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const { data, error } = await client
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('id', workoutId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(WORKOUT_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(WORKOUT_NOT_FOUND);
  const exercises = Array.isArray(rec.workout_exercises)
    ? (rec.workout_exercises as Record<string, unknown>[])
        .slice()
        .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
        .map((ex) => mapWorkoutExercise(ex))
    : [];
  return { householdId, workout: mapWorkout(rec, exercises) };
}

export async function searchExercises(
  client: SupabaseClient,
  userId: string,
  opts: { query?: string; limit?: number },
): Promise<{ householdId: string; exercises: ExerciseSummary[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const query = opts.query?.trim() ?? '';

  let builder = client
    .from('exercises')
    .select('*')
    .is('merged_into', null)
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(limit * 3);

  if (query) {
    builder = builder.ilike('name', `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);

  let exercises = (data ?? []).map((row) => mapExercise(row as Record<string, unknown>));
  if (query) {
    const q = normalizeName(query);
    exercises = exercises.filter(
      (ex) =>
        normalizeName(ex.name).includes(q) ||
        normalizeName(ex.bodyPart).includes(q) ||
        normalizeName(ex.targetMuscle).includes(q) ||
        normalizeName(ex.equipment).includes(q),
    );
  }
  return { householdId, exercises: exercises.slice(0, limit) };
}

export async function findExerciseByName(
  client: SupabaseClient,
  name: string,
): Promise<ExerciseSummary | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await client
    .from('exercises')
    .select('*')
    .is('merged_into', null)
    .eq('status', 'active')
    .ilike('name', `%${trimmed}%`)
    .limit(40);
  if (error) throw new Error(error.message);
  const exact = (data ?? [])
    .map((row) => mapExercise(row as Record<string, unknown>))
    .find((ex) => normalizeName(ex.name) === normalizeName(trimmed));
  if (exact) return exact;
  return (
    (data ?? [])
      .map((row) => mapExercise(row as Record<string, unknown>))
      .find((ex) => titleMatches(ex.name, trimmed)) ?? null
  );
}

export async function loadExerciseOrThrow(
  client: SupabaseClient,
  exerciseId: string,
): Promise<ExerciseSummary> {
  const { data, error } = await client.from('exercises').select('*').eq('id', exerciseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(EXERCISE_NOT_FOUND);
  return mapExercise(data as Record<string, unknown>);
}

export async function findWorkoutDedupeCandidates(
  client: SupabaseClient,
  householdId: string,
  title: string,
  exerciseNames: readonly string[],
): Promise<WorkoutSummary[]> {
  const { data, error } = await client
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('household_id', householdId)
    .eq('plan_only', false)
    .ilike('name', `%${title.trim()}%`)
    .limit(40);
  if (error) throw new Error(error.message);

  const wanted = new Set(exerciseNames.map(normalizeName).filter(Boolean));
  return (data ?? [])
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const exercises = Array.isArray(rec.workout_exercises)
        ? (rec.workout_exercises as Record<string, unknown>[]).map((ex) => mapWorkoutExercise(ex))
        : [];
      return mapWorkout(rec, exercises);
    })
    .filter((workout) => {
      if (!titleMatches(workout.name, title)) return false;
      if (wanted.size === 0) return true;
      const have = new Set(workout.exercises.map((ex) => normalizeName(ex.name)));
      let overlap = 0;
      for (const name of wanted) {
        if (have.has(name)) overlap += 1;
      }
      return overlap >= Math.min(2, wanted.size) || (wanted.size === 1 && overlap === 1);
    })
    .slice(0, 8);
}

export async function findExerciseDedupeCandidates(
  client: SupabaseClient,
  name: string,
): Promise<ExerciseSummary[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const { data, error } = await client
    .from('exercises')
    .select('*')
    .is('merged_into', null)
    .eq('status', 'active')
    .ilike('name', `%${trimmed}%`)
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => mapExercise(row as Record<string, unknown>))
    .filter((ex) => titleMatches(ex.name, trimmed) || normalizeName(ex.name) === normalizeName(trimmed))
    .slice(0, 8);
}

export async function listTrainingPlans(
  client: SupabaseClient,
  userId: string,
  opts: { weekStart?: string; limit?: number },
): Promise<{ householdId: string; plans: TrainingPlanSummary[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 30);
  let builder = client
    .from('training_plans')
    .select(
      'id, name, household_id, owner_id, week_start, visibility, training_plan_days(id, day, position, rest_day, focus, duration_min, scheduled_time, status, workout_id, session_id)',
    )
    .eq('household_id', householdId)
    .order('week_start', { ascending: false })
    .limit(limit);

  if (opts.weekStart) {
    builder = builder.eq('week_start', parseIsoDate(opts.weekStart, 'weekStart'));
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);

  const plans = await Promise.all(
    (data ?? []).map(async (row) => mapPlan(client, row as Record<string, unknown>)),
  );
  return { householdId, plans };
}

export async function getTrainingPlan(
  client: SupabaseClient,
  userId: string,
  planId: string,
): Promise<{ householdId: string; plan: TrainingPlanSummary }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const { data, error } = await client
    .from('training_plans')
    .select(
      'id, name, household_id, owner_id, week_start, visibility, training_plan_days(id, day, position, rest_day, focus, duration_min, scheduled_time, status, workout_id, session_id)',
    )
    .eq('id', planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(PLAN_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(PLAN_NOT_FOUND);
  return { householdId, plan: await mapPlan(client, rec) };
}

async function mapPlan(client: SupabaseClient, row: Record<string, unknown>): Promise<TrainingPlanSummary> {
  const dayRows = Array.isArray(row.training_plan_days)
    ? (row.training_plan_days as Record<string, unknown>[])
    : [];
  const workoutIds = [
    ...new Set(
      dayRows
        .map((d) => (typeof d.workout_id === 'string' ? d.workout_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const names = new Map<string, string>();
  if (workoutIds.length > 0) {
    const { data } = await client.from('workouts').select('id, name').in('id', workoutIds);
    for (const w of data ?? []) {
      const rec = asRecord(w);
      if (rec) names.set(String(rec.id), String(rec.name ?? ''));
    }
  }

  const days: PlanDaySummary[] = dayRows
    .slice()
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((d) => {
      const workoutId = typeof d.workout_id === 'string' ? d.workout_id : null;
      return {
        id: String(d.id),
        day: String(d.day) as Day,
        position: typeof d.position === 'number' ? d.position : 0,
        restDay: Boolean(d.rest_day),
        focus: Array.isArray(d.focus) ? d.focus.map(String) : [],
        durationMin: typeof d.duration_min === 'number' ? d.duration_min : null,
        scheduledTime: typeof d.scheduled_time === 'string' ? d.scheduled_time : null,
        status: String(d.status ?? 'planned'),
        workoutId,
        workoutName: workoutId ? (names.get(workoutId) ?? null) : null,
        sessionId: typeof d.session_id === 'string' ? d.session_id : null,
      };
    });

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    householdId: String(row.household_id ?? ''),
    ownerId: String(row.owner_id ?? ''),
    weekStart: String(row.week_start ?? ''),
    visibility: String(row.visibility ?? 'private'),
    days,
  };
}

export async function getWorkoutHistory(
  client: SupabaseClient,
  userId: string,
  opts: { limit?: number; fromDate?: string; toDate?: string },
): Promise<{ householdId: string; sessions: SessionSummary[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  let builder = client
    .from('workout_sessions')
    .select('*, workout_sets(*)')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (opts.fromDate) {
    builder = builder.gte('started_at', `${parseIsoDate(opts.fromDate, 'fromDate')}T00:00:00`);
  }
  if (opts.toDate) {
    builder = builder.lte('started_at', `${parseIsoDate(opts.toDate, 'toDate')}T23:59:59`);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return {
    householdId,
    sessions: (data ?? []).map((row) => mapSession(row as Record<string, unknown>)),
  };
}

export async function getSession(
  client: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<{ householdId: string; session: SessionSummary }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const { data, error } = await client
    .from('workout_sessions')
    .select('*, workout_sets(*)')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(SESSION_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.user_id) !== userId || String(rec.household_id) !== householdId) {
    throw new Error(SESSION_NOT_FOUND);
  }
  return { householdId, session: mapSession(rec) };
}

function mapSession(row: Record<string, unknown>): SessionSummary {
  const sets = Array.isArray(row.workout_sets)
    ? (row.workout_sets as Record<string, unknown>[])
        .slice()
        .sort(
          (a, b) =>
            Number(a.position ?? 0) - Number(b.position ?? 0) ||
            Number(a.set_index ?? 0) - Number(b.set_index ?? 0),
        )
        .map((set) => ({
          id: String(set.id),
          exerciseId: typeof set.exercise_id === 'string' ? set.exercise_id : null,
          exerciseName: String(set.exercise_name ?? ''),
          position: typeof set.position === 'number' ? set.position : 0,
          setIndex: typeof set.set_index === 'number' ? set.set_index : 0,
          weight: typeof set.weight === 'string' ? set.weight : '',
          reps: typeof set.reps === 'string' ? set.reps : '',
          done: Boolean(set.done),
        }))
    : [];
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    workoutId: typeof row.workout_id === 'string' ? row.workout_id : null,
    startedAt: String(row.started_at ?? ''),
    finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
    durationMin: typeof row.duration_min === 'number' ? row.duration_min : null,
    sets,
  };
}

export async function loadCatalogueForFill(client: SupabaseClient) {
  const rows: { id: string; name: string; bodyPart: string; equipment: string; targetMuscle: string; category: string | null; canonicalKey?: string | null; isCompound?: boolean | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('exercises')
      .select('id, name, body_part, equipment, target_muscle, category, canonical_key, is_compound, status, merged_into')
      .is('merged_into', null)
      .eq('status', 'active')
      .order('name')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const rec = row as Record<string, unknown>;
      rows.push({
        id: String(rec.id),
        name: String(rec.name ?? ''),
        bodyPart: String(rec.body_part ?? ''),
        equipment: String(rec.equipment ?? ''),
        targetMuscle: String(rec.target_muscle ?? ''),
        category: typeof rec.category === 'string' ? rec.category : null,
        canonicalKey: typeof rec.canonical_key === 'string' ? rec.canonical_key : null,
        isCompound: typeof rec.is_compound === 'boolean' ? rec.is_compound : null,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export function defaultWeekStart(): string {
  return mondayWeekStart(new Date());
}
