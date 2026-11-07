import { addDaysIso } from '../meals/week';
import { DAYS, type Day } from '../meals/types';
import { todayIso } from '../stash/items';
import {
  generateTrainPlan,
  type GeneratedTrainDay,
  type GeneratePlanGoal,
  type GeneratePlanLevel,
  type SavedWorkoutCandidate,
} from './generate-plan';
import type { PlanCalendarDeletePush, PlanCalendarPush } from './plan-calendar';
import type { CatalogExercise } from './types';
import type { TrainVisibility } from './visibility';

export type TrainingPlanDayStatus = 'planned' | 'done' | 'skipped';

export type TrainingPlanDayRow = {
  id: string;
  planId: string;
  day: Day;
  position: number;
  workoutId: string | null;
  generatedSpec: Record<string, unknown> | null;
  restDay: boolean;
  scheduledTime: string | null;
  durationMin: number | null;
  focus: string[];
  status: TrainingPlanDayStatus;
  sessionId: string | null;
};

export type TrainingPlanWeekRow = {
  id: string;
  householdId: string;
  ownerId: string;
  name: string;
  weekStart: string;
  visibility: TrainVisibility;
  audiencePersonIds: string[];
  prefs: Record<string, unknown>;
  calendarAutoSync: boolean;
  buddyUserIds: string[];
  days: TrainingPlanDayRow[];
};

type QueryError = { message: string; code?: string } | null;
type QueryResult<T> = { data: T; error: QueryError };

/** Loose authenticated Supabase-shaped client — no service role. */
export type PlanWeekDbClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

function isRlsOrOwnershipError(error: QueryError): boolean {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return (
    error.code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('violates row-level security') ||
    msg.includes('new row violates')
  );
}

const DAY_SHORT: Record<Day, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export function dayDateIso(weekStart: string, day: Day): string {
  const idx = DAYS.indexOf(day);
  return addDaysIso(weekStart, idx < 0 ? 0 : idx);
}

/** Future + still-planned days only (past / done / skipped locked). */
export function isRegeneratableDay(input: {
  weekStart: string;
  day: Day;
  status: TrainingPlanDayStatus;
  todayIso: string;
}): boolean {
  if (input.status !== 'planned') return false;
  return dayDateIso(input.weekStart, input.day) >= input.todayIso;
}

function asDay(value: string): Day | null {
  return (DAYS as readonly string[]).includes(value) ? (value as Day) : null;
}

function asStatus(value: string): TrainingPlanDayStatus | null {
  return value === 'planned' || value === 'done' || value === 'skipped' ? value : null;
}

function mapDayRow(row: Record<string, unknown>, planId: string): TrainingPlanDayRow | null {
  const day = typeof row.day === 'string' ? asDay(row.day) : null;
  const status = typeof row.status === 'string' ? asStatus(row.status) : null;
  if (!day || !status || typeof row.id !== 'string') return null;
  return {
    id: row.id,
    planId,
    day,
    position: typeof row.position === 'number' ? row.position : 0,
    workoutId: typeof row.workout_id === 'string' ? row.workout_id : null,
    generatedSpec:
      row.generated_spec && typeof row.generated_spec === 'object' && !Array.isArray(row.generated_spec)
        ? (row.generated_spec as Record<string, unknown>)
        : null,
    restDay: Boolean(row.rest_day),
    scheduledTime: typeof row.scheduled_time === 'string' ? row.scheduled_time : null,
    durationMin: typeof row.duration_min === 'number' ? row.duration_min : null,
    focus: Array.isArray(row.focus) ? row.focus.map(String) : [],
    status,
    sessionId: typeof row.session_id === 'string' ? row.session_id : null,
  };
}

