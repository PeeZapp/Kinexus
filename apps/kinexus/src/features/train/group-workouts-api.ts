import {
  GROUP_WORKOUT_JOIN_ALPHABET,
  generateJoinCode,
  isGroupPickingDue,
  isTargetUnit,
  orderGroupPicks,
  trackingCompatTargets,
  unitToTracking,
  type GroupWorkoutStatus,
  type TargetUnit,
} from '@kinexus/domain';
import { rpc } from '@kinexus/db';

import { fetchPublicProfilesByIds, type PublicSocialUser } from '@/src/features/stash/watchlist-social';
import {
  createWorkout,
  loadWorkoutById,
  saveWorkoutToLibrary,
  type WorkoutDraft,
  type WorkoutExerciseInput,
} from '@/src/features/train/api';
import { supabase } from '@/src/lib/supabase';

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export type GroupWorkoutJoinMode = 'buddies' | 'code';

export type GroupWorkoutSummary = {
  id: string;
  title: string;
  workoutDate: string;
  categories: string[];
  picksPerPerson: number;
  closesAt: string;
  joinMode: GroupWorkoutJoinMode;
  joinCode: string | null;
  status: GroupWorkoutStatus;
  creatorId: string;
  myPickCount: number;
  totalPickCount: number;
  memberCount: number;
  members: PublicSocialUser[];
};

export type GroupWorkoutMember = {
  userId: string;
  joinedAt: string;
  workoutId: string | null;
  profile: PublicSocialUser;
};

export type GroupWorkoutPick = {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  category: string;
  targetSets: number;
  targetReps: string;
  targetUnit: TargetUnit | null;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
  createdAt: string;
  canonicalKey?: string | null;
  instructions?: string[] | null;
};

export type GroupWorkoutDetail = {
  id: string;
  title: string;
  workoutDate: string;
  categories: string[];
  picksPerPerson: number;
  closesAt: string;
  joinMode: GroupWorkoutJoinMode;
  joinCode: string | null;
  status: GroupWorkoutStatus;
  creatorId: string;
  closedAt: string | null;
  builtAt: string | null;
  createdAt: string;
  members: GroupWorkoutMember[];
  picks: GroupWorkoutPick[];
  /** Signed-in member's built copy, when present. */
  myWorkout: WorkoutDraft | null;
};

export type CreateGroupWorkoutInput = {
  title: string;
  workoutDate: string;
  categories: string[];
  picksPerPerson: number;
  closesAt: string;
  joinMode: GroupWorkoutJoinMode;
  inviteeIds?: string[];
};

export type UpdateGroupWorkoutInput = {
  title: string;
  workoutDate: string;
  categories: string[];
  picksPerPerson: number;
  closesAt: string;
  joinMode: GroupWorkoutJoinMode;
};

type GroupWorkoutRow = {
  id: string;
  title: string;
  workout_date: string;
  categories: string[] | null;
  picks_per_person: number;
  closes_at: string;
  join_mode: string;
  join_code: string | null;
  status: string;
  creator_id: string;
  closed_at?: string | null;
  built_at?: string | null;
  created_at?: string;
};

function isJoinMode(value: string): value is GroupWorkoutJoinMode {
  return value === 'buddies' || value === 'code';
}

function isStatus(value: string): value is GroupWorkoutStatus {
  return value === 'picking' || value === 'closed' || value === 'built' || value === 'cancelled';
}

function errMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

function errCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return '';
}

/** Map Supabase / Postgres errors to short UI copy. */
export function mapGroupWorkoutError(error: unknown): Error {
  const message = errMessage(error);
  const code = errCode(error);
  const lower = message.toLowerCase();

  if (code === '23505' || lower.includes('duplicate') || lower.includes('unique')) {
    return new Error('That exercise was just picked by someone else');
  }
  if (lower.includes('picking is closed')) {
    return new Error('Picking has closed');
  }
  if (lower.includes('all picks used')) {
    return new Error("You've used all your picks");
  }
  if (
    lower.includes('group workout not found') ||
    lower.includes('invalid join code') ||
    lower.includes('invalid join')
  ) {
    return new Error("That code doesn't match a group workout");
  }
  return new Error(message || 'Something went wrong');
}

/** Uppercase + drop 0/O/1/I and anything outside the join alphabet. */
export function normalizeJoinCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[01IO]/g, '')
    .split('')
    .filter((ch) => GROUP_WORKOUT_JOIN_ALPHABET.includes(ch))
    .join('')
    .slice(0, 6);
}

