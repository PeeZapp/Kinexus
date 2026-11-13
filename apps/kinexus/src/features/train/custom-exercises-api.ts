import {
  archiveExerciseCall,
  isExerciseDifficulty,
  planSharedWorkoutExerciseCopy,
  promoteExercisePatch,
  publishGlobalExerciseCall,
  type ExerciseDifficulty,
  type ExerciseScope,
  type PromoteExerciseTarget,
  type ShareCopyExerciseRow,
} from '@kinexus/domain';
import { rpc, type Database } from '@kinexus/db';

import { fetchPublicProfilesByIds, type PublicSocialUser } from '@/src/features/stash/watchlist-social';
import type { LibraryExercise, WorkoutExerciseInput } from '@/src/features/train/api';
import { supabase } from '@/src/lib/supabase';

type ExerciseRow = Database['public']['Tables']['exercises']['Row'];
type ExerciseGroupRow = Database['public']['Tables']['exercise_groups']['Row'];

const MEDIA_BUCKET = 'recipe-images';

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export type CustomExerciseInput = {
  name: string;
  bodyPart: string;
  equipment: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  instructions: string[];
  category: string | null;
  difficulty: ExerciseDifficulty | null;
  isCompound: boolean | null;
  mediaUrl: string | null;
  mediaUrls: string[];
  mediaKind: 'gif' | 'image' | null;
  scope: Exclude<ExerciseScope, 'global'>;
  householdId: string | null;
  groupId: string | null;
};

export type ExerciseGroup = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  members: PublicSocialUser[];
};

function mediaKindFromUrl(url: string | null): 'gif' | 'image' | null {
  if (!url) return null;
  return /\.gif(\?|$)/i.test(url) ? 'gif' : 'image';
}

