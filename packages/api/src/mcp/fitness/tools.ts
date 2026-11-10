import { z } from 'zod';

import type { McpToolDefinition } from '../registry.js';
import type { McpCaller } from '../context.js';
import {
  getSession,
  getTrainingPlan,
  getWorkout,
  getWorkoutHistory,
  listTrainingPlans,
  listWorkouts,
  searchExercises,
} from './reads.js';
import { resolveCallerHousehold, withFitnessAudit } from './shared.js';
import {
  previewClearPlanDay,
  previewCreateCustomExercise,
  previewCreateTrainingPlan,
  previewCreateWorkout,
  previewDeleteTrainingPlan,
  previewDeleteWorkout,
  previewFillPlanDay,
  previewLogWorkoutSession,
  previewMarkPlanDayStatus,
  previewMovePlanDay,
  previewSavePlanWorkoutToLibrary,
  previewSetPlanDayWorkout,
  previewUpdateCustomExercise,
  previewUpdatePlanDay,
  previewUpdateWorkout,
  type PreviewResult,
} from './writes.js';

const intensitySchema = z.enum(['light', 'moderate', 'heavy', 'medium', 'hard']);
const chatScopeSchema = z.enum(['personal', 'family', 'buddy', 'creator-global']);
const goalSchema = z.enum(['strength', 'hypertrophy', 'conditioning', 'mobility', 'fat_loss']);
const levelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
const dayStatusSchema = z.enum(['planned', 'done', 'skipped']);

const exerciseDraftSchema = z.object({
  exerciseId: z.string().optional(),
  name: z.string(),
  targetSets: z.number().int().positive().optional(),
  targetReps: z.string().optional(),
  intensity: intensitySchema.optional(),
  note: z.string().optional(),
  createIfMissing: z.boolean().optional(),
  custom: z
    .object({
      scope: chatScopeSchema.optional(),
      bodyPart: z.string().optional(),
      equipment: z.string().optional(),
      targetMuscle: z.string().optional(),
      category: z.string().nullable().optional(),
      difficulty: levelSchema.nullable().optional(),
      groupId: z.string().nullable().optional(),
    })
    .optional(),
});

const workoutExerciseOut = z.object({
  id: z.string(),
  exerciseId: z.string().nullable(),
  name: z.string(),
  position: z.number(),
  targetSets: z.number(),
  targetReps: z.string(),
  intensity: z.enum(['light', 'moderate', 'heavy', 'max']).nullable(),
  guide: z.enum(['load', 'effort']),
  note: z.string(),
});

const workoutOut = z.object({
  id: z.string(),
  name: z.string(),
  householdId: z.string(),
  visibility: z.string(),
  planOnly: z.boolean(),
  durationMin: z.number().nullable(),
  createdBy: z.string().nullable(),
  exercises: z.array(workoutExerciseOut),
});

const exerciseOut = z.object({
  id: z.string(),
  name: z.string(),
  bodyPart: z.string(),
  equipment: z.string(),
  targetMuscle: z.string(),
  category: z.string().nullable(),
  scope: z.string(),
  source: z.string(),
  guide: z.enum(['load', 'effort']),
});

const planDayOut = z.object({
  id: z.string(),
  day: z.string(),
  position: z.number(),
  restDay: z.boolean(),
  focus: z.array(z.string()),
  durationMin: z.number().nullable(),
  scheduledTime: z.string().nullable(),
  status: z.string(),
  workoutId: z.string().nullable(),
  workoutName: z.string().nullable(),
  sessionId: z.string().nullable(),
});

const planOut = z.object({
  id: z.string(),
  name: z.string(),
  householdId: z.string(),
  ownerId: z.string(),
  weekStart: z.string(),
  visibility: z.string(),
  days: z.array(planDayOut),
});

const sessionOut = z.object({
  id: z.string(),
  name: z.string(),
  workoutId: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  durationMin: z.number().nullable(),
  sets: z.array(
    z.object({
      id: z.string(),
      exerciseId: z.string().nullable(),
      exerciseName: z.string(),
      position: z.number(),
      setIndex: z.number(),
      weight: z.string(),
      reps: z.string(),
      done: z.boolean(),
    }),
  ),
});

