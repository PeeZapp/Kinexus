import type { Day } from '../meals/types';
import type { GeneratedTrainDay } from './generate-plan';
import type { TrainVisibility } from './visibility';

export type ApplyTrainingPlanDay = GeneratedTrainDay & {
  scheduledTime?: string | null;
  /** Draft display name; used when creating a plan-only workout on apply. */
  workoutName?: string | null;
};

export type ApplyTrainingPlanInput = {
  householdId: string;
  ownerId: string;
  authUserId: string;
  name?: string;
  weekStart: string;
  visibility: TrainVisibility;
  audiencePersonIds?: string[];
  buddyUserIds?: string[];
  prefs?: Record<string, unknown>;
  days: readonly ApplyTrainingPlanDay[];
  /** When set (e.g. from create_training_plan RPC), skip the training_plans insert. */
  planId?: string;
};

export type ApplyTrainingPlanResult =
  | { status: 200; body: { planId: string; workoutIds: Record<string, string> } }
  | { status: 400 | 403 | 500; body: { error: string } };

type QueryError = { message: string; code?: string } | null;

type QueryResult<T> = { data: T; error: QueryError };

export type ApplyDbClient = {
  from: (table: string) => {
    insert: (rows: unknown) => {
      select: (cols: string) => {
        single: () => PromiseLike<QueryResult<unknown>>;
      };
      then?: PromiseLike<QueryResult<unknown>>['then'];
    } & PromiseLike<QueryResult<unknown>>;
    upsert: (rows: unknown) => {
      select: (cols: string) => {
        single: () => PromiseLike<QueryResult<unknown>>;
      };
    } & PromiseLike<QueryResult<unknown>>;
    delete: () => {
      eq: (col: string, val: unknown) => PromiseLike<QueryResult<unknown>>;
    };
  };
};

const DAY_SHORT: Record<Day, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
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

function workoutNameFor(day: ApplyTrainingPlanDay): string {
  const named = day.workoutName?.trim();
  if (named) return named;
  const focus = day.focus[0] ?? 'Train';
  return `${DAY_SHORT[day.day]} · ${focus}`;
}

/**
 * Persist a generated weekly training plan using the caller's authenticated client.
 * No service-role bypass — RLS must allow owner insert.
 */
