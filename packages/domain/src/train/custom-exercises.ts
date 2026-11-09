import {
  exerciseMatchConfidence,
  MATCH_NEEDS_CONFIRM,
  rankExerciseMatches,
} from '../lists/match-exercise';

export const EXERCISE_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number];

export const EXERCISE_SCOPES = ['private', 'household', 'group', 'global'] as const;
export type ExerciseScope = (typeof EXERCISE_SCOPES)[number];

export const EXERCISE_SOURCE_BADGES = ['kinexus', 'family', 'group', 'mine', 'creator'] as const;
export type ExerciseSourceBadge = (typeof EXERCISE_SOURCE_BADGES)[number];

export const EXERCISE_SOURCE_BADGE_LABEL: Record<ExerciseSourceBadge, string> = {
  kinexus: 'Kinexus',
  family: 'Family',
  group: 'Group',
  mine: 'Mine',
  creator: 'Creator ✓',
};

export type DuplicateExerciseCandidate = {
  id: string;
  name: string;
  confidence: number;
};

/** Fuzzy “Did you mean…?” suggestions against the visible catalogue. */
export function findDuplicateExerciseSuggestions(
  name: string,
  catalog: readonly { id: string; name: string }[],
  limit = 5,
): DuplicateExerciseCandidate[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  return rankExerciseMatches(trimmed, catalog, limit)
    .filter((row) => row.confidence >= MATCH_NEEDS_CONFIRM)
    .map((row) => ({
      id: row.exerciseId,
      name: row.name,
      confidence: row.confidence,
    }));
}

export function isLikelyDuplicateName(
  name: string,
  catalog: readonly { id: string; name: string }[],
): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  for (const row of catalog) {
    if (exerciseMatchConfidence(trimmed, row.name) >= 0.9) return true;
  }
  return false;
}

export type PromoteExerciseTarget =
  | { scope: 'private' }
  | { scope: 'household'; householdId: string }
  | { scope: 'group'; groupId: string };

export type PromoteExercisePatch = {
  scope: 'private' | 'household' | 'group';
  household_id: string | null;
  group_id: string | null;
};

/** Client update payload when promoting a custom exercise between private/family/group. */
export function promoteExercisePatch(target: PromoteExerciseTarget): PromoteExercisePatch {
  if (target.scope === 'private') {
    return { scope: 'private', household_id: null, group_id: null };
  }
  if (target.scope === 'household') {
    return { scope: 'household', household_id: target.householdId, group_id: null };
  }
  return { scope: 'group', household_id: null, group_id: target.groupId };
}

export function canPromoteExercise(opts: {
  source: string;
  scope: ExerciseScope;
  ownerId: string | null;
  userId: string;
  householdRole: string | null;
  canEditGroup: boolean;
}): boolean {
  if (opts.source !== 'user' && opts.source !== 'creator') return false;
  if (opts.scope === 'global') return false;
  if (opts.ownerId === opts.userId) return true;
  if (
    opts.scope === 'household' &&
    (opts.householdRole === 'owner' || opts.householdRole === 'admin')
  ) {
    return true;
  }
  if (opts.scope === 'group' && opts.canEditGroup) return true;
  return false;
}

export type ArchiveExerciseCall = {
  rpc: 'archive_exercise';
  args: { p_exercise_id: string };
};

export type PublishGlobalExerciseCall = {
  rpc: 'publish_global_exercise';
  args: { p_source_exercise_id: string };
};

export function archiveExerciseCall(exerciseId: string): ArchiveExerciseCall {
  return { rpc: 'archive_exercise', args: { p_exercise_id: exerciseId } };
}

export function publishGlobalExerciseCall(exerciseId: string): PublishGlobalExerciseCall {
  return { rpc: 'publish_global_exercise', args: { p_source_exercise_id: exerciseId } };
}

export type ShareCopyExerciseRow = {
  id: string;
  name: string;
  scope: ExerciseScope;
  ownerId: string | null;
  householdId: string | null;
  source: string;
};

export type ShareCopyWorkoutExercise = {
  exerciseId: string | null;
  name: string;
};

export type ShareCopyPlanItem =
  | { kind: 'keep'; exerciseId: string | null; name: string }
  | { kind: 'copy'; sourceExerciseId: string; name: string }
  | { kind: 'replace'; sourceExerciseId: string | null; name: string };

/**
 * When copying a shared workout, remount private/group (or invisible) exercises
 * into the recipient’s private scope, or flag a replacement prompt.
 */
export function planSharedWorkoutExerciseCopy(opts: {
  exercises: readonly ShareCopyWorkoutExercise[];
  byId: ReadonlyMap<string, ShareCopyExerciseRow>;
  recipientUserId: string;
  recipientHouseholdId: string | null;
}): ShareCopyPlanItem[] {
  return opts.exercises.map((exercise) => {
    const id = exercise.exerciseId;
    if (!id) return { kind: 'keep', exerciseId: null, name: exercise.name };

    const row = opts.byId.get(id);
    if (!row) {
      return { kind: 'replace', sourceExerciseId: id, name: exercise.name };
    }

    if (row.scope === 'global') {
      return { kind: 'keep', exerciseId: id, name: exercise.name };
    }

    if (row.ownerId === opts.recipientUserId) {
      return { kind: 'keep', exerciseId: id, name: exercise.name };
    }

    if (
      row.scope === 'household' &&
      opts.recipientHouseholdId &&
      row.householdId === opts.recipientHouseholdId
    ) {
      return { kind: 'keep', exerciseId: id, name: exercise.name };
    }

    if (row.scope === 'private' || row.scope === 'group') {
      return { kind: 'copy', sourceExerciseId: id, name: row.name || exercise.name };
    }

    // Visible but not owned household of another home — ask for a replacement.
    return { kind: 'replace', sourceExerciseId: id, name: exercise.name };
  });
}

export function exerciseSourceBadge(opts: {
  scope: ExerciseScope;
  source: string;
}): ExerciseSourceBadge {
  if (opts.scope === 'household') return 'family';
  if (opts.scope === 'group') return 'group';
  if (opts.scope === 'private') return 'mine';
  if (opts.source === 'creator') return 'creator';
  return 'kinexus';
}

export function isExerciseDifficulty(value: string): value is ExerciseDifficulty {
  return (EXERCISE_DIFFICULTIES as readonly string[]).includes(value);
}
