import type {
  CatalogExercise,
  EffortLevel,
  ExerciseRecord,
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
  TrainVisibility,
  WeightUnit,
} from '@kinexus/domain';
import {
  applyLoggedSets,
  buildTrainingPlanIcs,
  effortLevelFrom,
  formatWeight,
  handleApplyTrainingPlan,
  handleDuplicateTrainingPlanToNextWeek,
  handleListTrainingPlansByWeek,
  handleMarkTrainingPlanDayFromSession,
  handleRegenerateRemainingDays,
  handleRemoveTrainingPlanDayEvent,
  handleSaveGeneratePrefs,
  handleSetTrainingPlanCalendarAutoSync,
  handleSetTrainingPlanDayStatus,
  handleSyncTrainingPlanToCalendar,
  handleUpdateTrainingPlanDaySchedule,
  handleUpsertTrainingPlanDayEvent,
  isFamilyPlanShare,
  isTrainGlobalGoal,
  isTrainGlobalLevel,
  isTrainVisibility,
  normalizeTrainGlobalEquipment,
  parseWeight,
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
import { supabase } from '@/src/lib/supabase';

type ExerciseRow = Database['public']['Tables']['exercises']['Row'];
type WorkoutRow = Database['public']['Tables']['workouts']['Row'];

export type LibraryExercise = CatalogExercise & {
  mediaUrl: string | null;
  mediaUrls: string[];
  mediaKind: 'gif' | 'image' | null;
  source: ExerciseRow['source'];
  license: string;
  licenseAuthor: string | null;
  instructions: string[];
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string | null;
  name: string;
  position: number;
  targetSets: number;
  targetReps: string;
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
  targetSets: number;
  targetReps: string;
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
};

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

function rpeFromDb(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function mapExercise(row: ExerciseRow): LibraryExercise {
  return {
    id: row.id,
    name: row.name,
    bodyPart: row.body_part,
    equipment: row.equipment,
    targetMuscle: row.target_muscle,
    mediaUrl: row.media_url,
    mediaUrls: row.media_urls?.length ? row.media_urls : row.media_url ? [row.media_url] : [],
    mediaKind: row.media_kind,
    source: row.source,
    license: row.license,
    licenseAuthor: row.license_author,
    instructions: row.instructions ?? [],
  };
}

export async function loadLibrary(): Promise<LibraryExercise[]> {
  const rows: ExerciseRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('exercises')
      .select('*')
      .order('name')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows.map(mapExercise);
}

export async function loadWorkouts(householdId: string): Promise<WorkoutDraft[]> {
  const { data, error } = await db()
    .from('workouts')
    .select('*, workout_exercises(*), workout_people(person_id), workout_buddy_shares(buddy_user_id)')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false });
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
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    splitId: row.split_id,
    durationMin: row.duration_min,
    createdBy: row.created_by,
    shareToken: row.share_token,
    isShared: Boolean(row.is_shared),
    level: mapGlobalLevel(row.level),
    goal: mapGlobalGoal(row.goal),
    equipment: normalizeTrainGlobalEquipment(row.equipment),
    sourceWorkoutId: row.source_workout_id,
    sourceCreatorId: row.source_creator_id,
    personIds: (row.workout_people ?? []).map((person) => person.person_id),
    buddyUserIds: (row.workout_buddy_shares ?? []).map((share) => share.buddy_user_id),
    ratings: ratingsByWorkout.get(row.id) ?? [],
    notes: notesByWorkout.get(row.id) ?? [],
    exercises: [...(row.workout_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exercise_id,
        name: exercise.name,
        position: exercise.position,
        targetSets: exercise.target_sets,
        targetReps: exercise.target_reps,
        targetWeight: exercise.target_weight,
        targetEffort: effortLevelFrom(exercise.target_effort),
        targetRpe: rpeFromDb(exercise.target_rpe),
        note: exercise.note ?? '',
        supersetId: exercise.superset_id ?? null,
      })),
  }));
}

