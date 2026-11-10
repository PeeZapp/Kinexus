import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildIntentWeekDays,
  canFillSessionType,
  displayFocusLabel,
  fillWorkoutFromSessionTypeWidened,
  handleApplyTrainingPlan,
  handleAttachWorkoutToPlanDay,
  handleDeleteTrainingPlan,
  handleMarkTrainingPlanDayFromSession,
  handleSetTrainingPlanDayStatus,
  handleUpdateTrainingPlanDaySchedule,
  pickTrainingDays,
  sessionTypeIdFromFocus,
  type Day,
  type EffortLevel,
  type GeneratePlanGoal,
  type GeneratePlanLevel,
  type TrainingPlanDayStatus,
} from '@kinexus/domain';

import { createWritePreview, commitWritePreview } from '../preview.js';
import type { McpCaller } from '../context.js';
import {
  findExerciseByName,
  findExerciseDedupeCandidates,
  findWorkoutDedupeCandidates,
  getWorkout,
  loadCatalogueForFill,
  loadExerciseOrThrow,
  defaultWeekStart,
} from './reads.js';
import {
  CREATOR_REQUIRED,
  EXERCISE_NOT_FOUND,
  PLAN_DAY_NOT_FOUND,
  PLAN_NOT_FOUND,
  WORKOUT_NOT_FOUND,
  assertCanWrite,
  chatScopeToDb,
  isApprovedCreator,
  normalizeName,
  parseDay,
  parseIntensity,
  parseIsoDate,
  resolveCallerHousehold,
  type ChatExerciseScope,
  type CustomExerciseDraft,
  type WorkoutExerciseDraft,
} from './shared.js';

export type FitnessWriteAction =
  | {
      action: 'create_workout';
      name: string;
      durationMin: number | null;
      exercises: WorkoutExerciseDraft[];
      customExercises: CustomExerciseDraft[];
    }
  | {
      action: 'update_workout';
      workoutId: string;
      name: string;
      durationMin: number | null;
      exercises: WorkoutExerciseDraft[];
      customExercises: CustomExerciseDraft[];
    }
  | { action: 'delete_workout'; workoutId: string; name: string }
  | { action: 'create_custom_exercise'; draft: CustomExerciseDraft }
  | { action: 'update_custom_exercise'; exerciseId: string; draft: CustomExerciseDraft }
  | {
      action: 'create_training_plan';
      name: string;
      weekStart: string;
      days: Day[];
      durationMin: number;
      goal: GeneratePlanGoal;
      splitStyle?: string | null;
      focusByDay?: Partial<Record<Day, string>>;
    }
  | {
      action: 'fill_plan_day';
      dayId: string;
      focus: string[];
      durationMin: number | null;
      goal?: GeneratePlanGoal | null;
      level?: GeneratePlanLevel | null;
      existingWorkoutId?: string | null;
    }
  | { action: 'set_plan_day_workout'; dayId: string; workoutId: string | null }
  | {
      action: 'update_plan_day';
      dayId: string;
      focus?: string[];
      durationMin?: number | null;
      restDay?: boolean;
      scheduledTime?: string | null;
    }
  | { action: 'clear_plan_day'; dayId: string; makeRest?: boolean }
  | { action: 'move_plan_day'; dayId: string; day: Day }
  | { action: 'delete_training_plan'; planId: string; name: string }
  | {
      action: 'log_workout_session';
      name: string;
      workoutId: string | null;
      planDayId: string | null;
      startedAt: string;
      finishedAt: string | null;
      durationMin: number | null;
      exercises: {
        exerciseId: string | null;
        name: string;
        sets: { intensity?: EffortLevel | null; reps?: string; done?: boolean }[];
      }[];
    }
  | {
      action: 'mark_plan_day_status';
      dayId: string;
      status: TrainingPlanDayStatus;
      sessionId?: string | null;
    }
  | { action: 'save_plan_workout_to_library'; workoutId: string; name: string };

export type PreviewResult =
  | {
      kind: 'preview';
      previewId: string;
      expiresAt: string;
      tool: string;
      summary: string;
      steps: string[];
    }
  | {
      kind: 'dedupe';
      summary: string;
      candidates: { id: string; name: string; detail?: string }[];
      message: string;
    }
  | {
      kind: 'blocked';
      summary: string;
      message: string;
    }
  | {
      kind: 'noop';
      summary: string;
      message: string;
      workoutId?: string;
      exerciseId?: string;
    };

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: FitnessWriteAction,
  summary: string,
  steps: string[],
): Promise<PreviewResult> {
  const { previewId, expiresAt } = await createWritePreview(caller.client, {
    userId: caller.userId,
    householdId,
    clientId: caller.clientId,
    tool,
    payload,
  });
  return { kind: 'preview', previewId, expiresAt, tool, summary, steps };
}

function draftCustom(input: {
  name: string;
  scope?: ChatExerciseScope;
  bodyPart?: string;
  equipment?: string;
  targetMuscle?: string;
  category?: string | null;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
  groupId?: string | null;
  secondaryMuscles?: string[];
  instructions?: string[];
  isCompound?: boolean | null;
}): CustomExerciseDraft {
  const name = input.name.trim();
  if (!name) throw new Error('Exercise name is required');
  const scope = input.scope ?? 'personal';
  if (scope === 'buddy' && !input.groupId) {
    throw new Error('groupId is required for buddy scope');
  }
  return {
    name,
    scope,
    bodyPart: input.bodyPart?.trim() || 'other',
    equipment: input.equipment?.trim() || 'body weight',
    targetMuscle: input.targetMuscle?.trim() || 'other',
    category: input.category?.trim() || null,
    difficulty: input.difficulty ?? null,
    groupId: input.groupId ?? null,
    secondaryMuscles: (input.secondaryMuscles ?? []).map((s) => s.trim()).filter(Boolean),
    instructions: (input.instructions ?? []).map((s) => s.trim()).filter(Boolean),
    isCompound: input.isCompound ?? null,
  };
}

