import {
  bestSessionTypeForFocuses,
  estimateWorkout,
  jointSessionAlertMessage,
  jointSessionPlanLabel,
  mondayWeekStart,
  resolveJointSessionVotes,
  trainSessionTypeById,
  workoutMatchesSessionTypes,
  type Day,
  type JointSessionInviteStatus,
  type JointSessionStatus,
} from '@kinexus/domain';
import { rpc } from '@kinexus/db';

import { fetchPublicProfilesByIds, type PublicSocialUser } from '@/src/features/stash/watchlist-social';
import {
  addTrainingPlanDay,
  applyGeneratedTrainingPlan,
  attachWorkoutToPlanDay,
  listTrainingPlansByWeek,
  updateTrainingPlanDaySchedule,
} from '@/src/features/train/api';
import { supabase } from '@/src/lib/supabase';

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export type JointSessionMember = {
  userId: string;
  householdId: string | null;
  role: 'inviter' | 'invitee';
  inviteStatus: JointSessionInviteStatus;
  pickedSessionTypeId: string | null;
  pickedWorkoutId: string | null;
  planDayId: string | null;
  profile: PublicSocialUser;
};

export type JointSessionRow = {
  id: string;
  inviterId: string;
  inviterHouseholdId: string;
  scheduledAt: string;
  offeredSessionTypeIds: string[];
  offeredWorkoutIds: string[];
  inviterSessionTypeId: string;
  inviterWorkoutId: string | null;
  status: JointSessionStatus;
  resolvedSessionTypeId: string | null;
  resolvedWorkoutId: string | null;
  needsInviterDecision: boolean;
  decisionReason: 'tie' | 'no_picks' | null;
  members: JointSessionMember[];
};

function asInviteStatus(value: string): JointSessionInviteStatus | null {
  return value === 'pending' || value === 'accepted' || value === 'declined' || value === 'cancelled'
    ? value
    : null;
}

function asSessionStatus(value: string): JointSessionStatus | null {
  return value === 'open' || value === 'resolved' || value === 'cancelled' ? value : null;
}

function dayFromIso(isoDate: string): Day {
  const date = new Date(`${isoDate}T12:00:00`);
  const map: Day[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[date.getDay()] ?? 'monday';
}

export async function createTrainJointSession(input: {
  householdId: string;
  scheduledAt: string;
  inviteeIds: string[];
  offeredSessionTypeIds: string[];
  offeredWorkoutIds: string[];
  inviterSessionTypeId: string;
  inviterWorkoutId: string | null;
}): Promise<string> {
  const { data, error } = await db().rpc(rpc.createTrainJointSession, {
    p_inviter_household_id: input.householdId,
    p_scheduled_at: input.scheduledAt,
    p_invitee_ids: input.inviteeIds,
    p_offered_session_type_ids: input.offeredSessionTypeIds,
    p_offered_workout_ids: input.offeredWorkoutIds,
    p_inviter_session_type_id: input.inviterSessionTypeId,
    p_inviter_workout_id: input.inviterWorkoutId,
  });
  if (error) throw error;
  if (!data || typeof data !== 'string') throw new Error('Could not create session');
  return data;
}

export async function loadMyJointSessions(userId: string): Promise<JointSessionRow[]> {
  const { data: memberRows, error: memberError } = await db()
    .from('train_joint_session_members')
    .select('session_id')
    .eq('user_id', userId);
  if (memberError) throw memberError;
  const sessionIds = [...new Set((memberRows ?? []).map((row) => row.session_id as string))];
  if (sessionIds.length === 0) return [];

  const { data: sessions, error: sessionError } = await db()
    .from('train_joint_sessions')
    .select(
      'id, inviter_id, inviter_household_id, scheduled_at, offered_session_type_ids, offered_workout_ids, inviter_session_type_id, inviter_workout_id, status, resolved_session_type_id, resolved_workout_id, needs_inviter_decision, decision_reason',
    )
    .in('id', sessionIds)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true });
  if (sessionError) throw sessionError;

  const { data: allMembers, error: allMembersError } = await db()
    .from('train_joint_session_members')
    .select(
      'session_id, user_id, household_id, role, invite_status, picked_session_type_id, picked_workout_id, plan_day_id',
    )
    .in('session_id', sessionIds);
  if (allMembersError) throw allMembersError;

  const profiles = await fetchPublicProfilesByIds((allMembers ?? []).map((row) => row.user_id as string));

  return (sessions ?? [])
    .map((session) => {
      const status = asSessionStatus(session.status);
      if (!status) return null;
      const members = (allMembers ?? [])
        .filter((row) => row.session_id === session.id)
        .map((row) => {
          const inviteStatus = asInviteStatus(row.invite_status);
          if (!inviteStatus) return null;
          if (row.role !== 'inviter' && row.role !== 'invitee') return null;
          return {
            userId: row.user_id as string,
            householdId: (row.household_id as string | null) ?? null,
            role: row.role as 'inviter' | 'invitee',
            inviteStatus,
            pickedSessionTypeId: (row.picked_session_type_id as string | null) ?? null,
            pickedWorkoutId: (row.picked_workout_id as string | null) ?? null,
            planDayId: (row.plan_day_id as string | null) ?? null,
            profile: profiles.get(row.user_id as string) ?? {
              id: row.user_id as string,
              globalHandle: 'Unknown',
              username: null,
              avatarUrl: null,
              isVerifiedCreator: false,
            },
          };
        })
        .filter((row): row is JointSessionMember => Boolean(row));

      return {
        id: session.id as string,
        inviterId: session.inviter_id as string,
        inviterHouseholdId: session.inviter_household_id as string,
        scheduledAt: session.scheduled_at as string,
        offeredSessionTypeIds: (session.offered_session_type_ids as string[]) ?? [],
        offeredWorkoutIds: (session.offered_workout_ids as string[]) ?? [],
        inviterSessionTypeId: session.inviter_session_type_id as string,
        inviterWorkoutId: (session.inviter_workout_id as string | null) ?? null,
        status,
        resolvedSessionTypeId: (session.resolved_session_type_id as string | null) ?? null,
        resolvedWorkoutId: (session.resolved_workout_id as string | null) ?? null,
        needsInviterDecision: Boolean(session.needs_inviter_decision),
        decisionReason:
          session.decision_reason === 'tie' || session.decision_reason === 'no_picks'
            ? session.decision_reason
            : null,
        members,
      };
    })
    .filter((row): row is JointSessionRow => Boolean(row));
}

