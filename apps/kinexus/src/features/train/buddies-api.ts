import {
  buddyHubVisibility,
  defaultTrainBuddyPermissions,
  effortLevelFrom,
  isTrainBuddyEventType,
  isTrainTogetherStatus,
  normalizeBuddyUsername,
  normalizeTrainGlobalEquipment,
  targetUnitFrom,
  trackingTypeFrom,
  type TrainBuddyEventType,
  type TrainBuddyPermissions,
  type TrainBuddyStatus,
  type TrainTogetherStatus,
} from '@kinexus/domain';
import { rpc } from '@kinexus/db';

import { fetchPublicProfileByHandle, fetchPublicProfilesByIds, type PublicSocialUser } from '@/src/features/stash/watchlist-social';
import type { WorkoutDraft } from '@/src/features/train/api';
import { supabase } from '@/src/lib/supabase';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

function rpeFromDb(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export type TrainBuddyConnection = {
  id: string;
  otherUserId: string;
  status: TrainBuddyStatus;
  direction: 'incoming' | 'outgoing' | 'peer';
  createdAt: string;
  profile: PublicSocialUser;
  permissions: TrainBuddyPermissions;
};

export type TrainBuddyInvitePeek = {
  inviterId: string;
  inviterUsername: string | null;
  inviterGlobalHandle: string;
  expiresAt: string;
};

export type CreatedTrainBuddyInvite = {
  inviteId: string;
  token: string;
  url: string;
  expiresAt: string;
  qrUrl: string;
};

export function buildTrainBuddyInviteUrl(token: string): string {
  const path = `/invite/train/${encodeURIComponent(token.trim())}`;
  const webBase = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  if (webBase) return `${webBase}${path}`;
  return Linking.createURL(path);
}

export function trainBuddyQrUrl(inviteUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteUrl)}`;
}

export function parseTrainBuddyInviteToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const fromPath = trimmed.match(/\/invite\/train\/([A-Za-z0-9_-]+)/i);
  if (fromPath?.[1]) return fromPath[1];
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const inviteIdx = parts.lastIndexOf('invite');
    if (inviteIdx >= 0 && parts[inviteIdx + 1] === 'train' && parts[inviteIdx + 2]) {
      return parts[inviteIdx + 2]!;
    }
  } catch {
    // raw token
  }
  return trimmed;
}

function mapPermissions(row: {
  can_view_plan: boolean;
  can_view_workouts: boolean;
  can_copy_workouts: boolean;
  can_view_sessions: boolean;
  can_view_prs: boolean;
  can_coedit_shared: boolean;
} | null | undefined): TrainBuddyPermissions {
  if (!row) return defaultTrainBuddyPermissions();
  return {
    can_view_plan: row.can_view_plan,
    can_view_workouts: row.can_view_workouts,
    can_copy_workouts: row.can_copy_workouts,
    can_view_sessions: row.can_view_sessions,
    can_view_prs: row.can_view_prs,
    can_coedit_shared: row.can_coedit_shared,
  };
}

export async function searchTrainBuddyByUsername(username: string): Promise<PublicSocialUser | null> {
  return fetchPublicProfileByHandle(normalizeBuddyUsername(username));
}

export async function loadTrainBuddies(userId: string): Promise<TrainBuddyConnection[]> {
  const client = db();
  const { data: rows, error } = await client
    .from('train_buddies')
    .select('id, requester_id, addressee_id, status, created_at')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const list = rows ?? [];
  const otherIds = list.map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id));
  const profiles = await fetchPublicProfilesByIds(otherIds);

  const { data: permRows, error: permError } = await client
    .from('train_buddy_permissions')
    .select('*')
    .eq('owner_id', userId);
  if (permError) throw permError;
  const perms = new Map((permRows ?? []).map((row) => [row.buddy_id, mapPermissions(row)]));

  return list.map((row) => {
    const otherUserId = row.requester_id === userId ? row.addressee_id : row.requester_id;
    const direction: TrainBuddyConnection['direction'] =
      row.status === 'pending'
        ? row.requester_id === userId
          ? 'outgoing'
          : 'incoming'
        : 'peer';
    return {
      id: row.id,
      otherUserId,
      status: row.status,
      direction,
      createdAt: row.created_at,
      profile: profiles.get(otherUserId) ?? {
        id: otherUserId,
        globalHandle: 'Unknown',
        username: null,
        avatarUrl: null,
        isVerifiedCreator: false,
      },
      permissions: perms.get(otherUserId) ?? defaultTrainBuddyPermissions(),
    };
  });
}

export async function requestTrainBuddyByUsername(username: string): Promise<string> {
  const { data, error } = await db().rpc(rpc.requestTrainBuddyByUsername, {
    p_username: normalizeBuddyUsername(username),
  });
  if (error) throw error;
  if (!data) throw new Error('Request was not created');
  return data;
}

export async function respondTrainBuddyRequest(connectionId: string, accept: boolean): Promise<void> {
  const { error } = await db().rpc(rpc.respondTrainBuddyRequest, {
    p_connection_id: connectionId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function removeTrainBuddy(otherUserId: string): Promise<void> {
  const { error } = await db().rpc(rpc.removeTrainBuddy, { p_other_user_id: otherUserId });
  if (error) throw error;
}

export async function blockTrainBuddy(otherUserId: string): Promise<void> {
  const { error } = await db().rpc(rpc.blockTrainBuddy, { p_other_user_id: otherUserId });
  if (error) throw error;
}

export async function saveTrainBuddyPermissions(
  buddyId: string,
  permissions: TrainBuddyPermissions,
): Promise<void> {
  const { data: userData, error: userError } = await db().auth.getUser();
  if (userError) throw userError;
  const ownerId = userData.user?.id;
  if (!ownerId) throw new Error('Not signed in');

  const { error } = await db()
    .from('train_buddy_permissions')
    .upsert(
      {
        owner_id: ownerId,
        buddy_id: buddyId,
        ...permissions,
      },
      { onConflict: 'owner_id,buddy_id' },
    );
  if (error) throw error;
}

export async function createTrainBuddyInvite(ttlHours = 168): Promise<CreatedTrainBuddyInvite> {
  const { data, error } = await db().rpc(rpc.createTrainBuddyInvite, { p_ttl_hours: ttlHours });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Invite was not created');
  const url = buildTrainBuddyInviteUrl(row.token);
  return {
    inviteId: row.invite_id,
    token: row.token,
    url,
    expiresAt: row.expires_at,
    qrUrl: trainBuddyQrUrl(url),
  };
}

export async function peekTrainBuddyInvite(token: string): Promise<TrainBuddyInvitePeek | null> {
  const { data, error } = await db().rpc(rpc.peekTrainBuddyInvite, {
    p_token: parseTrainBuddyInviteToken(token),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    inviterId: row.inviter_id,
    inviterUsername: row.inviter_username,
    inviterGlobalHandle: row.inviter_global_handle,
    expiresAt: row.expires_at,
  };
}

export async function acceptTrainBuddyInvite(token: string): Promise<string> {
  const { data, error } = await db().rpc(rpc.acceptTrainBuddyInvite, {
    p_token: parseTrainBuddyInviteToken(token),
  });
  if (error) throw error;
  if (!data) throw new Error('Accept invite did not return a connection');
  return data;
}

export async function revokeTrainBuddyInvite(inviteId: string): Promise<void> {
  const { error } = await db().rpc(rpc.revokeTrainBuddyInvite, { p_invite_id: inviteId });
  if (error) throw error;
}

export async function loadMyTrainBuddyInvites(): Promise<
  { id: string; expiresAt: string; createdAt: string; acceptedAt: string | null; revokedAt: string | null }[]
> {
  const { data, error } = await db()
    .from('train_buddy_invites')
    .select('id, expires_at, created_at, accepted_at, revoked_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  }));
}

export type BuddyHubPlan = {
  id: string;
  name: string;
  days: { weekday: number; workoutId: string | null; label: string }[];
};

export type BuddyHubSession = {
  id: string;
  name: string;
  finishedAt: string | null;
  workoutId: string | null;
};

export type BuddyHubPr = {
  exerciseId: string;
  exerciseName: string;
  bestWeight: string;
  bestReps: string;
  updatedAt: string;
};

export type BuddyHubDetail = {
  visibility: ReturnType<typeof buddyHubVisibility>;
  theirPermissionsForMe: TrainBuddyPermissions;
  plan: BuddyHubPlan | null;
  workouts: WorkoutDraft[];
  sessions: BuddyHubSession[];
  prs: BuddyHubPr[];
};

function mapWorkoutRow(row: {
  id: string;
  name: string;
  visibility: WorkoutDraft['visibility'];
  split_id: string | null;
  duration_min: number | null;
  created_by: string | null;
  added_by?: string | null;
  share_token: string | null;
  is_shared: boolean | null;
  level?: WorkoutDraft['level'];
  goal?: WorkoutDraft['goal'];
  equipment?: string[] | null;
  source_workout_id?: string | null;
  source_creator_id?: string | null;
  workout_people?: { person_id: string }[] | null;
  workout_buddy_shares?: { buddy_user_id: string }[] | null;
  workout_exercises?: {
    id: string;
    exercise_id: string | null;
    name: string;
    position: number;
    tracking?: string | null;
    target_unit?: string | null;
    target_sets: number;
    target_reps: string;
    target_duration_sec?: number | null;
    target_distance_km?: number | null;
    target_weight: number | null;
    target_effort: string | null;
    target_rpe: number | null;
    note: string | null;
    superset_id: string | null;
  }[] | null;
}): WorkoutDraft {
  return {
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    splitId: row.split_id,
    durationMin: row.duration_min,
    createdBy: row.created_by,
    addedBy: row.added_by ?? row.created_by ?? null,
    shareToken: row.share_token,
    isShared: Boolean(row.is_shared),
    planOnly: false,
    inLibrary: true,
    groupWorkoutId: null,
    level: row.level ?? null,
    goal: row.goal ?? null,
    equipment: normalizeTrainGlobalEquipment(row.equipment),
    sourceWorkoutId: row.source_workout_id ?? null,
    sourceCreatorId: row.source_creator_id ?? null,
    personIds: (row.workout_people ?? []).map((person) => person.person_id),
    buddyUserIds: (row.workout_buddy_shares ?? []).map((share) => share.buddy_user_id),
    ratings: [],
    notes: [],
    exercises: [...(row.workout_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => {
        const tracking = trackingTypeFrom(exercise.tracking);
        const targetDistanceKm =
          exercise.target_distance_km == null ? null : Number(exercise.target_distance_km);
        return {
          id: exercise.id,
          exerciseId: exercise.exercise_id,
          name: exercise.name,
          position: exercise.position,
          tracking,
          targetUnit: targetUnitFrom(exercise.target_unit, tracking, { targetDistanceKm }),
          targetSets: exercise.target_sets,
          targetReps: exercise.target_reps,
          targetDurationSec: exercise.target_duration_sec ?? null,
          targetDistanceKm,
          targetWeight: exercise.target_weight,
          targetEffort: effortLevelFrom(exercise.target_effort),
          targetRpe: rpeFromDb(exercise.target_rpe),
          note: exercise.note ?? '',
          supersetId: exercise.superset_id ?? null,
        };
      }),
  };
}

export async function loadBuddyPermissionsForMe(
  ownerId: string,
  viewerId: string,
): Promise<TrainBuddyPermissions> {
  const { data, error } = await db()
    .from('train_buddy_permissions')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('buddy_id', viewerId)
    .maybeSingle();
  if (error) throw error;
  return mapPermissions(data);
}

export async function loadBuddyHubDetail(opts: {
  buddyUserId: string;
  viewerId: string;
  buddyStatus: TrainBuddyStatus;
}): Promise<BuddyHubDetail> {
  const theirPermissionsForMe = await loadBuddyPermissionsForMe(opts.buddyUserId, opts.viewerId);
  const visibility = buddyHubVisibility({
    buddyStatus: opts.buddyStatus,
    theirPermissionsForMe,
  });

  const [planRes, workoutsRes, sessionsRes, prsRes] = await Promise.all([
    visibility.plan
      ? db()
          .from('train_plans')
          .select('id, name, train_plan_days(weekday, position, workout_id, label)')
          .eq('user_id', opts.buddyUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    visibility.workouts
      ? db()
          .from('workouts')
          .select('*, workout_exercises(*), workout_people(person_id), workout_buddy_shares(buddy_user_id)')
          .eq('created_by', opts.buddyUserId)
          .order('updated_at', { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as never[], error: null }),
    visibility.sessions
      ? db()
          .from('workout_sessions')
          .select('id, name, finished_at, workout_id')
          .eq('user_id', opts.buddyUserId)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] as never[], error: null }),
    visibility.prs
      ? db()
          .from('exercise_records')
          .select('exercise_id, best_weight, best_reps, updated_at, exercises(name)')
          .eq('user_id', opts.buddyUserId)
          .order('updated_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  if (planRes.error) throw planRes.error;
  if (workoutsRes.error) throw workoutsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (prsRes.error) throw prsRes.error;

  const planRow = planRes.data;
  const plan: BuddyHubPlan | null = planRow
    ? {
        id: planRow.id,
        name: planRow.name,
        days: [...(planRow.train_plan_days ?? [])]
          .sort((a, b) => a.weekday - b.weekday || a.position - b.position)
          .map((day) => ({
            weekday: day.weekday,
            workoutId: day.workout_id,
            label: day.label,
          })),
      }
    : null;

  return {
    visibility,
    theirPermissionsForMe,
    plan,
    workouts: (workoutsRes.data ?? []).map(mapWorkoutRow),
    sessions: (sessionsRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      finishedAt: row.finished_at,
      workoutId: row.workout_id,
    })),
    prs: (prsRes.data ?? []).map((row) => {
      const exercise = row.exercises as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(exercise) ? exercise[0]?.name : exercise?.name;
      return {
        exerciseId: row.exercise_id,
        exerciseName: name ?? 'Exercise',
        bestWeight: row.best_weight,
        bestReps: row.best_reps,
        updatedAt: row.updated_at,
      };
    }),
  };
}

export type TrainTogetherInvite = {
  id: string;
  workoutId: string;
  workoutName: string;
  inviterId: string;
  inviteeId: string;
  scheduledAt: string | null;
  status: TrainTogetherStatus;
  createdAt: string;
  otherProfile: PublicSocialUser;
  direction: 'incoming' | 'outgoing';
};

export async function loadTrainTogetherInvites(userId: string): Promise<TrainTogetherInvite[]> {
  const { data, error } = await db()
    .from('train_together_invites')
    .select('id, workout_id, inviter_id, invitee_id, scheduled_at, status, created_at, workouts(name)')
    .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;

  const rows = data ?? [];
  const otherIds = rows.map((row) => (row.inviter_id === userId ? row.invitee_id : row.inviter_id));
  const profiles = await fetchPublicProfilesByIds(otherIds);

  return rows
    .map((row) => {
      if (!isTrainTogetherStatus(row.status)) return null;
      const otherUserId = row.inviter_id === userId ? row.invitee_id : row.inviter_id;
      const workout = row.workouts as { name?: string } | { name?: string }[] | null;
      const workoutName = Array.isArray(workout) ? workout[0]?.name : workout?.name;
      return {
        id: row.id,
        workoutId: row.workout_id,
        workoutName: workoutName ?? 'Workout',
        inviterId: row.inviter_id,
        inviteeId: row.invitee_id,
        scheduledAt: row.scheduled_at,
        status: row.status,
        createdAt: row.created_at,
        direction: row.invitee_id === userId ? ('incoming' as const) : ('outgoing' as const),
        otherProfile: profiles.get(otherUserId) ?? {
          id: otherUserId,
          globalHandle: 'Unknown',
          username: null,
          avatarUrl: null,
          isVerifiedCreator: false,
        },
      };
    })
    .filter((row): row is TrainTogetherInvite => Boolean(row));
}

export async function inviteTrainTogether(opts: {
  workoutId: string;
  inviteeIds: string[];
  scheduledAt?: string | null;
}): Promise<string[]> {
  const { data, error } = await db().rpc(rpc.inviteTrainTogether, {
    p_workout_id: opts.workoutId,
    p_invitee_ids: opts.inviteeIds,
    p_scheduled_at: opts.scheduledAt ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

export async function respondTrainTogether(inviteId: string, accept: boolean): Promise<void> {
  const { error } = await db().rpc(rpc.respondTrainTogether, {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function cancelTrainTogether(inviteId: string): Promise<void> {
  const { error } = await db().rpc(rpc.cancelTrainTogether, { p_invite_id: inviteId });
  if (error) throw error;
}

export type TrainBuddyFeedEvent = {
  id: string;
  actorId: string;
  eventType: TrainBuddyEventType;
  workoutId: string | null;
  sessionId: string | null;
  exerciseId: string | null;
  title: string;
  createdAt: string;
  actor: PublicSocialUser;
  highFiveCount: number;
  highFivedByMe: boolean;
};

export async function loadTrainBuddyFeed(viewerId: string): Promise<TrainBuddyFeedEvent[]> {
  const { data, error } = await db()
    .from('train_buddy_events')
    .select('id, actor_id, event_type, workout_id, session_id, exercise_id, title, created_at, train_buddy_event_high_fives(user_id)')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;

  const rows = (data ?? []).filter((row) => isTrainBuddyEventType(row.event_type));
  const actorIds = [...new Set(rows.map((row) => row.actor_id))];
  const profiles = await fetchPublicProfilesByIds(actorIds);

  return rows.map((row) => {
    const highs = row.train_buddy_event_high_fives ?? [];
    return {
      id: row.id,
      actorId: row.actor_id,
      eventType: row.event_type as TrainBuddyEventType,
      workoutId: row.workout_id,
      sessionId: row.session_id,
      exerciseId: row.exercise_id,
      title: row.title,
      createdAt: row.created_at,
      actor: profiles.get(row.actor_id) ?? {
        id: row.actor_id,
        globalHandle: 'Unknown',
        username: null,
        avatarUrl: null,
        isVerifiedCreator: false,
      },
      highFiveCount: highs.length,
      highFivedByMe: highs.some((high) => high.user_id === viewerId),
    };
  });
}

export async function highFiveTrainBuddyEvent(eventId: string): Promise<void> {
  const { error } = await db().rpc(rpc.highFiveTrainBuddyEvent, { p_event_id: eventId });
  if (error) throw error;
}

/** Accepted / pending train-together rows for Plan (both people). */
export async function loadPlanTrainTogether(userId: string): Promise<TrainTogetherInvite[]> {
  const rows = await loadTrainTogetherInvites(userId);
  return rows.filter((row) => row.status === 'accepted' || row.status === 'pending');
}