function fallbackProfile(userId: string): PublicSocialUser {
  return {
    id: userId,
    globalHandle: 'Unknown',
    username: null,
    avatarUrl: null,
    isVerifiedCreator: false,
  };
}

function mapGroupRow(row: GroupWorkoutRow): Omit<
  GroupWorkoutSummary,
  'myPickCount' | 'totalPickCount' | 'memberCount' | 'members'
> {
  if (!isJoinMode(row.join_mode) || !isStatus(row.status)) {
    throw new Error('Invalid group workout row');
  }
  return {
    id: row.id,
    title: row.title,
    workoutDate: row.workout_date,
    categories: row.categories ?? [],
    picksPerPerson: row.picks_per_person,
    closesAt: row.closes_at,
    joinMode: row.join_mode,
    joinCode: row.join_code,
    status: row.status,
    creatorId: row.creator_id,
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await db().auth.getUser();
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

async function loadPicksForOrdering(groupId: string): Promise<GroupWorkoutPick[]> {
  const { data, error } = await db()
    .from('group_workout_picks')
    .select(
      'id, user_id, exercise_id, category, target_sets, target_reps, target_unit, target_duration_sec, target_distance_km, created_at, exercises(name, canonical_key, instructions)',
    )
    .eq('group_workout_id', groupId);
  if (error) throw mapGroupWorkoutError(error);

  return (data ?? []).map((row) => {
    const exercise = row.exercises as
      | { name?: string; canonical_key?: string | null; instructions?: string[] | null }
      | { name?: string; canonical_key?: string | null; instructions?: string[] | null }[]
      | null;
    const ex = Array.isArray(exercise) ? exercise[0] : exercise;
    const unit = row.target_unit;
    return {
      id: row.id,
      userId: row.user_id,
      exerciseId: row.exercise_id,
      exerciseName: ex?.name ?? 'Exercise',
      category: row.category,
      targetSets: row.target_sets,
      targetReps: row.target_reps,
      targetUnit: isTargetUnit(unit) ? unit : null,
      targetDurationSec: row.target_duration_sec,
      targetDistanceKm: row.target_distance_km == null ? null : Number(row.target_distance_km),
      createdAt: row.created_at,
      canonicalKey: ex?.canonical_key ?? null,
      instructions: ex?.instructions ?? null,
    };
  });
}

/**
 * Close if due, then order picks client-side and build. Idempotent under races;
 * already-built is success.
 */
export async function ensureClosedAndBuilt(id: string): Promise<void> {
  const client = db();

  const [{ data: group, error: groupError }, { data: memberRows, error: memberError }, { data: pickRows, error: pickError }] =
    await Promise.all([
      client
        .from('group_workouts')
        .select('id, closes_at, picks_per_person, status')
        .eq('id', id)
        .maybeSingle(),
      client.from('group_workout_members').select('user_id').eq('group_workout_id', id),
      client.from('group_workout_picks').select('user_id').eq('group_workout_id', id),
    ]);

  if (groupError) throw mapGroupWorkoutError(groupError);
  if (memberError) throw mapGroupWorkoutError(memberError);
  if (pickError) throw mapGroupWorkoutError(pickError);
  if (!group) return;

  const status = isStatus(group.status) ? group.status : 'picking';
  if (status === 'cancelled' || status === 'built') return;

  const due = isGroupPickingDue(
    { closesAt: group.closes_at, picksPerPerson: group.picks_per_person, status },
    (memberRows ?? []).map((row) => ({ userId: row.user_id })),
    (pickRows ?? []).map((row) => ({ userId: row.user_id })),
  );
  if (!due && status === 'picking') return;

  const { error: closeError } = await client.rpc(rpc.closeGroupWorkoutIfDue, {
    p_group_workout_id: id,
  });
  if (closeError) throw mapGroupWorkoutError(closeError);

  const { data: refreshed, error: refreshError } = await client
    .from('group_workouts')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (refreshError) throw mapGroupWorkoutError(refreshError);

  const nextStatus = refreshed?.status;
  if (nextStatus === 'built' || nextStatus === 'cancelled' || nextStatus !== 'closed') return;

  const picks = await loadPicksForOrdering(id);
  const ordered = orderGroupPicks(
    picks.map((pick) => ({
      id: pick.id,
      userId: pick.userId,
      exerciseId: pick.exerciseId,
      category: pick.category,
      name: pick.exerciseName,
      canonicalKey: pick.canonicalKey,
      instructions: pick.instructions,
      targetUnit: pick.targetUnit,
      createdAt: pick.createdAt,
    })),
  );

  const { error: buildError } = await client.rpc(rpc.buildGroupWorkout, {
    p_group_workout_id: id,
    p_ordered_pick_ids: ordered.map((pick) => pick.id),
  });
  if (buildError) {
    const msg = errMessage(buildError).toLowerCase();
    if (msg.includes('already') || msg.includes('not ready') || msg.includes('built')) return;
    // Race: peer finished build → status built; treat as ok after recheck.
    const { data: after } = await client.from('group_workouts').select('status').eq('id', id).maybeSingle();
    if (after?.status === 'built') return;
    throw mapGroupWorkoutError(buildError);
  }
}

export async function listMyGroupWorkouts(): Promise<GroupWorkoutSummary[]> {
  const userId = await currentUserId();
  const client = db();

  const { data: memberships, error } = await client
    .from('group_workout_members')
    .select(
      'group_workout_id, joined_at, group_workouts(id, title, workout_date, categories, picks_per_person, closes_at, join_mode, join_code, status, creator_id)',
    )
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });
  if (error) throw mapGroupWorkoutError(error);

  const rows = (memberships ?? [])
    .map((row) => {
      const raw = row.group_workouts as GroupWorkoutRow | GroupWorkoutRow[] | null;
      const group = Array.isArray(raw) ? raw[0] : raw;
      if (!group) return null;
      return mapGroupRow(group);
    })
    .filter((row): row is ReturnType<typeof mapGroupRow> => Boolean(row));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const [{ data: allMembers, error: membersError }, { data: allPicks, error: picksError }] = await Promise.all([
    client.from('group_workout_members').select('group_workout_id, user_id').in('group_workout_id', ids),
    client.from('group_workout_picks').select('group_workout_id, user_id').in('group_workout_id', ids),
  ]);
  if (membersError) throw mapGroupWorkoutError(membersError);
  if (picksError) throw mapGroupWorkoutError(picksError);

  const membersByGroup = new Map<string, string[]>();
  for (const row of allMembers ?? []) {
    const list = membersByGroup.get(row.group_workout_id) ?? [];
    list.push(row.user_id);
    membersByGroup.set(row.group_workout_id, list);
  }
  const picksByGroup = new Map<string, { userId: string }[]>();
  for (const row of allPicks ?? []) {
    const list = picksByGroup.get(row.group_workout_id) ?? [];
    list.push({ userId: row.user_id });
    picksByGroup.set(row.group_workout_id, list);
  }

  await Promise.all(
    rows
      .filter((row) => {
        if (row.status === 'cancelled' || row.status === 'built') return false;
        const memberIds = membersByGroup.get(row.id) ?? [];
        return isGroupPickingDue(
          { closesAt: row.closesAt, picksPerPerson: row.picksPerPerson, status: row.status },
          memberIds.map((id) => ({ userId: id })),
          picksByGroup.get(row.id) ?? [],
        );
      })
      .map((row) => ensureClosedAndBuilt(row.id).catch(() => undefined)),
  );

  const { data: finalGroups, error: finalError } = await client
    .from('group_workouts')
    .select('id, title, workout_date, categories, picks_per_person, closes_at, join_mode, join_code, status, creator_id')
    .in('id', ids);
  if (finalError) throw mapGroupWorkoutError(finalError);

  const finalById = new Map((finalGroups ?? []).map((row) => [row.id, mapGroupRow(row as GroupWorkoutRow)]));
  const profileIds = [...new Set((allMembers ?? []).map((row) => row.user_id))];
  const profiles = await fetchPublicProfilesByIds(profileIds);

  const order = new Map(ids.map((id, index) => [id, index]));
  return [...finalById.values()]
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((group) => {
      const memberIds = membersByGroup.get(group.id) ?? [];
      const picks = picksByGroup.get(group.id) ?? [];
      return {
        ...group,
        memberCount: memberIds.length,
        totalPickCount: picks.length,
        myPickCount: picks.filter((pick) => pick.userId === userId).length,
        members: memberIds.map((id) => profiles.get(id) ?? fallbackProfile(id)),
      };
    });
}

