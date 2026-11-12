import type {
  CatalogExercise,
  Day,
  EffortLevel,
  ExerciseDifficulty,
  ExerciseRecord,
  ExerciseSourceBadge,
  FamilyPlanShare,
  GeneratedTrainDay,
  LoggedSet,
  PlanIcsDay,
  RegenerateRemainingPreviewDay,
  RestExtra,
  SavedWorkoutCandidate,
  TrainGlobalEquipment,
  TrainGlobalGoal,
  TrainGlobalLevel,
  TrainingPlanDayStatus,
  TrainingPlanWeekRow,
  TargetUnit,
  TrackingType,
  TrainVisibility,
  WeightUnit,
} from '@kinexus/domain';
import {
  appendWorkoutSetCall,
  applyLoggedSets,
  buildTrainingPlanIcs,
  canFillSessionType,
  deleteWorkoutSetCall,
  deleteWorkoutSetsAtPositionCall,
  effortLevelFrom,
  exerciseSourceBadge as domainExerciseSourceBadge,
  fillWorkoutFromSessionTypeWidened,
  finishWorkoutSessionCall,
  isStaleEmptySession,
  formatWeight,
  handleAddTrainingPlanDay,
  handleApplyTrainingPlan,
  handleAttachWorkoutToPlanDay,
  handleCopySharedTrainingPlan,
  handleDeleteTrainingPlan,
  handleDuplicateTrainingPlanToNextWeek,
  handleListTrainingPlansByWeek,
  handleRegenerateRemainingDays,
  handleRemoveTrainingPlanDayEvent,
  handleSaveGeneratePrefs,
  handleSetTrainingPlanCalendarAutoSync,
  handleSetTrainingPlanDayStatus,
  handleSyncTrainingPlanToCalendar,
  handleUpdateTrainingPlanDaySchedule,
  handleUpdateTrainingPlanVisibility,
  handleUpsertTrainingPlanDayEvent,
  isFamilyPlanShare,
  isTrainGlobalGoal,
  isTrainGlobalLevel,
  linkWorkoutSessionCall,
  moveSessionExerciseCall,
  replaceSessionExerciseCall,
  rewriteSessionSetsCall,
  sessionHasLoggedSets,
  targetUnitFrom,
  trackingCompatTargets,
  trackingTypeFrom,
  unitToTracking,
  updateWorkoutSetCall,
  isTrainVisibility,
  normalizeTrainGlobalEquipment,
  parseWeight,
  sessionTypeIdFromFocus,
  toStoredKg,
} from '@kinexus/domain';

import type { Database } from '@kinexus/db';
import { rpc } from '@kinexus/db';

import {
  deleteHouseholdEventFromGoogle,
  pushHouseholdEventToGoogle,
} from '@/src/features/calendar/google-sync';
import { shareOrDownloadExport } from '@/src/features/lists/list-file-io';
import { fetchPublicProfilesByIds, type PublicSocialUser } from '@/src/features/stash/watchlist-social';
import { difficultyFrom, resolveExercisesForWorkoutCopy } from '@/src/features/train/custom-exercises-api';
import { supabase } from '@/src/lib/supabase';

type ExerciseRow = Database['public']['Tables']['exercises']['Row'];
type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

export type { ExerciseSourceBadge };

export type LibraryExercise = CatalogExercise & {
  mediaUrl: string | null;
  mediaUrls: string[];
  mediaKind: 'gif' | 'image' | null;
  source: ExerciseRow['source'];
  sourceBadge: ExerciseSourceBadge;
  scope: ExerciseRow['scope'];
  status: ExerciseRow['status'];
  license: string;
  licenseAuthor: string | null;
  instructions: string[];
  ownerId: string | null;
  householdId: string | null;
  groupId: string | null;
  difficulty: ExerciseDifficulty | null;
  secondaryMuscles: string[];
  aliases: string[];
  mergedInto: string | null;
  owner: PublicSocialUser | null;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string | null;
  name: string;
  position: number;
  tracking: TrackingType;
  targetUnit: TargetUnit;
  targetSets: number;
  targetReps: string;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
  /** Stored kg. */
  targetWeight: number | null;
  targetEffort: EffortLevel | null;
  targetRpe: number | null;
  note: string;
  supersetId: string | null;
};

export type WorkoutExerciseInput = {
  exerciseId: string | null;
  name: string;
  tracking?: TrackingType;
  targetUnit?: TargetUnit;
  targetSets: number;
  targetReps: string;
  targetDurationSec?: number | null;
  targetDistanceKm?: number | null;
  targetWeight?: number | null;
  targetEffort?: EffortLevel | null;
  targetRpe?: number | null;
  note?: string;
  supersetId?: string | null;
};

/** Format a stored kg value for display in the user's unit. */
export function displayWeight(kg: string | number | null | undefined, unit: WeightUnit): string {
  if (kg == null || kg === '') return '';
  const value = typeof kg === 'number' ? kg : parseWeight(String(kg));
  if (value == null) return '';
  return String(formatWeight(value, unit));
}

/** Format stored kg with unit label, e.g. "100 kg" / "220 lb". */
export function weightLabel(kg: string | number | null | undefined, unit: WeightUnit): string {
  const value = displayWeight(kg, unit);
  return value ? `${value} ${unit}` : '';
}

export type WorkoutRating = {
  userId: string;
  score: number;
};

export type WorkoutUserNote = {
  position: number;
  body: string;
};

export type WorkoutDraft = {
  id: string;
  name: string;
  visibility: WorkoutRow['visibility'];
  splitId: string | null;
  durationMin: number | null;
  createdBy: string | null;
  shareToken: string | null;
  isShared: boolean;
  /** Linked to a plan day; hidden from the Workouts library until saved. */
  planOnly: boolean;
  /** Personal library membership; group copies start false until opted in. */
  inLibrary: boolean;
  groupWorkoutId: string | null;
  level: TrainGlobalLevel | null;
  goal: TrainGlobalGoal | null;
  equipment: TrainGlobalEquipment[];
  sourceWorkoutId: string | null;
  sourceCreatorId: string | null;
  personIds: string[];
  buddyUserIds: string[];
  exercises: WorkoutExercise[];
  ratings: WorkoutRating[];
  notes: WorkoutUserNote[];
};

export type GlobalWorkoutCard = {
  id: string;
  name: string;
  level: TrainGlobalLevel | null;
  goal: TrainGlobalGoal | null;
  equipment: TrainGlobalEquipment[];
  durationMin: number | null;
  updatedAt: string;
  createdBy: string | null;
  creator: PublicSocialUser | null;
  avgScore: number | null;
  ratingCount: number;
  myScore: number | null;
  exercises: WorkoutExercise[];
};

export type TrainPrefs = {
  restExtra: RestExtra;
  defaultWorkoutVisibility: TrainVisibility;
  familyPlanShare: FamilyPlanShare;
  generatePrefs: Record<string, unknown>;
};

export type FamilyTrainMember = {
  userId: string;
  displayName: string;
  familyPlanShare: FamilyPlanShare;
  planId: string | null;
  planName: string | null;
  todayWorkoutId: string | null;
  todayWorkoutName: string | null;
  recentCompletions: {
    sessionId: string;
    name: string;
    finishedAt: string | null;
    sets: { exerciseName: string; setIndex: number; reps: string; weight?: string; done: boolean }[];
  }[];
};

export type TrainPlanDraft = {
  id: string;
  name: string;
  visibility: TrainVisibility;
  level: TrainGlobalLevel | null;
  goal: TrainGlobalGoal | null;
  equipment: TrainGlobalEquipment[];
  personIds: string[];
  buddyUserIds: string[];
  days: { weekday: number; position: number; workoutId: string | null; label: string }[];
};

function mapGlobalLevel(value: string | null | undefined): TrainGlobalLevel | null {
  return value && isTrainGlobalLevel(value) ? value : null;
}

function mapGlobalGoal(value: string | null | undefined): TrainGlobalGoal | null {
  return value && isTrainGlobalGoal(value) ? value : null;
}

export type SessionSet = LoggedSet & {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  position: number;
  setIndex: number;
  durationSec: number | null;
  distanceKm: number | null;
};

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

