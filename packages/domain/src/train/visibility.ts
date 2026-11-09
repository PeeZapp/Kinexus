import type { HouseholdRole } from '../household/types';
import { buddyCan, type TrainBuddyPermissions, type TrainBuddyStatus } from './buddies';

export const TRAIN_VISIBILITIES = [
  'private',
  'household',
  'people',
  'buddies',
  'buddies_selected',
  'global',
] as const;

export type TrainVisibility = (typeof TRAIN_VISIBILITIES)[number];

export type TrainVisibilityOption = {
  value: TrainVisibility;
  label: string;
  icon: string;
};

export const TRAIN_VISIBILITY_OPTIONS: readonly TrainVisibilityOption[] = [
  { value: 'private', label: 'Only me', icon: '●' },
  { value: 'household', label: 'Family', icon: '◎' },
  { value: 'buddies', label: 'Buddies', icon: '◇' },
  { value: 'buddies_selected', label: 'Pick buddies', icon: '◆' },
  { value: 'global', label: 'Everyone', icon: '○' },
];

export const FAMILY_PLAN_SHARES = ['off', 'plan', 'plan_activity'] as const;
export type FamilyPlanShare = (typeof FAMILY_PLAN_SHARES)[number];

export function isTrainVisibility(value: string): value is TrainVisibility {
  return (TRAIN_VISIBILITIES as readonly string[]).includes(value);
}

export function isFamilyPlanShare(value: string): value is FamilyPlanShare {
  return (FAMILY_PLAN_SHARES as readonly string[]).includes(value);
}

/** UI picker options; Everyone only when verified creator. Legacy `people` kept if already set. */
export function trainVisibilityOptions(opts: {
  isApprovedCreator: boolean;
  includePeople?: boolean;
  current?: TrainVisibility | null;
}): TrainVisibilityOption[] {
  const base = TRAIN_VISIBILITY_OPTIONS.filter((option) => {
    if (option.value === 'global') return opts.isApprovedCreator;
    return true;
  });

  if (opts.includePeople || opts.current === 'people') {
    return [
      ...base.slice(0, 2),
      { value: 'people', label: 'People', icon: '▣' },
      ...base.slice(2),
    ];
  }
  return [...base];
}

export function trainVisibilityLabel(visibility: TrainVisibility): string {
  if (visibility === 'people') return 'People';
  return TRAIN_VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ?? visibility;
}

export function normalizeTrainShare(
  visibility: TrainVisibility,
  personIds: readonly string[],
  buddyUserIds: readonly string[],
): { visibility: TrainVisibility; personIds: string[]; buddyUserIds: string[] } {
  if (visibility === 'people') {
    return { visibility, personIds: [...new Set(personIds)], buddyUserIds: [] };
  }
  if (visibility === 'buddies_selected') {
    return { visibility, personIds: [], buddyUserIds: [...new Set(buddyUserIds)] };
  }
  return { visibility, personIds: [], buddyUserIds: [] };
}

export function resolveDefaultWorkoutVisibility(opts: {
  preferred: TrainVisibility | null | undefined;
  isApprovedCreator: boolean;
}): TrainVisibility {
  const preferred = opts.preferred && isTrainVisibility(opts.preferred) ? opts.preferred : 'private';
  if (preferred === 'global' && !opts.isApprovedCreator) return 'private';
  return preferred;
}

export type WorkoutVisibilityAccess = {
  viewerId: string | null;
  ownerId: string | null;
  visibility: TrainVisibility;
  householdMember: boolean;
  householdRole: HouseholdRole | null;
  sharedWithViewer: boolean;
  buddySharedWithViewer: boolean;
  buddyStatus: TrainBuddyStatus | null | undefined;
  buddyPermissions: Partial<TrainBuddyPermissions> | null | undefined;
};

/**
 * Domain mirror of can_view_workout (household people + buddies + blocks).
 * Owner/admin household override matches can_view_shared.
 */
export function canViewWorkoutVisibility(opts: WorkoutVisibilityAccess): boolean {
  const viewer = opts.viewerId;
  if (!viewer) return false;
  if (opts.ownerId && opts.ownerId === viewer) return true;

  if (opts.visibility === 'global') return true;

  if (opts.householdMember) {
    if (opts.householdRole === 'owner' || opts.householdRole === 'admin') return true;
    if (opts.visibility === 'household') return true;
    if (opts.visibility === 'people' && opts.sharedWithViewer) return true;
  }

  if (opts.visibility === 'buddies') {
    return buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_view_workouts');
  }

  if (opts.visibility === 'buddies_selected') {
    return (
      opts.buddySharedWithViewer &&
      buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_view_workouts')
    );
  }

  return false;
}