export async function getGroupWorkout(id: string): Promise<GroupWorkoutDetail> {
  await ensureClosedAndBuilt(id).catch(() => undefined);

  const client = db();
  const { data: group, error } = await client
    .from('group_workouts')
    .select(
      'id, title, workout_date, categories, picks_per_person, closes_at, join_mode, join_code, status, creator_id, closed_at, built_at, created_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapGroupWorkoutError(error);
  if (!group) throw new Error('Group workout not found');

  const mapped = mapGroupRow(group as GroupWorkoutRow);
  const [{ data: memberRows, error: memberError }, picks] = await Promise.all([
    client
      .from('group_workout_members')
      .select('user_id, joined_at, workout_id')
      .eq('group_workout_id', id)
      .order('joined_at', { ascending: true }),
    loadPicksForOrdering(id),
  ]);
  if (memberError) throw mapGroupWorkoutError(memberError);

  const profiles = await fetchPublicProfilesByIds((memberRows ?? []).map((row) => row.user_id));
  const row = group as GroupWorkoutRow;
  const userId = await currentUserId();
  const mine = (memberRows ?? []).find((member) => member.user_id === userId);
  let myWorkout = mine?.workout_id ? await loadWorkoutById(mine.workout_id) : null;
  if (!myWorkout) {
    const { data: copyRow, error: copyError } = await client
      .from('workouts')
      .select('id')
      .eq('group_workout_id', id)
      .eq('created_by', userId)
      .maybeSingle();
    if (copyError) throw mapGroupWorkoutError(copyError);
    if (copyRow?.id) myWorkout = await loadWorkoutById(copyRow.id);
  }

  return {
    ...mapped,
    closedAt: row.closed_at ?? null,
    builtAt: row.built_at ?? null,
    createdAt: row.created_at ?? '',
    members: (memberRows ?? []).map((member) => ({
      userId: member.user_id,
      joinedAt: member.joined_at,
      workoutId: member.workout_id,
      profile: profiles.get(member.user_id) ?? fallbackProfile(member.user_id),
    })),
    picks,
    myWorkout,
  };
}

export async function createGroupWorkout(
  input: CreateGroupWorkoutInput,
): Promise<{ id: string; joinCode: string | null }> {
  const { data, error } = await db().rpc(rpc.createGroupWorkout, {
    p_title: input.title,
    p_workout_date: input.workoutDate,
    p_categories: input.categories,
    p_picks_per_person: input.picksPerPerson,
    p_closes_at: input.closesAt,
    p_join_mode: input.joinMode,
  });
  if (error) throw mapGroupWorkoutError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) throw new Error('Group workout was not created');

  const inviteeIds = [...new Set((input.inviteeIds ?? []).filter(Boolean))];
  for (const userId of inviteeIds) {
    await inviteBuddy(row.id, userId);
  }

  return { id: row.id, joinCode: row.join_code ?? null };
}

