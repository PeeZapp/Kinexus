import { isRemixCategory, remixCategoryOf } from './remix';
import { inferTracking, isTargetUnit, type TargetUnit } from './tracking';
import type { CatalogExercise } from './types';

/** Join codes: 6 chars, uppercase, no 0/O/1/I. */
export const GROUP_WORKOUT_JOIN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export type GroupWorkoutStatus = 'picking' | 'closed' | 'built' | 'cancelled';

export type GroupWorkoutOrderPick = {
  id: string;
  userId: string;
  exerciseId: string;
  category: string;
  name?: string;
  canonicalKey?: string | null;
  instructions?: string[] | null;
  targetUnit?: TargetUnit | null;
  createdAt?: string;
};

export type GroupWorkoutDueGroup = {
  closesAt: string | Date;
  picksPerPerson: number;
  status?: GroupWorkoutStatus;
};

export type GroupWorkoutDueMember = {
  userId: string;
};

export type GroupWorkoutDuePick = {
  userId: string;
};

/**
 * Ordering tiers for a shared session:
 * 0 compound / big-muscle strength (Legs, Back, Chest, Glutes, Full Body)
 * 1 Shoulders
 * 2 arms / isolation (Biceps, Triceps)
 * 3 Core
 * 4 other (Mobility, Plyometrics, …)
 * 5 Cardio / time / distance last
 */
export function groupPickTier(
  pick: GroupWorkoutOrderPick,
  catalogById?: ReadonlyMap<string, CatalogExercise>,
): number {
  const catalog = catalogById?.get(pick.exerciseId);
  const category =
    (catalog ? remixCategoryOf(catalog) : null) ??
    (isRemixCategory(pick.category) ? pick.category : pick.category);

  const unit: TargetUnit = isTargetUnit(pick.targetUnit)
    ? pick.targetUnit
    : inferTracking({
        name: pick.name ?? catalog?.name ?? '',
        category,
        canonicalKey: pick.canonicalKey ?? catalog?.canonicalKey,
        instructions: pick.instructions ?? catalog?.instructions,
      });

  if (unit === 'min' || unit === 'km' || unit === 'm' || category === 'Cardio') {
    return 5;
  }

  if (
    category === 'Legs' ||
    category === 'Back' ||
    category === 'Chest' ||
    category === 'Glutes' ||
    category === 'Full Body'
  ) {
    return 0;
  }
  if (category === 'Shoulders') return 1;
  if (category === 'Biceps' || category === 'Triceps') return 2;
  if (category === 'Core') return 3;
  return 4;
}

/**
 * Sensible shared order: strength compounds first → shoulders → arms → core →
 * other → cardio/time/distance last. Within a tier, keep each member's picks
 * together; ties are stable by createdAt then id.
 */
export function orderGroupPicks<T extends GroupWorkoutOrderPick>(
  picks: readonly T[],
  catalogById?: ReadonlyMap<string, CatalogExercise>,
): T[] {
  return [...picks].sort((a, b) => {
    const tierDiff = groupPickTier(a, catalogById) - groupPickTier(b, catalogById);
    if (tierDiff !== 0) return tierDiff;
    if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1;
    const aAt = a.createdAt ?? '';
    const bAt = b.createdAt ?? '';
    if (aAt !== bAt) return aAt < bAt ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}

/** Mirrors SQL close_group_workout_if_due: time passed OR every member used all picks. */
export function isGroupPickingDue(
  group: GroupWorkoutDueGroup,
  members: readonly GroupWorkoutDueMember[],
  picks: readonly GroupWorkoutDuePick[],
  now: Date | string | number = new Date(),
): boolean {
  if (group.status && group.status !== 'picking') return true;

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const closesMs = group.closesAt instanceof Date ? group.closesAt.getTime() : new Date(group.closesAt).getTime();
  if (Number.isFinite(closesMs) && nowMs >= closesMs) return true;

  if (members.length === 0) return false;

  const counts = new Map<string, number>();
  for (const member of members) counts.set(member.userId, 0);
  for (const pick of picks) {
    if (!counts.has(pick.userId)) continue;
    counts.set(pick.userId, (counts.get(pick.userId) ?? 0) + 1);
  }

  const need = Math.max(1, Math.min(10, Math.floor(group.picksPerPerson) || 1));
  for (const count of counts.values()) {
    if (count < need) return false;
  }
  return true;
}

export function generateJoinCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    const idx = Math.floor(random() * GROUP_WORKOUT_JOIN_ALPHABET.length) % GROUP_WORKOUT_JOIN_ALPHABET.length;
    code += GROUP_WORKOUT_JOIN_ALPHABET[idx] ?? '2';
  }
  return code;
}
