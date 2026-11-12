import type { TrainGlobalGoal, TrainGlobalLevel } from './library';
import {
  durationTargetForSessionType,
  preferredExerciseKeysForSessionType,
  resolveSessionTypeFromFocus,
  trainSessionTypeById,
  type TrainSessionTypeId,
} from './session-types';
import {
  generateFromCategoryMix,
  isRemixCategory,
  remixCategoryOf,
  type RemixCategory,
} from './remix';
import {
  defaultTargetFor,
  inferTracking,
  progressionStepForLevel,
  type TargetUnit,
  type TrackingType,
} from './tracking';
import type { CatalogExercise } from './types';

export type FilledTemplateExercise = {
  exerciseId: string;
  name: string;
  tracking: TrackingType;
  targetUnit: TargetUnit;
  targetSets: number;
  targetReps: string;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
  targetRpe: number;
  category: RemixCategory | null;
};

export type FillWorkoutTemplateInput = {
  sessionTypeId: string;
  durationMin: number;
  catalogue: readonly CatalogExercise[];
  goal?: TrainGlobalGoal;
  level?: TrainGlobalLevel;
  seed: number;
  avoidExerciseIds?: readonly string[];
};

const FOCUS_TO_SESSION: Record<string, TrainSessionTypeId> = {
  Upper: 'upper',
  Lower: 'lower',
  Push: 'upper_push',
  Pull: 'upper_pull',
  Legs: 'legs',
  'Full Body': 'full_body',
  Cardio: 'zone2',
  Mobility: 'mobility',
  Core: 'core',
  Walk: 'walk',
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function rpeFor(goal: TrainGlobalGoal | undefined, level: TrainGlobalLevel | undefined): number {
  if (goal === 'strength') return level === 'advanced' ? 9 : 8;
  if (goal === 'mobility' || goal === 'conditioning') return 6;
  return level === 'beginner' ? 7 : 8;
}

function matchesKey(exercise: CatalogExercise, key: string): boolean {
  const needle = key.trim().toLowerCase();
  if (!needle) return false;
  const canonical = (exercise.canonicalKey ?? '').trim().toLowerCase();
  if (canonical && canonical === needle) return true;
  return exercise.name.trim().toLowerCase() === needle;
}

function pickPreferredExercise(
  keys: readonly string[],
  catalogue: readonly CatalogExercise[],
  avoid: ReadonlySet<string>,
  random: () => number,
): CatalogExercise | null {
  for (const key of keys) {
    const matches = catalogue.filter((ex) => !avoid.has(ex.id) && matchesKey(ex, key));
    if (matches.length > 0) {
      return matches[Math.floor(random() * matches.length) % matches.length] ?? null;
    }
  }
  // Fall back to any Cardio-tagged exercise.
  const cardio = catalogue.filter((ex) => !avoid.has(ex.id) && remixCategoryOf(ex) === 'Cardio');
  if (cardio.length === 0) return null;
  return cardio[Math.floor(random() * cardio.length) % cardio.length] ?? null;
}

/** Map a plan-day focus label onto a session type id. */
export function sessionTypeIdFromFocus(focus: string): TrainSessionTypeId | null {
  const mapped = FOCUS_TO_SESSION[focus];
  if (mapped) return mapped;
  const direct = resolveSessionTypeFromFocus(focus);
  return direct ? (direct.id as TrainSessionTypeId) : null;
}

/** Human label for a scheduled focus (session-type vocabulary). */
export function displayFocusLabel(focus: string): string {
  const id = sessionTypeIdFromFocus(focus);
  if (!id) return focus;
  return trainSessionTypeById(id)?.label ?? focus;
}

/**
 * Build exercises for a session type from the catalogue.
 * Duration-based modalities prefer a single named modality exercise.
 * Strength / mixed types use category remix.
 */
export function fillWorkoutFromSessionType(input: FillWorkoutTemplateInput): FilledTemplateExercise[] {
  const session = trainSessionTypeById(input.sessionTypeId);
  if (!session || session.categories.length === 0) return [];

  const random = mulberry32(input.seed);
  const avoid = new Set(input.avoidExerciseIds ?? []);
  const pool = input.catalogue.filter((ex) => !avoid.has(ex.id));
  const rpe = rpeFor(input.goal, input.level);

  const step = progressionStepForLevel(input.level);

  if (session.durationBased) {
    const keys = preferredExerciseKeysForSessionType(session.id);
    const pick = pickPreferredExercise(keys, pool, avoid, random);
    if (!pick) return [];
    const inferred = inferTracking(pick);
    const duration = durationTargetForSessionType(session.id, input.durationMin);
    const minutes = Number.parseInt(duration.reps, 10) || input.durationMin;
    const targets =
      inferred === 'km' || inferred === 'm'
        ? defaultTargetFor({
            name: pick.name,
            category: pick.category,
            canonicalKey: pick.canonicalKey,
            instructions: pick.instructions,
            targetUnit: inferred,
            progressionStep: step,
          })
        : defaultTargetFor({
            name: pick.name,
            category: pick.category ?? 'Cardio',
            canonicalKey: pick.canonicalKey,
            instructions: pick.instructions,
            targetUnit: 'min',
            targetSets: duration.sets,
            targetReps: duration.reps,
            targetDurationSec: minutes * 60,
            // Session duration is the template; do not also scale by level.
            progressionStep: 0,
          });
    return [
      {
        exerciseId: pick.id,
        name: pick.name,
        tracking: targets.tracking,
        targetUnit: targets.targetUnit,
        targetSets: targets.targetSets,
        targetReps: targets.targetReps,
        targetDurationSec: targets.targetDurationSec,
        targetDistanceKm: targets.targetDistanceKm,
        targetRpe: Math.min(rpe, 7),
        category: remixCategoryOf(pick),
      },
    ];
  }

  const categories = session.categories.filter(isRemixCategory);
  if (categories.length === 0) return [];
  const weights = categories.map(() => 100);
  const picks = generateFromCategoryMix(categories, weights, input.durationMin, pool, random);
  return picks.map((pick) => {
    const ex = pool.find((row) => row.id === pick.exerciseId);
    const targets = defaultTargetFor({
      name: pick.name,
      category: ex?.category ?? (ex ? remixCategoryOf(ex) : null),
      canonicalKey: ex?.canonicalKey,
      instructions: ex?.instructions,
      targetUnit: pick.targetUnit,
      targetSets: pick.targetSets,
      targetReps: pick.targetReps,
      targetDurationSec: pick.targetDurationSec,
      targetDistanceKm: pick.targetDistanceKm,
      // Remix already set base targets; only scale time/distance by level.
      progressionStep: pick.targetUnit === 'min' || pick.targetUnit === 'km' || pick.targetUnit === 'm' ? step : 0,
    });
    return {
      exerciseId: pick.exerciseId,
      name: pick.name,
      tracking: targets.tracking,
      targetUnit: targets.targetUnit,
      targetSets: targets.targetSets,
      targetReps: targets.targetReps,
      targetDurationSec: targets.targetDurationSec,
      targetDistanceKm: targets.targetDistanceKm,
      targetRpe: rpe,
      category: ex ? remixCategoryOf(ex) : null,
    };
  });
}

/** True when the catalogue has enough material to fill this session type. */
export function canFillSessionType(
  sessionTypeId: string,
  catalogue: readonly CatalogExercise[],
  minExercises = 1,
): boolean {
  const session = trainSessionTypeById(sessionTypeId);
  if (!session || session.categories.length === 0) return false;
  if (session.durationBased) {
    const keys = preferredExerciseKeysForSessionType(session.id);
    if (keys.some((key) => catalogue.some((ex) => matchesKey(ex, key)))) return true;
    return catalogue.some((ex) => remixCategoryOf(ex) === 'Cardio');
  }
  const categories = new Set(session.categories.filter(isRemixCategory));
  let count = 0;
  for (const ex of catalogue) {
    const cat = remixCategoryOf(ex);
    if (cat && categories.has(cat)) {
      count += 1;
      if (count >= Math.max(minExercises, 3)) return true;
    }
  }
  return count >= minExercises;
}

/** Broader fallbacks when a narrow session type cannot fill (e.g. Upper Push → Upper). */
const SESSION_TYPE_WIDEN: Partial<Record<TrainSessionTypeId, TrainSessionTypeId>> = {
  upper_push: 'upper',
  upper_pull: 'upper',
  push: 'upper',
  pull: 'upper',
  chest_tris: 'upper',
  back_bis: 'upper',
  shoulders: 'upper',
  arms: 'upper',
  legs: 'lower',
  glutes: 'lower',
};

/** Ordered session-type ids to try: exact first, then quiet widen parents. */
export function widenSessionTypeIds(sessionTypeId: string): string[] {
  const out: string[] = [];
  let current: string | undefined = sessionTypeId;
  while (current && !out.includes(current)) {
    out.push(current);
    current = SESSION_TYPE_WIDEN[current as TrainSessionTypeId];
  }
  return out;
}

/** Fill a session type, quietly widening to a broader type when the exact pool is too thin. */
export function fillWorkoutFromSessionTypeWidened(
  input: FillWorkoutTemplateInput,
): FilledTemplateExercise[] {
  for (const sessionTypeId of widenSessionTypeIds(input.sessionTypeId)) {
    if (!canFillSessionType(sessionTypeId, input.catalogue)) continue;
    const filled = fillWorkoutFromSessionType({ ...input, sessionTypeId });
    if (filled.length > 0) return filled;
  }
  return [];
}