export async function loadWorkoutById(workoutId: string): Promise<WorkoutDraft | null> {
  const { data, error } = await db()
    .from('workouts')
    .select('*, workout_exercises(*), workout_people(person_id), workout_buddy_shares(buddy_user_id)')
    .eq('id', workoutId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    visibility: data.visibility,
    splitId: data.split_id,
    durationMin: data.duration_min,
    createdBy: data.created_by,
    shareToken: data.share_token,
    isShared: Boolean(data.is_shared),
    level: mapGlobalLevel(data.level),
    goal: mapGlobalGoal(data.goal),
    equipment: normalizeTrainGlobalEquipment(data.equipment),
    sourceWorkoutId: data.source_workout_id,
    sourceCreatorId: data.source_creator_id,
    personIds: (data.workout_people ?? []).map((person) => person.person_id),
    buddyUserIds: (data.workout_buddy_shares ?? []).map((share) => share.buddy_user_id),
    ratings: [],
    notes: [],
    exercises: [...(data.workout_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exercise_id,
        name: exercise.name,
        position: exercise.position,
        targetSets: exercise.target_sets,
        targetReps: exercise.target_reps,
        targetWeight: exercise.target_weight,
        targetEffort: effortLevelFrom(exercise.target_effort),
        targetRpe: rpeFromDb(exercise.target_rpe),
        note: exercise.note ?? '',
        supersetId: exercise.superset_id ?? null,
      })),
  };
}