const previewResultSchema = z.object({
  kind: z.enum(['preview', 'dedupe', 'blocked', 'noop']),
  previewId: z.string().optional(),
  expiresAt: z.string().optional(),
  tool: z.string().optional(),
  summary: z.string(),
  steps: z.array(z.string()).optional(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
  message: z.string().optional(),
  workoutId: z.string().optional(),
  exerciseId: z.string().optional(),
});

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
} as const;

async function householdIdOrNull(caller: McpCaller): Promise<string | null> {
  try {
    return (await resolveCallerHousehold(caller.client, caller.userId)).householdId;
  } catch {
    return null;
  }
}

function asPreviewResult(value: PreviewResult): z.infer<typeof previewResultSchema> {
  return value;
}

async function auditedPreview(
  caller: McpCaller,
  tool: string,
  run: () => Promise<PreviewResult>,
): Promise<z.infer<typeof previewResultSchema>> {
  const householdId = await householdIdOrNull(caller);
  return withFitnessAudit(caller, { tool, mode: 'write', householdId }, async () =>
    asPreviewResult(await run()),
  );
}

const listWorkoutsInput = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
  includePlanOnly: z.boolean().optional(),
});
const listWorkoutsOutput = z.object({
  householdId: z.string(),
  workouts: z.array(workoutOut),
});

export const listWorkoutsTool: McpToolDefinition<typeof listWorkoutsInput, typeof listWorkoutsOutput> = {
  name: 'list_workouts',
  title: 'List workouts',
  description: 'List library workouts for the household (excludes plan-only unless includePlanOnly).',
  inputSchema: listWorkoutsInput,
  outputSchema: listWorkoutsOutput,
  scope: 'fitness:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFitnessAudit(caller, { tool: 'list_workouts', mode: 'read' }, () =>
      listWorkouts(caller.client, caller.userId, args),
    ),
};

const getWorkoutInput = z.object({ workoutId: z.string() });
const getWorkoutOutput = z.object({ householdId: z.string(), workout: workoutOut });

export const getWorkoutTool: McpToolDefinition<typeof getWorkoutInput, typeof getWorkoutOutput> = {
  name: 'get_workout',
  title: 'Get workout',
  description: 'Get one workout by id with exercises and intensity (Load/Effort).',
  inputSchema: getWorkoutInput,
  outputSchema: getWorkoutOutput,
  scope: 'fitness:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFitnessAudit(caller, { tool: 'get_workout', mode: 'read' }, () =>
      getWorkout(caller.client, caller.userId, args.workoutId),
    ),
};

const searchExercisesInput = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
});
const searchExercisesOutput = z.object({
  householdId: z.string(),
  exercises: z.array(exerciseOut),
});

export const searchExercisesTool: McpToolDefinition<typeof searchExercisesInput, typeof searchExercisesOutput> = {
  name: 'search_exercises',
  title: 'Search exercises',
  description: 'Search the visible exercise library (catalogue + custom). Never invents exercises.',
  inputSchema: searchExercisesInput,
  outputSchema: searchExercisesOutput,
  scope: 'fitness:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFitnessAudit(caller, { tool: 'search_exercises', mode: 'read' }, () =>
      searchExercises(caller.client, caller.userId, args),
    ),
};

const listPlansInput = z.object({
  weekStart: z.string().optional(),
  limit: z.number().int().positive().max(30).optional(),
});
const listPlansOutput = z.object({
  householdId: z.string(),
  plans: z.array(planOut),
});

export const listTrainingPlansTool: McpToolDefinition<typeof listPlansInput, typeof listPlansOutput> = {
  name: 'list_training_plans',
  title: 'List training plans',
  description: 'List training plans for the household, optionally filtered by weekStart (YYYY-MM-DD Monday).',
  inputSchema: listPlansInput,
  outputSchema: listPlansOutput,
  scope: 'fitness:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFitnessAudit(caller, { tool: 'list_training_plans', mode: 'read' }, () =>
      listTrainingPlans(caller.client, caller.userId, args),
    ),
};