export async function handleApplyTrainingPlan(
  client: ApplyDbClient,
  input: ApplyTrainingPlanInput,
): Promise<ApplyTrainingPlanResult> {
  if (!input.householdId || !input.ownerId || !input.authUserId || !input.weekStart) {
    return { status: 400, body: { error: 'householdId, ownerId, authUserId, and weekStart are required' } };
  }
  if (input.ownerId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only create training plans you own' } };
  }
  if (!input.days.length) {
    return { status: 400, body: { error: 'Plan days are required' } };
  }

  const visibility = input.visibility;
  const audiencePersonIds = visibility === 'people' ? (input.audiencePersonIds ?? []) : [];
  const buddyUserIds =
    visibility === 'buddies' || visibility === 'buddies_selected'
      ? (input.buddyUserIds ?? []).filter((id) => id !== input.ownerId)
      : [];

  let planId = input.planId?.trim() || '';
  if (!planId) {
    const planInsert = await client
      .from('training_plans')
      .insert({
        household_id: input.householdId,
        owner_id: input.ownerId,
        name: (input.name ?? 'Training plan').trim() || 'Training plan',
        week_start: input.weekStart,
        visibility,
        audience_person_ids: audiencePersonIds,
        prefs: input.prefs ?? {},
      })
      .select('id')
      .single();

    if (planInsert.error || !planInsert.data || typeof planInsert.data !== 'object' || !('id' in planInsert.data)) {
      const detail = planInsert.error?.message?.trim();
      if (isRlsOrOwnershipError(planInsert.error)) {
        return {
          status: 403,
          body: {
            error: detail
              ? `Not allowed to create this training plan (${detail})`
              : 'Not allowed to create this training plan',
          },
        };
      }
      // Insert can succeed under RLS while SELECT on the new row fails — treat as permission.
      if (!planInsert.error && !planInsert.data) {
        return { status: 403, body: { error: 'Not allowed to create this training plan' } };
      }
      if (detail && /0 rows|no rows|multiple \(or no\) rows/i.test(detail)) {
        return { status: 403, body: { error: 'Not allowed to create this training plan' } };
      }
      return { status: 500, body: { error: detail ?? 'Could not create training plan' } };
    }

    planId = String((planInsert.data as { id: string }).id);
  }
  const workoutIds: Record<string, string> = {};
  const createdWorkoutIds: string[] = [];

  try {
    for (let position = 0; position < input.days.length; position += 1) {
      const day = input.days[position]!;
      let workoutId = day.workoutId;

      if (!day.restDay && !workoutId && day.exercises.length > 0) {
        const workoutInsert = await client
          .from('workouts')
          .insert({
            household_id: input.householdId,
            created_by: input.ownerId,
            name: workoutNameFor(day),
            visibility: visibility === 'people' || visibility === 'buddies_selected' ? 'private' : visibility,
            split_id: null,
            duration_min: day.durationMin || null,
            plan_only: true,
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
            exercise_id: /^[0-9a-f-]{36}$/i.test(exercise.exerciseId) ? exercise.exerciseId : null,
            name: exercise.name,
            position: index,
            target_sets: exercise.targetSets,
            target_reps: exercise.targetReps,
            target_rpe: exercise.targetRpe,
            note: '',
          })),
        );
        if (exercisesInsert.error) throw new Error(exercisesInsert.error.message);
      } else if (workoutId) {
        workoutIds[day.day] = workoutId;
      }

      const dayInsert = await client.from('training_plan_days').insert({
        plan_id: planId,
        day: day.day,
        position,
        workout_id: day.restDay ? null : workoutId,
        generated_spec: {
          focus: day.focus,
          exercises: day.exercises,
          explanation: day.explanation,
        },
        rest_day: day.restDay,
        scheduled_time: day.scheduledTime ?? null,
        duration_min: day.restDay ? null : day.durationMin || null,
        focus: day.focus,
        status: 'planned',
      });

      if (dayInsert.error) {
        if (isRlsOrOwnershipError(dayInsert.error)) {
          throw Object.assign(new Error('Not allowed to write plan days'), { rls: true });
        }
        throw new Error(dayInsert.error.message);
      }
    }

    if (buddyUserIds.length > 0) {
      const shareInsert = await client.from('training_plan_buddy_shares').insert(
        buddyUserIds.map((buddyUserId) => ({
          plan_id: planId,
          buddy_user_id: buddyUserId,
          household_id: input.householdId,
        })),
      );
      if (shareInsert.error) {
        if (isRlsOrOwnershipError(shareInsert.error)) {
          throw Object.assign(new Error('Not allowed to share this plan with buddies'), { rls: true });
        }
        throw new Error(shareInsert.error.message);
      }
    }

    return { status: 200, body: { planId, workoutIds } };
  } catch (err) {
    await client.from('training_plans').delete().eq('id', planId);
    for (const id of createdWorkoutIds) {
      await client.from('workouts').delete().eq('id', id);
    }
    const message = err instanceof Error ? err.message : 'Could not apply training plan';
    if (err && typeof err === 'object' && 'rls' in err) {
      return { status: 403, body: { error: message } };
    }
    return { status: 500, body: { error: message } };
  }
}

export type SaveGeneratePrefsInput = {
  userId: string;
  authUserId: string;
  prefs: Record<string, unknown>;
};

export type SaveGeneratePrefsResult =
  | { status: 200; body: { ok: true } }
  | { status: 400 | 403 | 500; body: { error: string } };

export async function handleSaveGeneratePrefs(
  client: ApplyDbClient,
  input: SaveGeneratePrefsInput,
): Promise<SaveGeneratePrefsResult> {
  if (!input.userId || !input.authUserId) {
    return { status: 400, body: { error: 'userId and authUserId are required' } };
  }
  if (input.userId !== input.authUserId) {
    return { status: 403, body: { error: 'You can only save your own generate prefs' } };
  }

  const result = await client
    .from('user_train_prefs')
    .upsert({ user_id: input.userId, generate_prefs: input.prefs })
    .select('user_id')
    .single();

  if (result.error) {
    if (isRlsOrOwnershipError(result.error)) {
      return { status: 403, body: { error: 'Not allowed to save generate prefs' } };
    }
    return { status: 500, body: { error: result.error.message } };
  }
  return { status: 200, body: { ok: true } };
}