/** Workouts shared to the signed-in user by buddies (any household). */
export async function loadBuddySharedWorkouts(): Promise<WorkoutDraft[]> {
  const { data, error } = await db()
    .from('workouts')
    .select('*, workout_exercises(*), workout_people(person_id), workout_buddy_shares(buddy_user_id)')
    .in('visibility', ['buddies', 'buddies_selected', 'global'])
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    visibility: row.visibility,
    splitId: row.split_id,
    durationMin: row.duration_min,
    createdBy: row.created_by,
    shareToken: row.share_token,
    isShared: Boolean(row.is_shared),
    level: mapGlobalLevel(row.level),
    goal: mapGlobalGoal(row.goal),
    equipment: normalizeTrainGlobalEquipment(row.equipment),
    sourceWorkoutId: row.source_workout_id,
    sourceCreatorId: row.source_creator_id,
    personIds: (row.workout_people ?? []).map((person) => person.person_id),
    buddyUserIds: (row.workout_buddy_shares ?? []).map((share) => share.buddy_user_id),
    ratings: [],
    notes: [],
    exercises: [...(row.workout_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exercise_id,
        name: exercise.name,
        position: exercise.position,
        targetSets: exercise.target_sets,
        targetReps: exercise.target_reps,
        targetWeight: exercise.target_weight,
        targetEffort: effortLevelFrom(exercise.target_effort),
        targetRpe: rpeFromDb(exercise.target_rpe),
        note: exercise.note ?? '',
        supersetId: exercise.superset_id ?? null,
      })),
  }));
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
  personIds: string[];
  buddyUserIds?: string[];
  exercises: WorkoutExerciseInput[];
}): Promise<string> {
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
    })
    .select('id')
    .single();
  if (error) throw error;
  await replaceWorkoutChildren(
    data.id,
    input.householdId,
    input.visibility,
    input.personIds,
    input.buddyUserIds ?? [],
    input.exercises,
  );
  return data.id;
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
  if (deleteExercises) throw deleteExercises;
  if (exercises.length > 0) {
    const { error } = await db()
      .from('workout_exercises')
      .insert(
        exercises.map((exercise, position) => ({
          workout_id: workoutId,
          household_id: householdId,
          exercise_id: exercise.exerciseId,
          name: exercise.name,
          position,
          target_sets: exercise.targetSets,
          target_reps: exercise.targetReps,
          target_weight: exercise.targetWeight ?? null,
          target_effort: exercise.targetEffort ?? null,
          target_rpe: exercise.targetRpe ?? null,
          note: (exercise.note ?? '').trim().slice(0, 160),
          superset_id: exercise.supersetId ?? null,
        })),
      );
    if (error) throw error;
  }
  const { error: deletePeople } = await db().from('workout_people').delete().eq('workout_id', workoutId);
  if (deletePeople) throw deletePeople;
  if (visibility === 'people' && personIds.length > 0) {
    const { error } = await db()
      .from('workout_people')
      .insert(personIds.map((personId) => ({ workout_id: workoutId, person_id: personId, household_id: householdId })));
    if (error) throw error;
  }
  const { error: deleteBuddies } = await db().from('workout_buddy_shares').delete().eq('workout_id', workoutId);
  if (deleteBuddies) throw deleteBuddies;
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
    if (error) throw error;
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
}): Promise<string> {
  return createWorkout({
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
  });
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
        .map((exercise) => ({
          id: exercise.id,
          exerciseId: exercise.exercise_id,
          name: exercise.name,
          position: exercise.position,
          targetSets: exercise.target_sets,
          targetReps: exercise.target_reps,
          targetWeight: exercise.target_weight,
          targetEffort: effortLevelFrom(exercise.target_effort),
          targetRpe: rpeFromDb(exercise.target_rpe),
          note: exercise.note ?? '',
          supersetId: exercise.superset_id ?? null,
        })),
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
}): Promise<string> {
  return createWorkout({
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
  });
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

export async function clearOpenSession(userId: string, workoutId: string): Promise<void> {
  const { error } = await db()
    .from('workout_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('workout_id', workoutId)
    .is('finished_at', null);
  if (error) throw error;
}

export async function openSession(input: {
  householdId: string;
  userId: string;
  workout: WorkoutDraft;
  records: Record<string, ExerciseRecord>;
}): Promise<{ sessionId: string; sets: SessionSet[] }> {
  const { data: existing, error: existingError } = await db()
    .from('workout_sessions')
    .select('id')
    .eq('user_id', input.userId)
    .eq('workout_id', input.workout.id)
    .is('finished_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const sets = await loadSets(existing.id);
    return { sessionId: existing.id, sets };
  }
  const { data, error } = await db()
    .from('workout_sessions')
    .insert({
      household_id: input.householdId,
      user_id: input.userId,
      workout_id: input.workout.id,
      name: input.workout.name,
    })
    .select('id')
    .single();
  if (error) throw error;
  const rows = input.workout.exercises.flatMap((exercise) =>
    Array.from({ length: exercise.targetSets }, (_, setIndex) => ({
      session_id: data.id,
      household_id: input.householdId,
      user_id: input.userId,
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.name,
      position: exercise.position,
      set_index: setIndex,
      weight: exercise.exerciseId
        ? input.records[exercise.exerciseId]?.lastWeight ||
          (exercise.targetWeight != null ? String(exercise.targetWeight) : '') ||
          ''
        : exercise.targetWeight != null
          ? String(exercise.targetWeight)
          : '',
      reps: exercise.targetReps,
      done: false,
    })),
  );
  if (rows.length > 0) {
    const { error: setError } = await db().from('workout_sets').insert(rows);
    if (setError) throw setError;
  }
  return { sessionId: data.id, sets: await loadSets(data.id) };
}

export async function startRemixSession(input: {
  householdId: string;
  userId: string;
  name: string;
  remixSpec: string;
  durationMin: number;
  exercises: { exerciseId: string; name: string; targetSets: number; targetReps: string }[];
}): Promise<string> {
  const records = await loadRecords(
    input.userId,
    input.exercises.map((exercise) => exercise.exerciseId),
  );
  const { data, error } = await db()
    .from('workout_sessions')
    .insert({
      household_id: input.householdId,
      user_id: input.userId,
      name: input.name,
      remix_spec: input.remixSpec,
      duration_min: input.durationMin,
    })
    .select('id')
    .single();
  if (error) throw error;
  const rows = input.exercises.flatMap((exercise, position) =>
    Array.from({ length: exercise.targetSets }, (_, setIndex) => ({
      session_id: data.id,
      household_id: input.householdId,
      user_id: input.userId,
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.name,
      position,
      set_index: setIndex,
      weight: records[exercise.exerciseId]?.lastWeight ?? '',
      reps: exercise.targetReps,
      done: false,
    })),
  );
  if (rows.length > 0) {
    const { error: setError } = await db().from('workout_sets').insert(rows);
    if (setError) throw setError;
  }
  return data.id;
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
  const { error } = await db().from('workout_sessions').update({ workout_id: workoutId, name }).eq('id', sessionId);
  if (error) throw error;
}

async function loadSets(sessionId: string): Promise<SessionSet[]> {
  const { data, error } = await db()
    .from('workout_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('position')
    .order('set_index');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    position: row.position,
    setIndex: row.set_index,
    weight: row.weight,
    reps: row.reps,
    done: row.done,
  }));
}