async function applyResolution(session: JointSessionRow): Promise<JointSessionRow> {
  if (session.status !== 'open') return session;

  const accepted = session.members.filter((row) => row.inviteStatus === 'accepted');
  const hasInviteeAccept = accepted.some((row) => row.role === 'invitee');
  if (!hasInviteeAccept) return session;

  const result = resolveJointSessionVotes({
    inviterId: session.inviterId,
    inviterSessionTypeId: session.inviterSessionTypeId,
    inviterWorkoutId: session.inviterWorkoutId,
    acceptedPicks: accepted.map((row) => ({
      userId: row.userId,
      sessionTypeId: row.pickedSessionTypeId,
      workoutId: row.pickedWorkoutId,
    })),
  });

  if (result.kind === 'resolved') {
    const { error } = await db().rpc(rpc.decideTrainJointSession, {
      p_session_id: session.id,
      p_session_type_id: result.sessionTypeId,
      p_workout_id: result.workoutId,
    });
    if (error) throw error;
    return {
      ...session,
      status: 'resolved',
      resolvedSessionTypeId: result.sessionTypeId,
      resolvedWorkoutId: result.workoutId,
      needsInviterDecision: false,
      decisionReason: null,
    };
  }

  const { error } = await db().rpc(rpc.markTrainJointSessionNeedsDecision, {
    p_session_id: session.id,
    p_reason: result.kind,
  });
  if (error) throw error;
  return {
    ...session,
    needsInviterDecision: true,
    decisionReason: result.kind,
  };
}

export async function respondTrainJointSession(input: {
  sessionId: string;
  userId: string;
  accept: boolean;
  householdId: string;
  sessionTypeId?: string | null;
  workoutId?: string | null;
}): Promise<JointSessionRow | null> {
  const { error } = await db().rpc(rpc.respondTrainJointSession, {
    p_session_id: input.sessionId,
    p_accept: input.accept,
    p_household_id: input.householdId,
    p_session_type_id: input.sessionTypeId ?? null,
    p_workout_id: input.workoutId ?? null,
  });
  if (error) throw error;
  if (!input.accept) return null;

  const sessions = await loadMyJointSessions(input.userId);
  const current = sessions.find((row) => row.id === input.sessionId);
  if (!current) return null;
  const resolved = await applyResolution(current);
  await syncJointSessionPlanDays(resolved);
  return resolved;
}

export async function decideTrainJointSession(input: {
  sessionId: string;
  sessionTypeId: string;
  workoutId?: string | null;
  userId: string;
}): Promise<JointSessionRow | null> {
  const { error } = await db().rpc(rpc.decideTrainJointSession, {
    p_session_id: input.sessionId,
    p_session_type_id: input.sessionTypeId,
    p_workout_id: input.workoutId ?? null,
  });
  if (error) throw error;
  const sessions = await loadMyJointSessions(input.userId);
  const current = sessions.find((row) => row.id === input.sessionId);
  if (!current) return null;
  await syncJointSessionPlanDays(current);
  return current;
}