export async function createCustomExercise(input: {
  userId: string;
  draft: CustomExerciseInput;
}): Promise<string> {
  const name = input.draft.name.trim();
  if (!name) throw new Error('Name is required');
  const mediaUrl = input.draft.mediaUrl?.trim() || null;
  const mediaUrls =
    input.draft.mediaUrls.length > 0
      ? input.draft.mediaUrls
      : mediaUrl
        ? [mediaUrl]
        : [];
  const { data, error } = await db()
    .from('exercises')
    .insert({
      name,
      body_part: input.draft.bodyPart.trim() || 'other',
      equipment: input.draft.equipment.trim() || 'bodyweight',
      target_muscle: input.draft.targetMuscle.trim() || 'other',
      secondary_muscles: input.draft.secondaryMuscles.map((m) => m.trim()).filter(Boolean),
      instructions: input.draft.instructions.map((s) => s.trim()).filter(Boolean),
      category: input.draft.category?.trim() || null,
      difficulty: input.draft.difficulty,
      is_compound: input.draft.isCompound,
      media_url: mediaUrl,
      media_urls: mediaUrls,
      media_kind: input.draft.mediaKind ?? mediaKindFromUrl(mediaUrl),
      source: 'user',
      license: 'user',
      license_author: null,
      scope: input.draft.scope,
      owner_id: input.userId,
      household_id: input.draft.scope === 'household' ? input.draft.householdId : null,
      group_id: input.draft.scope === 'group' ? input.draft.groupId : null,
      status: 'active',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCustomExercise(input: {
  exerciseId: string;
  draft: CustomExerciseInput;
}): Promise<void> {
  const name = input.draft.name.trim();
  if (!name) throw new Error('Name is required');
  const mediaUrl = input.draft.mediaUrl?.trim() || null;
  const mediaUrls =
    input.draft.mediaUrls.length > 0
      ? input.draft.mediaUrls
      : mediaUrl
        ? [mediaUrl]
        : [];
  const { error } = await db()
    .from('exercises')
    .update({
      name,
      body_part: input.draft.bodyPart.trim() || 'other',
      equipment: input.draft.equipment.trim() || 'bodyweight',
      target_muscle: input.draft.targetMuscle.trim() || 'other',
      secondary_muscles: input.draft.secondaryMuscles.map((m) => m.trim()).filter(Boolean),
      instructions: input.draft.instructions.map((s) => s.trim()).filter(Boolean),
      category: input.draft.category?.trim() || null,
      difficulty: input.draft.difficulty,
      is_compound: input.draft.isCompound,
      media_url: mediaUrl,
      media_urls: mediaUrls,
      media_kind: input.draft.mediaKind ?? mediaKindFromUrl(mediaUrl),
      scope: input.draft.scope,
      household_id: input.draft.scope === 'household' ? input.draft.householdId : null,
      group_id: input.draft.scope === 'group' ? input.draft.groupId : null,
    })
    .eq('id', input.exerciseId);
  if (error) throw error;
}

export async function archiveCustomExercise(exerciseId: string): Promise<'hidden' | 'deleted'> {
  const call = archiveExerciseCall(exerciseId);
  const { data, error } = await db().rpc(rpc.archiveExercise, call.args);
  if (error) throw error;
  return data === 'deleted' ? 'deleted' : 'hidden';
}

export async function publishGlobalExercise(exerciseId: string): Promise<string> {
  const call = publishGlobalExerciseCall(exerciseId);
  const { data, error } = await db().rpc(rpc.publishGlobalExercise, call.args);
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Publish failed');
  return data;
}

export async function promoteCustomExercise(input: {
  exerciseId: string;
  target: PromoteExerciseTarget;
}): Promise<void> {
  const patch = promoteExercisePatch(input.target);
  const { error } = await db().from('exercises').update(patch).eq('id', input.exerciseId);
  if (error) throw error;
}

export async function hideGlobalExercise(exerciseId: string): Promise<void> {
  await archiveCustomExercise(exerciseId);
}

export async function uploadExerciseMedia(input: {
  householdId: string;
  userId: string;
  file: File;
}): Promise<string> {
  const contentType = input.file.type.startsWith('image/')
    ? input.file.type
    : input.file.name.toLowerCase().endsWith('.gif')
      ? 'image/gif'
      : input.file.name.toLowerCase().endsWith('.png')
        ? 'image/png'
        : input.file.name.toLowerCase().endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
  if (input.file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB');
  const ext =
    contentType === 'image/gif'
      ? 'gif'
      : contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : 'jpg';
  const path = `${input.householdId}/exercises/${input.userId}/${Date.now()}.${ext}`;
  const { error } = await db().storage.from(MEDIA_BUCKET).upload(path, input.file, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = db().storage.from(MEDIA_BUCKET).getPublicUrl(path);
  if (!data.publicUrl.startsWith('https://')) throw new Error('Public URL was not https');
  return data.publicUrl;
}

export async function loadExerciseGroups(userId: string): Promise<ExerciseGroup[]> {
  const { data: groups, error } = await db()
    .from('exercise_groups')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (groups ?? []) as ExerciseGroupRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const { data: members, error: memberError } = await db()
    .from('exercise_group_members')
    .select('group_id, user_id')
    .in('group_id', ids);
  if (memberError) throw memberError;

  const memberIds = [...new Set((members ?? []).map((row) => row.user_id))];
  const profiles = await fetchPublicProfilesByIds(memberIds);
  const byGroup = new Map<string, string[]>();
  for (const row of members ?? []) {
    const list = byGroup.get(row.group_id) ?? [];
    list.push(row.user_id);
    byGroup.set(row.group_id, list);
  }

  return rows.map((row) => {
    const memberList = byGroup.get(row.id) ?? [userId];
    return {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      memberIds: memberList,
      members: memberList.map(
        (id) =>
          profiles.get(id) ?? {
            id,
            globalHandle: 'Unknown',
            username: null,
            avatarUrl: null,
            isVerifiedCreator: false,
          },
      ),
    };
  });
}

export async function createExerciseGroup(input: {
  userId: string;
  name: string;
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Name is required');
  const { data, error } = await db()
    .from('exercise_groups')
    .insert({ owner_id: input.userId, name })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function renameExerciseGroup(input: { groupId: string; name: string }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Name is required');
  const { error } = await db().from('exercise_groups').update({ name }).eq('id', input.groupId);
  if (error) throw error;
}

export async function addExerciseGroupMember(input: {
  groupId: string;
  userId: string;
}): Promise<void> {
  const { error } = await db()
    .from('exercise_group_members')
    .insert({ group_id: input.groupId, user_id: input.userId });
  if (error) throw error;
}

export async function removeExerciseGroupMember(input: {
  groupId: string;
  userId: string;
}): Promise<void> {
  const { error } = await db()
    .from('exercise_group_members')
    .delete()
    .eq('group_id', input.groupId)
    .eq('user_id', input.userId);
  if (error) throw error;
}

export async function deleteExerciseGroup(groupId: string): Promise<void> {
  const { error } = await db().from('exercise_groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function leaveExerciseGroup(input: {
  groupId: string;
  userId: string;
}): Promise<void> {
  await removeExerciseGroupMember(input);
}

async function copyExerciseRowToPrivate(input: {
  sourceId: string;
  userId: string;
}): Promise<{ id: string; name: string }> {
  const { data: source, error } = await db()
    .from('exercises')
    .select('*')
    .eq('id', input.sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!source) throw new Error('Exercise is not available to copy');
  const row = source as ExerciseRow;
  const { data, error: insertError } = await db()
    .from('exercises')
    .insert({
      name: row.name,
      body_part: row.body_part,
      equipment: row.equipment,
      target_muscle: row.target_muscle,
      secondary_muscles: row.secondary_muscles ?? [],
      instructions: row.instructions ?? [],
      category: row.category,
      difficulty: row.difficulty && isExerciseDifficulty(row.difficulty) ? row.difficulty : null,
      is_compound: row.is_compound,
      media_url: row.media_url,
      media_urls: row.media_urls ?? [],
      media_kind: row.media_kind,
      source: 'user',
      license: 'user',
      license_author: null,
      scope: 'private',
      owner_id: input.userId,
      household_id: null,
      group_id: null,
      status: 'active',
    })
    .select('id, name')
    .single();
  if (insertError) throw insertError;
  return { id: data.id, name: data.name };
}

export type WorkoutCopyExerciseResolution = {
  exercises: WorkoutExerciseInput[];
  needsReplacement: { name: string; sourceExerciseId: string | null }[];
};

/** Remap workout exercises for copy-into-my-library, cloning private/group rows when needed. */
export async function resolveExercisesForWorkoutCopy(input: {
  exercises: WorkoutExerciseInput[];
  userId: string;
  householdId: string | null;
}): Promise<WorkoutCopyExerciseResolution> {
  const ids = [
    ...new Set(input.exercises.map((row) => row.exerciseId).filter((id): id is string => Boolean(id))),
  ];
  const byId = new Map<string, ShareCopyExerciseRow>();
  if (ids.length > 0) {
    const { data, error } = await db().from('exercises').select('*').in('id', ids);
    if (error) throw error;
    for (const row of (data ?? []) as ExerciseRow[]) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        scope: row.scope,
        ownerId: row.owner_id,
        householdId: row.household_id,
        source: row.source,
      });
    }
  }

  const plan = planSharedWorkoutExerciseCopy({
    exercises: input.exercises.map((row) => ({
      exerciseId: row.exerciseId,
      name: row.name,
    })),
    byId,
    recipientUserId: input.userId,
    recipientHouseholdId: input.householdId,
  });

  const needsReplacement: WorkoutCopyExerciseResolution['needsReplacement'] = [];
  const exercises: WorkoutExerciseInput[] = [];

  for (let index = 0; index < plan.length; index += 1) {
    const item = plan[index]!;
    const source = input.exercises[index]!;
    if (item.kind === 'keep') {
      exercises.push({ ...source, exerciseId: item.exerciseId, name: item.name });
      continue;
    }
    if (item.kind === 'replace') {
      needsReplacement.push({ name: item.name, sourceExerciseId: item.sourceExerciseId });
      exercises.push({ ...source, exerciseId: null, name: item.name });
      continue;
    }
    const copied = await copyExerciseRowToPrivate({
      sourceId: item.sourceExerciseId,
      userId: input.userId,
    });
    exercises.push({ ...source, exerciseId: copied.id, name: copied.name });
  }

  return { exercises, needsReplacement };
}

export function difficultyFrom(value: string | null | undefined): ExerciseDifficulty | null {
  return value && isExerciseDifficulty(value) ? value : null;
}

export type LibraryExerciseDetail = LibraryExercise & {
  ownerId: string | null;
  householdId: string | null;
  groupId: string | null;
  difficulty: ExerciseDifficulty | null;
  secondaryMuscles: string[];
  isCompound: boolean | null;
  owner: PublicSocialUser | null;
};