export function canEditWorkoutVisibility(opts: WorkoutVisibilityAccess): boolean {
  const viewer = opts.viewerId;
  if (!viewer) return false;
  if (opts.ownerId && opts.ownerId === viewer) {
    if (!opts.householdMember) return false;
    if (opts.householdRole === 'child') return false;
    return true;
  }

  if (!opts.householdMember) {
    if (opts.visibility === 'buddies' || opts.visibility === 'buddies_selected') {
      const listed =
        opts.visibility === 'buddies' || (opts.visibility === 'buddies_selected' && opts.buddySharedWithViewer);
      return listed && buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_coedit_shared');
    }
    return false;
  }

  if (opts.householdRole === 'owner' || opts.householdRole === 'admin') return true;
  if (opts.householdRole === 'adult') return canViewWorkoutVisibility(opts);
  if (opts.householdRole === 'teen') return opts.ownerId === viewer;
  return false;
}

export function canCopySharedWorkout(opts: {
  buddyStatus: TrainBuddyStatus | null | undefined;
  buddyPermissions: Partial<TrainBuddyPermissions> | null | undefined;
}): boolean {
  return buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_copy_workouts');
}

export type TrainingPlanVisibilityAccess = {
  viewerId: string | null;
  ownerId: string | null;
  visibility: TrainVisibility;
  householdMember: boolean;
  householdRole: HouseholdRole | null;
  sharedWithViewer: boolean;
  buddySharedWithViewer: boolean;
  buddyStatus: TrainBuddyStatus | null | undefined;
  buddyPermissions: Partial<TrainBuddyPermissions> | null | undefined;
  /** Owner's family_plan_share pref (plan | plan_activity enables household read). */
  familyPlanShare?: FamilyPlanShare | null;
  isApprovedCreator?: boolean;
};

/** Domain mirror of can_view_training_plan (buddies use can_view_plan). */
export function canViewTrainingPlanVisibility(opts: TrainingPlanVisibilityAccess): boolean {
  const viewer = opts.viewerId;
  if (!viewer) return false;
  if (opts.ownerId && opts.ownerId === viewer) return true;

  if (opts.visibility === 'global') return true;

  if (opts.householdMember) {
    if (opts.householdRole === 'owner' || opts.householdRole === 'admin') return true;
    if (opts.visibility === 'household') return true;
    if (opts.visibility === 'people' && opts.sharedWithViewer) return true;
    if (opts.familyPlanShare === 'plan' || opts.familyPlanShare === 'plan_activity') return true;
  }

  if (opts.visibility === 'buddies') {
    return buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_view_plan');
  }

  if (opts.visibility === 'buddies_selected') {
    return (
      opts.buddySharedWithViewer &&
      buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_view_plan')
    );
  }

  return false;
}

/** Everyone publish requires owner + verified creator (mirrors training_plan_global_publish_guard). */
export function canPublishTrainingPlanGlobal(opts: {
  ownerId: string | null;
  actorId: string | null;
  isApprovedCreator: boolean;
}): boolean {
  if (!opts.ownerId || !opts.actorId) return false;
  return opts.ownerId === opts.actorId && opts.isApprovedCreator;
}

export function canViewSessionVisibility(opts: {
  viewerId: string | null;
  ownerId: string | null;
  buddyStatus: TrainBuddyStatus | null | undefined;
  buddyPermissions: Partial<TrainBuddyPermissions> | null | undefined;
  householdMember: boolean;
  householdRole: HouseholdRole | null;
  familyPlanShare: FamilyPlanShare;
}): boolean {
  if (!opts.viewerId) return false;
  if (opts.ownerId === opts.viewerId) return true;
  if (buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_view_sessions')) return true;
  if (
    opts.householdMember &&
    opts.familyPlanShare === 'plan_activity' &&
    opts.householdRole !== 'child'
  ) {
    return true;
  }
  return false;
}

/** Weights / set loads stay owner-only unless sessions or PRs are explicitly allowed. */
export function canViewWorkoutWeights(opts: {
  viewerId: string | null;
  ownerId: string | null;
  buddyStatus: TrainBuddyStatus | null | undefined;
  buddyPermissions: Partial<TrainBuddyPermissions> | null | undefined;
  householdRole: HouseholdRole | null;
  familyPlanShare: FamilyPlanShare;
}): boolean {
  if (!opts.viewerId || !opts.ownerId) return false;
  if (opts.ownerId === opts.viewerId) return true;
  if (buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_view_sessions')) return true;
  if (buddyCan(opts.buddyStatus, opts.buddyPermissions, 'can_view_prs')) return true;
  if (
    opts.familyPlanShare === 'plan_activity' &&
    opts.householdRole !== 'child' &&
    opts.householdRole !== 'teen'
  ) {
    return true;
  }
  return false;
}

export function allowedFamilyPlanShares(role: HouseholdRole | null | undefined): FamilyPlanShare[] {
  if (role === 'child') return ['off', 'plan'];
  return ['off', 'plan', 'plan_activity'];
}