function scheduledParts(scheduledAt: string): { weekStart: string; day: Day; time: string; dateIso: string } {
  const when = new Date(scheduledAt);
  const weekStart = mondayWeekStart(when);
  const dateIso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
  const day = dayFromIso(dateIso);
  const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}:00`;
  return { weekStart, day, time, dateIso };
}

async function ensurePlanDayForMember(input: {
  session: JointSessionRow;
  member: JointSessionMember;
  label: string;
  workoutId: string | null;
}): Promise<void> {
  if (!input.member.householdId || input.member.inviteStatus !== 'accepted') return;
  const { weekStart, day, time } = scheduledParts(input.session.scheduledAt);

  let plans = await listTrainingPlansByWeek(input.member.householdId, weekStart, input.member.userId);
  let plan = plans.find((row) => row.ownerId === input.member.userId) ?? null;
  if (!plan) {
    await applyGeneratedTrainingPlan({
      householdId: input.member.householdId,
      userId: input.member.userId,
      weekStart,
      name: 'Training plan',
      visibility: 'private',
      days: [
        {
          day,
          restDay: false,
          focus: [input.label],
          durationMin: 45,
          exercises: [],
          workoutId: null,
          explanation: 'Joint session with buddies',
          scheduledTime: time.slice(0, 5),
        },
      ],
      replaceExisting: false,
    });
    plans = await listTrainingPlansByWeek(input.member.householdId, weekStart, input.member.userId);
    plan = plans.find((row) => row.ownerId === input.member.userId) ?? null;
  }
  if (!plan) return;

  let existing =
    plan.days.find((row) => row.day === day && !row.restDay) ?? plan.days.find((row) => row.day === day) ?? null;
  if (!existing) {
    const created = await addTrainingPlanDay({
      userId: input.member.userId,
      planId: plan.id,
      day,
      focus: [input.label],
      durationMin: 45,
    });
    existing = {
      id: created.id,
      planId: plan.id,
      day: created.day,
      position: created.position,
      workoutId: null,
      generatedSpec: null,
      restDay: false,
      scheduledTime: null,
      durationMin: created.durationMin,
      focus: created.focus,
      status: 'planned',
      sessionId: null,
    };
  }

  await updateTrainingPlanDaySchedule({
    userId: input.member.userId,
    dayId: existing.id,
    focus: [input.label],
    restDay: false,
    durationMin: existing.durationMin ?? 45,
    scheduledTime: time.slice(0, 5),
  });

  if (input.workoutId) {
    try {
      await attachWorkoutToPlanDay({
        userId: input.member.userId,
        dayId: existing.id,
        workoutId: input.workoutId,
      });
    } catch {
      // Cross-household workout attach may fail; label still lands on the plan.
    }
  }

  await db()
    .from('train_joint_session_members')
    .update({ plan_day_id: existing.id })
    .eq('session_id', input.session.id)
    .eq('user_id', input.member.userId);
}

export async function syncJointSessionPlanDays(session: JointSessionRow): Promise<void> {
  const accepted = session.members.filter((row) => row.inviteStatus === 'accepted');
  const buddyNames = accepted
    .filter((row) => row.role === 'invitee')
    .map((row) => row.profile.username || row.profile.globalHandle);

  let workoutName: string | null = null;
  if (session.resolvedWorkoutId) {
    const { data } = await db().from('workouts').select('name').eq('id', session.resolvedWorkoutId).maybeSingle();
    workoutName = data?.name ?? null;
  }

  const label = jointSessionPlanLabel({
    resolvedSessionTypeId: session.resolvedSessionTypeId,
    resolvedWorkoutName: workoutName,
    buddyNames,
  });

  for (const member of accepted) {
    await ensurePlanDayForMember({
      session,
      member,
      label,
      workoutId: session.resolvedWorkoutId,
    });
  }
}

export function jointSessionNeedsAlert(session: JointSessionRow, userId: string): string | null {
  if (session.inviterId !== userId) return null;
  if (session.status === 'cancelled') return null;
  const hasAccept = session.members.some((row) => row.role === 'invitee' && row.inviteStatus === 'accepted');
  if (!hasAccept) return null;
  if (session.status === 'resolved' && session.resolvedSessionTypeId) return null;
  if (!session.needsInviterDecision && session.status === 'resolved') return null;
  return jointSessionAlertMessage({
    missingSessionType: !session.resolvedSessionTypeId,
    missingWorkout: Boolean(session.resolvedSessionTypeId) && !session.resolvedWorkoutId,
  });
}

export type InviteWorkoutOption = {
  id: string;
  name: string;
  /** Household / library workouts first in the invite picker. */
  origin: 'yours' | 'global';
  exercises: readonly { name: string; targetSets: number; supersetId?: string | null }[];
};

function workoutFocuses(workout: InviteWorkoutOption): string[] {
  return estimateWorkout(
    workout.exercises.map((exercise) => ({
      name: exercise.name,
      targetSets: exercise.targetSets,
      category: null,
    })),
  ).focuses;
}

export function filterWorkoutsForSessionTypes<T extends InviteWorkoutOption>(
  workouts: readonly T[],
  sessionTypeIds: readonly string[],
): T[] {
  return workouts.filter((workout) => {
    // Prefer exercise names via remixCategory heuristic inside estimateWorkout
    return workoutMatchesSessionTypes(workoutFocuses(workout), sessionTypeIds);
  });
}

/** Preferred workout wins: map it onto the best matching offered session type. */
export function sessionTypeForPreferredWorkout(
  workout: InviteWorkoutOption | null | undefined,
  sessionTypeIds: readonly string[],
): string | null {
  if (!workout || sessionTypeIds.length === 0) return null;
  return bestSessionTypeForFocuses(workoutFocuses(workout), sessionTypeIds);
}

export function sessionTypeLabel(id: string): string {
  return trainSessionTypeById(id)?.label ?? id;
}
