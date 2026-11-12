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
import { trackingCompatTargets, trackingTypeFrom, targetUnitFrom, unitToTracking } from './tracking';
import type { CatalogExercise } from './types';
import { isTrainVisibility, type TrainVisibility } from './visibility';

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
  shareToken: string | null;
  isShared: boolean;
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
    msg.includes('violates row-level security')
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
    shareToken: typeof row.share_token === 'string' ? row.share_token : null,
    isShared: Boolean(row.is_shared),
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

  // Week-scoped only — RLS returns owned + household/family + buddy-shared plans.
  const result = await client
    .from('training_plans')
    .select(
      'id, household_id, owner_id, name, week_start, visibility, audience_person_ids, prefs, calendar_auto_sync, share_token, is_shared, training_plan_days(*), training_plan_buddy_shares(buddy_user_id)',
    )
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

export type UpdateTrainingPlanVisibilityResult =
  | { status: 200; body: { id: string; visibility: TrainVisibility; buddyUserIds: string[] } }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

export async function handleUpdateTrainingPlanVisibility(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    planId: string;
    visibility: TrainVisibility;
    audiencePersonIds?: string[];
    buddyUserIds?: string[];
  },
): Promise<UpdateTrainingPlanVisibilityResult> {
  if (!input.authUserId || !input.planId) {
    return { status: 400, body: { error: 'authUserId and planId are required' } };
  }
  if (!isTrainVisibility(input.visibility)) {
    return { status: 400, body: { error: 'Invalid visibility' } };
  }

  const loaded = await client
    .from('training_plans')
    .select('id, household_id, owner_id, visibility')
    .eq('id', input.planId)
    .maybeSingle();

  if (loaded.error) {
    if (isRlsOrOwnershipError(loaded.error)) {
      return { status: 403, body: { error: 'Not allowed to update this plan' } };
    }
    return { status: 500, body: { error: loaded.error.message } };
  }
  if (!loaded.data || typeof loaded.data !== 'object' || !('id' in loaded.data)) {
    return { status: 404, body: { error: 'Plan not found' } };
  }

  const plan = loaded.data as { id: string; household_id: string; owner_id: string };
  if (plan.owner_id !== input.authUserId) {
    return { status: 403, body: { error: 'You can only change visibility on plans you own' } };
  }

  const audiencePersonIds =
    input.visibility === 'people' ? [...new Set(input.audiencePersonIds ?? [])] : [];
  const buddyUserIds =
    input.visibility === 'buddies_selected'
      ? [...new Set((input.buddyUserIds ?? []).filter((id) => id !== input.authUserId))]
      : [];

  const updated = await client
    .from('training_plans')
    .update({
      visibility: input.visibility,
      audience_person_ids: audiencePersonIds,
    })
    .eq('id', input.planId)
    .select('id, visibility')
    .maybeSingle();

  if (updated.error) {
    if (isRlsOrOwnershipError(updated.error)) {
      return { status: 403, body: { error: 'Not allowed to set this visibility' } };
    }
    return { status: 500, body: { error: updated.error.message } };
  }
  if (!updated.data || typeof updated.data !== 'object') {
    return { status: 404, body: { error: 'Plan not found' } };
  }

  const clearShares = await client.from('training_plan_buddy_shares').delete().eq('plan_id', input.planId);
  if (clearShares.error) {
    if (isRlsOrOwnershipError(clearShares.error)) {
      return { status: 403, body: { error: 'Not allowed to update buddy shares' } };
    }
    return { status: 500, body: { error: clearShares.error.message } };
  }

  if (buddyUserIds.length > 0) {
    const shareInsert = await client.from('training_plan_buddy_shares').insert(
      buddyUserIds.map((buddyUserId) => ({
        plan_id: input.planId,
        buddy_user_id: buddyUserId,
        household_id: plan.household_id,
      })),
    );
    if (shareInsert.error) {
      if (isRlsOrOwnershipError(shareInsert.error)) {
        return { status: 403, body: { error: 'Not allowed to share with those buddies' } };
      }
      return { status: 500, body: { error: shareInsert.error.message } };
    }
  }

  return {
    status: 200,
    body: {
      id: input.planId,
      visibility: input.visibility,
      buddyUserIds,
    },
  };
}

export type SharedTrainingPlanCopyDay = {
  day: Day;
  restDay: boolean;
  focus: string[];
  durationMin: number | null;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    tracking?: string | null;
    targetUnit?: string | null;
    targetDurationSec?: number | null;
    targetDistanceKm?: number | null;
    effort: string | null;
    rpe: number | null;
    note: string;
    supersetId: string | null;
  }>;
};