const getPlanInput = z.object({ planId: z.string() });
const getPlanOutput = z.object({ householdId: z.string(), plan: planOut });

export const getTrainingPlanTool: McpToolDefinition<typeof getPlanInput, typeof getPlanOutput> = {
  name: 'get_training_plan',
  title: 'Get training plan',
  description: 'Get a training plan with days, session types, and linked workouts.',
  inputSchema: getPlanInput,
  outputSchema: getPlanOutput,
  scope: 'fitness:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFitnessAudit(caller, { tool: 'get_training_plan', mode: 'read' }, () =>
      getTrainingPlan(caller.client, caller.userId, args.planId),
    ),
};

const historyInput = z.object({
  limit: z.number().int().positive().max(50).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
const historyOutput = z.object({
  householdId: z.string(),
  sessions: z.array(sessionOut),
});

export const getWorkoutHistoryTool: McpToolDefinition<typeof historyInput, typeof historyOutput> = {
  name: 'get_workout_history',
  title: 'Get workout history',
  description: 'List finished workout sessions for the caller.',
  inputSchema: historyInput,
  outputSchema: historyOutput,
  scope: 'fitness:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFitnessAudit(caller, { tool: 'get_workout_history', mode: 'read' }, () =>
      getWorkoutHistory(caller.client, caller.userId, args),
    ),
};

const getSessionInput = z.object({ sessionId: z.string() });
const getSessionOutput = z.object({ householdId: z.string(), session: sessionOut });

export const getSessionTool: McpToolDefinition<typeof getSessionInput, typeof getSessionOutput> = {
  name: 'get_session',
  title: 'Get session',
  description: 'Get one workout session (live or finished) with sets.',
  inputSchema: getSessionInput,
  outputSchema: getSessionOutput,
  scope: 'fitness:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFitnessAudit(caller, { tool: 'get_session', mode: 'read' }, () =>
      getSession(caller.client, caller.userId, args.sessionId),
    ),
};

const createWorkoutInput = z.object({
  name: z.string(),
  durationMin: z.number().nullable().optional(),
  exercises: z.array(exerciseDraftSchema).optional(),
  decision: z.enum(['create_new', 'reuse']).optional(),
  reuseWorkoutId: z.string().optional(),
});

export const previewCreateWorkoutTool: McpToolDefinition<typeof createWorkoutInput, typeof previewResultSchema> = {
  name: 'preview_create_workout',
  title: 'Preview create workout',
  description:
    'Preview creating a private library workout. Dedupes by title + exercise set. Missing exercises propose create_custom_exercise in the same preview (one confirmation).',
  inputSchema: createWorkoutInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_create_workout', () => previewCreateWorkout(caller, args)),
};

const updateWorkoutInput = createWorkoutInput.partial().extend({ workoutId: z.string() });

export const previewUpdateWorkoutTool: McpToolDefinition<typeof updateWorkoutInput, typeof previewResultSchema> = {
  name: 'preview_update_workout',
  title: 'Preview update workout',
  description: 'Preview updating a library workout. Intensity uses Load/Effort (light/medium/heavy), not RPE/kg.',
  inputSchema: updateWorkoutInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_update_workout', () => previewUpdateWorkout(caller, args)),
};

const deleteWorkoutInput = z.object({ workoutId: z.string() });

export const previewDeleteWorkoutTool: McpToolDefinition<typeof deleteWorkoutInput, typeof previewResultSchema> = {
  name: 'preview_delete_workout',
  title: 'Preview delete workout',
  description: 'Preview deleting a library workout.',
  inputSchema: deleteWorkoutInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_delete_workout', () => previewDeleteWorkout(caller, args)),
};

const customExerciseInput = z.object({
  name: z.string(),
  scope: chatScopeSchema.optional(),
  bodyPart: z.string().optional(),
  equipment: z.string().optional(),
  targetMuscle: z.string().optional(),
  category: z.string().nullable().optional(),
  difficulty: levelSchema.nullable().optional(),
  groupId: z.string().nullable().optional(),
  secondaryMuscles: z.array(z.string()).optional(),
  instructions: z.array(z.string()).optional(),
  isCompound: z.boolean().nullable().optional(),
  decision: z.enum(['create_new', 'reuse']).optional(),
  reuseExerciseId: z.string().optional(),
});