async function resolveExerciseDrafts(
  client: SupabaseClient,
  inputs: {
    exerciseId?: string;
    name: string;
    targetSets?: number;
    targetReps?: string;
    intensity?: string;
    note?: string;
    createIfMissing?: boolean;
    custom?: {
      scope?: ChatExerciseScope;
      bodyPart?: string;
      equipment?: string;
      targetMuscle?: string;
      category?: string | null;
      difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
      groupId?: string | null;
    };
  }[],
): Promise<{ exercises: WorkoutExerciseDraft[]; customExercises: CustomExerciseDraft[]; missing: string[] }> {
  const exercises: WorkoutExerciseDraft[] = [];
  const customExercises: CustomExerciseDraft[] = [];
  const missing: string[] = [];
  const proposedKeys = new Set<string>();

  for (const item of inputs) {
    const name = item.name.trim();
    if (!name) continue;
    let exerciseId = item.exerciseId?.trim() || null;
    let resolvedName = name;
    let proposeCreate: CustomExerciseDraft | null = null;

    if (exerciseId) {
      const existing = await loadExerciseOrThrow(client, exerciseId);
      resolvedName = existing.name;
    } else {
      const found = await findExerciseByName(client, name);
      if (found) {
        exerciseId = found.id;
        resolvedName = found.name;
      } else if (item.createIfMissing !== false) {
        const draft = draftCustom({
          name,
          scope: item.custom?.scope ?? 'personal',
          bodyPart: item.custom?.bodyPart,
          equipment: item.custom?.equipment,
          targetMuscle: item.custom?.targetMuscle,
          category: item.custom?.category,
          difficulty: item.custom?.difficulty,
          groupId: item.custom?.groupId,
        });
        const key = normalizeName(draft.name);
        if (!proposedKeys.has(key)) {
          proposedKeys.add(key);
          customExercises.push(draft);
        }
        proposeCreate = draft;
      } else {
        missing.push(name);
      }
    }

    exercises.push({
      exerciseId,
      name: resolvedName,
      targetSets: Math.max(1, item.targetSets ?? 3),
      targetReps: (item.targetReps ?? '8-12').trim() || '8-12',
      intensity: parseIntensity(item.intensity),
      note: item.note?.trim() || undefined,
      proposeCreate,
    });
  }

  return { exercises, customExercises, missing };
}

export async function previewCreateWorkout(
  caller: McpCaller,
  input: {
    name: string;
    durationMin?: number | null;
    exercises?: {
      exerciseId?: string;
      name: string;
      targetSets?: number;
      targetReps?: string;
      intensity?: string;
      note?: string;
      createIfMissing?: boolean;
      custom?: {
        scope?: ChatExerciseScope;
        bodyPart?: string;
        equipment?: string;
        targetMuscle?: string;
        category?: string | null;
        difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
        groupId?: string | null;
      };
    }[];
    decision?: 'create_new' | 'reuse';
    reuseWorkoutId?: string;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const name = input.name.trim();
  if (!name) throw new Error('Workout name is required');

  if (input.decision === 'reuse') {
    if (!input.reuseWorkoutId) throw new Error('reuseWorkoutId is required when decision is reuse');
    const existing = await getWorkout(caller.client, caller.userId, input.reuseWorkoutId);
    return {
      kind: 'noop',
      summary: `Reuse existing workout "${existing.workout.name}"`,
      message: 'No write needed — using the existing library workout.',
      workoutId: existing.workout.id,
    };
  }

  const resolved = await resolveExerciseDrafts(caller.client, input.exercises ?? []);
  if (resolved.missing.length > 0) {
    return {
      kind: 'blocked',
      summary: 'Unknown exercises',
      message: `Could not resolve: ${resolved.missing.join(', ')}. Pass createIfMissing or use catalogue names.`,
    };
  }

  if (input.decision !== 'create_new') {
    const candidates = await findWorkoutDedupeCandidates(
      caller.client,
      householdId,
      name,
      resolved.exercises.map((ex) => ex.name),
    );
    if (candidates.length > 0) {
      return {
        kind: 'dedupe',
        summary: `Possible matches for "${name}"`,
        message:
          'Choose decision: "reuse" with reuseWorkoutId, or decision: "create_new" to create a library workout.',
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          detail: c.exercises.map((ex) => ex.name).slice(0, 6).join(', '),
        })),
      };
    }
  }

  for (const draft of resolved.customExercises) {
    if (draft.scope === 'creator-global') {
      const ok = await isApprovedCreator(caller.client);
      if (!ok) throw new Error(CREATOR_REQUIRED);
    }
  }

  const steps = [
    ...resolved.customExercises.map((c) => `Create custom exercise "${c.name}" (${c.scope})`),
    `Create private library workout "${name}" with ${resolved.exercises.length} exercise(s)`,
  ];
  return savePreview(
    caller,
    householdId,
    'preview_create_workout',
    {
      action: 'create_workout',
      name,
      durationMin: input.durationMin ?? null,
      exercises: resolved.exercises,
      customExercises: resolved.customExercises,
    },
    resolved.customExercises.length
      ? `Create ${resolved.customExercises.length} custom exercise(s) and library workout "${name}"`
      : `Create library workout "${name}"`,
    steps,
  );
}