export type CopySharedTrainingPlanResult =
  | { status: 200; body: { planId: string; workoutIds: Record<string, string> } }
  | { status: 400 | 403 | 500; body: { error: string } };

/** Clone a public shared plan payload into the caller's household as a private owned plan. */
export async function handleCopySharedTrainingPlan(
  client: PlanWeekDbClient,
  input: {
    householdId: string;
    ownerId: string;
    authUserId: string;
    name: string;
    weekStart: string;
    days: readonly SharedTrainingPlanCopyDay[];
  },
): Promise<CopySharedTrainingPlanResult> {
  if (!input.householdId || !input.ownerId || !input.authUserId || !input.weekStart) {
    return { status: 400, body: { error: 'householdId, ownerId, authUserId, and weekStart are required' } };
  }
  if (input.ownerId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only copy plans into your own ownership' } };
  }
  if (!input.days.length) {
    return { status: 400, body: { error: 'Plan days are required' } };
  }

  const planInsert = await client
    .from('training_plans')
    .insert({
      household_id: input.householdId,
      owner_id: input.ownerId,
      name: (input.name.trim() || 'Training plan').slice(0, 120),
      week_start: input.weekStart,
      visibility: 'private',
      audience_person_ids: [],
      prefs: {},
      calendar_auto_sync: false,
      is_shared: false,
      share_token: null,
    })
    .select('id')
    .single();

  if (planInsert.error || !planInsert.data || typeof planInsert.data !== 'object' || !('id' in planInsert.data)) {
    if (isRlsOrOwnershipError(planInsert.error)) {
      return { status: 403, body: { error: 'Not allowed to create this training plan' } };
    }
    return { status: 500, body: { error: planInsert.error?.message ?? 'Could not create training plan' } };
  }

  const planId = String((planInsert.data as { id: string }).id);
  const workoutIds: Record<string, string> = {};
  const createdWorkoutIds: string[] = [];

  try {
    for (let position = 0; position < input.days.length; position += 1) {
      const day = input.days[position]!;
      let workoutId: string | null = null;

      if (!day.restDay && day.exercises.length > 0) {
        const workoutInsert = await client
          .from('workouts')
          .insert({
            household_id: input.householdId,
            created_by: input.ownerId,
            name: `${DAY_SHORT[day.day]} · ${day.focus[0] ?? 'Train'}`,
            visibility: 'private',
            split_id: null,
            duration_min: day.durationMin,
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
            throw Object.assign(new Error('Not allowed to create workouts for this plan'), { rls: true });
          }
          throw new Error(workoutInsert.error?.message ?? 'Could not create workout');
        }

        workoutId = String((workoutInsert.data as { id: string }).id);
        createdWorkoutIds.push(workoutId);
        workoutIds[day.day] = workoutId;

        const exercisesInsert = await client.from('workout_exercises').insert(
          day.exercises.map((exercise, index) => ({
            workout_id: workoutId,
            household_id: input.householdId,
            exercise_id: null,
            name: exercise.name,
            position: index,
            tracking: exercise.tracking ?? 'reps',
            target_unit: exercise.targetUnit ?? 'reps',
            target_sets: exercise.sets,
            target_reps: exercise.reps,
            target_duration_sec: exercise.targetDurationSec ?? null,
            target_distance_km: exercise.targetDistanceKm ?? null,
            target_effort: exercise.effort,
            target_rpe: exercise.rpe,
            note: exercise.note,
            superset_id: exercise.supersetId,
          })),
        );
        if (exercisesInsert.error) throw new Error(exercisesInsert.error.message);
      }

      const dayInsert = await client.from('training_plan_days').insert({
        plan_id: planId,
        day: day.day,
        position,
        workout_id: day.restDay ? null : workoutId,
        generated_spec: { focus: day.focus, exercises: day.exercises },
        rest_day: day.restDay,
        scheduled_time: null,
        duration_min: day.restDay ? null : day.durationMin,
        focus: day.focus,
        status: 'planned',
        session_id: null,
      });
      if (dayInsert.error) {
        if (isRlsOrOwnershipError(dayInsert.error)) {
          throw Object.assign(new Error('Not allowed to write plan days'), { rls: true });
        }
        throw new Error(dayInsert.error.message);
      }
    }

    return { status: 200, body: { planId, workoutIds } };
  } catch (err) {
    await client.from('training_plans').delete().eq('id', planId);
    for (const id of createdWorkoutIds) {
      await client.from('workouts').delete().eq('id', id);
    }
    const message = err instanceof Error ? err.message : 'Could not copy training plan';
    if (err && typeof err === 'object' && 'rls' in err) {
      return { status: 403, body: { error: message } };
    }
    return { status: 500, body: { error: message } };
  }
}

export type DeleteTrainingPlanResult =
  | { status: 200; body: { id: string } }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