export const previewCreateCustomExerciseTool: McpToolDefinition<
  typeof customExerciseInput,
  typeof previewResultSchema
> = {
  name: 'preview_create_custom_exercise',
  title: 'Preview create custom exercise',
  description:
    'Preview creating a custom exercise. Scope: personal (default), family, buddy (needs groupId), creator-global (approved creators only). Dedupes by normalised name.',
  inputSchema: customExerciseInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_create_custom_exercise', () => previewCreateCustomExercise(caller, args)),
};

const updateCustomInput = customExerciseInput.partial().extend({ exerciseId: z.string() });

export const previewUpdateCustomExerciseTool: McpToolDefinition<
  typeof updateCustomInput,
  typeof previewResultSchema
> = {
  name: 'preview_update_custom_exercise',
  title: 'Preview update custom exercise',
  description: 'Preview updating a custom exercise (scope rules same as create).',
  inputSchema: updateCustomInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_update_custom_exercise', () => previewUpdateCustomExercise(caller, args)),
};

const createPlanInput = z.object({
  name: z.string().optional(),
  weekStart: z.string().optional(),
  daysPerWeek: z.number().int().min(2).max(6).optional(),
  days: z.array(z.string()).optional(),
  durationMin: z.number().optional(),
  goal: goalSchema.optional(),
  splitStyle: z.string().nullable().optional(),
  focusByDay: z.record(z.string()).optional(),
});

export const previewCreateTrainingPlanTool: McpToolDefinition<typeof createPlanInput, typeof previewResultSchema> = {
  name: 'preview_create_training_plan',
  title: 'Preview create training plan',
  description:
    'Preview creating an intent-first training plan (session types on days). fillWorkouts is always off — no workouts are generated.',
  inputSchema: createPlanInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_create_training_plan', () => previewCreateTrainingPlan(caller, args)),
};

const fillDayInput = z.object({
  dayId: z.string(),
  goal: goalSchema.nullable().optional(),
  level: levelSchema.nullable().optional(),
});

export const previewFillPlanDayTool: McpToolDefinition<typeof fillDayInput, typeof previewResultSchema> = {
  name: 'preview_fill_plan_day',
  title: 'Preview fill plan day',
  description:
    'Preview filling one named plan day from its session type into a plan_only workout. Never fills other days.',
  inputSchema: fillDayInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_fill_plan_day', () => previewFillPlanDay(caller, args)),
};

const setDayWorkoutInput = z.object({
  dayId: z.string(),
  workoutId: z.string().nullable(),
});

export const previewSetPlanDayWorkoutTool: McpToolDefinition<
  typeof setDayWorkoutInput,
  typeof previewResultSchema
> = {
  name: 'preview_set_plan_day_workout',
  title: 'Preview set plan day workout',
  description: 'Preview linking an existing workout to a plan day, or clearing the link (intent kept).',
  inputSchema: setDayWorkoutInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_set_plan_day_workout', () => previewSetPlanDayWorkout(caller, args)),
};

const updateDayInput = z.object({
  dayId: z.string(),
  focus: z.array(z.string()).optional(),
  durationMin: z.number().nullable().optional(),
  restDay: z.boolean().optional(),
  scheduledTime: z.string().nullable().optional(),
});

export const previewUpdatePlanDayTool: McpToolDefinition<typeof updateDayInput, typeof previewResultSchema> = {
  name: 'preview_update_plan_day',
  title: 'Preview update plan day',
  description: 'Preview updating a plan day focus, duration, rest, or scheduled time. Never triggers calendar push.',
  inputSchema: updateDayInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_update_plan_day', () => previewUpdatePlanDay(caller, args)),
};

const clearDayInput = z.object({
  dayId: z.string(),
  makeRest: z.boolean().optional(),
});