export async function previewUpdateWorkout(
  caller: McpCaller,
  input: {
    workoutId: string;
    name?: string;
    durationMin?: number | null;
    exercises?: {
      exerciseId?: string;
      name: string;
      targetSets?: number;
      targetReps?: string;
      intensity?: string;
      note?: string;
      createIfMissing?: boolean;
      custom?: {
        scope?: ChatExerciseScope;
        bodyPart?: string;
        equipment?: string;
        targetMuscle?: string;
        category?: string | null;
        difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
        groupId?: string | null;
      };
    }[];
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const existing = await getWorkout(caller.client, caller.userId, input.workoutId);
  const name = (input.name ?? existing.workout.name).trim() || existing.workout.name;
  const exerciseInputs =
    input.exercises ??
    existing.workout.exercises.map((ex) => ({
      exerciseId: ex.exerciseId ?? undefined,
      name: ex.name,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      intensity: ex.intensity ?? undefined,
      note: ex.note,
      createIfMissing: false,
    }));
  const resolved = await resolveExerciseDrafts(caller.client, exerciseInputs);
  if (resolved.missing.length > 0) {
    return {
      kind: 'blocked',
      summary: 'Unknown exercises',
      message: `Could not resolve: ${resolved.missing.join(', ')}`,
    };
  }
  for (const draft of resolved.customExercises) {
    if (draft.scope === 'creator-global') {
      const ok = await isApprovedCreator(caller.client);
      if (!ok) throw new Error(CREATOR_REQUIRED);
    }
  }
  return savePreview(
    caller,
    householdId,
    'preview_update_workout',
    {
      action: 'update_workout',
      workoutId: existing.workout.id,
      name,
      durationMin: input.durationMin !== undefined ? input.durationMin : existing.workout.durationMin,
      exercises: resolved.exercises,
      customExercises: resolved.customExercises,
    },
    `Update workout "${existing.workout.name}"`,
    [
      ...resolved.customExercises.map((c) => `Create custom exercise "${c.name}" (${c.scope})`),
      `Update workout ${existing.workout.id}`,
    ],
  );
}

export async function previewDeleteWorkout(
  caller: McpCaller,
  input: { workoutId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const existing = await getWorkout(caller.client, caller.userId, input.workoutId);
  return savePreview(
    caller,
    householdId,
    'preview_delete_workout',
    { action: 'delete_workout', workoutId: existing.workout.id, name: existing.workout.name },
    `Delete workout "${existing.workout.name}"`,
    [`Delete workout ${existing.workout.id}`],
  );
}

export async function previewCreateCustomExercise(
  caller: McpCaller,
  input: {
    name: string;
    scope?: ChatExerciseScope;
    bodyPart?: string;
    equipment?: string;
    targetMuscle?: string;
    category?: string | null;
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
    groupId?: string | null;
    secondaryMuscles?: string[];
    instructions?: string[];
    isCompound?: boolean | null;
    decision?: 'create_new' | 'reuse';
    reuseExerciseId?: string;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const draft = draftCustom(input);

  if (input.decision === 'reuse') {
    if (!input.reuseExerciseId) throw new Error('reuseExerciseId is required when decision is reuse');
    const existing = await loadExerciseOrThrow(caller.client, input.reuseExerciseId);
    return {
      kind: 'noop',
      summary: `Reuse existing exercise "${existing.name}"`,
      message: 'No write needed — using the existing exercise.',
      exerciseId: existing.id,
    };
  }

  if (draft.scope === 'creator-global') {
    const ok = await isApprovedCreator(caller.client);
    if (!ok) throw new Error(CREATOR_REQUIRED);
  }

  if (input.decision !== 'create_new') {
    const candidates = await findExerciseDedupeCandidates(caller.client, draft.name);
    if (candidates.length > 0) {
      return {
        kind: 'dedupe',
        summary: `Possible matches for "${draft.name}"`,
        message:
          'Choose decision: "reuse" with reuseExerciseId, or decision: "create_new" to create a custom exercise.',
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          detail: `${c.scope}/${c.source}`,
        })),
      };
    }
  }

  return savePreview(
    caller,
    householdId,
    'preview_create_custom_exercise',
    { action: 'create_custom_exercise', draft },
    `Create custom exercise "${draft.name}" (${draft.scope})`,
    [`Create ${draft.scope} exercise "${draft.name}"`],
  );
}

