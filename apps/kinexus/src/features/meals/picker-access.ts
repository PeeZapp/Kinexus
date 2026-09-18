import type { HouseholdPerson, HouseholdRole } from '@kinexus/domain';

export function canManageMealPlan(role: HouseholdRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function linkedPersonForUser(
  people: readonly HouseholdPerson[],
  userId: string | null | undefined,
): HouseholdPerson | null {
  if (!userId) return null;
  return people.find((person) => person.userId === userId) ?? null;
}

export function isRestrictedPicker(opts: {
  role: HouseholdRole | null;
  people?: readonly HouseholdPerson[];
  userId?: string | null;
}): boolean {
  return !canManageMealPlan(opts.role);
}

/** Members may only choose a recipe on a slot assigned to their linked person. Anyone = parents only. */
export function canEditSlot(opts: {
  role: HouseholdRole | null;
  people: readonly HouseholdPerson[];
  userId: string | null | undefined;
  assignedPersonId?: string | null;
}): boolean {
  if (canManageMealPlan(opts.role)) return true;
  const linked = linkedPersonForUser(opts.people, opts.userId);
  if (!linked || !opts.assignedPersonId) return false;
  return opts.assignedPersonId === linked.id;
}

export function personName(
  people: readonly HouseholdPerson[],
  personId: string | null | undefined,
): string | null {
  if (!personId) return null;
  return people.find((person) => person.id === personId)?.name ?? null;
}