/** Owner-only delete of a training plan (days cascade). */
export async function handleDeleteTrainingPlan(
  client: PlanWeekDbClient,
  input: { authUserId: string; planId: string },
): Promise<DeleteTrainingPlanResult> {
  if (!input.authUserId || !input.planId) {
    return { status: 400, body: { error: 'authUserId and planId are required' } };
  }

  const loaded = await client
    .from('training_plans')
    .select('id, owner_id')
    .eq('id', input.planId)
    .maybeSingle();

  if (loaded.error) {
    if (isRlsOrOwnershipError(loaded.error)) {
      return { status: 403, body: { error: 'Not allowed to delete this plan' } };
    }
    return { status: 500, body: { error: loaded.error.message } };
  }
  if (!loaded.data || typeof loaded.data !== 'object' || !('id' in loaded.data)) {
    return { status: 404, body: { error: 'Plan not found' } };
  }

  const plan = loaded.data as { id: string; owner_id: string };
  if (plan.owner_id !== input.authUserId) {
    return { status: 403, body: { error: 'You can only delete plans you own' } };
  }

  const deleted = await client.from('training_plans').delete().eq('id', input.planId);
  if (deleted.error) {
    if (isRlsOrOwnershipError(deleted.error)) {
      return { status: 403, body: { error: 'Not allowed to delete this plan' } };
    }
    return { status: 500, body: { error: deleted.error.message } };
  }

  return { status: 200, body: { id: plan.id } };
}

export type AddTrainingPlanDayResult =
  | {
      status: 200;
      body: { id: string; day: Day; position: number; focus: string[]; durationMin: number | null };
    }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

/** Add another session slot on an existing plan day (same weekday, next position). */
export async function handleAddTrainingPlanDay(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    planId: string;
    day: Day;
    focus?: string[];
    durationMin?: number | null;
  },
): Promise<AddTrainingPlanDayResult> {
  if (!input.authUserId || !input.planId || !input.day) {
    return { status: 400, body: { error: 'authUserId, planId, and day are required' } };
  }
  if (!DAYS.includes(input.day)) {
    return { status: 400, body: { error: 'Invalid day' } };
  }

  const loaded = await client
    .from('training_plans')
    .select('id, owner_id, prefs')
    .eq('id', input.planId)
    .maybeSingle();

  if (loaded.error) {
    if (isRlsOrOwnershipError(loaded.error)) {
      return { status: 403, body: { error: 'Not allowed to update this plan' } };
    }
    return { status: 500, body: { error: loaded.error.message } };
  }
  if (!loaded.data || typeof loaded.data !== 'object' || !('id' in loaded.data)) {
    return { status: 404, body: { error: 'Plan not found' } };
  }

  const plan = loaded.data as { id: string; owner_id: string; prefs?: Record<string, unknown> };
  if (plan.owner_id !== input.authUserId) {
    return { status: 403, body: { error: 'You can only edit plans you own' } };
  }

  const existing = await client
    .from('training_plan_days')
    .select('id, position, rest_day')
    .eq('plan_id', input.planId)
    .eq('day', input.day);

  if (existing.error) {
    return { status: 500, body: { error: existing.error.message } };
  }

  const rows = (existing.data ?? []) as { id: string; position: number; rest_day: boolean }[];
  const loneRest = rows.length === 1 && rows[0]?.rest_day;
  if (loneRest && rows[0]) {
    const focus = (input.focus?.length ? input.focus : ['Full Body']).map((item) => item.trim()).filter(Boolean);
    const prefsDuration =
      typeof plan.prefs?.durationMin === 'number' && Number.isFinite(plan.prefs.durationMin)
        ? plan.prefs.durationMin
        : 40;
    const durationMin = input.durationMin ?? prefsDuration;
    const updated = await client
      .from('training_plan_days')
      .update({
        rest_day: false,
        focus,
        duration_min: durationMin,
        workout_id: null,
        status: 'planned',
      })
      .eq('id', rows[0].id)
      .select('id, position, focus, duration_min')
      .maybeSingle();
    if (updated.error || !updated.data || typeof updated.data !== 'object' || !('id' in updated.data)) {
      if (isRlsOrOwnershipError(updated.error)) {
        return { status: 403, body: { error: 'Not allowed to update this plan day' } };
      }
      return { status: 500, body: { error: updated.error?.message ?? 'Could not update plan day' } };
    }
    const row = updated.data as {
      id: string;
      position: number;
      focus: string[];
      duration_min: number | null;
    };
    return {
      status: 200,
      body: {
        id: row.id,
        day: input.day,
        position: row.position,
        focus: Array.isArray(row.focus) ? row.focus : focus,
        durationMin: row.duration_min,
      },
    };
  }

  const nextPosition =
    rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.position)) + 1;
  const focus = (input.focus?.length ? input.focus : ['Full Body']).map((item) => item.trim()).filter(Boolean);
  const prefsDuration =
    typeof plan.prefs?.durationMin === 'number' && Number.isFinite(plan.prefs.durationMin)
      ? plan.prefs.durationMin
      : 40;
  const durationMin = input.durationMin ?? prefsDuration;

  const inserted = await client
    .from('training_plan_days')
    .insert({
      plan_id: input.planId,
      day: input.day,
      position: nextPosition,
      workout_id: null,
      rest_day: false,
      focus,
      duration_min: durationMin,
      status: 'planned',
    })
    .select('id, position, focus, duration_min')
    .maybeSingle();

  if (inserted.error || !inserted.data || typeof inserted.data !== 'object' || !('id' in inserted.data)) {
    if (isRlsOrOwnershipError(inserted.error)) {
      return { status: 403, body: { error: 'Not allowed to add a plan day' } };
    }
    return { status: 500, body: { error: inserted.error?.message ?? 'Could not add plan day' } };
  }

  const row = inserted.data as {
    id: string;
    position: number;
    focus: string[];
    duration_min: number | null;
  };
  return {
    status: 200,
    body: {
      id: row.id,
      day: input.day,
      position: row.position,
      focus: Array.isArray(row.focus) ? row.focus : focus,
      durationMin: row.duration_min,
    },
  };
}