function rpeFromDb(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function exerciseSourceBadge(row: ExerciseRow): ExerciseSourceBadge {
  return domainExerciseSourceBadge({ scope: row.scope, source: row.source });
}

function mapExercise(row: ExerciseRow, owner: PublicSocialUser | null = null): LibraryExercise {
  return {
    id: row.id,
    name: row.name,
    bodyPart: row.body_part,
    equipment: row.equipment,
    targetMuscle: row.target_muscle,
    canonicalKey: row.canonical_key,
    category: row.category,
    isCompound: row.is_compound,
    mediaUrl: row.media_url,
    mediaUrls: row.media_urls?.length ? row.media_urls : row.media_url ? [row.media_url] : [],
    mediaKind: row.media_kind,
    source: row.source,
    sourceBadge: exerciseSourceBadge(row),
    scope: row.scope,
    status: row.status,
    license: row.license,
    licenseAuthor: row.license_author,
    instructions: row.instructions ?? [],
    ownerId: row.owner_id,
    householdId: row.household_id,
    groupId: row.group_id,
    difficulty: difficultyFrom(row.difficulty),
    secondaryMuscles: row.secondary_muscles ?? [],
    aliases: row.aliases ?? [],
    mergedInto: row.merged_into ?? null,
    owner,
  };
}

/** Active catalogue / custom rows used for pickers, search, remix, and generators. */
export function isPickableLibraryExercise(exercise: Pick<LibraryExercise, 'status' | 'mergedInto'>): boolean {
  return exercise.status === 'active' && exercise.mergedInto == null;
}

export async function loadLibrary(): Promise<LibraryExercise[]> {
  // RLS returns global + visible custom scopes; active rows plus hidden customs
  // referenced by history. Near-dupe merges (merged_into set) are excluded so
  // pickers/search/generators see one row; workout_exercises still keep their FKs.
  const rows: ExerciseRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('exercises')
      .select('*')
      .is('merged_into', null)
      .order('name')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const ownerIds = [
    ...new Set(
      rows
        .filter((row) => row.source === 'creator' || row.scope !== 'global')
        .map((row) => row.owner_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const owners = ownerIds.length > 0 ? await fetchPublicProfilesByIds(ownerIds) : new Map();
  return rows.map((row) => mapExercise(row, row.owner_id ? owners.get(row.owner_id) ?? null : null));
}

export async function loadWorkouts(
  householdId: string,
  opts?: { includePlanOnly?: boolean },
): Promise<WorkoutDraft[]> {
  let query = db()
    .from('workouts')
    .select('*, workout_exercises(*), workout_people(person_id), workout_buddy_shares(buddy_user_id)')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false });
  query = query.eq('in_library', true);
  if (!opts?.includePlanOnly) {
    query = query.eq('plan_only', false);
  }
  const { data, error } = await query;
  if (error) throw error;
  const { data: ratingRows } = await db().from('workout_ratings').select('workout_id, user_id, score').eq('household_id', householdId);
  const ratingsByWorkout = new Map<string, WorkoutRating[]>();
  for (const rating of ratingRows ?? []) {
    const list = ratingsByWorkout.get(rating.workout_id) ?? [];
    list.push({ userId: rating.user_id, score: rating.score });
    ratingsByWorkout.set(rating.workout_id, list);
  }
  const { data: noteRows } = await db()
    .from('workout_user_notes')
    .select('workout_id, exercise_position, body')
    .eq('household_id', householdId);
  const notesByWorkout = new Map<string, WorkoutUserNote[]>();
  for (const note of noteRows ?? []) {
    const list = notesByWorkout.get(note.workout_id) ?? [];
    list.push({ position: note.exercise_position, body: note.body });
    notesByWorkout.set(note.workout_id, list);
  }
  return (data ?? []).map((row) => mapWorkoutDraft(row, ratingsByWorkout, notesByWorkout));
}

export type OutOfLibraryGroupWorkout = WorkoutDraft & {
  workoutDate: string | null;
};

/** Built group copies the user has not added to their personal library yet. */
export async function loadOutOfLibraryGroupWorkouts(
  householdId: string,
  userId: string,
): Promise<OutOfLibraryGroupWorkout[]> {
  const { data, error } = await db()
    .from('workouts')
    .select(
      '*, workout_exercises(*), workout_people(person_id), workout_buddy_shares(buddy_user_id), group_workouts(workout_date)',
    )
    .eq('household_id', householdId)
    .eq('created_by', userId)
    .eq('in_library', false)
    .not('group_workout_id', 'is', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const raw = (row as { group_workouts?: { workout_date?: string } | { workout_date?: string }[] | null })
      .group_workouts;
    const group = Array.isArray(raw) ? raw[0] : raw;
    return {
      ...mapWorkoutDraft(row),
      workoutDate: group?.workout_date ?? null,
    };
  });
}

function mapWorkoutDraft(
  row: {
    id: string;
    name: string;
    visibility: WorkoutRow['visibility'];
    split_id: string | null;
    duration_min: number | null;
    created_by: string | null;
    share_token: string | null;
    is_shared: boolean | null;
    plan_only?: boolean | null;
    in_library?: boolean | null;
    group_workout_id?: string | null;
    level: string | null;
    goal: string | null;
    equipment: string[] | null;
    source_workout_id: string | null;
    source_creator_id: string | null;
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
    }[];
    workout_people?: { person_id: string }[];
    workout_buddy_shares?: { buddy_user_id: string }[];
  },
  ratingsByWorkout?: Map<string, WorkoutRating[]>,
  notesByWorkout?: Map<string, WorkoutUserNote[]>,
): WorkoutDraft {
  return {
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    splitId: row.split_id,
    durationMin: row.duration_min,
    createdBy: row.created_by,
    shareToken: row.share_token,
    isShared: Boolean(row.is_shared),
    planOnly: Boolean(row.plan_only),
    inLibrary: row.in_library == null ? true : Boolean(row.in_library),
    groupWorkoutId: row.group_workout_id ?? null,
    level: mapGlobalLevel(row.level),
    goal: mapGlobalGoal(row.goal),
    equipment: normalizeTrainGlobalEquipment(row.equipment),
    sourceWorkoutId: row.source_workout_id,
    sourceCreatorId: row.source_creator_id,
    personIds: (row.workout_people ?? []).map((person) => person.person_id),
    buddyUserIds: (row.workout_buddy_shares ?? []).map((share) => share.buddy_user_id),
    ratings: ratingsByWorkout?.get(row.id) ?? [],
    notes: notesByWorkout?.get(row.id) ?? [],
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

export async function loadWorkoutById(workoutId: string): Promise<WorkoutDraft | null> {
  const { data, error } = await db()
    .from('workouts')
    .select('*, workout_exercises(*), workout_people(person_id), workout_buddy_shares(buddy_user_id)')
    .eq('id', workoutId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapWorkoutDraft(data);
}

/** Workouts shared to the signed-in user by buddies (any household). */
export async function loadBuddySharedWorkouts(): Promise<WorkoutDraft[]> {
  const { data, error } = await db()
    .from('workouts')
    .select('*, workout_exercises(*), workout_people(person_id), workout_buddy_shares(buddy_user_id)')
    .in('visibility', ['buddies', 'buddies_selected', 'global'])
    .eq('plan_only', false)
    .eq('in_library', true)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => mapWorkoutDraft(row));
}

export async function createWorkout(input: {
  householdId: string;
  userId: string;
  name: string;
  visibility: WorkoutRow['visibility'];
  splitId: string | null;
  durationMin: number | null;
  level?: TrainGlobalLevel | null;
  goal?: TrainGlobalGoal | null;
  equipment?: TrainGlobalEquipment[];
  sourceWorkoutId?: string | null;
  sourceCreatorId?: string | null;
  /** When true, workout stays off the Workouts library (plan-linked). */
  planOnly?: boolean;
  personIds: string[];
  buddyUserIds?: string[];
  exercises: WorkoutExerciseInput[];
}): Promise<string> {
  const usePrivateRpc =
    input.visibility === 'private' &&
    !input.splitId &&
    !input.sourceWorkoutId &&
    !input.sourceCreatorId &&
    (input.personIds?.length ?? 0) === 0 &&
    (input.buddyUserIds?.length ?? 0) === 0;

  let workoutId: string;
  if (usePrivateRpc) {
    const { data, error } = await db().rpc(rpc.createPrivateWorkout, {
      p_household_id: input.householdId,
      p_name: input.name,
      p_duration_min: input.durationMin,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== 'string') throw new Error('Could not create workout');
    workoutId = data;
  } else {
    const { data, error } = await db()
      .from('workouts')
      .insert({
        household_id: input.householdId,
        created_by: input.userId,
        name: input.name,
        visibility: input.visibility,
        split_id: input.splitId,
        duration_min: input.durationMin,
        level: input.level ?? null,
        goal: input.goal ?? null,
        equipment: input.equipment ?? [],
        source_workout_id: input.sourceWorkoutId ?? null,
        source_creator_id: input.sourceCreatorId ?? null,
        plan_only: Boolean(input.planOnly),
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    workoutId = data.id;
  }

  if (input.planOnly && usePrivateRpc) {
    const { error } = await db()
      .from('workouts')
      .update({ plan_only: true })
      .eq('id', workoutId);
    if (error) throw new Error(error.message);
  }

  const needsChildren =
    input.exercises.length > 0 ||
    (input.visibility === 'people' && (input.personIds?.length ?? 0) > 0) ||
    (input.visibility === 'buddies_selected' && (input.buddyUserIds?.length ?? 0) > 0);

  if (needsChildren || !usePrivateRpc) {
    await replaceWorkoutChildren(
      workoutId,
      input.householdId,
      input.visibility,
      input.personIds,
      input.buddyUserIds ?? [],
      input.exercises,
    );
  }
  return workoutId;
}

export async function saveWorkoutToLibrary(workoutId: string): Promise<void> {
  const { error } = await db().rpc(rpc.saveWorkoutToLibrary, { p_workout_id: workoutId });
  if (error) throw new Error(error.message);
}

export async function saveWorkout(
  workoutId: string,
  householdId: string,
  draft: {
    name: string;
    visibility: WorkoutRow['visibility'];
    splitId: string | null;
    durationMin: number | null;
    level?: TrainGlobalLevel | null;
    goal?: TrainGlobalGoal | null;
    equipment?: TrainGlobalEquipment[];
    personIds: string[];
    buddyUserIds?: string[];
    exercises: WorkoutExerciseInput[];
  },
): Promise<void> {
  const { error } = await db()
    .from('workouts')
    .update({
      name: draft.name.trim() || 'Workout',
      visibility: draft.visibility,
      split_id: draft.splitId,
      duration_min: draft.durationMin,
      level: draft.level ?? null,
      goal: draft.goal ?? null,
      equipment: draft.equipment ?? [],
    })
    .eq('id', workoutId);
  if (error) throw error;
  await replaceWorkoutChildren(
    workoutId,
    householdId,
    draft.visibility,
    draft.personIds,
    draft.buddyUserIds ?? [],
    draft.exercises,
  );
}

async function replaceWorkoutChildren(
  workoutId: string,
  householdId: string,
  visibility: WorkoutRow['visibility'],
  personIds: string[],
  buddyUserIds: string[],
  exercises: WorkoutExerciseInput[],
) {
  const { error: deleteExercises } = await db().from('workout_exercises').delete().eq('workout_id', workoutId);
  if (deleteExercises) throw new Error(deleteExercises.message);
  if (exercises.length > 0) {
    const { error } = await db()
      .from('workout_exercises')
      .insert(
        exercises.map((exercise, position) => {
          const tracking = trackingTypeFrom(exercise.tracking ?? unitToTracking(targetUnitFrom(exercise.targetUnit)));
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
            household_id: householdId,
            exercise_id: exercise.exerciseId,
            name: exercise.name,
            position,
            tracking: compat.tracking,
            target_unit: compat.targetUnit,
            target_sets: compat.targetSets,
            target_reps: compat.targetReps,
            target_duration_sec: compat.targetDurationSec,
            target_distance_km: compat.targetDistanceKm,
            target_weight: exercise.targetWeight ?? null,
            target_effort: exercise.targetEffort ?? null,
            target_rpe: exercise.targetRpe ?? null,
            note: (exercise.note ?? '').trim().slice(0, 160),
            superset_id: exercise.supersetId ?? null,
          };
        }),
      );
    if (error) throw new Error(error.message);
  }
  const { error: deletePeople } = await db().from('workout_people').delete().eq('workout_id', workoutId);
  if (deletePeople) throw new Error(deletePeople.message);
  if (visibility === 'people' && personIds.length > 0) {
    const { error } = await db()
      .from('workout_people')
      .insert(personIds.map((personId) => ({ workout_id: workoutId, person_id: personId, household_id: householdId })));
    if (error) throw new Error(error.message);
  }
  const { error: deleteBuddies } = await db().from('workout_buddy_shares').delete().eq('workout_id', workoutId);
  if (deleteBuddies) throw new Error(deleteBuddies.message);
  if (visibility === 'buddies_selected' && buddyUserIds.length > 0) {
    const { error } = await db()
      .from('workout_buddy_shares')
      .insert(
        buddyUserIds.map((buddyUserId) => ({
          workout_id: workoutId,
          buddy_user_id: buddyUserId,
          household_id: householdId,
        })),
      );
    if (error) throw new Error(error.message);
  }
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const { data, error } = await db().from('workouts').delete().eq('id', workoutId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Could not delete this workout');
}

export async function loadRecords(userId: string, exerciseIds: string[]): Promise<Record<string, ExerciseRecord>> {
  if (exerciseIds.length === 0) return {};
  const { data, error } = await db().from('exercise_records').select('*').eq('user_id', userId).in('exercise_id', exerciseIds);
  if (error) throw error;
  const records: Record<string, ExerciseRecord> = {};
  for (const row of data ?? []) {
    records[row.exercise_id] = {
      lastWeight: row.last_weight,
      lastReps: row.last_reps,
      bestWeight: row.best_weight,
      bestReps: row.best_reps,
    };
  }
  return records;
}

export async function loadRestExtra(userId: string): Promise<RestExtra> {
  const prefs = await loadTrainPrefs(userId);
  return prefs.restExtra;
}

export async function saveRestExtra(userId: string, restExtra: RestExtra): Promise<void> {
  const { error } = await db().from('user_train_prefs').upsert({ user_id: userId, rest_extra: restExtra });
  if (error) throw error;
}

export async function loadTrainPrefs(userId: string): Promise<TrainPrefs> {
  const { data, error } = await db()
    .from('user_train_prefs')
    .select('rest_extra, default_workout_visibility, family_plan_share, generate_prefs')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const visibility = data?.default_workout_visibility;
  const family = data?.family_plan_share;
  const generatePrefs =
    data?.generate_prefs && typeof data.generate_prefs === 'object' && !Array.isArray(data.generate_prefs)
      ? (data.generate_prefs as Record<string, unknown>)
      : {};
  return {
    restExtra: data?.rest_extra ?? 'off',
    defaultWorkoutVisibility: visibility && isTrainVisibility(visibility) ? visibility : 'private',
    familyPlanShare: family && isFamilyPlanShare(family) ? family : 'off',
    generatePrefs,
  };
}

export async function saveTrainPrefs(
  userId: string,
  patch: Partial<{
    restExtra: RestExtra;
    defaultWorkoutVisibility: TrainVisibility;
    familyPlanShare: FamilyPlanShare;
    generatePrefs: Record<string, unknown>;
  }>,
): Promise<void> {
  const { error } = await db()
    .from('user_train_prefs')
    .upsert({
      user_id: userId,
      ...(patch.restExtra != null ? { rest_extra: patch.restExtra } : {}),
      ...(patch.defaultWorkoutVisibility != null
        ? { default_workout_visibility: patch.defaultWorkoutVisibility }
        : {}),
      ...(patch.familyPlanShare != null ? { family_plan_share: patch.familyPlanShare } : {}),
      ...(patch.generatePrefs != null ? { generate_prefs: patch.generatePrefs } : {}),
    });
  if (error) throw error;
}

export async function loadFamilyTrainOverview(householdId: string): Promise<FamilyTrainMember[]> {
  const { data, error } = await db().rpc(rpc.familyTrainOverview, { _household_id: householdId });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const completions = Array.isArray(row.recent_completions) ? row.recent_completions : [];
    return {
      userId: row.user_id,
      displayName: row.display_name,
      familyPlanShare: isFamilyPlanShare(row.family_plan_share) ? row.family_plan_share : 'off',
      planId: row.plan_id,
      planName: row.plan_name,
      todayWorkoutId: row.today_workout_id,
      todayWorkoutName: row.today_workout_name,
      recentCompletions: completions.map((item) => {
        const rowItem = item as {
          session_id?: string;
          name?: string;
          finished_at?: string | null;
          sets?: { exercise_name?: string; set_index?: number; reps?: string; weight?: string; done?: boolean }[];
        };
        return {
          sessionId: rowItem.session_id ?? '',
          name: rowItem.name ?? 'Session',
          finishedAt: rowItem.finished_at ?? null,
          sets: (rowItem.sets ?? []).map((set) => ({
            exerciseName: set.exercise_name ?? '',
            setIndex: set.set_index ?? 0,
            reps: set.reps ?? '',
            weight: set.weight,
            done: Boolean(set.done),
          })),
        };
      }),
    };
  });
}

export async function loadMyTrainPlan(userId: string, householdId: string): Promise<TrainPlanDraft | null> {
  const { data, error } = await db()
    .from('train_plans')
    .select('*, train_plan_days(*), train_plan_people(person_id), train_plan_buddy_shares(buddy_user_id)')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    visibility: data.visibility,
    level: mapGlobalLevel(data.level),
    goal: mapGlobalGoal(data.goal),
    equipment: normalizeTrainGlobalEquipment(data.equipment),
    personIds: (data.train_plan_people ?? []).map((person) => person.person_id),
    buddyUserIds: (data.train_plan_buddy_shares ?? []).map((share) => share.buddy_user_id),
    days: [...(data.train_plan_days ?? [])]
      .sort((a, b) => a.weekday - b.weekday || a.position - b.position)
      .map((day) => ({
        weekday: day.weekday,
        position: day.position,
        workoutId: day.workout_id,
        label: day.label,
      })),
  };
}

export async function saveMyTrainPlan(input: {
  householdId: string;
  userId: string;
  name: string;
  visibility: TrainVisibility;
  level?: TrainGlobalLevel | null;
  goal?: TrainGlobalGoal | null;
  equipment?: TrainGlobalEquipment[];
  personIds: string[];
  buddyUserIds: string[];
  days: { weekday: number; position: number; workoutId: string | null; label: string }[];
}): Promise<string> {
  const { data, error } = await db()
    .from('train_plans')
    .upsert(
      {
        household_id: input.householdId,
        user_id: input.userId,
        name: input.name.trim() || 'My plan',
        visibility: input.visibility,
        level: input.level ?? null,
        goal: input.goal ?? null,
        equipment: input.equipment ?? [],
      },
      { onConflict: 'user_id' },
    )
    .select('id')
    .single();
  if (error) throw error;
  const planId = data.id;

  const { error: clearDays } = await db().from('train_plan_days').delete().eq('plan_id', planId);
  if (clearDays) throw clearDays;
  if (input.days.length > 0) {
    const { error: dayError } = await db().from('train_plan_days').insert(
      input.days.map((day) => ({
        plan_id: planId,
        weekday: day.weekday,
        position: day.position,
        workout_id: day.workoutId,
        label: day.label,
      })),
    );
    if (dayError) throw dayError;
  }

  const { error: clearPeople } = await db().from('train_plan_people').delete().eq('plan_id', planId);
  if (clearPeople) throw clearPeople;
  if (input.visibility === 'people' && input.personIds.length > 0) {
    const { error: peopleError } = await db().from('train_plan_people').insert(
      input.personIds.map((personId) => ({
        plan_id: planId,
        person_id: personId,
        household_id: input.householdId,
      })),
    );
    if (peopleError) throw peopleError;
  }

  const { error: clearBuddies } = await db().from('train_plan_buddy_shares').delete().eq('plan_id', planId);
  if (clearBuddies) throw clearBuddies;
  if (input.visibility === 'buddies_selected' && input.buddyUserIds.length > 0) {
    const { error: buddyError } = await db().from('train_plan_buddy_shares').insert(
      input.buddyUserIds.map((buddyUserId) => ({
        plan_id: planId,
        buddy_user_id: buddyUserId,
        household_id: input.householdId,
      })),
    );
    if (buddyError) throw buddyError;
  }

  return planId;
}

export async function copyWorkoutToMyLibrary(input: {
  source: WorkoutDraft;
  householdId: string;
  userId: string;
}): Promise<{ workoutId: string; needsReplacement: { name: string; sourceExerciseId: string | null }[] }> {
  const resolved = await resolveExercisesForWorkoutCopy({
    exercises: input.source.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      targetWeight: exercise.targetWeight,
      targetEffort: exercise.targetEffort,
      targetRpe: exercise.targetRpe,
      note: exercise.note,
      supersetId: exercise.supersetId,
    })),
    userId: input.userId,
    householdId: input.householdId,
  });
  const workoutId = await createWorkout({
    householdId: input.householdId,
    userId: input.userId,
    name: input.source.name,
    visibility: 'private',
    splitId: null,
    durationMin: input.source.durationMin,
    level: input.source.level,
    goal: input.source.goal,
    equipment: input.source.equipment,
    sourceWorkoutId: input.source.id,
    sourceCreatorId: input.source.createdBy,
    personIds: [],
    buddyUserIds: [],
    exercises: resolved.exercises,
  });
  return { workoutId, needsReplacement: resolved.needsReplacement };
}