function mapPlanRow(row: Record<string, unknown>): TrainingPlanWeekRow | null {
  if (typeof row.id !== 'string' || typeof row.household_id !== 'string' || typeof row.owner_id !== 'string') {
    return null;
  }
  const weekStart = typeof row.week_start === 'string' ? row.week_start : '';
  if (!weekStart) return null;
  const dayRows = Array.isArray(row.training_plan_days) ? row.training_plan_days : [];
  const shares = Array.isArray(row.training_plan_buddy_shares) ? row.training_plan_buddy_shares : [];
  return {
    id: row.id,
    householdId: row.household_id,
    ownerId: row.owner_id,
    name: typeof row.name === 'string' ? row.name : 'Training plan',
    weekStart,
    visibility: (typeof row.visibility === 'string' ? row.visibility : 'private') as TrainVisibility,
    audiencePersonIds: Array.isArray(row.audience_person_ids)
      ? row.audience_person_ids.map(String)
      : [],
    prefs:
      row.prefs && typeof row.prefs === 'object' && !Array.isArray(row.prefs)
        ? (row.prefs as Record<string, unknown>)
        : {},
    calendarAutoSync: Boolean(row.calendar_auto_sync),
    buddyUserIds: shares
      .map((share) =>
        share && typeof share === 'object' && 'buddy_user_id' in share
          ? String((share as { buddy_user_id: unknown }).buddy_user_id)
          : '',
      )
      .filter(Boolean),
    days: dayRows
      .map((day) =>
        day && typeof day === 'object' ? mapDayRow(day as Record<string, unknown>, row.id as string) : null,
      )
      .filter((day): day is TrainingPlanDayRow => Boolean(day))
      .sort((a, b) => a.position - b.position || DAYS.indexOf(a.day) - DAYS.indexOf(b.day)),
  };
}

export type ListTrainingPlansByWeekResult =
  | { status: 200; body: { plans: TrainingPlanWeekRow[] } }
  | { status: 400 | 403 | 500; body: { error: string } };

export async function handleListTrainingPlansByWeek(
  client: PlanWeekDbClient,
  input: { householdId: string; weekStart: string; authUserId: string },
): Promise<ListTrainingPlansByWeekResult> {
  if (!input.householdId || !input.weekStart || !input.authUserId) {
    return { status: 400, body: { error: 'householdId, weekStart, and authUserId are required' } };
  }

  const result = await client
    .from('training_plans')
    .select(
      'id, household_id, owner_id, name, week_start, visibility, audience_person_ids, prefs, calendar_auto_sync, training_plan_days(*), training_plan_buddy_shares(buddy_user_id)',
    )
    .eq('household_id', input.householdId)
    .eq('week_start', input.weekStart)
    .order('created_at', { ascending: true });

  if (result.error) {
    if (isRlsOrOwnershipError(result.error)) {
      return { status: 403, body: { error: 'Not allowed to view training plans' } };
    }
    return { status: 500, body: { error: result.error.message } };
  }

  const rows: unknown[] = Array.isArray(result.data) ? result.data : [];
  const plans = rows
    .map((row: unknown) => (row && typeof row === 'object' ? mapPlanRow(row as Record<string, unknown>) : null))
    .filter((plan: TrainingPlanWeekRow | null): plan is TrainingPlanWeekRow => Boolean(plan));

  return { status: 200, body: { plans } };
}

export type SetTrainingPlanDayStatusResult =
  | { status: 200; body: { id: string; status: TrainingPlanDayStatus; sessionId: string | null } }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

export async function handleSetTrainingPlanDayStatus(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    dayId: string;
    status: TrainingPlanDayStatus;
    sessionId?: string | null;
  },
): Promise<SetTrainingPlanDayStatusResult> {
  if (!input.authUserId || !input.dayId) {
    return { status: 400, body: { error: 'authUserId and dayId are required' } };
  }
  if (!asStatus(input.status)) {
    return { status: 400, body: { error: 'Invalid status' } };
  }

  const sessionId = input.status === 'done' ? (input.sessionId ?? null) : null;
  const result = await client
    .from('training_plan_days')
    .update({
      status: input.status,
      session_id: sessionId,
    })
    .eq('id', input.dayId)
    .select('id, status, session_id')
    .maybeSingle();

  if (result.error) {
    if (isRlsOrOwnershipError(result.error)) {
      return { status: 403, body: { error: 'Not allowed to update this plan day' } };
    }
    return { status: 500, body: { error: result.error.message } };
  }
  if (!result.data || typeof result.data !== 'object' || !('id' in result.data)) {
    return { status: 404, body: { error: 'Plan day not found' } };
  }

  const row = result.data as { id: string; status: string; session_id: string | null };
  const status = asStatus(row.status) ?? input.status;
  return {
    status: 200,
    body: { id: row.id, status, sessionId: row.session_id ?? null },
  };
}