export async function updateGroupWorkout(
  id: string,
  input: UpdateGroupWorkoutInput,
): Promise<{ joinCode: string | null }> {
  const client = db();
  const { data: existing, error: loadError } = await client
    .from('group_workouts')
    .select('join_mode, join_code, status, creator_id')
    .eq('id', id)
    .maybeSingle();
  if (loadError) throw mapGroupWorkoutError(loadError);
  if (!existing) throw new Error('Group workout not found');
  if (existing.status !== 'picking') throw new Error('Picking has closed');

  const userId = await currentUserId();
  if (existing.creator_id !== userId) throw new Error('Only the creator can edit');

  let joinCode: string | null = existing.join_code;
  if (input.joinMode === 'code') {
    joinCode = existing.join_mode === 'code' && existing.join_code ? existing.join_code : generateJoinCode();
  } else {
    joinCode = null;
  }

  const { error } = await client
    .from('group_workouts')
    .update({
      title: input.title.trim().slice(0, 120),
      workout_date: input.workoutDate,
      categories: input.categories,
      picks_per_person: input.picksPerPerson,
      closes_at: input.closesAt,
      join_mode: input.joinMode,
      join_code: joinCode,
    })
    .eq('id', id)
    .eq('creator_id', userId)
    .eq('status', 'picking');
  if (error) throw mapGroupWorkoutError(error);
  return { joinCode };
}

export async function inviteBuddy(groupWorkoutId: string, userId: string): Promise<void> {
  const { error } = await db().rpc(rpc.inviteGroupWorkoutBuddy, {
    p_group_workout_id: groupWorkoutId,
    p_user_id: userId,
  });
  if (error) throw mapGroupWorkoutError(error);
}

export async function joinByCode(code: string): Promise<string> {
  const normalized = normalizeJoinCode(code);
  const { data, error } = await db().rpc(rpc.joinGroupWorkoutByCode, { p_code: normalized });
  if (error) throw mapGroupWorkoutError(error);
  if (!data) throw new Error("That code doesn't match a group workout");
  return data;
}

export async function leaveGroupWorkout(id: string): Promise<void> {
  const { error } = await db().rpc(rpc.leaveGroupWorkout, { p_group_workout_id: id });
  if (error) throw mapGroupWorkoutError(error);
}