export async function loadGlobalWorkouts(userId: string | null): Promise<GlobalWorkoutCard[]> {
  const { data, error } = await db()
    .from('workouts')
    .select('*, workout_exercises(*)')
    .eq('visibility', 'global')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((row) => row.id);
  const creatorIds = rows.map((row) => row.created_by).filter((id): id is string => Boolean(id));
  const profiles = await fetchPublicProfilesByIds(creatorIds);

  const ratingByWorkout = new Map<string, { scores: number[]; mine: number | null }>();
  if (ids.length > 0) {
    const { data: ratingRows, error: ratingError } = await db()
      .from('train_global_workout_ratings')
      .select('workout_id, user_id, score')
      .in('workout_id', ids);
    if (ratingError) throw ratingError;
    for (const rating of ratingRows ?? []) {
      const bucket = ratingByWorkout.get(rating.workout_id) ?? { scores: [], mine: null };
      bucket.scores.push(rating.score);
      if (userId && rating.user_id === userId) bucket.mine = rating.score;
      ratingByWorkout.set(rating.workout_id, bucket);
    }
  }

  return rows.map((row) => {
    const ratings = ratingByWorkout.get(row.id);
    const sum = ratings?.scores.reduce((acc, score) => acc + score, 0) ?? 0;
    const count = ratings?.scores.length ?? 0;
    return {
      id: row.id,
      name: row.name,
      level: mapGlobalLevel(row.level),
      goal: mapGlobalGoal(row.goal),
      equipment: normalizeTrainGlobalEquipment(row.equipment),
      durationMin: row.duration_min,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      creator: row.created_by ? profiles.get(row.created_by) ?? null : null,
      avgScore: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
      ratingCount: count,
      myScore: ratings?.mine ?? null,
      exercises: [...(row.workout_exercises ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((exercise) => {
          const rowExercise = exercise as {
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
          };
          const tracking = trackingTypeFrom(rowExercise.tracking);
          const targetDistanceKm =
            rowExercise.target_distance_km == null ? null : Number(rowExercise.target_distance_km);
          return {
            id: rowExercise.id,
            exerciseId: rowExercise.exercise_id,
            name: rowExercise.name,
            position: rowExercise.position,
            tracking,
            targetUnit: targetUnitFrom(rowExercise.target_unit, tracking, { targetDistanceKm }),
            targetSets: rowExercise.target_sets,
            targetReps: rowExercise.target_reps,
            targetDurationSec: rowExercise.target_duration_sec ?? null,
            targetDistanceKm,
            targetWeight: rowExercise.target_weight,
            targetEffort: effortLevelFrom(rowExercise.target_effort),
            targetRpe: rpeFromDb(rowExercise.target_rpe),
            note: rowExercise.note ?? '',
            supersetId: rowExercise.superset_id ?? null,
          };
        }),
    };
  });
}

export async function rateGlobalWorkout(input: {
  workoutId: string;
  userId: string;
  score: number | null;
}): Promise<void> {
  if (input.score == null) {
    const { error } = await db()
      .from('train_global_workout_ratings')
      .delete()
      .eq('workout_id', input.workoutId)
      .eq('user_id', input.userId);
    if (error) throw error;
    return;
  }
  const { error } = await db().from('train_global_workout_ratings').upsert(
    {
      workout_id: input.workoutId,
      user_id: input.userId,
      score: input.score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workout_id,user_id' },
  );
  if (error) throw error;
}

export async function copyGlobalWorkoutToMine(input: {
  workout: GlobalWorkoutCard;
  householdId: string;
  userId: string;
}): Promise<{ workoutId: string; needsReplacement: { name: string; sourceExerciseId: string | null }[] }> {
  const resolved = await resolveExercisesForWorkoutCopy({
    exercises: input.workout.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      targetWeight: exercise.targetWeight,
      targetEffort: exercise.targetEffort,
      targetRpe: exercise.targetRpe,
      note: exercise.note,
      supersetId: exercise.supersetId,
    })),
    userId: input.userId,
    householdId: input.householdId,
  });
  const workoutId = await createWorkout({
    householdId: input.householdId,
    userId: input.userId,
    name: input.workout.name,
    visibility: 'private',
    splitId: null,
    durationMin: input.workout.durationMin,
    level: input.workout.level,
    goal: input.workout.goal,
    equipment: [...input.workout.equipment],
    sourceWorkoutId: input.workout.id,
    sourceCreatorId: input.workout.createdBy,
    personIds: [],
    buddyUserIds: [],
    exercises: resolved.exercises,
  });
  return { workoutId, needsReplacement: resolved.needsReplacement };
}