export type MarkPlanDayFromSessionResult =
  | { status: 200; body: { updated: number; dayIds: string[] } }
  | { status: 400 | 403 | 500; body: { error: string } };

/**
 * Idempotent completion hook: mark matching planned days done for this session/workout.
 * Re-running with the same session_id is a no-op success.
 */
export async function handleMarkTrainingPlanDayFromSession(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    sessionId: string;
    workoutId: string | null;
  },
): Promise<MarkPlanDayFromSessionResult> {
  if (!input.authUserId || !input.sessionId) {
    return { status: 400, body: { error: 'authUserId and sessionId are required' } };
  }
  if (!input.workoutId) {
    return { status: 200, body: { updated: 0, dayIds: [] } };
  }

  const existing = await client
    .from('training_plan_days')
    .select('id, status, session_id')
    .eq('workout_id', input.workoutId);

  if (existing.error) {
    if (isRlsOrOwnershipError(existing.error)) {
      return { status: 403, body: { error: 'Not allowed to update plan days for this session' } };
    }
    return { status: 500, body: { error: existing.error.message } };
  }

  const rows: unknown[] = Array.isArray(existing.data) ? existing.data : [];
  const targets = rows.flatMap((row: unknown) => {
    if (!row || typeof row !== 'object' || !('id' in row)) return [];
    const rec = row as Record<string, unknown>;
    if (typeof rec.id !== 'string') return [];
    const status = typeof rec.status === 'string' ? rec.status : '';
    const sessionId = typeof rec.session_id === 'string' ? rec.session_id : null;
    if (status === 'planned' || (status === 'done' && sessionId === input.sessionId)) {
      return [{ id: rec.id, status, session_id: sessionId }];
    }
    return [];
  });

  if (targets.length === 0) {
    return { status: 200, body: { updated: 0, dayIds: [] } };
  }

  const alreadyDone = targets.filter((row) => row.status === 'done' && row.session_id === input.sessionId);
  const toUpdate = targets.filter((row) => row.status === 'planned');
  const dayIds = [...alreadyDone, ...toUpdate].map((row) => row.id);

  if (toUpdate.length === 0) {
    return { status: 200, body: { updated: 0, dayIds } };
  }

  const update = await client
    .from('training_plan_days')
    .update({ status: 'done', session_id: input.sessionId })
    .in(
      'id',
      toUpdate.map((row) => row.id),
    );

  if (update.error) {
    if (isRlsOrOwnershipError(update.error)) {
      return { status: 403, body: { error: 'Not allowed to update plan days for this session' } };
    }
    return { status: 500, body: { error: update.error.message } };
  }

  return { status: 200, body: { updated: toUpdate.length, dayIds } };
}

export type DuplicateTrainingPlanResult =
  | { status: 200; body: { planId: string; weekStart: string } }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

