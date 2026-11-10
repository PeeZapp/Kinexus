import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DAYS,
  effortLevelFrom,
  exerciseGuideKind,
  type Day,
  type EffortLevel,
  type ExerciseScope,
} from '@kinexus/domain';

import type { McpCaller } from '../context.js';
import {
  assertCanWrite,
  resolveCallerHousehold,
  titleMatches,
  withMcpAudit,
  type CallerHousehold,
} from '../meals/shared.js';

export const WORKOUT_NOT_FOUND = 'Workout not found';
export const PLAN_NOT_FOUND = 'Training plan not found';
export const PLAN_DAY_NOT_FOUND = 'Plan day not found';
export const SESSION_NOT_FOUND = 'Workout session not found';
export const EXERCISE_NOT_FOUND = 'Exercise not found';
export const CREATOR_REQUIRED = 'Only approved creators can publish global exercises';

export type ChatExerciseScope = 'personal' | 'family' | 'buddy' | 'creator-global';

export type WorkoutExerciseDraft = {
  exerciseId: string | null;
  name: string;
  targetSets: number;
  targetReps: string;
  /** Load/Effort: light | moderate | heavy. */
  intensity: EffortLevel | null;
  note?: string;
  /** When set, commit creates this custom exercise first (same preview). */
  proposeCreate?: CustomExerciseDraft | null;
};

export type CustomExerciseDraft = {
  name: string;
  scope: ChatExerciseScope;
  bodyPart?: string;
  equipment?: string;
  targetMuscle?: string;
  category?: string | null;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
  groupId?: string | null;
  secondaryMuscles?: string[];
  instructions?: string[];
  isCompound?: boolean | null;
};

export type WorkoutSummary = {
  id: string;
  name: string;
  householdId: string;
  visibility: string;
  planOnly: boolean;
  durationMin: number | null;
  createdBy: string | null;
  exercises: {
    id: string;
    exerciseId: string | null;
    name: string;
    position: number;
    targetSets: number;
    targetReps: string;
    intensity: EffortLevel | null;
    guide: 'load' | 'effort';
    note: string;
  }[];
};

export type ExerciseSummary = {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  targetMuscle: string;
  category: string | null;
  scope: string;
  source: string;
  guide: 'load' | 'effort';
};

export type PlanDaySummary = {
  id: string;
  day: Day;
  position: number;
  restDay: boolean;
  focus: string[];
  durationMin: number | null;
  scheduledTime: string | null;
  status: string;
  workoutId: string | null;
  workoutName: string | null;
  sessionId: string | null;
};

export type TrainingPlanSummary = {
  id: string;
  name: string;
  householdId: string;
  ownerId: string;
  weekStart: string;
  visibility: string;
  days: PlanDaySummary[];
};

export type SessionSummary = {
  id: string;
  name: string;
  workoutId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMin: number | null;
  sets: {
    id: string;
    exerciseId: string | null;
    exerciseName: string;
    position: number;
    setIndex: number;
    weight: string;
    reps: string;
    done: boolean;
  }[];
};

const DAY_SET = new Set<string>(DAYS);

export { assertCanWrite, resolveCallerHousehold, withMcpAudit, titleMatches };
export type { CallerHousehold };

export function parseDay(value: string): Day {
  const key = value.trim().toLowerCase();
  if (!DAY_SET.has(key)) throw new Error(`Unknown day "${value}"`);
  return key as Day;
}

export function parseIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be YYYY-MM-DD`);
  return value;
}

export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseIntensity(value: unknown): EffortLevel | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  if (raw === 'medium') return 'moderate';
  if (raw === 'hard') return 'heavy';
  return effortLevelFrom(raw === 'max' ? 'heavy' : raw);
}

export function chatScopeToDb(scope: ChatExerciseScope): {
  scope: Exclude<ExerciseScope, 'global'>;
  publishGlobal: boolean;
} {
  if (scope === 'personal') return { scope: 'private', publishGlobal: false };
  if (scope === 'family') return { scope: 'household', publishGlobal: false };
  if (scope === 'buddy') return { scope: 'group', publishGlobal: false };
  return { scope: 'private', publishGlobal: true };
}

export async function isApprovedCreator(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc('is_approved_creator');
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export function mapWorkoutExercise(row: Record<string, unknown>, category?: string | null) {
  const intensity = effortLevelFrom(row.target_effort);
  const guide = exerciseGuideKind(category ?? null);
  return {
    id: String(row.id),
    exerciseId: typeof row.exercise_id === 'string' ? row.exercise_id : null,
    name: String(row.name ?? ''),
    position: typeof row.position === 'number' ? row.position : 0,
    targetSets: typeof row.target_sets === 'number' ? row.target_sets : 1,
    targetReps: typeof row.target_reps === 'string' ? row.target_reps : '',
    intensity,
    guide,
    note: typeof row.note === 'string' ? row.note : '',
  };
}

export function mapWorkout(row: Record<string, unknown>, exercises: WorkoutSummary['exercises']): WorkoutSummary {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    householdId: String(row.household_id ?? ''),
    visibility: String(row.visibility ?? 'private'),
    planOnly: Boolean(row.plan_only),
    durationMin: typeof row.duration_min === 'number' ? row.duration_min : null,
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    exercises,
  };
}

export function mapExercise(row: Record<string, unknown>): ExerciseSummary {
  const category = typeof row.category === 'string' ? row.category : null;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    bodyPart: String(row.body_part ?? ''),
    equipment: String(row.equipment ?? ''),
    targetMuscle: String(row.target_muscle ?? ''),
    category,
    scope: String(row.scope ?? 'global'),
    source: String(row.source ?? ''),
    guide: exerciseGuideKind(category),
  };
}

export async function withFitnessAudit<T>(
  caller: McpCaller,
  opts: { tool: string; mode: 'read' | 'write'; householdId?: string | null },
  run: () => Promise<T>,
): Promise<T> {
  return withMcpAudit(caller, opts, run);
}
