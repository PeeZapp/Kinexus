import {
  defaultTargetFor,
  inferTracking,
  isTargetUnit,
  isTrackingType,
  targetUnitFrom,
  trackingCompatTargets,
  trackingTypeFrom,
  type TargetUnit,
  type TrackingType,
} from '@kinexus/domain';

import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';

export type SharedWorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  tracking: TrackingType;
  targetUnit: TargetUnit;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
  effort: string | null;
  rpe: number | null;
  note: string;
  supersetId: string | null;
  mediaUrls: string[];
};

export type SharedWorkoutPayload = {
  name: string;
  durationMin: number | null;
  exercises: SharedWorkoutExercise[];
};

export type SharedWorkoutDeps = {
  isConfigured: () => boolean;
  createClient: () => ReturnType<typeof createServiceClient>;
};

const defaultDeps: SharedWorkoutDeps = {
  isConfigured: isServiceRoleConfigured,
  createClient: createServiceClient,
};

function mediaUrlsFromExercise(row: {
  media_url?: string | null;
  media_urls?: string[] | null;
}): string[] {
  if (row.media_urls?.length) return row.media_urls.filter((url) => typeof url === 'string' && url.trim());
  if (row.media_url?.trim()) return [row.media_url.trim()];
  return [];
}

export function sharedExerciseTargets(row: {
  name: string;
  target_sets?: number | null;
  target_reps?: string | null;
  tracking?: string | null;
  target_unit?: string | null;
  target_duration_sec?: number | null;
  target_distance_km?: number | string | null;
}): {
  tracking: TrackingType;
  targetUnit: TargetUnit;
  sets: number;
  reps: string;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
} {
  const sets = Math.max(1, row.target_sets ?? 3);
  const reps = typeof row.target_reps === 'string' && row.target_reps.trim() ? row.target_reps : '8';
  const targetDistanceKm =
    row.target_distance_km == null || row.target_distance_km === ''
      ? null
      : Number(row.target_distance_km);
  const targetDurationSec = row.target_duration_sec ?? null;
  const hasExplicit = isTargetUnit(row.target_unit) || isTrackingType(row.tracking);

  if (!hasExplicit) {
    const inferred = inferTracking({ name: row.name });
    if (inferred !== 'reps') {
      const defaults = defaultTargetFor({
        name: row.name,
        targetUnit: inferred,
        targetSets: sets,
        targetReps: reps,
        targetDurationSec,
        targetDistanceKm: Number.isFinite(targetDistanceKm) ? targetDistanceKm : null,
      });
      return {
        tracking: defaults.tracking,
        targetUnit: defaults.targetUnit,
        sets: defaults.targetSets,
        reps: defaults.targetReps,
        targetDurationSec: defaults.targetDurationSec,
        targetDistanceKm: defaults.targetDistanceKm,
      };
    }
  }

  const tracking = trackingTypeFrom(row.tracking);
  const unit = targetUnitFrom(row.target_unit, tracking, {
    targetDistanceKm: Number.isFinite(targetDistanceKm) ? targetDistanceKm : null,
  });
  const compat = trackingCompatTargets({
    tracking,
    targetUnit: unit,
    targetSets: sets,
    targetReps: reps,
    targetDurationSec,
    targetDistanceKm: Number.isFinite(targetDistanceKm) ? targetDistanceKm : null,
  });
  return {
    tracking: compat.tracking,
    targetUnit: compat.targetUnit,
    sets: compat.targetSets,
    reps: compat.targetReps,
    targetDurationSec: compat.targetDurationSec,
    targetDistanceKm: compat.targetDistanceKm,
  };
}

export async function handleGetSharedWorkout(
  token: string,
  deps: SharedWorkoutDeps = defaultDeps,
): Promise<{ status: number; body: SharedWorkoutPayload | { error: string } }> {
  const trimmed = token.trim();
  if (!trimmed) return { status: 400, body: { error: 'Share token required' } };
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'Shared workouts are not configured' } };
  }

  const client = deps.createClient();
  const { data: workout, error: workoutError } = await client
    .from('workouts')
    .select('id, name, duration_min, is_shared')
    .eq('share_token', trimmed)
    .eq('is_shared', true)
    .maybeSingle();

  if (workoutError) return { status: 500, body: { error: workoutError.message } };
  if (!workout) return { status: 404, body: { error: 'Workout not found or not shared' } };

  const { data: exercises, error: exercisesError } = await client
    .from('workout_exercises')
    .select(
      'name, position, tracking, target_unit, target_sets, target_reps, target_duration_sec, target_distance_km, target_effort, target_rpe, note, superset_id, exercise_id, exercises(media_url, media_urls)',
    )
    .eq('workout_id', workout.id)
    .order('position', { ascending: true });
  if (exercisesError) return { status: 500, body: { error: exercisesError.message } };

  const mapped: SharedWorkoutExercise[] = (exercises ?? []).map((row) => {
    const linked = row.exercises as { media_url?: string | null; media_urls?: string[] | null } | null;
    const targets = sharedExerciseTargets(row);
    return {
      name: row.name,
      sets: targets.sets,
      reps: targets.reps,
      tracking: targets.tracking,
      targetUnit: targets.targetUnit,
      targetDurationSec: targets.targetDurationSec,
      targetDistanceKm: targets.targetDistanceKm,
      effort: row.target_effort,
      rpe: row.target_rpe == null ? null : Number(row.target_rpe),
      note: typeof row.note === 'string' ? row.note : '',
      supersetId: row.superset_id ?? null,
      mediaUrls: mediaUrlsFromExercise(linked ?? {}),
    };
  });

  return {
    status: 200,
    body: {
      name: workout.name,
      durationMin: workout.duration_min,
      exercises: mapped,
    },
  };
}