/** Persist a set. `weight` is in `weightUnit` and stored as kg. */
export async function updateSet(
  setId: string,
  patch: { weight?: string; reps?: string; done?: boolean },
  weightUnit: WeightUnit = 'kg',
): Promise<void> {
  const row: { weight?: string; reps?: string; done?: boolean } = {};
  if (patch.reps !== undefined) row.reps = patch.reps;
  if (patch.done !== undefined) row.done = patch.done;
  if (patch.weight !== undefined) {
    const trimmed = patch.weight.trim();
    if (!trimmed) row.weight = '';
    else {
      const parsed = parseWeight(trimmed);
      row.weight = parsed == null ? trimmed : String(toStoredKg(parsed, weightUnit));
    }
  }
  const { error } = await db().from('workout_sets').update(row).eq('id', setId);
  if (error) throw error;
}

export async function rewriteSessionExercises(input: {
  sessionId: string;
  householdId: string;
  userId: string;
  exercises: { exerciseId: string; name: string; targetSets: number; targetReps: string }[];
  records: Record<string, ExerciseRecord>;
}): Promise<SessionSet[]> {
  const { error: deleteError } = await db().from('workout_sets').delete().eq('session_id', input.sessionId);
  if (deleteError) throw deleteError;
  const rows = input.exercises.flatMap((exercise, position) =>
    Array.from({ length: exercise.targetSets }, (_, setIndex) => ({
      session_id: input.sessionId,
      household_id: input.householdId,
      user_id: input.userId,
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.name,
      position,
      set_index: setIndex,
      weight: input.records[exercise.exerciseId]?.lastWeight ?? '',
      reps: exercise.targetReps,
      done: false,
    })),
  );
  if (rows.length > 0) {
    const { error } = await db().from('workout_sets').insert(rows);
    if (error) throw error;
  }
  return loadSets(input.sessionId);
}

export async function replaceSessionExercise(input: {
  sessionId: string;
  position: number;
  exerciseId: string;
  name: string;
  lastWeight: string;
}): Promise<void> {
  const { error } = await db()
    .from('workout_sets')
    .update({
      exercise_id: input.exerciseId,
      exercise_name: input.name,
      weight: input.lastWeight,
      done: false,
    })
    .eq('session_id', input.sessionId)
    .eq('position', input.position);
  if (error) throw error;
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
    const update = applyLoggedSets(input.records[exerciseId] ?? null, sets);
    if (!update) continue;
    const { error } = await db().from('exercise_records').upsert({
      user_id: input.userId,
      exercise_id: exerciseId,
      last_weight: update.lastWeight,
      last_reps: update.lastReps,
      best_weight: update.bestWeight,
      best_reps: update.bestReps,
    });
    if (error) throw error;
  }
  const { error } = await db().from('workout_sessions').update({ finished_at: new Date().toISOString() }).eq('id', input.sessionId);
  if (error) throw error;

  let workoutId = input.workoutId ?? null;
  if (!workoutId) {
    const { data } = await db().from('workout_sessions').select('workout_id').eq('id', input.sessionId).maybeSingle();
    workoutId = data?.workout_id ?? null;
  }
  const marked = await handleMarkTrainingPlanDayFromSession(db() as never, {
    authUserId: input.userId,
    sessionId: input.sessionId,
    workoutId,
  });
  if (marked.status !== 200 && marked.status !== 403) {
    throw new Error(marked.body.error);
  }
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
    sets: { weightKg: number | null; reps: string | null; durationSec: number | null }[];
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

export async function applyGeneratedTrainingPlan(input: {
  householdId: string;
  userId: string;
  name?: string;
  weekStart: string;
  visibility: TrainVisibility;
  audiencePersonIds?: string[];
  buddyUserIds?: string[];
  prefs?: Record<string, unknown>;
  days: (GeneratedTrainDay & { scheduledTime?: string | null })[];
}): Promise<{ planId: string; workoutIds: Record<string, string> }> {
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
}): Promise<{ synced: boolean; usedDefaultTime: boolean }> {
  const result = await handleUpdateTrainingPlanDaySchedule(db() as never, {
    authUserId: input.userId,
    dayId: input.dayId,
    scheduledTime: input.scheduledTime,
    durationMin: input.durationMin,
    day: input.day,
    restDay: input.restDay,
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

