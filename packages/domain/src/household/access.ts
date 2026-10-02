import type { HouseholdRole } from './types';

export const ROLE_LABELS: Record<HouseholdRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  adult: 'Adult',
  teen: 'Teen',
  child: 'Child',
};

const BELOW_OWNER = ['admin', 'adult', 'teen', 'child'] as const;
const BELOW_ADMIN = ['adult', 'teen', 'child'] as const;

export type AssignableRole = (typeof BELOW_OWNER)[number];

export function roleLabel(role: HouseholdRole): string {
  return ROLE_LABELS[role];
}

export function canManageHousehold(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canInvite(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'adult';
}

export function inviteRoles(role: HouseholdRole | null | undefined): AssignableRole[] {
  if (role === 'owner' || role === 'admin') return [...BELOW_OWNER];
  if (role === 'adult') return [...BELOW_ADMIN];
  return [];
}

export function canChangeMemberRole(
  actor: HouseholdRole | null | undefined,
  target: HouseholdRole,
  next: HouseholdRole,
  isSelf: boolean,
): boolean {
  if (isSelf || target === 'owner' || next === 'owner') return false;
  if (actor === 'owner' || actor === 'admin') {
    return next === 'admin' || next === 'adult' || next === 'teen' || next === 'child';
  }
  if (actor === 'adult') {
    const targetLower = target === 'adult' || target === 'teen' || target === 'child';
    const nextLower = next === 'adult' || next === 'teen' || next === 'child';
    return targetLower && nextLower;
  }
  return false;
}

export function assignableRoles(
  actor: HouseholdRole | null | undefined,
  target: HouseholdRole,
  isSelf: boolean,
): AssignableRole[] {
  return BELOW_OWNER.filter((next) => canChangeMemberRole(actor, target, next, isSelf));
}

export function canRemoveMember(
  actor: HouseholdRole | null | undefined,
  target: HouseholdRole,
  isSelf: boolean,
): boolean {
  if (isSelf) return false;
  if (actor !== 'owner' && actor !== 'admin') return false;
  return target === 'adult' || target === 'teen' || target === 'child';
}

export function canViewFinances(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'adult';
}

export function canManageBudgetPlan(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canEnterBudgetAmounts(role: HouseholdRole | null | undefined): boolean {
  return canViewFinances(role);
}

export function canEditBudgetTxn(
  role: HouseholdRole | null | undefined,
  createdBy: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (canManageBudgetPlan(role)) return true;
  if (role !== 'adult' || !userId) return false;
  return createdBy === userId;
}

export function canEditFinanceRecords(role: HouseholdRole | null | undefined): boolean {
  return canViewFinances(role);
}

export function canDeleteFinanceRecords(role: HouseholdRole | null | undefined): boolean {
  return canManageBudgetPlan(role);
}

export type SharedAccess = {
  role: HouseholdRole | null;
  userId: string | null;
  personId: string | null;
  createdBy: string | null;
  visibility: 'household' | 'private' | 'people';
  personIds: readonly string[];
};

export function canSeeShared(opts: SharedAccess): boolean {
  if (opts.createdBy && opts.userId && opts.createdBy === opts.userId) return true;
  if (opts.visibility === 'private') return opts.role === 'owner';
  if (opts.role === 'owner' || opts.role === 'admin') return true;
  if (opts.visibility === 'household') return true;
  return Boolean(opts.personId && opts.personIds.includes(opts.personId));
}

/** Adults edit what they can see. Teens edit only what they created, unless household watchlists are allowed. */
export function canEditShared(opts: SharedAccess, teenEditsHousehold = false): boolean {
  if (
    opts.visibility === 'private' &&
    opts.role !== 'owner' &&
    !(opts.createdBy && opts.userId && opts.createdBy === opts.userId)
  ) {
    return false;
  }
  if (opts.role === 'owner' || opts.role === 'admin') return true;
  if (opts.role === 'adult') return canSeeShared(opts);
  if (opts.role === 'teen') {
    if (opts.createdBy && opts.userId && opts.createdBy === opts.userId) return true;
    return teenEditsHousehold && opts.visibility === 'household';
  }
  return false;
}

export function canCreateShared(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'adult' || role === 'teen';
}