export async function previewUpdateCustomExercise(
  caller: McpCaller,
  input: {
    exerciseId: string;
    name?: string;
    scope?: ChatExerciseScope;
    bodyPart?: string;
    equipment?: string;
    targetMuscle?: string;
    category?: string | null;
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
    groupId?: string | null;
    secondaryMuscles?: string[];
    instructions?: string[];
    isCompound?: boolean | null;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const existing = await loadExerciseOrThrow(caller.client, input.exerciseId);
  if (existing.source !== 'user' && existing.source !== 'creator') {
    throw new Error('Only custom exercises can be updated here');
  }
  const draft = draftCustom({
    name: input.name ?? existing.name,
    scope: input.scope ?? (existing.scope === 'household' ? 'family' : existing.scope === 'group' ? 'buddy' : 'personal'),
    bodyPart: input.bodyPart ?? existing.bodyPart,
    equipment: input.equipment ?? existing.equipment,
    targetMuscle: input.targetMuscle ?? existing.targetMuscle,
    category: input.category !== undefined ? input.category : existing.category,
    difficulty: input.difficulty,
    groupId: input.groupId,
    secondaryMuscles: input.secondaryMuscles,
    instructions: input.instructions,
    isCompound: input.isCompound,
  });
  if (draft.scope === 'creator-global') {
    const ok = await isApprovedCreator(caller.client);
    if (!ok) throw new Error(CREATOR_REQUIRED);
  }
  return savePreview(
    caller,
    householdId,
    'preview_update_custom_exercise',
    { action: 'update_custom_exercise', exerciseId: existing.id, draft },
    `Update custom exercise "${existing.name}"`,
    [`Update exercise ${existing.id}`],
  );
}

export async function previewCreateTrainingPlan(
  caller: McpCaller,
  input: {
    name?: string;
    weekStart?: string;
    daysPerWeek?: number;
    days?: string[];
    durationMin?: number;
    goal?: GeneratePlanGoal;
    splitStyle?: string | null;
    focusByDay?: Record<string, string>;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const weekStart = parseIsoDate(input.weekStart ?? defaultWeekStart(), 'weekStart');
  const durationMin = Math.max(10, Math.min(180, input.durationMin ?? 40));
  const goal = input.goal ?? 'hypertrophy';
  const trainingDays =
    input.days && input.days.length > 0
      ? input.days.map(parseDay)
      : pickTrainingDays(Math.max(2, Math.min(6, input.daysPerWeek ?? 3)));
  const focusByDay: Partial<Record<Day, string>> = {};
  for (const [key, value] of Object.entries(input.focusByDay ?? {})) {
    focusByDay[parseDay(key)] = displayFocusLabel(value);
  }
  const intentDays = buildIntentWeekDays({
    trainingDays,
    durationMin,
    goal,
    splitStyle: input.splitStyle,
    customFocusByDay: focusByDay,
  });
  const active = intentDays.filter((d) => !d.restDay);
  const name = (input.name ?? 'Training plan').trim() || 'Training plan';
  return savePreview(
    caller,
    householdId,
    'preview_create_training_plan',
    {
      action: 'create_training_plan',
      name,
      weekStart,
      days: trainingDays,
      durationMin,
      goal,
      splitStyle: input.splitStyle ?? null,
      focusByDay,
    },
    `Create intent plan "${name}" for week of ${weekStart} (${active.length} session day(s), no workouts filled)`,
    [
      `Create private training plan "${name}"`,
      ...active.map((d) => `${d.day}: ${d.focus[0] ?? 'Train'} (${d.durationMin} min, intent only)`),
    ],
  );
}

export async function previewFillPlanDay(
  caller: McpCaller,
  input: {
    dayId: string;
    goal?: GeneratePlanGoal | null;
    level?: GeneratePlanLevel | null;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const day = await loadPlanDayOrThrow(caller.client, householdId, input.dayId);
  if (day.restDay) {
    return { kind: 'blocked', summary: 'Rest day', message: 'Cannot fill a rest day. Update the session type first.' };
  }
  const focus = day.focus.length ? day.focus : ['Full Body'];
  const sessionTypeId = sessionTypeIdFromFocus(focus[0] ?? 'Full Body');
  if (!sessionTypeId) {
    return { kind: 'blocked', summary: 'Unknown session type', message: `No session type for "${focus[0]}"` };
  }
  return savePreview(
    caller,
    householdId,
    'preview_fill_plan_day',
    {
      action: 'fill_plan_day',
      dayId: day.id,
      focus,
      durationMin: day.durationMin,
      goal: input.goal ?? null,
      level: input.level ?? null,
      existingWorkoutId: day.workoutId,
    },
    `Fill ${day.day} (${focus[0]}) with a plan-only workout`,
    [
      day.workoutId
        ? `Replace exercises on linked plan-only workout ${day.workoutId}`
        : `Create plan-only workout for ${day.day} and attach it`,
    ],
  );
}

export async function previewSetPlanDayWorkout(
  caller: McpCaller,
  input: { dayId: string; workoutId: string | null },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const day = await loadPlanDayOrThrow(caller.client, householdId, input.dayId);
  if (input.workoutId) {
    await getWorkout(caller.client, caller.userId, input.workoutId);
  }
  return savePreview(
    caller,
    householdId,
    'preview_set_plan_day_workout',
    { action: 'set_plan_day_workout', dayId: day.id, workoutId: input.workoutId },
    input.workoutId
      ? `Link workout ${input.workoutId} to ${day.day}`
      : `Clear workout link on ${day.day}`,
    [input.workoutId ? `Attach workout ${input.workoutId}` : 'Detach workout (intent day kept)'],
  );
}

export async function previewUpdatePlanDay(
  caller: McpCaller,
  input: {
    dayId: string;
    focus?: string[];
    durationMin?: number | null;
    restDay?: boolean;
    scheduledTime?: string | null;
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const day = await loadPlanDayOrThrow(caller.client, householdId, input.dayId);
  return savePreview(
    caller,
    householdId,
    'preview_update_plan_day',
    {
      action: 'update_plan_day',
      dayId: day.id,
      focus: input.focus?.map((f) => displayFocusLabel(f)),
      durationMin: input.durationMin,
      restDay: input.restDay,
      scheduledTime: input.scheduledTime,
    },
    `Update ${day.day} plan day`,
    [
      input.focus ? `Set focus to ${input.focus.map((f) => displayFocusLabel(f)).join(', ')}` : null,
      input.durationMin != null ? `Set duration ${input.durationMin} min` : null,
      input.restDay != null ? (input.restDay ? 'Mark as rest' : 'Mark as training') : null,
      input.scheduledTime !== undefined ? `Set time ${input.scheduledTime ?? 'cleared'}` : null,
    ].filter((s): s is string => Boolean(s)),
  );
}

export async function previewClearPlanDay(
  caller: McpCaller,
  input: { dayId: string; makeRest?: boolean },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const day = await loadPlanDayOrThrow(caller.client, householdId, input.dayId);
  return savePreview(
    caller,
    householdId,
    'preview_clear_plan_day',
    { action: 'clear_plan_day', dayId: day.id, makeRest: Boolean(input.makeRest) },
    input.makeRest ? `Clear ${day.day} to rest` : `Clear workout from ${day.day}`,
    [input.makeRest ? 'Make rest day' : 'Detach workout, keep session type'],
  );
}

export async function previewMovePlanDay(
  caller: McpCaller,
  input: { dayId: string; day: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const day = await loadPlanDayOrThrow(caller.client, householdId, input.dayId);
  const target = parseDay(input.day);
  return savePreview(
    caller,
    householdId,
    'preview_move_plan_day',
    { action: 'move_plan_day', dayId: day.id, day: target },
    `Move plan day from ${day.day} to ${target}`,
    [`Change weekday ${day.day} → ${target}`],
  );
}

export async function previewDeleteTrainingPlan(
  caller: McpCaller,
  input: { planId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const { data, error } = await caller.client
    .from('training_plans')
    .select('id, name, household_id, owner_id')
    .eq('id', input.planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || String((data as { household_id: string }).household_id) !== householdId) {
    throw new Error(PLAN_NOT_FOUND);
  }
  const plan = data as { id: string; name: string; owner_id: string };
  if (plan.owner_id !== caller.userId) throw new Error('You can only delete plans you own');
  return savePreview(
    caller,
    householdId,
    'preview_delete_training_plan',
    { action: 'delete_training_plan', planId: plan.id, name: plan.name },
    `Delete training plan "${plan.name}"`,
    [`Delete plan ${plan.id}`],
  );
}

export async function previewLogWorkoutSession(
  caller: McpCaller,
  input: {
    name?: string;
    workoutId?: string | null;
    planDayId?: string | null;
    startedAt?: string;
    finishedAt?: string | null;
    durationMin?: number | null;
    exercises?: {
      exerciseId?: string;
      name: string;
      sets?: { intensity?: string; reps?: string; done?: boolean }[];
      targetSets?: number;
      targetReps?: string;
      intensity?: string;
    }[];
  },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);

  let workoutId = input.workoutId ?? null;
  let name = input.name?.trim() || 'Workout';
  if (workoutId) {
    const workout = await getWorkout(caller.client, caller.userId, workoutId);
    name = input.name?.trim() || workout.workout.name;
  }
  if (input.planDayId) {
    const day = await loadPlanDayOrThrow(caller.client, householdId, input.planDayId);
    if (day.workoutId) workoutId = day.workoutId;
    if (!input.name && day.focus[0]) name = day.focus[0];
  }

  const exercises = [];
  for (const item of input.exercises ?? []) {
    let exerciseId = item.exerciseId ?? null;
    let resolvedName = item.name.trim();
    if (exerciseId) {
      const existing = await loadExerciseOrThrow(caller.client, exerciseId);
      resolvedName = existing.name;
    } else if (resolvedName) {
      const found = await findExerciseByName(caller.client, resolvedName);
      if (!found) throw new Error(`${EXERCISE_NOT_FOUND}: ${resolvedName}`);
      exerciseId = found.id;
      resolvedName = found.name;
    }
    const sets =
      item.sets && item.sets.length > 0
        ? item.sets.map((set) => ({
            intensity: parseIntensity(set.intensity ?? item.intensity),
            reps: set.reps ?? item.targetReps ?? '8-12',
            done: set.done !== false,
          }))
        : Array.from({ length: Math.max(1, item.targetSets ?? 3) }, () => ({
            intensity: parseIntensity(item.intensity),
            reps: item.targetReps ?? '8-12',
            done: true,
          }));
    exercises.push({ exerciseId, name: resolvedName, sets });
  }

  const startedAt = input.startedAt ?? new Date().toISOString();
  const durationMin = input.durationMin ?? null;
  const finishedAt =
    input.finishedAt ??
    (durationMin != null
      ? new Date(Date.parse(startedAt) + durationMin * 60_000).toISOString()
      : new Date().toISOString());

  return savePreview(
    caller,
    householdId,
    'preview_log_workout_session',
    {
      action: 'log_workout_session',
      name,
      workoutId,
      planDayId: input.planDayId ?? null,
      startedAt,
      finishedAt,
      durationMin,
      exercises,
    },
    `Log finished session "${name}"`,
    [
      `Create finished session with ${exercises.length} exercise(s)`,
      input.planDayId ? `Mark plan day ${input.planDayId} done` : null,
    ].filter((s): s is string => Boolean(s)),
  );
}

export async function previewMarkPlanDayStatus(
  caller: McpCaller,
  input: { dayId: string; status: TrainingPlanDayStatus; sessionId?: string | null },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const day = await loadPlanDayOrThrow(caller.client, householdId, input.dayId);
  return savePreview(
    caller,
    householdId,
    'preview_mark_plan_day_status',
    {
      action: 'mark_plan_day_status',
      dayId: day.id,
      status: input.status,
      sessionId: input.sessionId ?? null,
    },
    `Mark ${day.day} as ${input.status}`,
    [`Set status ${input.status}`],
  );
}

export async function previewSavePlanWorkoutToLibrary(
  caller: McpCaller,
  input: { workoutId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  const workout = await getWorkout(caller.client, caller.userId, input.workoutId);
  if (!workout.workout.planOnly) {
    return {
      kind: 'noop',
      summary: `"${workout.workout.name}" is already in the library`,
      message: 'No write needed.',
      workoutId: workout.workout.id,
    };
  }
  return savePreview(
    caller,
    householdId,
    'preview_save_plan_workout_to_library',
    {
      action: 'save_plan_workout_to_library',
      workoutId: workout.workout.id,
      name: workout.workout.name,
    },
    `Save "${workout.workout.name}" to my workouts`,
    [`Clear plan_only on workout ${workout.workout.id}`],
  );
}

async function loadPlanDayOrThrow(
  client: SupabaseClient,
  householdId: string,
  dayId: string,
): Promise<{
  id: string;
  day: Day;
  restDay: boolean;
  focus: string[];
  durationMin: number | null;
  workoutId: string | null;
  planId: string;
}> {
  const { data, error } = await client
    .from('training_plan_days')
    .select('id, day, rest_day, focus, duration_min, workout_id, plan_id')
    .eq('id', dayId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(PLAN_DAY_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  const planId = String(rec.plan_id);
  const { data: plan, error: planError } = await client
    .from('training_plans')
    .select('id, household_id')
    .eq('id', planId)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan || String((plan as { household_id: string }).household_id) !== householdId) {
    throw new Error(PLAN_DAY_NOT_FOUND);
  }
  return {
    id: String(rec.id),
    day: String(rec.day) as Day,
    restDay: Boolean(rec.rest_day),
    focus: Array.isArray(rec.focus) ? rec.focus.map(String) : [],
    durationMin: typeof rec.duration_min === 'number' ? rec.duration_min : null,
    workoutId: typeof rec.workout_id === 'string' ? rec.workout_id : null,
    planId,
  };
}

async function createCustomExerciseRow(
  client: SupabaseClient,
  userId: string,
  householdId: string,
  draft: CustomExerciseDraft,
): Promise<string> {
  if (draft.scope === 'creator-global') {
    const ok = await isApprovedCreator(client);
    if (!ok) throw new Error(CREATOR_REQUIRED);
  }
  const mapped = chatScopeToDb(draft.scope);
  const { data, error } = await client
    .from('exercises')
    .insert({
      name: draft.name,
      body_part: draft.bodyPart ?? 'other',
      equipment: draft.equipment ?? 'body weight',
      target_muscle: draft.targetMuscle ?? 'other',
      secondary_muscles: draft.secondaryMuscles ?? [],
      instructions: draft.instructions ?? [],
      category: draft.category ?? null,
      difficulty: draft.difficulty ?? null,
      is_compound: draft.isCompound ?? null,
      media_url: null,
      media_urls: [],
      media_kind: null,
      source: 'user',
      license: 'user',
      license_author: null,
      scope: mapped.scope,
      owner_id: userId,
      household_id: mapped.scope === 'household' ? householdId : null,
      group_id: mapped.scope === 'group' ? draft.groupId : null,
      status: 'active',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const id = String((data as { id: string }).id);
  if (mapped.publishGlobal) {
    const { data: globalId, error: pubError } = await client.rpc('publish_global_exercise', {
      p_source_exercise_id: id,
    });
    if (pubError) throw new Error(pubError.message);
    if (typeof globalId === 'string' && globalId) return globalId;
  }
  return id;
}

async function replaceWorkoutExercises(
  client: SupabaseClient,
  householdId: string,
  workoutId: string,
  exercises: WorkoutExerciseDraft[],
): Promise<void> {
  const { error: delError } = await client.from('workout_exercises').delete().eq('workout_id', workoutId);
  if (delError) throw new Error(delError.message);
  if (exercises.length === 0) return;
  const { error } = await client.from('workout_exercises').insert(
    exercises.map((exercise, position) => ({
      workout_id: workoutId,
      household_id: householdId,
      exercise_id: exercise.exerciseId,
      name: exercise.name,
      position,
      target_sets: exercise.targetSets,
      target_reps: exercise.targetReps,
      target_weight: null,
      target_effort: exercise.intensity,
      target_rpe: null,
      note: (exercise.note ?? '').slice(0, 160),
      superset_id: null,
    })),
  );
  if (error) throw new Error(error.message);
}

async function materializeCustomExercises(
  client: SupabaseClient,
  userId: string,
  householdId: string,
  customExercises: CustomExerciseDraft[],
  exercises: WorkoutExerciseDraft[],
): Promise<{ createdIds: string[]; exercises: WorkoutExerciseDraft[] }> {
  const created = new Map<string, string>();
  const createdIds: string[] = [];
  for (const draft of customExercises) {
    const key = normalizeName(draft.name);
    if (created.has(key)) continue;
    const id = await createCustomExerciseRow(client, userId, householdId, draft);
    created.set(key, id);
    createdIds.push(id);
  }
  const next = exercises.map((ex) => {
    if (ex.exerciseId) return ex;
    const key = normalizeName(ex.proposeCreate?.name ?? ex.name);
    const id = created.get(key) ?? null;
    return { ...ex, exerciseId: id, proposeCreate: null };
  });
  return { createdIds, exercises: next };
}

async function createLibraryWorkout(
  client: SupabaseClient,
  opts: {
    householdId: string;
    userId: string;
    name: string;
    durationMin: number | null;
    planOnly: boolean;
    exercises: WorkoutExerciseDraft[];
  },
): Promise<string> {
  let workoutId: string;
  if (!opts.planOnly) {
    const { data, error } = await client.rpc('create_private_workout', {
      p_household_id: opts.householdId,
      p_name: opts.name,
      p_duration_min: opts.durationMin,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== 'string') throw new Error('Could not create workout');
    workoutId = data;
  } else {
    const { data, error } = await client
      .from('workouts')
      .insert({
        household_id: opts.householdId,
        created_by: opts.userId,
        name: opts.name,
        visibility: 'private',
        split_id: null,
        duration_min: opts.durationMin,
        plan_only: true,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    workoutId = String((data as { id: string }).id);
  }
  await replaceWorkoutExercises(client, opts.householdId, workoutId, opts.exercises);
  return workoutId;
}

export async function commitFitnessPreview(
  caller: McpCaller,
  input: { previewId: string },
): Promise<{
  ok: true;
  tool: string;
  affectedIds: string[];
  result: Record<string, unknown>;
}> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  assertCanWrite(role);
  if (!input.previewId) throw new Error('previewId is required');

  const tool = await peekPreviewTool(caller.client, caller.userId, input.previewId);
  const committed = await commitWritePreview(caller.client, {
    userId: caller.userId,
    previewId: input.previewId,
    tool,
  });
  if (!committed.ok) throw new Error(`Preview ${committed.reason}`);

  const payload = committed.preview.payload as FitnessWriteAction;
  const executed = await executeWrite(caller, householdId, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

async function peekPreviewTool(
  client: SupabaseClient,
  userId: string,
  previewId: string,
): Promise<string> {
  const { data, error } = await client
    .from('mcp_previews')
    .select('tool')
    .eq('id', previewId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tool) throw new Error('Preview missing');
  return data.tool as string;
}

async function executeWrite(
  caller: McpCaller,
  householdId: string,
  payload: FitnessWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  const client = caller.client;
  const userId = caller.userId;

  switch (payload.action) {
    case 'create_workout': {
      const materialized = await materializeCustomExercises(
        client,
        userId,
        householdId,
        payload.customExercises,
        payload.exercises,
      );
      const workoutId = await createLibraryWorkout(client, {
        householdId,
        userId,
        name: payload.name,
        durationMin: payload.durationMin,
        planOnly: false,
        exercises: materialized.exercises,
      });
      return {
        affectedIds: [...materialized.createdIds, workoutId],
        result: { workoutId, customExerciseIds: materialized.createdIds, planOnly: false },
      };
    }
    case 'update_workout': {
      const materialized = await materializeCustomExercises(
        client,
        userId,
        householdId,
        payload.customExercises,
        payload.exercises,
      );
      const { error } = await client
        .from('workouts')
        .update({
          name: payload.name,
          duration_min: payload.durationMin,
        })
        .eq('id', payload.workoutId)
        .eq('household_id', householdId);
      if (error) throw new Error(error.message);
      await replaceWorkoutExercises(client, householdId, payload.workoutId, materialized.exercises);
      return {
        affectedIds: [...materialized.createdIds, payload.workoutId],
        result: { workoutId: payload.workoutId },
      };
    }
    case 'delete_workout': {
      const { data, error } = await client
        .from('workouts')
        .delete()
        .eq('id', payload.workoutId)
        .eq('household_id', householdId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(WORKOUT_NOT_FOUND);
      return { affectedIds: [payload.workoutId], result: { deleted: payload.workoutId } };
    }
    case 'create_custom_exercise': {
      const id = await createCustomExerciseRow(client, userId, householdId, payload.draft);
      return { affectedIds: [id], result: { exerciseId: id } };
    }
    case 'update_custom_exercise': {
      const mapped = chatScopeToDb(payload.draft.scope);
      if (payload.draft.scope === 'creator-global') {
        const ok = await isApprovedCreator(client);
        if (!ok) throw new Error(CREATOR_REQUIRED);
      }
      const { error } = await client
        .from('exercises')
        .update({
          name: payload.draft.name,
          body_part: payload.draft.bodyPart ?? 'other',
          equipment: payload.draft.equipment ?? 'body weight',
          target_muscle: payload.draft.targetMuscle ?? 'other',
          secondary_muscles: payload.draft.secondaryMuscles ?? [],
          instructions: payload.draft.instructions ?? [],
          category: payload.draft.category ?? null,
          difficulty: payload.draft.difficulty ?? null,
          is_compound: payload.draft.isCompound ?? null,
          scope: mapped.scope,
          household_id: mapped.scope === 'household' ? householdId : null,
          group_id: mapped.scope === 'group' ? payload.draft.groupId : null,
        })
        .eq('id', payload.exerciseId);
      if (error) throw new Error(error.message);
      let exerciseId = payload.exerciseId;
      if (mapped.publishGlobal) {
        const { data: globalId, error: pubError } = await client.rpc('publish_global_exercise', {
          p_source_exercise_id: payload.exerciseId,
        });
        if (pubError) throw new Error(pubError.message);
        if (typeof globalId === 'string' && globalId) exerciseId = globalId;
      }
      return { affectedIds: [exerciseId], result: { exerciseId } };
    }
    case 'create_training_plan': {
      const intentDays = buildIntentWeekDays({
        trainingDays: payload.days,
        durationMin: payload.durationMin,
        goal: payload.goal,
        splitStyle: payload.splitStyle,
        customFocusByDay: payload.focusByDay,
      });
      const { data: createdPlanId, error: createError } = await client.rpc('create_training_plan', {
        p_household_id: householdId,
        p_week_start: payload.weekStart,
        p_name: payload.name,
        p_visibility: 'private',
        p_audience_person_ids: [],
        p_prefs: {
          fillWorkouts: false,
          durationMin: payload.durationMin,
          goal: payload.goal,
          splitStyle: payload.splitStyle ?? null,
        },
      });
      if (createError) throw new Error(createError.message);
      if (!createdPlanId || typeof createdPlanId !== 'string') {
        throw new Error('Could not create training plan');
      }
      const applied = await handleApplyTrainingPlan(client as never, {
        householdId,
        ownerId: userId,
        authUserId: userId,
        name: payload.name,
        weekStart: payload.weekStart,
        visibility: 'private',
        prefs: {
          fillWorkouts: false,
          durationMin: payload.durationMin,
          goal: payload.goal,
          splitStyle: payload.splitStyle ?? null,
        },
        days: intentDays,
        planId: createdPlanId,
      });
      if (applied.status !== 200) throw new Error(applied.body.error);
      return {
        affectedIds: [applied.body.planId],
        result: { planId: applied.body.planId, workoutIds: applied.body.workoutIds },
      };
    }
    case 'fill_plan_day': {
      const focusLabel = payload.focus[0]?.trim() || 'Train';
      const sessionTypeId = sessionTypeIdFromFocus(focusLabel);
      if (!sessionTypeId) throw new Error('No matching session type');
      const catalogue = await loadCatalogueForFill(client);
      const pool = canFillSessionType(sessionTypeId, catalogue) ? catalogue : catalogue;
      const filled = fillWorkoutFromSessionTypeWidened({
        sessionTypeId,
        durationMin: payload.durationMin ?? 40,
        catalogue: pool,
        goal: payload.goal ?? undefined,
        level: payload.level ?? undefined,
        seed: Date.now() % 1_000_000,
      });
      if (filled.length === 0) throw new Error('No matching exercises');
      const exercises: WorkoutExerciseDraft[] = filled.map((ex) => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        intensity: null,
      }));
      let workoutId = payload.existingWorkoutId ?? null;
      if (workoutId) {
        await replaceWorkoutExercises(client, householdId, workoutId, exercises);
        const { error } = await client
          .from('workouts')
          .update({ plan_only: true, name: focusLabel, duration_min: payload.durationMin })
          .eq('id', workoutId);
        if (error) throw new Error(error.message);
      } else {
        workoutId = await createLibraryWorkout(client, {
          householdId,
          userId,
          name: focusLabel,
          durationMin: payload.durationMin,
          planOnly: true,
          exercises,
        });
        const attach = await handleAttachWorkoutToPlanDay(client as never, {
          authUserId: userId,
          dayId: payload.dayId,
          workoutId,
        });
        if (attach.status !== 200) throw new Error(attach.body.error);
      }
      return {
        affectedIds: [workoutId, payload.dayId],
        result: { workoutId, exerciseCount: exercises.length, planOnly: true },
      };
    }
    case 'set_plan_day_workout': {
      const attach = await handleAttachWorkoutToPlanDay(client as never, {
        authUserId: userId,
        dayId: payload.dayId,
        workoutId: payload.workoutId,
      });
      if (attach.status !== 200) throw new Error(attach.body.error);
      return {
        affectedIds: [payload.dayId, payload.workoutId].filter((id): id is string => Boolean(id)),
        result: attach.body,
      };
    }
    case 'update_plan_day': {
      const result = await handleUpdateTrainingPlanDaySchedule(client as never, {
        authUserId: userId,
        dayId: payload.dayId,
        focus: payload.focus,
        durationMin: payload.durationMin,
        restDay: payload.restDay,
        scheduledTime: payload.scheduledTime,
        // Never push calendar from chat.
      });
      if (result.status !== 200) throw new Error(result.body.error);
      return { affectedIds: [payload.dayId], result: result.body };
    }
    case 'clear_plan_day': {
      if (payload.makeRest) {
        const result = await handleUpdateTrainingPlanDaySchedule(client as never, {
          authUserId: userId,
          dayId: payload.dayId,
          restDay: true,
        });
        if (result.status !== 200) throw new Error(result.body.error);
      } else {
        const attach = await handleAttachWorkoutToPlanDay(client as never, {
          authUserId: userId,
          dayId: payload.dayId,
          workoutId: null,
        });
        if (attach.status !== 200) throw new Error(attach.body.error);
      }
      return { affectedIds: [payload.dayId], result: { cleared: true, makeRest: Boolean(payload.makeRest) } };
    }
    case 'move_plan_day': {
      const result = await handleUpdateTrainingPlanDaySchedule(client as never, {
        authUserId: userId,
        dayId: payload.dayId,
        day: payload.day,
      });
      if (result.status !== 200) throw new Error(result.body.error);
      return { affectedIds: [payload.dayId], result: result.body };
    }
    case 'delete_training_plan': {
      const result = await handleDeleteTrainingPlan(client as never, {
        authUserId: userId,
        planId: payload.planId,
      });
      if (result.status !== 200) throw new Error(result.body.error);
      return { affectedIds: [payload.planId], result: { deleted: payload.planId } };
    }
    case 'log_workout_session': {
      const { data, error } = await client
        .from('workout_sessions')
        .insert({
          household_id: householdId,
          user_id: userId,
          workout_id: payload.workoutId,
          name: payload.name,
          started_at: payload.startedAt,
          finished_at: payload.finishedAt,
          duration_min: payload.durationMin,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      const sessionId = String((data as { id: string }).id);
      const rows = payload.exercises.flatMap((exercise, position) =>
        exercise.sets.map((set, setIndex) => ({
          session_id: sessionId,
          household_id: householdId,
          user_id: userId,
          exercise_id: exercise.exerciseId,
          exercise_name: exercise.name,
          position,
          set_index: setIndex,
          weight: set.intensity ?? '',
          reps: set.reps ?? '',
          done: set.done !== false,
        })),
      );
      if (rows.length > 0) {
        const { error: setError } = await client.from('workout_sets').insert(rows);
        if (setError) throw new Error(setError.message);
      }
      if (payload.planDayId) {
        const marked = await handleSetTrainingPlanDayStatus(client as never, {
          authUserId: userId,
          dayId: payload.planDayId,
          status: 'done',
          sessionId,
        });
        if (marked.status !== 200) throw new Error(marked.body.error);
      } else if (payload.workoutId) {
        await handleMarkTrainingPlanDayFromSession(client as never, {
          authUserId: userId,
          sessionId,
          workoutId: payload.workoutId,
        });
      }
      return {
        affectedIds: [sessionId, payload.planDayId].filter((id): id is string => Boolean(id)),
        result: { sessionId },
      };
    }
    case 'mark_plan_day_status': {
      const result = await handleSetTrainingPlanDayStatus(client as never, {
        authUserId: userId,
        dayId: payload.dayId,
        status: payload.status,
        sessionId: payload.sessionId,
      });
      if (result.status !== 200) throw new Error(result.body.error);
      return { affectedIds: [payload.dayId], result: result.body };
    }
    case 'save_plan_workout_to_library': {
      const { error } = await client.rpc('save_workout_to_library', {
        p_workout_id: payload.workoutId,
      });
      if (error) throw new Error(error.message);
      return {
        affectedIds: [payload.workoutId],
        result: { workoutId: payload.workoutId, planOnly: false },
      };
    }
    default:
      throw new Error('Unknown fitness write action');
  }
}