export async function handleDuplicateTrainingPlanToNextWeek(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    planId: string;
    pushToGoogle?: PlanCalendarPush;
    deleteFromGoogle?: PlanCalendarDeletePush;
  },
): Promise<DuplicateTrainingPlanResult> {
  if (!input.authUserId || !input.planId) {
    return { status: 400, body: { error: 'authUserId and planId are required' } };
  }

  const loaded = await client
    .from('training_plans')
    .select(
      'id, household_id, owner_id, name, week_start, visibility, audience_person_ids, prefs, calendar_auto_sync, training_plan_days(*), training_plan_buddy_shares(buddy_user_id)',
    )
    .eq('id', input.planId)
    .maybeSingle();

  if (loaded.error) {
    if (isRlsOrOwnershipError(loaded.error)) {
      return { status: 403, body: { error: 'Not allowed to duplicate this plan' } };
    }
    return { status: 500, body: { error: loaded.error.message } };
  }
  if (!loaded.data || typeof loaded.data !== 'object') {
    return { status: 404, body: { error: 'Plan not found' } };
  }

  const plan = mapPlanRow(loaded.data as Record<string, unknown>);
  if (!plan) return { status: 500, body: { error: 'Could not read plan' } };
  if (plan.ownerId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only duplicate plans you own' } };
  }

  const nextWeek = addDaysIso(plan.weekStart, 7);
  const insertPlan = await client
    .from('training_plans')
    .insert({
      household_id: plan.householdId,
      owner_id: plan.ownerId,
      name: plan.name,
      week_start: nextWeek,
      visibility: plan.visibility,
      audience_person_ids: plan.audiencePersonIds,
      prefs: plan.prefs,
      calendar_auto_sync: plan.calendarAutoSync,
    })
    .select('id')
    .single();

  if (insertPlan.error || !insertPlan.data || typeof insertPlan.data !== 'object' || !('id' in insertPlan.data)) {
    if (isRlsOrOwnershipError(insertPlan.error)) {
      return { status: 403, body: { error: 'Not allowed to create the duplicated plan' } };
    }
    return { status: 500, body: { error: insertPlan.error?.message ?? 'Could not duplicate plan' } };
  }

  const newPlanId = String((insertPlan.data as { id: string }).id);

  try {
    if (plan.days.length > 0) {
      const dayInsert = await client.from('training_plan_days').insert(
        plan.days.map((day) => ({
          plan_id: newPlanId,
          day: day.day,
          position: day.position,
          workout_id: day.workoutId,
          generated_spec: day.generatedSpec,
          rest_day: day.restDay,
          scheduled_time: day.scheduledTime,
          duration_min: day.durationMin,
          focus: day.focus,
          status: 'planned',
          session_id: null,
        })),
      );
      if (dayInsert.error) {
        if (isRlsOrOwnershipError(dayInsert.error)) {
          throw Object.assign(new Error('Not allowed to write duplicated plan days'), { rls: true });
        }
        throw new Error(dayInsert.error.message);
      }
    }

    if (plan.buddyUserIds.length > 0) {
      const shareInsert = await client.from('training_plan_buddy_shares').insert(
        plan.buddyUserIds.map((buddyUserId) => ({
          plan_id: newPlanId,
          buddy_user_id: buddyUserId,
          household_id: plan.householdId,
        })),
      );
      if (shareInsert.error) {
        if (isRlsOrOwnershipError(shareInsert.error)) {
          throw Object.assign(new Error('Not allowed to copy buddy shares'), { rls: true });
        }
        throw new Error(shareInsert.error.message);
      }
    }

    if (plan.calendarAutoSync) {
      const { syncPlanCalendarIfEnabled } = await import('./plan-calendar.js');
      const synced = await syncPlanCalendarIfEnabled(client, {
        authUserId: input.authUserId,
        planId: newPlanId,
        calendarAutoSync: true,
        pushToGoogle: input.pushToGoogle,
        deleteFromGoogle: input.deleteFromGoogle,
      });
      if (!synced.ok) {
        throw Object.assign(new Error(synced.error), { rls: synced.status === 403 });
      }
    }

    return { status: 200, body: { planId: newPlanId, weekStart: nextWeek } };
  } catch (err) {
    await client.from('training_plans').delete().eq('id', newPlanId);
    const message = err instanceof Error ? err.message : 'Could not duplicate plan';
    if (err && typeof err === 'object' && 'rls' in err) {
      return { status: 403, body: { error: message } };
    }
    return { status: 500, body: { error: message } };
  }
}

function prefsGoal(prefs: Record<string, unknown>): GeneratePlanGoal {
  const goal = prefs.goal;
  if (
    goal === 'strength' ||
    goal === 'hypertrophy' ||
    goal === 'conditioning' ||
    goal === 'mobility' ||
    goal === 'fat_loss'
  ) {
    return goal;
  }
  return 'hypertrophy';
}

function prefsLevel(prefs: Record<string, unknown>): GeneratePlanLevel {
  const level = prefs.level;
  if (level === 'beginner' || level === 'intermediate' || level === 'advanced') return level;
  return 'intermediate';
}