export const previewClearPlanDayTool: McpToolDefinition<typeof clearDayInput, typeof previewResultSchema> = {
  name: 'preview_clear_plan_day',
  title: 'Preview clear plan day',
  description: 'Preview clearing the workout link on a plan day, or making it a rest day.',
  inputSchema: clearDayInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_clear_plan_day', () => previewClearPlanDay(caller, args)),
};

const moveDayInput = z.object({
  dayId: z.string(),
  day: z.string(),
});

export const previewMovePlanDayTool: McpToolDefinition<typeof moveDayInput, typeof previewResultSchema> = {
  name: 'preview_move_plan_day',
  title: 'Preview move plan day',
  description: 'Preview moving a plan day to another weekday.',
  inputSchema: moveDayInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_move_plan_day', () => previewMovePlanDay(caller, args)),
};

const deletePlanInput = z.object({ planId: z.string() });

export const previewDeleteTrainingPlanTool: McpToolDefinition<typeof deletePlanInput, typeof previewResultSchema> = {
  name: 'preview_delete_training_plan',
  title: 'Preview delete training plan',
  description: 'Preview deleting a training plan you own.',
  inputSchema: deletePlanInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_delete_training_plan', () => previewDeleteTrainingPlan(caller, args)),
};

const logSessionInput = z.object({
  name: z.string().optional(),
  workoutId: z.string().nullable().optional(),
  planDayId: z.string().nullable().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().nullable().optional(),
  durationMin: z.number().nullable().optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().optional(),
        name: z.string(),
        targetSets: z.number().optional(),
        targetReps: z.string().optional(),
        intensity: intensitySchema.optional(),
        sets: z
          .array(
            z.object({
              intensity: intensitySchema.optional(),
              reps: z.string().optional(),
              done: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export const previewLogWorkoutSessionTool: McpToolDefinition<typeof logSessionInput, typeof previewResultSchema> = {
  name: 'preview_log_workout_session',
  title: 'Preview log workout session',
  description:
    'Preview logging a finished workout session (same rules as in-app finish, including optional plan-day link).',
  inputSchema: logSessionInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_log_workout_session', () => previewLogWorkoutSession(caller, args)),
};

const markStatusInput = z.object({
  dayId: z.string(),
  status: dayStatusSchema,
  sessionId: z.string().nullable().optional(),
});

export const previewMarkPlanDayStatusTool: McpToolDefinition<typeof markStatusInput, typeof previewResultSchema> = {
  name: 'preview_mark_plan_day_status',
  title: 'Preview mark plan day status',
  description: 'Preview marking a plan day planned/done/skipped.',
  inputSchema: markStatusInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_mark_plan_day_status', () => previewMarkPlanDayStatus(caller, args)),
};

const saveLibraryInput = z.object({ workoutId: z.string() });

export const previewSavePlanWorkoutToLibraryTool: McpToolDefinition<
  typeof saveLibraryInput,
  typeof previewResultSchema
> = {
  name: 'preview_save_plan_workout_to_library',
  title: 'Preview save plan workout to library',
  description: 'Preview the "Save to my workouts" action for a plan_only workout.',
  inputSchema: saveLibraryInput,
  outputSchema: previewResultSchema,
  scope: 'fitness:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_save_plan_workout_to_library', () =>
      previewSavePlanWorkoutToLibrary(caller, args),
    ),
};

export const FITNESS_MCP_TOOLS = [
  listWorkoutsTool,
  getWorkoutTool,
  searchExercisesTool,
  listTrainingPlansTool,
  getTrainingPlanTool,
  getWorkoutHistoryTool,
  getSessionTool,
  previewCreateWorkoutTool,
  previewUpdateWorkoutTool,
  previewDeleteWorkoutTool,
  previewCreateCustomExerciseTool,
  previewUpdateCustomExerciseTool,
  previewCreateTrainingPlanTool,
  previewFillPlanDayTool,
  previewSetPlanDayWorkoutTool,
  previewUpdatePlanDayTool,
  previewClearPlanDayTool,
  previewMovePlanDayTool,
  previewDeleteTrainingPlanTool,
  previewLogWorkoutSessionTool,
  previewMarkPlanDayStatusTool,
  previewSavePlanWorkoutToLibraryTool,
] as const;
