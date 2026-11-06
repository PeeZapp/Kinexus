export const TRAIN_BUDDY_STATUSES = ['pending', 'accepted', 'blocked'] as const;
export type TrainBuddyStatus = (typeof TRAIN_BUDDY_STATUSES)[number];

export const TRAIN_BUDDY_PERMISSION_KEYS = [
  'can_view_plan',
  'can_view_workouts',
  'can_copy_workouts',
  'can_view_sessions',
  'can_view_prs',
  'can_coedit_shared',
] as const;

export type TrainBuddyPermissionKey = (typeof TRAIN_BUDDY_PERMISSION_KEYS)[number];

export type TrainBuddyPermissions = Record<TrainBuddyPermissionKey, boolean>;

export const TRAIN_BUDDY_PERMISSION_LABELS: Record<TrainBuddyPermissionKey, string> = {
  can_view_plan: 'View plan',
  can_view_workouts: 'View workouts',
  can_copy_workouts: 'Copy workouts',
  can_view_sessions: 'View sessions',
  can_view_prs: 'View PRs',
  can_coedit_shared: 'Co-edit shared',
};

export function defaultTrainBuddyPermissions(): TrainBuddyPermissions {
  return {
    can_view_plan: false,
    can_view_workouts: true,
    can_copy_workouts: true,
    can_view_sessions: false,
    can_view_prs: false,
    can_coedit_shared: false,
  };
}

export function isTrainBuddyPermissionKey(value: string): value is TrainBuddyPermissionKey {
  return (TRAIN_BUDDY_PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Mirror of SQL are_train_buddies: accepted only (blocked/pending/missing = false). */
export function areTrainBuddies(status: TrainBuddyStatus | null | undefined): boolean {
  return status === 'accepted';
}

/**
 * Mirror of SQL buddy_can.
 * Blocking / non-accepted connections hide everything both ways.
 */
export function buddyCan(
  status: TrainBuddyStatus | null | undefined,
  permissions: Partial<TrainBuddyPermissions> | null | undefined,
  permission: TrainBuddyPermissionKey,
): boolean {
  if (!areTrainBuddies(status)) return false;
  if (!permissions) return false;
  return permissions[permission] === true;
}

export function normalizeBuddyUsername(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('@')) return trimmed.slice(1).trim();
  return trimmed;
}
