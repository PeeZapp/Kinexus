import { trainSessionTypeById, type TrainSessionTypeId } from './session-types';

export const JOINT_SESSION_INVITE_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type JointSessionInviteStatus = (typeof JOINT_SESSION_INVITE_STATUSES)[number];

export const JOINT_SESSION_STATUSES = ['open', 'resolved', 'cancelled'] as const;
export type JointSessionStatus = (typeof JOINT_SESSION_STATUSES)[number];

export type JointSessionVote = {
  userId: string;
  sessionTypeId: string | null;
  workoutId: string | null;
};

export type JointSessionResolveResult =
  | { kind: 'resolved'; sessionTypeId: string; workoutId: string | null }
  | { kind: 'tie'; sessionTypeIds: string[] }
  | { kind: 'no_picks' };

/**
 * Votes = invitor preference + accepted invitees who picked a session type.
 * Blank accepts do not vote. Unique max wins; ties return tie; no buddy picks → no_picks.
 */
export function resolveJointSessionVotes(input: {
  inviterId: string;
  inviterSessionTypeId: string;
  inviterWorkoutId: string | null;
  /** Accepted members only (invitees + optional inviter row ignored for picks). */
  acceptedPicks: readonly JointSessionVote[];
}): JointSessionResolveResult {
  const buddyPicks = input.acceptedPicks.filter(
    (row) => row.userId !== input.inviterId && row.sessionTypeId,
  );

  if (buddyPicks.length === 0) {
    return { kind: 'no_picks' };
  }

  const votes: JointSessionVote[] = [
    {
      userId: input.inviterId,
      sessionTypeId: input.inviterSessionTypeId,
      workoutId: input.inviterWorkoutId,
    },
    ...buddyPicks.map((row) => ({
      userId: row.userId,
      sessionTypeId: row.sessionTypeId,
      workoutId: row.workoutId,
    })),
  ];

  const typeCounts = new Map<string, number>();
  for (const vote of votes) {
    if (!vote.sessionTypeId) continue;
    typeCounts.set(vote.sessionTypeId, (typeCounts.get(vote.sessionTypeId) ?? 0) + 1);
  }

  let bestCount = 0;
  const leaders: string[] = [];
  for (const [typeId, count] of typeCounts) {
    if (count > bestCount) {
      bestCount = count;
      leaders.length = 0;
      leaders.push(typeId);
    } else if (count === bestCount) {
      leaders.push(typeId);
    }
  }

  if (leaders.length !== 1) {
    return { kind: 'tie', sessionTypeIds: leaders };
  }

  const winnerType = leaders[0]!;
  const workoutCounts = new Map<string, number>();
  for (const vote of votes) {
    if (vote.sessionTypeId !== winnerType || !vote.workoutId) continue;
    workoutCounts.set(vote.workoutId, (workoutCounts.get(vote.workoutId) ?? 0) + 1);
  }

  let bestWorkoutCount = 0;
  const workoutLeaders: string[] = [];
  for (const [workoutId, count] of workoutCounts) {
    if (count > bestWorkoutCount) {
      bestWorkoutCount = count;
      workoutLeaders.length = 0;
      workoutLeaders.push(workoutId);
    } else if (count === bestWorkoutCount) {
      workoutLeaders.push(workoutId);
    }
  }

  const workoutId = workoutLeaders.length === 1 ? workoutLeaders[0]! : null;
  return { kind: 'resolved', sessionTypeId: winnerType, workoutId };
}

/** Primary focus = first estimate focus; match if it sits in any selected session type's categories. */
export function workoutMatchesSessionTypes(
  primaryFocuses: readonly string[],
  sessionTypeIds: readonly string[],
): boolean {
  const primary = primaryFocuses[0]?.trim();
  if (!primary) return false;
  const allowed = new Set<string>();
  for (const id of sessionTypeIds) {
    const row = trainSessionTypeById(id);
    if (!row) continue;
    for (const category of row.categories) allowed.add(category.toLowerCase());
  }
  if (allowed.size === 0) return false;
  return allowed.has(primary.toLowerCase());
}

/**
 * Best offered session type for a workout's focuses.
 * Primary focus must land in the type's categories; secondary overlaps and tighter types win ties.
 */
export function bestSessionTypeForFocuses(
  focuses: readonly string[],
  sessionTypeIds: readonly string[],
): string | null {
  const normalized = focuses.map((item) => item.trim().toLowerCase()).filter(Boolean);
  const primary = normalized[0];
  if (!primary || sessionTypeIds.length === 0) return null;

  let best: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const id of sessionTypeIds) {
    const row = trainSessionTypeById(id);
    if (!row) continue;
    const cats = row.categories.map((category) => category.toLowerCase());
    if (!cats.includes(primary)) continue;
    let score = 100;
    for (let i = 1; i < normalized.length; i += 1) {
      if (cats.includes(normalized[i]!)) score += Math.max(1, 10 - i);
    }
    // Prefer more specific session types when scores otherwise match.
    score -= cats.length;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

export function jointSessionPlanLabel(input: {
  resolvedSessionTypeId: string | null;
  resolvedWorkoutName: string | null;
  buddyNames: readonly string[];
}): string {
  const withWhom =
    input.buddyNames.length === 0
      ? 'buddies'
      : input.buddyNames.length === 1
        ? input.buddyNames[0]!
        : input.buddyNames.length === 2
          ? `${input.buddyNames[0]} & ${input.buddyNames[1]}`
          : `${input.buddyNames[0]} +${input.buddyNames.length - 1}`;

  if (input.resolvedWorkoutName?.trim()) {
    return `${input.resolvedWorkoutName.trim()} · with ${withWhom}`;
  }
  if (input.resolvedSessionTypeId) {
    const label = trainSessionTypeById(input.resolvedSessionTypeId)?.label ?? input.resolvedSessionTypeId;
    return `${label} · with ${withWhom}`;
  }
  return `Session with ${withWhom}`;
}

export function jointSessionAlertMessage(input: {
  missingSessionType: boolean;
  missingWorkout: boolean;
}): string {
  if (input.missingSessionType) {
    return 'Session accepted but no session type picked. You can choose one.';
  }
  if (input.missingWorkout) {
    return 'Session accepted but no workout picked. You can choose one.';
  }
  return 'Session accepted. You can lock in the details.';
}

export function isTrainSessionTypeIdList(ids: readonly string[]): ids is TrainSessionTypeId[] {
  return ids.length > 0 && ids.every((id) => Boolean(trainSessionTypeById(id)));
}
