import type { CatalogExercise, ExerciseRecord, LoggedSet, RestExtra } from '@kinexus/domain';
import { applyLoggedSets } from '@kinexus/domain';

import type { Database } from '@kinexus/db';

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
  targetWeight: string;
  note: string;
  supersetId: string | null;
};

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
  personIds: string[];
  exercises: WorkoutExercise[];
  ratings: WorkoutRating[];
  notes: WorkoutUserNote[];
};

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
    .select('*, workout_exercises(*), workout_people(person_id)')
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
    personIds: (row.workout_people ?? []).map((person) => person.person_id),
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
        targetWeight: exercise.target_weight ?? '',
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
  personIds: string[];
  exercises: { exerciseId: string; name: string; targetSets: number; targetReps: string; targetWeight?: string; note?: string; supersetId?: string | null }[];
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
    })
    .select('id')
    .single();
  if (error) throw error;
  await replaceWorkoutChildren(data.id, input.householdId, input.visibility, input.personIds, input.exercises);
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
    personIds: string[];
    exercises: { exerciseId: string | null; name: string; targetSets: number; targetReps: string; targetWeight?: string; note?: string; supersetId?: string | null }[];
  },
): Promise<void> {
  const { error } = await db()
    .from('workouts')
    .update({
      name: draft.name.trim() || 'Workout',
      visibility: draft.visibility,
      split_id: draft.splitId,
      duration_min: draft.durationMin,
    })
    .eq('id', workoutId);
  if (error) throw error;
  await replaceWorkoutChildren(workoutId, householdId, draft.visibility, draft.personIds, draft.exercises);
}

async function replaceWorkoutChildren(
  workoutId: string,
  householdId: string,
  visibility: WorkoutRow['visibility'],
  personIds: string[],
  exercises: { exerciseId: string | null; name: string; targetSets: number; targetReps: string; targetWeight?: string; note?: string; supersetId?: string | null }[],
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
          target_weight: exercise.targetWeight?.trim() ?? '',
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
  const { data, error } = await db().from('user_train_prefs').select('rest_extra').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.rest_extra ?? 'off';
}

export async function saveRestExtra(userId: string, restExtra: RestExtra): Promise<void> {
  const { error } = await db().from('user_train_prefs').upsert({ user_id: userId, rest_extra: restExtra });
  if (error) throw error;
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
        ? input.records[exercise.exerciseId]?.lastWeight || exercise.targetWeight || ''
        : exercise.targetWeight || '',
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

export async function updateSet(setId: string, patch: { weight?: string; reps?: string; done?: boolean }): Promise<void> {
  const { error } = await db().from('workout_sets').update(patch).eq('id', setId);
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
}