/** Creator cancel — leave_group_workout sets status cancelled (RLS blocks direct status update). */
export async function cancelGroupWorkout(id: string): Promise<void> {
  const userId = await currentUserId();
  const { data, error } = await db()
    .from('group_workouts')
    .select('creator_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapGroupWorkoutError(error);
  if (!data) throw new Error('Group workout not found');
  if (data.creator_id !== userId) throw new Error('Only the creator can cancel');
  await leaveGroupWorkout(id);
}

export type AddGroupWorkoutPickInput = {
  groupWorkoutId: string;
  exerciseId: string;
  targetSets: number;
  targetReps: string;
  targetUnit: TargetUnit;
  targetDurationSec?: number | null;
  targetDistanceKm?: number | null;
  category?: string | null;
};

export async function addGroupWorkoutPick(input: AddGroupWorkoutPickInput): Promise<string> {
  const { data, error } = await db().rpc(rpc.addGroupWorkoutPick, {
    p_group_workout_id: input.groupWorkoutId,
    p_exercise_id: input.exerciseId,
    p_target_sets: input.targetSets,
    p_target_reps: input.targetReps,
    p_target_unit: input.targetUnit,
    p_target_duration_sec: input.targetDurationSec ?? null,
    p_target_distance_km: input.targetDistanceKm ?? null,
    p_category: input.category ?? null,
  });
  if (error) throw mapGroupWorkoutError(error);
  if (!data || typeof data !== 'string') throw new Error('Could not add pick');
  return data;
}

export async function removeGroupWorkoutPick(pickId: string): Promise<void> {
  const { error } = await db().rpc(rpc.removeGroupWorkoutPick, { p_pick_id: pickId });
  if (error) throw mapGroupWorkoutError(error);
}

export async function addMyGroupWorkoutToLibrary(workoutId: string): Promise<void> {
  await saveWorkoutToLibrary(workoutId);
}

function pickToExerciseInput(pick: GroupWorkoutPick): WorkoutExerciseInput {
  const unit: TargetUnit = pick.targetUnit ?? 'reps';
  const compat = trackingCompatTargets({
    tracking: unitToTracking(unit),
    targetUnit: unit,
    targetSets: pick.targetSets,
    targetReps: pick.targetReps,
    targetDurationSec: pick.targetDurationSec,
    targetDistanceKm: pick.targetDistanceKm,
  });
  return {
    exerciseId: pick.exerciseId,
    name: pick.exerciseName,
    tracking: compat.tracking,
    targetUnit: compat.targetUnit,
    targetSets: compat.targetSets,
    targetReps: compat.targetReps,
    targetDurationSec: compat.targetDurationSec,
    targetDistanceKm: compat.targetDistanceKm,
  };
}

/**
 * Late joiner: no member copy was built. Create a normal library workout from
 * the ordered picks and link it on the membership row.
 */
export async function copyGroupWorkoutToLibrary(input: {
  groupWorkoutId: string;
  householdId: string;
  userId: string;
}): Promise<string> {
  const detail = await getGroupWorkout(input.groupWorkoutId);
  if (detail.status !== 'built' && detail.status !== 'closed') {
    throw new Error('Group workout is not ready');
  }
  if (!detail.members.some((member) => member.userId === input.userId)) {
    throw new Error('Not a member');
  }
  if (detail.myWorkout) {
    if (!detail.myWorkout.inLibrary) await addMyGroupWorkoutToLibrary(detail.myWorkout.id);
    return detail.myWorkout.id;
  }

  const ordered = orderGroupPicks(
    detail.picks.map((pick) => ({
      id: pick.id,
      userId: pick.userId,
      exerciseId: pick.exerciseId,
      category: pick.category,
      name: pick.exerciseName,
      canonicalKey: pick.canonicalKey,
      instructions: pick.instructions,
      targetUnit: pick.targetUnit,
      createdAt: pick.createdAt,
    })),
  );
  const pickById = new Map(detail.picks.map((pick) => [pick.id, pick]));
  const exercises = ordered
    .map((row) => pickById.get(row.id))
    .filter((pick): pick is GroupWorkoutPick => Boolean(pick))
    .map(pickToExerciseInput);

  const workoutId = await createWorkout({
    householdId: input.householdId,
    userId: input.userId,
    name: detail.title,
    visibility: 'private',
    splitId: null,
    durationMin: null,
    personIds: [],
    exercises,
  });

  const { error: linkError } = await db()
    .from('workouts')
    .update({ group_workout_id: input.groupWorkoutId, in_library: true })
    .eq('id', workoutId);
  if (linkError) throw mapGroupWorkoutError(linkError);

  return workoutId;
}
