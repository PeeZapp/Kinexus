import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';

export type SharedTrainingPlanExercise = {
  name: string;
  sets: number;
  reps: string;
  effort: string | null;
  rpe: number | null;
  note: string;
  supersetId: string | null;
};

export type SharedTrainingPlanDay = {
  day: string;
  restDay: boolean;
  focus: string[];
  durationMin: number | null;
  exercises: SharedTrainingPlanExercise[];
};

export type SharedTrainingPlanPayload = {
  name: string;
  weekStart: string;
  days: SharedTrainingPlanDay[];
};

export type SharedTrainingPlanDeps = {
  isConfigured: () => boolean;
  createClient: () => ReturnType<typeof createServiceClient>;
};

const defaultDeps: SharedTrainingPlanDeps = {
  isConfigured: isServiceRoleConfigured,
  createClient: createServiceClient,
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function exercisesFromSpec(spec: unknown): SharedTrainingPlanExercise[] {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [];
  const exercises = (spec as { exercises?: unknown }).exercises;
  if (!Array.isArray(exercises)) return [];
  return exercises.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const rec = row as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name : '';
    if (!name) return [];
    return [
      {
        name,
        sets: typeof rec.targetSets === 'number' ? rec.targetSets : typeof rec.sets === 'number' ? rec.sets : 3,
        reps: typeof rec.targetReps === 'string' ? rec.targetReps : typeof rec.reps === 'string' ? rec.reps : '8',
        effort: typeof rec.targetEffort === 'string' ? rec.targetEffort : typeof rec.effort === 'string' ? rec.effort : null,
        rpe: typeof rec.targetRpe === 'number' ? rec.targetRpe : typeof rec.rpe === 'number' ? rec.rpe : null,
        note: typeof rec.note === 'string' ? rec.note : '',
        supersetId: typeof rec.supersetId === 'string' ? rec.supersetId : null,
      },
    ];
  });
}

export async function handleGetSharedTrainingPlan(
  token: string,
  deps: SharedTrainingPlanDeps = defaultDeps,
): Promise<{ status: number; body: SharedTrainingPlanPayload | { error: string } }> {
  const trimmed = token.trim();
  if (!trimmed) return { status: 400, body: { error: 'Share token required' } };
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'Shared plans are not configured' } };
  }

  const client = deps.createClient();
  const { data: plan, error: planError } = await client
    .from('training_plans')
    .select('id, name, week_start, is_shared')
    .eq('share_token', trimmed)
    .eq('is_shared', true)
    .maybeSingle();

  if (planError) return { status: 500, body: { error: planError.message } };
  if (!plan) return { status: 404, body: { error: 'Plan not found or not shared' } };

  const { data: dayRows, error: daysError } = await client
    .from('training_plan_days')
    .select('day, position, rest_day, focus, duration_min, generated_spec, workout_id')
    .eq('plan_id', plan.id)
    .order('position', { ascending: true });
  if (daysError) return { status: 500, body: { error: daysError.message } };

  const workoutIds = [...new Set((dayRows ?? []).flatMap((row) => (row.workout_id ? [row.workout_id] : [])))];
  const exerciseByWorkout = new Map<string, SharedTrainingPlanExercise[]>();

  if (workoutIds.length > 0) {
    const { data: exercises, error: exercisesError } = await client
      .from('workout_exercises')
      .select('workout_id, name, position, target_sets, target_reps, target_effort, target_rpe, note, superset_id')
      .in('workout_id', workoutIds)
      .order('position', { ascending: true });
    if (exercisesError) return { status: 500, body: { error: exercisesError.message } };

    for (const row of exercises ?? []) {
      const list = exerciseByWorkout.get(row.workout_id) ?? [];
      list.push({
        name: row.name,
        sets: row.target_sets,
        reps: row.target_reps,
        effort: row.target_effort,
        rpe: row.target_rpe == null ? null : Number(row.target_rpe),
        note: typeof row.note === 'string' ? row.note : '',
        supersetId: row.superset_id ?? null,
      });
      exerciseByWorkout.set(row.workout_id, list);
    }
  }

  const days: SharedTrainingPlanDay[] = (dayRows ?? [])
    .filter((row) => typeof row.day === 'string' && (DAYS as readonly string[]).includes(row.day))
    .map((row) => {
      const restDay = Boolean(row.rest_day);
      const fromWorkout = row.workout_id ? exerciseByWorkout.get(row.workout_id) ?? [] : [];
      const fromSpec = exercisesFromSpec(row.generated_spec);
      return {
        day: row.day,
        restDay,
        focus: Array.isArray(row.focus) ? row.focus.map(String) : [],
        durationMin: typeof row.duration_min === 'number' ? row.duration_min : null,
        exercises: restDay ? [] : fromWorkout.length > 0 ? fromWorkout : fromSpec,
      };
    });

  return {
    status: 200,
    body: {
      name: plan.name,
      weekStart: plan.week_start,
      days,
    },
  };
}