export type AttachWorkoutToPlanDayResult =
  | { status: 200; body: { id: string; workoutId: string | null } }
  | { status: 400 | 403 | 404 | 500; body: { error: string } };

/** Attach or clear a workout on an intent plan day. Null workout keeps the day as intent-only. */
export async function handleAttachWorkoutToPlanDay(
  client: PlanWeekDbClient,
  input: {
    authUserId: string;
    dayId: string;
    workoutId: string | null;
  },
): Promise<AttachWorkoutToPlanDayResult> {
  if (!input.authUserId || !input.dayId) {
    return { status: 400, body: { error: 'authUserId and dayId are required' } };
  }

  const result = await client
    .from('training_plan_days')
    .update({
      workout_id: input.workoutId,
      ...(input.workoutId ? { rest_day: false } : {}),
    })
    .eq('id', input.dayId)
    .select('id, workout_id')
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

  const row = result.data as { id: string; workout_id: string | null };
  return {
    status: 200,
    body: { id: row.id, workoutId: typeof row.workout_id === 'string' ? row.workout_id : null },
  };
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
      'id, household_id, owner_id, name, week_start, visibility, audience_person_ids, prefs, calendar_auto_sync, share_token, is_shared, training_plan_days(*), training_plan_buddy_shares(buddy_user_id)',
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
      const { syncPlanCalendarIfEnabled } = await import('./plan-calendar');
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
      'id, household_id, owner_id, name, week_start, visibility, audience_person_ids, prefs, calendar_auto_sync, share_token, is_shared, training_plan_days(*), training_plan_buddy_shares(buddy_user_id)',
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
    splitStyle: typeof prefs.splitStyle === 'string' ? prefs.splitStyle : null,
    focusByDay:
      prefs.customFocusByDay && typeof prefs.customFocusByDay === 'object' && !Array.isArray(prefs.customFocusByDay)
        ? (prefs.customFocusByDay as Partial<Record<Day, string>>)
        : undefined,
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
        day.exercises.map((exercise, index) => {
          const tracking = trackingTypeFrom(
            exercise.tracking ?? unitToTracking(targetUnitFrom(exercise.targetUnit)),
          );
          const compat = trackingCompatTargets({
            tracking,
            targetUnit: targetUnitFrom(exercise.targetUnit, tracking, {
              targetDistanceKm: exercise.targetDistanceKm ?? null,
            }),
            targetSets: exercise.targetSets,
            targetReps: exercise.targetReps,
            targetDurationSec: exercise.targetDurationSec ?? null,
            targetDistanceKm: exercise.targetDistanceKm ?? null,
          });
          return {
            workout_id: workoutId,
            household_id: plan.householdId,
            exercise_id: /^[0-9a-f-]{36}$/i.test(exercise.exerciseId) ? exercise.exerciseId : null,
            name: exercise.name,
            position: index,
            tracking: compat.tracking,
            target_unit: compat.targetUnit,
            target_sets: compat.targetSets,
            target_reps: compat.targetReps,
            target_duration_sec: compat.targetDurationSec,
            target_distance_km: compat.targetDistanceKm,
            target_rpe: exercise.targetRpe,
            note: '',
          };
        }),
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
    const { syncPlanCalendarIfEnabled } = await import('./plan-calendar');
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