export type RestGame = 'quiz' | 'memory';

export type RestGameScore = {
  game: RestGame;
  seconds: number;
  score: number;
};

function asRestGame(game: string): RestGame | null {
  return game === 'quiz' || game === 'memory' ? game : null;
}

export async function loadMyRestScores(userId: string): Promise<RestGameScore[]> {
  const { data, error } = await db().from('rest_game_scores').select('game, rest_seconds, best_score').eq('user_id', userId);
  if (error) throw error;
  const scores: RestGameScore[] = [];
  for (const row of data ?? []) {
    const game = asRestGame(row.game);
    if (!game) continue;
    scores.push({ game, seconds: row.rest_seconds, score: row.best_score });
  }
  return scores;
}

export async function loadRestTops(): Promise<RestGameScore[]> {
  const { data, error } = await db().rpc('rest_game_tops');
  if (error) throw error;
  const scores: RestGameScore[] = [];
  for (const row of data ?? []) {
    const game = asRestGame(row.game);
    if (!game) continue;
    scores.push({ game, seconds: row.rest_seconds, score: row.best_score });
  }
  return scores;
}

export async function saveRestBest(userId: string, score: RestGameScore): Promise<void> {
  const { error } = await db().from('rest_game_scores').upsert({
    user_id: userId,
    game: score.game,
    rest_seconds: score.seconds,
    best_score: score.score,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function loadOpenWorkoutIds(userId: string, householdId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('workout_sessions')
    .select('workout_id')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .is('finished_at', null)
    .not('workout_id', 'is', null);
  if (error) throw error;
  return [...new Set((data ?? []).flatMap((row) => (row.workout_id ? [row.workout_id] : [])))];
}

/** Workout ids the user has finished at least once in this household. */
export async function loadCompletedWorkoutIds(userId: string, householdId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('workout_sessions')
    .select('workout_id')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .not('finished_at', 'is', null)
    .not('workout_id', 'is', null);
  if (error) throw error;
  return [...new Set((data ?? []).flatMap((row) => (row.workout_id ? [row.workout_id] : [])))];
}

export async function clearOpenSession(userId: string, workoutId: string): Promise<void> {
  const { error } = await db()
    .from('workout_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('workout_id', workoutId)
    .is('finished_at', null);
  if (error) throw error;
}

function sessionSetCount(exercise: Pick<WorkoutExercise, 'targetSets'>): number {
  return Math.max(1, exercise.targetSets || 1);
}

function sessionSetRowsFromWorkout(input: {
  sessionId: string;
  householdId: string;
  userId: string;
  workout: WorkoutDraft;
  records: Record<string, ExerciseRecord>;
}) {
  return input.workout.exercises.flatMap((exercise) => {
    const tracking = trackingTypeFrom(exercise.tracking);
    const unit = targetUnitFrom(exercise.targetUnit, tracking, {
      targetDistanceKm: exercise.targetDistanceKm,
    });
    const count = sessionSetCount(exercise);
    return Array.from({ length: count }, (_, setIndex) => ({
      session_id: input.sessionId,
      household_id: input.householdId,
      user_id: input.userId,
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.name,
      position: exercise.position,
      set_index: setIndex,
      weight:
        unit === 'reps'
          ? exercise.exerciseId
            ? input.records[exercise.exerciseId]?.lastWeight ||
              (exercise.targetWeight != null ? String(exercise.targetWeight) : '') ||
              ''
            : exercise.targetWeight != null
              ? String(exercise.targetWeight)
              : ''
          : '',
      reps: exercise.targetReps,
      done: false,
      duration_sec: unit === 'sec' || unit === 'min' ? exercise.targetDurationSec : null,
      distance_km:
        unit === 'min' || unit === 'km' || unit === 'm' ? exercise.targetDistanceKm : null,
    }));
  });
}

export async function openSession(input: {
  householdId: string;
  userId: string;
  workout: WorkoutDraft;
  records: Record<string, ExerciseRecord>;
}): Promise<{ sessionId: string; sets: SessionSet[] }> {
  const seedRows = sessionSetRowsFromWorkout({
    sessionId: '00000000-0000-0000-0000-000000000000',
    householdId: input.householdId,
    userId: input.userId,
    workout: input.workout,
    records: input.records,
  });
  const { data, error } = await db().rpc(rpc.startWorkoutSession, {
    p_household_id: input.householdId,
    p_name: input.workout.name,
    p_workout_id: input.workout.id,
    p_remix_spec: null,
    p_duration_min: input.workout.durationMin,
    p_sets: seedRows.map((row) => ({
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name,
      position: row.position,
      set_index: row.set_index,
      weight: row.weight,
      reps: row.reps,
      duration_sec: row.duration_sec,
      distance_km: row.distance_km,
    })),
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'string') throw new Error('Could not start workout');
  let sets = await loadSets(data);
  if (sets.length === 0 && input.workout.exercises.length > 0) {
    sets = await rewriteSessionExercises({
      sessionId: data,
      householdId: input.householdId,
      userId: input.userId,
      exercises: input.workout.exercises.flatMap((exercise) =>
        exercise.exerciseId
          ? [
              {
                exerciseId: exercise.exerciseId,
                name: exercise.name,
                targetSets: Math.max(1, exercise.targetSets || 1),
                targetReps: exercise.targetReps,
              },
            ]
          : [],
      ),
      records: input.records,
    });
    if (sets.length === 0) throw new Error('Could not load workout exercises');
  }
  return { sessionId: data, sets };
}

export type OpenLiveSessionSummary = {
  id: string;
  name: string;
  workoutId: string | null;
  startedAt: string;
  hasLoggedSets: boolean;
};

export async function listOpenLiveSessions(userId: string): Promise<OpenLiveSessionSummary[]> {
  const { data, error } = await db()
    .from('workout_sessions')
    .select('id, name, workout_id, started_at, workout_sets(done)')
    .eq('user_id', userId)
    .is('finished_at', null)
    .order('started_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const sets = (row.workout_sets ?? []) as { done: boolean | null }[];
    return {
      id: row.id,
      name: row.name,
      workoutId: row.workout_id,
      startedAt: row.started_at,
      hasLoggedSets: sessionHasLoggedSets(sets.map((set) => ({ done: Boolean(set.done) }))),
    };
  });
}

export async function abandonWorkoutSession(sessionId: string): Promise<void> {
  const { error } = await db().rpc(rpc.abandonWorkoutSession, { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}

/** Abandon stale empty sessions; if another has logged sets, return it for Resume / Start new. */
export async function prepareToStartWorkout(userId: string): Promise<{
  resume: OpenLiveSessionSummary | null;
}> {
  const open = await listOpenLiveSessions(userId);
  const staleEmpty = open.filter((row) =>
    isStaleEmptySession({ startedAt: row.startedAt, hasLoggedSets: row.hasLoggedSets }),
  );
  for (const row of staleEmpty) {
    await abandonWorkoutSession(row.id);
  }
  const remaining = open.filter((row) => !staleEmpty.some((stale) => stale.id === row.id));
  const withLogs = remaining.find((row) => row.hasLoggedSets) ?? null;
  return { resume: withLogs };
}

/** Quietly abandon empty open sessions (e.g. superseded when starting another). */
export async function abandonEmptyOpenSessions(userId: string): Promise<void> {
  const open = await listOpenLiveSessions(userId);
  for (const row of open) {
    if (!row.hasLoggedSets) await abandonWorkoutSession(row.id);
  }
}

export async function startEmptyLiveSession(input: {
  householdId: string;
  name: string;
  durationMin?: number | null;
}): Promise<string> {
  const { data, error } = await db().rpc(rpc.startWorkoutSession, {
    p_household_id: input.householdId,
    p_name: input.name,
    p_workout_id: null,
    p_remix_spec: null,
    p_duration_min: input.durationMin ?? null,
    p_sets: [],
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'string') throw new Error('Could not start workout');
  return data;
}

export async function startRemixSession(input: {
  householdId: string;
  userId: string;
  name: string;
  remixSpec: string;
  durationMin: number;
  exercises: {
    exerciseId: string;
    name: string;
    tracking?: TrackingType;
    targetUnit?: TargetUnit;
    targetSets: number;
    targetReps: string;
    targetDurationSec?: number | null;
    targetDistanceKm?: number | null;
  }[];
}): Promise<string> {
  const records = await loadRecords(
    input.userId,
    input.exercises.map((exercise) => exercise.exerciseId),
  );
  const sets = input.exercises.flatMap((exercise, position) =>
    Array.from({ length: exercise.targetSets }, (_, setIndex) => ({
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.name,
      position,
      set_index: setIndex,
      weight: records[exercise.exerciseId]?.lastWeight ?? '',
      reps: exercise.targetReps,
    })),
  );
  const { data, error } = await db().rpc(rpc.startWorkoutSession, {
    p_household_id: input.householdId,
    p_name: input.name,
    p_workout_id: null,
    p_remix_spec: input.remixSpec,
    p_duration_min: input.durationMin,
    p_sets: sets,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'string') throw new Error('Could not start workout');
  return data;
}

export type LiveSession = {
  id: string;
  name: string;
  workoutId: string | null;
  remixSpec: string | null;
  durationMin: number | null;
  finishedAt: string | null;
  sets: SessionSet[];
};

export async function loadLiveSession(sessionId: string): Promise<LiveSession | null> {
  const { data, error } = await db()
    .from('workout_sessions')
    .select('id, name, workout_id, remix_spec, duration_min, finished_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    workoutId: data.workout_id,
    remixSpec: data.remix_spec,
    durationMin: data.duration_min,
    finishedAt: data.finished_at,
    sets: await loadSets(sessionId),
  };
}

export async function linkSessionWorkout(sessionId: string, workoutId: string, name: string): Promise<void> {
  const call = linkWorkoutSessionCall(sessionId, workoutId, name);
  const { error } = await db().rpc(rpc.linkWorkoutSession, call.args);
  if (error) throw new Error(error.message);
}

async function loadSets(sessionId: string): Promise<SessionSet[]> {
  const { data, error } = await db()
    .from('workout_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('position')
    .order('set_index');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    position: row.position,
    setIndex: row.set_index,
    weight: row.weight,
    reps: row.reps,
    done: row.done,
    durationSec: row.duration_sec ?? null,
    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
  }));
}

/** Persist a set. `weight` is in `weightUnit` and stored as kg. */
export async function updateSet(
  setId: string,
  patch: {
    weight?: string;
    reps?: string;
    done?: boolean;
    durationSec?: number | null;
    distanceKm?: number | null;
  },
  weightUnit: WeightUnit = 'kg',
): Promise<void> {
  const row: {
    weight?: string;
    reps?: string;
    done?: boolean;
    durationSec?: number | null;
    distanceKm?: number | null;
  } = {};
  if (patch.reps !== undefined) row.reps = patch.reps;
  if (patch.done !== undefined) row.done = patch.done;
  if (patch.durationSec !== undefined) row.durationSec = patch.durationSec;
  if (patch.distanceKm !== undefined) row.distanceKm = patch.distanceKm;
  if (patch.weight !== undefined) {
    const trimmed = patch.weight.trim();
    if (!trimmed) row.weight = '';
    else {
      const parsed = parseWeight(trimmed);
      row.weight = parsed == null ? trimmed : String(toStoredKg(parsed, weightUnit));
    }
  }
  const call = updateWorkoutSetCall(setId, row);
  const { error } = await db().rpc(rpc.updateWorkoutSet, call.args);
  if (error) throw new Error(error.message);
}

export async function rewriteSessionExercises(input: {
  sessionId: string;
  householdId: string;
  userId: string;
  exercises: { exerciseId: string; name: string; targetSets: number; targetReps: string }[];
  records: Record<string, ExerciseRecord>;
}): Promise<SessionSet[]> {
  const rows = input.exercises.flatMap((exercise, position) =>
    Array.from({ length: exercise.targetSets }, (_, setIndex) => ({
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.name,
      position,
      set_index: setIndex,
      weight: input.records[exercise.exerciseId]?.lastWeight ?? '',
      reps: exercise.targetReps,
      done: false,
    })),
  );
  const call = rewriteSessionSetsCall(input.sessionId, rows);
  const { error } = await db().rpc(rpc.rewriteSessionSets, call.args);
  if (error) throw new Error(error.message);
  return loadSets(input.sessionId);
}

export async function replaceSessionExercise(input: {
  sessionId: string;
  position: number;
  exerciseId: string;
  name: string;
  lastWeight: string;
}): Promise<void> {
  const call = replaceSessionExerciseCall({
    sessionId: input.sessionId,
    position: input.position,
    exerciseId: input.exerciseId,
    name: input.name,
    weight: input.lastWeight,
  });
  const { error } = await db().rpc(rpc.replaceSessionExercise, call.args);
  if (error) throw new Error(error.message);
}

/** Append one exercise (N sets) to a live session without rewriting existing sets. */
export async function appendSessionExercise(input: {
  sessionId: string;
  householdId: string;
  userId: string;
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: string;
  lastWeight?: string;
}): Promise<SessionSet[]> {
  const existing = await loadSets(input.sessionId);
  const nextPosition =
    existing.length === 0 ? 0 : Math.max(...existing.map((set) => set.position)) + 1;
  const sets = Math.max(1, Math.min(20, Math.round(input.targetSets)));
  const rows = Array.from({ length: sets }, (_, setIndex) => ({
    exercise_id: input.exerciseId,
    exercise_name: input.name,
    position: nextPosition,
    set_index: setIndex,
    weight: input.lastWeight ?? '',
    reps: input.targetReps,
    done: false,
  }));
  const call = appendWorkoutSetCall(input.sessionId, rows);
  const { error } = await db().rpc(rpc.appendWorkoutSet, call.args);
  if (error) throw new Error(error.message);
  return loadSets(input.sessionId);
}

/** Remove one exercise slot (all its sets) from a live session. */
export async function removeSessionExercise(input: {
  sessionId: string;
  position: number;
}): Promise<SessionSet[]> {
  const call = deleteWorkoutSetsAtPositionCall(input.sessionId, input.position);
  const { error } = await db().rpc(rpc.deleteWorkoutSetsAtPosition, call.args);
  if (error) throw new Error(error.message);
  return loadSets(input.sessionId);
}

/** Swap one exercise with its neighbor in a live session. */
export async function moveSessionExercise(input: {
  sessionId: string;
  position: number;
  direction: -1 | 1;
}): Promise<SessionSet[]> {
  const existing = await loadSets(input.sessionId);
  const positions = [...new Set(existing.map((set) => set.position))].sort((a, b) => a - b);
  const index = positions.indexOf(input.position);
  const target = index + input.direction;
  if (index < 0 || target < 0 || target >= positions.length) return existing;
  const call = moveSessionExerciseCall(input.sessionId, input.position, input.direction);
  const { error } = await db().rpc(rpc.moveSessionExercise, call.args);
  if (error) throw new Error(error.message);
  return loadSets(input.sessionId);
}

/** Append one set to an exercise in a live session. */
export async function addSessionSet(input: {
  sessionId: string;
  householdId: string;
  userId: string;
  position: number;
}): Promise<SessionSet[]> {
  const existing = await loadSets(input.sessionId);
  const group = existing
    .filter((set) => set.position === input.position)
    .sort((a, b) => a.setIndex - b.setIndex);
  const last = group[group.length - 1];
  if (!last || group.length >= 20) return existing;
  const call = appendWorkoutSetCall(input.sessionId, [
    {
      exercise_id: last.exerciseId,
      exercise_name: last.exerciseName,
      position: input.position,
      set_index: last.setIndex + 1,
      weight: last.weight,
      reps: last.reps,
      done: false,
      duration_sec: last.durationSec,
      distance_km: last.distanceKm,
    },
  ]);
  const { error } = await db().rpc(rpc.appendWorkoutSet, call.args);
  if (error) throw new Error(error.message);
  return loadSets(input.sessionId);
}

/** Remove the last set from an exercise (keeps at least one). */
export async function removeSessionSet(input: {
  sessionId: string;
  position: number;
}): Promise<SessionSet[]> {
  const existing = await loadSets(input.sessionId);
  const group = existing
    .filter((set) => set.position === input.position)
    .sort((a, b) => a.setIndex - b.setIndex);
  if (group.length <= 1) return existing;
  const last = group[group.length - 1]!;
  const call = deleteWorkoutSetCall(last.id);
  const { error } = await db().rpc(rpc.deleteWorkoutSet, call.args);
  if (error) throw new Error(error.message);
  return loadSets(input.sessionId);
}

export async function saveWorkoutUserNotes(input: {
  workoutId: string;
  userId: string;
  householdId: string;
  notes: WorkoutUserNote[];
}): Promise<void> {
  const notesToKeep = input.notes
    .map((note) => ({ position: note.position, body: note.body.trim().slice(0, 280) }))
    .filter((note) => note.body.length > 0);
  const { error: deleteError } = await db().from('workout_user_notes').delete().eq('workout_id', input.workoutId).eq('user_id', input.userId);
  if (deleteError) throw deleteError;
  if (notesToKeep.length === 0) return;
  const { error } = await db()
    .from('workout_user_notes')
    .insert(
      notesToKeep.map((note) => ({
        workout_id: input.workoutId,
        user_id: input.userId,
        household_id: input.householdId,
        exercise_position: note.position,
        body: note.body,
        updated_at: new Date().toISOString(),
      })),
    );
  if (error) throw error;
}

export async function saveWorkoutRating(input: {
  workoutId: string;
  userId: string;
  householdId: string;
  score: number | null;
}): Promise<void> {
  if (input.score === null) {
    const { error } = await db().from('workout_ratings').delete().eq('workout_id', input.workoutId).eq('user_id', input.userId);
    if (error) throw error;
    return;
  }
  const { error } = await db().from('workout_ratings').upsert({
    workout_id: input.workoutId,
    user_id: input.userId,
    household_id: input.householdId,
    score: input.score,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function finishSession(input: {
  sessionId: string;
  userId: string;
  sets: SessionSet[];
  records: Record<string, ExerciseRecord>;
  workoutId?: string | null;
}): Promise<void> {
  const groups = new Map<string, SessionSet[]>();
  for (const set of input.sets) {
    if (!set.exerciseId) continue;
    const group = groups.get(set.exerciseId) ?? [];
    group.push(set);
    groups.set(set.exerciseId, group);
  }
  for (const [exerciseId, sets] of groups) {
    // Time / intervals / distance sets are not weight×reps PRs.
    const strengthSets = sets.filter((set) => set.durationSec == null && set.distanceKm == null);
    const update = applyLoggedSets(input.records[exerciseId] ?? null, strengthSets);
    if (!update) continue;
    const { error } = await db().from('exercise_records').upsert({
      user_id: input.userId,
      exercise_id: exerciseId,
      last_weight: update.lastWeight,
      last_reps: update.lastReps,
      best_weight: update.bestWeight,
      best_reps: update.bestReps,
    });
    if (error) throw new Error(error.message);
  }
  // Finish + mark plan day done (idempotent) inside security-definer RPC.
  const call = finishWorkoutSessionCall(input.sessionId);
  const { error } = await db().rpc(rpc.finishWorkoutSession, call.args);
  if (error) throw new Error(error.message);
}

export async function loadHistoryDedupeKeys(
  userId: string,
  householdId: string,
): Promise<{ name: string; startedAt: string }[]> {
  const { data, error } = await db()
    .from('workout_sessions')
    .select('name, started_at')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .not('finished_at', 'is', null);
  if (error) throw error;
  return (data ?? []).map((row) => ({ name: row.name, startedAt: row.started_at }));
}

/** Write a finished session from Hevy/Strong history import. Weights already stored kg. */
export async function importFinishedSession(input: {
  householdId: string;
  userId: string;
  workoutId: string | null;
  name: string;
  startedAt: string;
  finishedAt: string | null;
  durationMin: number | null;
  exercises: {
    exerciseId: string | null;
    name: string;
    sets: {
      weightKg: number | null;
      reps: string | null;
      durationSec: number | null;
      distanceKm?: number | null;
    }[];
  }[];
}): Promise<string> {
  const finishedAt =
    input.finishedAt ??
    (input.durationMin != null
      ? new Date(Date.parse(input.startedAt) + input.durationMin * 60000).toISOString()
      : input.startedAt);
  const { data, error } = await db()
    .from('workout_sessions')
    .insert({
      household_id: input.householdId,
      user_id: input.userId,
      workout_id: input.workoutId,
      name: input.name,
      started_at: input.startedAt,
      finished_at: finishedAt,
      duration_min: input.durationMin,
    })
    .select('id')
    .single();
  if (error) throw error;

  const rows = input.exercises.flatMap((exercise, position) =>
    exercise.sets.map((set, setIndex) => ({
      session_id: data.id,
      household_id: input.householdId,
      user_id: input.userId,
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.name,
      position,
      set_index: setIndex,
      weight: set.weightKg != null ? String(set.weightKg) : '',
      reps: set.reps ?? (set.durationSec != null ? String(set.durationSec) : ''),
      duration_sec: set.durationSec ?? null,
      distance_km: set.distanceKm ?? null,
      done: true,
    })),
  );
  if (rows.length > 0) {
    const { error: setError } = await db().from('workout_sets').insert(rows);
    if (setError) throw setError;
  }
  return data.id;
}

export async function loadGeneratePrefs(userId: string): Promise<Record<string, unknown>> {
  const prefs = await loadTrainPrefs(userId);
  return prefs.generatePrefs;
}

export async function saveGeneratePrefs(userId: string, prefs: Record<string, unknown>): Promise<void> {
  const result = await handleSaveGeneratePrefs(db() as never, {
    userId,
    authUserId: userId,
    prefs,
  });
  if (result.status !== 200) throw new Error(result.body.error);
}

export async function deleteTrainingPlan(userId: string, planId: string): Promise<void> {
  const result = await handleDeleteTrainingPlan(db() as never, {
    authUserId: userId,
    planId,
  });
  if (result.status !== 200) throw new Error(result.body.error);
}

export async function addTrainingPlanDay(input: {
  userId: string;
  planId: string;
  day: Day;
  focus?: string[];
  durationMin?: number | null;
}): Promise<{ id: string; day: Day; position: number; focus: string[]; durationMin: number | null }> {
  const result = await handleAddTrainingPlanDay(db() as never, {
    authUserId: input.userId,
    planId: input.planId,
    day: input.day,
    focus: input.focus,
    durationMin: input.durationMin,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return result.body;
}

export async function applyGeneratedTrainingPlan(input: {
  householdId: string;
  userId: string;
  name?: string;
  weekStart: string;
  visibility: TrainVisibility;
  audiencePersonIds?: string[];
  buddyUserIds?: string[];
  prefs?: Record<string, unknown>;
  days: (GeneratedTrainDay & { scheduledTime?: string | null; workoutName?: string | null })[];
  /** When true (default), replace any owned plan for this week instead of stacking. */
  replaceExisting?: boolean;
}): Promise<{ planId: string; workoutIds: Record<string, string> }> {
  if (input.replaceExisting !== false) {
    const existing = await listTrainingPlansByWeek(input.householdId, input.weekStart, input.userId);
    for (const plan of existing) {
      if (plan.ownerId === input.userId) {
        await deleteTrainingPlan(input.userId, plan.id);
      }
    }
  }

  const audiencePersonIds =
    input.visibility === 'people' ? (input.audiencePersonIds ?? []) : [];
  const { data: createdPlanId, error: createError } = await db().rpc(rpc.createTrainingPlan, {
    p_household_id: input.householdId,
    p_week_start: input.weekStart,
    p_name: (input.name ?? 'Training plan').trim() || 'Training plan',
    p_visibility: input.visibility,
    p_audience_person_ids: audiencePersonIds,
    p_prefs: input.prefs ?? {},
  });
  if (createError) {
    const detail = createError.message?.trim();
    if (/row-level security|permission|not a member|not authenticated/i.test(detail || '')) {
      throw new Error(detail ? `Not allowed to create this training plan (${detail})` : 'Not allowed to create this training plan');
    }
    throw new Error(detail || 'Could not create training plan');
  }
  if (!createdPlanId || typeof createdPlanId !== 'string') {
    throw new Error('Could not create training plan');
  }

  const result = await handleApplyTrainingPlan(db() as never, {
    householdId: input.householdId,
    ownerId: input.userId,
    authUserId: input.userId,
    name: input.name,
    weekStart: input.weekStart,
    visibility: input.visibility,
    audiencePersonIds: input.audiencePersonIds,
    buddyUserIds: input.buddyUserIds,
    prefs: input.prefs,
    days: input.days,
    planId: createdPlanId,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return result.body;
}

export type { TrainingPlanWeekRow, TrainingPlanDayStatus, RegenerateRemainingPreviewDay };

export async function listTrainingPlansByWeek(
  householdId: string,
  weekStart: string,
  userId: string,
): Promise<TrainingPlanWeekRow[]> {
  const result = await handleListTrainingPlansByWeek(db() as never, {
    householdId,
    weekStart,
    authUserId: userId,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return result.body.plans;
}

export async function updateTrainingPlanVisibility(input: {
  userId: string;
  planId: string;
  visibility: TrainVisibility;
  audiencePersonIds?: string[];
  buddyUserIds?: string[];
}): Promise<void> {
  const result = await handleUpdateTrainingPlanVisibility(db() as never, {
    authUserId: input.userId,
    planId: input.planId,
    visibility: input.visibility,
    audiencePersonIds: input.audiencePersonIds,
    buddyUserIds: input.buddyUserIds,
  });
  if (result.status !== 200) throw new Error(result.body.error);
}

export async function copySharedTrainingPlan(input: {
  householdId: string;
  userId: string;
  name: string;
  weekStart: string;
  days: Array<{
    day: import('@kinexus/domain').Day;
    restDay: boolean;
    focus: string[];
    durationMin: number | null;
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      tracking?: TrackingType | null;
      targetUnit?: TargetUnit | null;
      targetDurationSec?: number | null;
      targetDistanceKm?: number | null;
      effort: string | null;
      rpe: number | null;
      note: string;
      supersetId: string | null;
    }>;
  }>;
}): Promise<{ planId: string }> {
  const result = await handleCopySharedTrainingPlan(db() as never, {
    householdId: input.householdId,
    ownerId: input.userId,
    authUserId: input.userId,
    name: input.name,
    weekStart: input.weekStart,
    days: input.days,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return { planId: result.body.planId };
}

/** Copy a shared plan day's workout into the buddy household, link via train-together, return local workout id. */
export async function trainTogetherOnPlanDay(input: {
  householdId: string;
  userId: string;
  ownerId: string;
  workoutId: string;
}): Promise<{ workoutId: string }> {
  const workout = await loadWorkoutById(input.workoutId);
  if (!workout) throw new Error('Workout not found');
  const resolved = await resolveExercisesForWorkoutCopy({
    exercises: workout.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      targetEffort: exercise.targetEffort,
      targetRpe: exercise.targetRpe,
      note: exercise.note,
      supersetId: exercise.supersetId,
    })),
    userId: input.userId,
    householdId: input.householdId,
  });
  const copyId = await createWorkout({
    householdId: input.householdId,
    userId: input.userId,
    name: workout.name,
    visibility: 'private',
    splitId: null,
    durationMin: workout.durationMin,
    personIds: [],
    exercises: resolved.exercises,
  });

  const { inviteTrainTogether } = await import('@/src/features/train/buddies-api');
  await inviteTrainTogether({
    workoutId: copyId,
    inviteeIds: [input.ownerId],
  });

  return { workoutId: copyId };
}

export async function setTrainingPlanDayStatus(input: {
  userId: string;
  dayId: string;
  status: TrainingPlanDayStatus;
  sessionId?: string | null;
}): Promise<void> {
  const result = await handleSetTrainingPlanDayStatus(db() as never, {
    authUserId: input.userId,
    dayId: input.dayId,
    status: input.status,
    sessionId: input.sessionId,
  });
  if (result.status !== 200) throw new Error(result.body.error);
}

export async function attachWorkoutToPlanDay(input: {
  userId: string;
  dayId: string;
  workoutId: string | null;
}): Promise<void> {
  const result = await handleAttachWorkoutToPlanDay(db() as never, {
    authUserId: input.userId,
    dayId: input.dayId,
    workoutId: input.workoutId,
  });
  if (result.status !== 200) throw new Error(result.body.error);
}

/** Create an empty workout for an intent day and attach it. Returns the workout id. */
export async function ensurePlanDayWorkout(input: {
  householdId: string;
  userId: string;
  dayId: string;
  name: string;
  durationMin: number | null;
  existingWorkoutId?: string | null;
}): Promise<string> {
  if (input.existingWorkoutId) return input.existingWorkoutId;
  const workoutId = await createWorkout({
    householdId: input.householdId,
    userId: input.userId,
    name: input.name.trim() || 'Train',
    visibility: 'private',
    splitId: null,
    durationMin: input.durationMin,
    planOnly: true,
    personIds: [],
    exercises: [],
  });
  await attachWorkoutToPlanDay({
    userId: input.userId,
    dayId: input.dayId,
    workoutId,
  });
  return workoutId;
}

/**
 * Build a workout from the exercise library for a plan day's session type and attach it.
 * Replaces an existing attached workout's exercises when one is already linked.
 */
export async function fillPlanDayFromLibrary(input: {
  householdId: string;
  userId: string;
  dayId: string;
  focus: string[];
  durationMin: number | null;
  existingWorkoutId?: string | null;
  goal?: TrainGlobalGoal | null;
  level?: TrainGlobalLevel | null;
  equipment?: string[];
  catalogue?: CatalogExercise[];
}): Promise<{ workoutId: string; exerciseCount: number }> {
  const focusLabel = input.focus[0]?.trim() || 'Train';
  const sessionTypeId = sessionTypeIdFromFocus(focusLabel);
  if (!sessionTypeId) {
    throw new Error('No matching exercises');
  }

  const catalogue = (input.catalogue ?? (await loadLibrary())).filter((ex) => {
    const row = ex as Partial<LibraryExercise>;
    if (row.status == null && row.mergedInto == null) return true;
    return isPickableLibraryExercise({
      status: row.status ?? 'active',
      mergedInto: row.mergedInto ?? null,
    });
  });
  const equipmentPool =
    input.equipment && input.equipment.length > 0
      ? catalogue.filter((ex) => {
          const eq = (ex.equipment || '').trim().toLowerCase();
          if (!eq || eq === 'body weight' || eq === 'bodyweight') {
            return input.equipment!.some((item) => {
              const value = item.trim().toLowerCase();
              return value === 'bodyweight' || value === 'body weight' || value === eq;
            });
          }
          return input.equipment!.some((item) => {
            const value = item.trim().toLowerCase();
            return eq.includes(value) || value.includes(eq);
          });
        })
      : catalogue;
  // Prefer equipment filter; fall back to full catalogue when the filtered pool is too thin.
  const pool = canFillSessionType(sessionTypeId, equipmentPool) ? equipmentPool : catalogue;

  const filled = fillWorkoutFromSessionTypeWidened({
    sessionTypeId,
    durationMin: input.durationMin ?? 40,
    catalogue: pool,
    goal: input.goal ?? undefined,
    level: input.level ?? undefined,
    seed: Date.now() % 1_000_000,
  });
  if (filled.length === 0) {
    throw new Error('No matching exercises');
  }

  const exercises: WorkoutExerciseInput[] = filled.map((ex) => ({
    exerciseId: ex.exerciseId,
    name: ex.name,
    tracking: ex.tracking,
    targetUnit: ex.targetUnit,
    targetSets: ex.targetSets,
    targetReps: ex.targetReps,
    targetDurationSec: ex.targetDurationSec,
    targetDistanceKm: ex.targetDistanceKm,
    targetRpe: ex.targetRpe,
  }));

  let workoutId = input.existingWorkoutId ?? null;
  if (workoutId) {
    await saveWorkout(workoutId, input.householdId, {
      name: focusLabel,
      visibility: 'private',
      splitId: null,
      durationMin: input.durationMin,
      goal: input.goal ?? null,
      level: input.level ?? null,
      personIds: [],
      exercises,
    });
    const { error: planOnlyError } = await db()
      .from('workouts')
      .update({ plan_only: true })
      .eq('id', workoutId);
    if (planOnlyError) throw new Error(planOnlyError.message);
  } else {
    workoutId = await createWorkout({
      householdId: input.householdId,
      userId: input.userId,
      name: focusLabel,
      visibility: 'private',
      splitId: null,
      durationMin: input.durationMin,
      goal: input.goal ?? null,
      level: input.level ?? null,
      planOnly: true,
      personIds: [],
      exercises,
    });
    await attachWorkoutToPlanDay({
      userId: input.userId,
      dayId: input.dayId,
      workoutId,
    });
  }

  return { workoutId, exerciseCount: exercises.length };
}

export async function duplicateTrainingPlanToNextWeek(userId: string, planId: string): Promise<{ planId: string; weekStart: string }> {
  const result = await handleDuplicateTrainingPlanToNextWeek(db() as never, {
    authUserId: userId,
    planId,
    pushToGoogle: pushHouseholdEventToGoogle,
    deleteFromGoogle: deleteHouseholdEventFromGoogle,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return result.body;
}

export async function regenerateRemainingTrainingDays(input: {
  userId: string;
  planId: string;
  catalogue: readonly CatalogExercise[];
  savedWorkouts?: readonly SavedWorkoutCandidate[];
  seed?: number;
  confirm: boolean;
}): Promise<{
  planId: string;
  remainingDays: string[];
  lockedDays: string[];
  preview: RegenerateRemainingPreviewDay[];
  applied: boolean;
}> {
  const result = await handleRegenerateRemainingDays(db() as never, {
    authUserId: input.userId,
    planId: input.planId,
    catalogue: input.catalogue,
    savedWorkouts: input.savedWorkouts,
    seed: input.seed,
    confirm: input.confirm,
    pushToGoogle: pushHouseholdEventToGoogle,
    deleteFromGoogle: deleteHouseholdEventFromGoogle,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return result.body;
}

export async function addTrainingPlanDayToCalendar(userId: string, dayId: string): Promise<{
  eventId: string;
  usedDefaultTime: boolean;
  created: boolean;
}> {
  const result = await handleUpsertTrainingPlanDayEvent(db() as never, {
    authUserId: userId,
    dayId,
    force: true,
    pushToGoogle: pushHouseholdEventToGoogle,
    deleteFromGoogle: deleteHouseholdEventFromGoogle,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return {
    eventId: result.body.eventId,
    usedDefaultTime: result.body.usedDefaultTime,
    created: result.body.created,
  };
}

export async function addTrainingPlanToCalendar(userId: string, planId: string): Promise<{
  usedDefaultTimeDays: string[];
}> {
  const result = await handleSyncTrainingPlanToCalendar(db() as never, {
    authUserId: userId,
    planId,
    force: true,
    pushToGoogle: pushHouseholdEventToGoogle,
    deleteFromGoogle: deleteHouseholdEventFromGoogle,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return { usedDefaultTimeDays: result.body.usedDefaultTimeDays };
}

export async function setTrainingPlanCalendarAutoSync(
  userId: string,
  planId: string,
  calendarAutoSync: boolean,
): Promise<void> {
  const result = await handleSetTrainingPlanCalendarAutoSync(db() as never, {
    authUserId: userId,
    planId,
    calendarAutoSync,
    pushToGoogle: pushHouseholdEventToGoogle,
    deleteFromGoogle: deleteHouseholdEventFromGoogle,
  });
  if (result.status !== 200) throw new Error(result.body.error);
}

export async function updateTrainingPlanDaySchedule(input: {
  userId: string;
  dayId: string;
  scheduledTime?: string | null;
  durationMin?: number | null;
  day?: TrainingPlanWeekRow['days'][number]['day'];
  restDay?: boolean;
  focus?: string[];
}): Promise<{ synced: boolean; usedDefaultTime: boolean }> {
  const result = await handleUpdateTrainingPlanDaySchedule(db() as never, {
    authUserId: input.userId,
    dayId: input.dayId,
    scheduledTime: input.scheduledTime,
    durationMin: input.durationMin,
    day: input.day,
    restDay: input.restDay,
    focus: input.focus,
    pushToGoogle: pushHouseholdEventToGoogle,
    deleteFromGoogle: deleteHouseholdEventFromGoogle,
  });
  if (result.status !== 200) throw new Error(result.body.error);
  return { synced: result.body.synced, usedDefaultTime: result.body.usedDefaultTime };
}

export async function removeTrainingPlanDayFromCalendar(userId: string, dayId: string): Promise<void> {
  const result = await handleRemoveTrainingPlanDayEvent(db() as never, {
    authUserId: userId,
    dayId,
    deleteFromGoogle: deleteHouseholdEventFromGoogle,
  });
  if (result.status !== 200) throw new Error(result.body.error);
}

function icsDaysFromPlan(plan: TrainingPlanWeekRow, dayIds?: string[]): PlanIcsDay[] {
  return plan.days
    .filter((day) => (!dayIds || dayIds.includes(day.id)) && !day.restDay)
    .map((day) => ({
      id: day.id,
      day: day.day,
      restDay: day.restDay,
      focus: day.focus,
      scheduledTime: day.scheduledTime,
      durationMin: day.durationMin,
    }));
}

export async function downloadTrainingPlanIcs(plan: TrainingPlanWeekRow, dayIds?: string[]): Promise<void> {
  const days = icsDaysFromPlan(plan, dayIds);
  if (days.length === 0) throw new Error('No workout days to export');
  const text = buildTrainingPlanIcs({
    planId: plan.id,
    planName: plan.name,
    weekStart: plan.weekStart,
    days,
  });
  const suffix = dayIds?.length === 1 ? `-${days[0]?.day ?? 'day'}` : '';
  await shareOrDownloadExport({
    fileName: `kinexus-plan-${plan.weekStart}${suffix}.ics`,
    mimeType: 'text/calendar',
    text,
    bytes: null,
  });
}

