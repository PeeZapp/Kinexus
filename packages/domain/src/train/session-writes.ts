export type SessionSetWrite = {
  exercise_id: string | null;
  exercise_name: string;
  position: number;
  set_index: number;
  weight?: string;
  reps?: string;
  done?: boolean;
};

export function appendWorkoutSetCall(sessionId: string, sets: readonly SessionSetWrite[]) {
  return {
    rpc: 'append_workout_set' as const,
    args: { p_session_id: sessionId, p_sets: sets },
  };
}

export function updateWorkoutSetCall(
  setId: string,
  patch: { weight?: string; reps?: string; done?: boolean },
) {
  return {
    rpc: 'update_workout_set' as const,
    args: {
      p_set_id: setId,
      p_weight: patch.weight ?? null,
      p_reps: patch.reps ?? null,
      p_done: patch.done ?? null,
    },
  };
}

export function deleteWorkoutSetCall(setId: string) {
  return { rpc: 'delete_workout_set' as const, args: { p_set_id: setId } };
}

export function deleteWorkoutSetsAtPositionCall(sessionId: string, position: number) {
  return {
    rpc: 'delete_workout_sets_at_position' as const,
    args: { p_session_id: sessionId, p_position: position },
  };
}

export function moveSessionExerciseCall(sessionId: string, position: number, direction: -1 | 1) {
  return {
    rpc: 'move_session_exercise' as const,
    args: { p_session_id: sessionId, p_position: position, p_direction: direction },
  };
}

export function replaceSessionExerciseCall(input: {
  sessionId: string;
  position: number;
  exerciseId: string;
  name: string;
  weight?: string;
}) {
  return {
    rpc: 'replace_session_exercise' as const,
    args: {
      p_session_id: input.sessionId,
      p_position: input.position,
      p_exercise_id: input.exerciseId,
      p_name: input.name,
      p_weight: input.weight ?? '',
    },
  };
}

export function rewriteSessionSetsCall(sessionId: string, sets: readonly SessionSetWrite[]) {
  return {
    rpc: 'rewrite_session_sets' as const,
    args: { p_session_id: sessionId, p_sets: sets },
  };
}

export function linkWorkoutSessionCall(sessionId: string, workoutId: string, name: string) {
  return {
    rpc: 'link_workout_session' as const,
    args: { p_session_id: sessionId, p_workout_id: workoutId, p_name: name },
  };
}

export function finishWorkoutSessionCall(sessionId: string) {
  return {
    rpc: 'finish_workout_session' as const,
    args: { p_session_id: sessionId },
  };
}

export function abandonWorkoutSessionCall(sessionId: string) {
  return {
    rpc: 'abandon_workout_session' as const,
    args: { p_session_id: sessionId },
  };
}

const STALE_EMPTY_MS = 12 * 60 * 60 * 1000;

/** True when any set was marked done (a real logged set). */
export function sessionHasLoggedSets(sets: readonly { done: boolean }[]): boolean {
  return sets.some((set) => set.done);
}

/** Empty live sessions older than 12h should be abandoned quietly. */
export function isStaleEmptySession(input: {
  startedAt: string;
  hasLoggedSets: boolean;
  nowMs?: number;
}): boolean {
  if (input.hasLoggedSets) return false;
  const started = Date.parse(input.startedAt);
  if (!Number.isFinite(started)) return false;
  return (input.nowMs ?? Date.now()) - started >= STALE_EMPTY_MS;
}