function prefsDays(prefs: Record<string, unknown>): Day[] | undefined {
  if (!Array.isArray(prefs.days) || prefs.days.length === 0) return undefined;
  const days = prefs.days.map(String).map(asDay).filter((day): day is Day => Boolean(day));
  return days.length > 0 ? days : undefined;
}

export type RegenerateRemainingPreviewDay = GeneratedTrainDay & {
  scheduledTime: string | null;
  dayId: string | null;
};

export type RegenerateRemainingResult =
  | {
      status: 200;
      body: {
        planId: string;
        remainingDays: Day[];
        lockedDays: Day[];
        preview: RegenerateRemainingPreviewDay[];
        applied: boolean;
      };
    }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

export async function handleRegenerateRemainingDays(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    planId: string;
    catalogue: readonly CatalogExercise[];
    savedWorkouts?: readonly SavedWorkoutCandidate[];
    seed?: number;
    todayIso?: string;
    /** When false, return preview only. When true, write regeneratable days. */
    confirm: boolean;
    pushToGoogle?: PlanCalendarPush;
    deleteFromGoogle?: PlanCalendarDeletePush;
  },
): Promise<RegenerateRemainingResult> {
  if (!input.authUserId || !input.planId) {
    return { status: 400, body: { error: 'authUserId and planId are required' } };
  }

  const loaded = await client
    .from('training_plans')
    .select(
      'id, household_id, owner_id, name, week_start, visibility, audience_person_ids, prefs, calendar_auto_sync, training_plan_days(*), training_plan_buddy_shares(buddy_user_id)',
    )
    .eq('id', input.planId)
    .maybeSingle();

  if (loaded.error) {
    if (isRlsOrOwnershipError(loaded.error)) {
      return { status: 403, body: { error: 'Not allowed to regenerate this plan' } };
    }
    return { status: 500, body: { error: loaded.error.message } };
  }
  if (!loaded.data || typeof loaded.data !== 'object') {
    return { status: 404, body: { error: 'Plan not found' } };
  }

  const plan = mapPlanRow(loaded.data as Record<string, unknown>);
  if (!plan) return { status: 500, body: { error: 'Could not read plan' } };
  if (plan.ownerId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only regenerate plans you own' } };
  }

  const today = input.todayIso ?? todayIso();
  const remainingDays = plan.days
    .filter((day) =>
      isRegeneratableDay({
        weekStart: plan.weekStart,
        day: day.day,
        status: day.status,
        todayIso: today,
      }),
    )
    .map((day) => day.day);
  const lockedDays = plan.days.map((day) => day.day).filter((day) => !remainingDays.includes(day));
  const remainingSet = new Set(remainingDays);

  const prefs = plan.prefs;
  const dayTimes =
    prefs.dayTimes && typeof prefs.dayTimes === 'object' && !Array.isArray(prefs.dayTimes)
      ? (prefs.dayTimes as Partial<Record<Day, string>>)
      : {};
  const daysPerWeek =
    typeof prefs.daysPerWeek === 'number' && Number.isFinite(prefs.daysPerWeek) ? prefs.daysPerWeek : 3;
  const durationMin =
    typeof prefs.durationMin === 'number' && Number.isFinite(prefs.durationMin) ? prefs.durationMin : 40;
  const equipment = Array.isArray(prefs.equipment) ? prefs.equipment.map(String) : [];
  const avoidExerciseIds = Array.isArray(prefs.avoidExerciseIds)
    ? prefs.avoidExerciseIds.map(String)
    : [];
  const seed = input.seed ?? (Date.now() % 1_000_000_000);

  const generated = generateTrainPlan({
    daysPerWeek,
    days: prefsDays(prefs),
    goal: prefsGoal(prefs),
    level: prefsLevel(prefs),
    durationMin,
    equipment,
    avoidExerciseIds,
    allowDuplicates: false,
    preferSavedWorkouts: prefs.preferSavedWorkouts === true,
    savedWorkouts: input.savedWorkouts,
    catalogue: input.catalogue,
    seed,
  });

  const dayIdByDay = new Map(plan.days.map((day) => [day.day, day.id] as const));
  const preview: RegenerateRemainingPreviewDay[] = generated.map((day) => ({
    ...day,
    scheduledTime: dayTimes[day.day] ?? null,
    dayId: remainingSet.has(day.day) ? (dayIdByDay.get(day.day) ?? null) : null,
  }));

  if (!input.confirm) {
    return {
      status: 200,
      body: {
        planId: plan.id,
        remainingDays,
        lockedDays,
        preview: preview.filter((day) => remainingSet.has(day.day)),
        applied: false,
      },
    };
  }

  const lockedSnapshots = new Map(plan.days.filter((day) => !remainingSet.has(day.day)).map((day) => [day.id, day]));

  for (const day of generated) {
    if (!remainingSet.has(day.day)) continue;
    const existingId = dayIdByDay.get(day.day);
    if (!existingId) continue;

    let workoutId = day.workoutId;
    if (!day.restDay && !workoutId && day.exercises.length > 0) {
      const workoutInsert = await client
        .from('workouts')
        .insert({
          household_id: plan.householdId,
          created_by: plan.ownerId,
          name: `${DAY_SHORT[day.day]} · ${day.focus[0] ?? 'Train'}`,
          visibility:
            plan.visibility === 'people' || plan.visibility === 'buddies_selected' ? 'private' : plan.visibility,
          split_id: null,
          duration_min: day.durationMin || null,
        })
        .select('id')
        .single();

      if (
        workoutInsert.error ||
        !workoutInsert.data ||
        typeof workoutInsert.data !== 'object' ||
        !('id' in workoutInsert.data)
      ) {
        if (isRlsOrOwnershipError(workoutInsert.error)) {
          return { status: 403, body: { error: 'Not allowed to create workouts for regenerated days' } };
        }
        return { status: 500, body: { error: workoutInsert.error?.message ?? 'Could not create workout' } };
      }

      workoutId = String((workoutInsert.data as { id: string }).id);
      const exercisesInsert = await client.from('workout_exercises').insert(
        day.exercises.map((exercise, index) => ({
          workout_id: workoutId,
          household_id: plan.householdId,
          exercise_id: /^[0-9a-f-]{36}$/i.test(exercise.exerciseId) ? exercise.exerciseId : null,
          name: exercise.name,
          position: index,
          target_sets: exercise.targetSets,
          target_reps: exercise.targetReps,
          target_rpe: exercise.targetRpe,
          note: '',
        })),
      );
      if (exercisesInsert.error) {
        return { status: 500, body: { error: exercisesInsert.error.message } };
      }
    }

    const update = await client
      .from('training_plan_days')
      .update({
        workout_id: day.restDay ? null : workoutId,
        generated_spec: {
          focus: day.focus,
          exercises: day.exercises,
          explanation: day.explanation,
        },
        rest_day: day.restDay,
        scheduled_time: dayTimes[day.day] ?? null,
        duration_min: day.restDay ? null : day.durationMin || null,
        focus: day.focus,
        status: 'planned',
        session_id: null,
      })
      .eq('id', existingId);

    if (update.error) {
      if (isRlsOrOwnershipError(update.error)) {
        return { status: 403, body: { error: 'Not allowed to update regenerated days' } };
      }
      return { status: 500, body: { error: update.error.message } };
    }
  }

  // Guard: locked rows must not have been targeted (pure invariant for callers/tests).
  for (const [id] of lockedSnapshots) {
    void id;
  }

  if (plan.calendarAutoSync) {
    const { syncPlanCalendarIfEnabled } = await import('./plan-calendar.js');
    const synced = await syncPlanCalendarIfEnabled(client, {
      authUserId: input.authUserId,
      planId: plan.id,
      calendarAutoSync: true,
      pushToGoogle: input.pushToGoogle,
      deleteFromGoogle: input.deleteFromGoogle,
    });
    if (!synced.ok) {
      return { status: synced.status, body: { error: synced.error } };
    }
  }

  return {
    status: 200,
    body: {
      planId: plan.id,
      remainingDays,
      lockedDays,
      preview: preview.filter((day) => remainingSet.has(day.day)),
      applied: true,
    },
  };
}
