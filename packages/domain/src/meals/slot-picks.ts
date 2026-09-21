import { recipesForSlot } from './generate-plan';
import { recipeForHouseholdView } from './recipe-versions';
import type { MealSlotKey, Recipe } from './types';

export type PersonSlotApproval = {
  personId: string;
  slotKey: MealSlotKey;
  recipeId: string;
};

const SNACK_SLOTS: readonly MealSlotKey[] = ['morning_snack', 'afternoon_snack', 'night_snack'];

export function approvedRecipeIds(
  approvals: readonly PersonSlotApproval[],
  personId: string,
  slotKey?: MealSlotKey,
): Set<string> {
  const ids = new Set<string>();
  for (const row of approvals) {
    if (row.personId !== personId) continue;
    if (slotKey && row.slotKey !== slotKey) continue;
    ids.add(row.recipeId);
  }
  return ids;
}

export function approvedRecipeIdsForLibraryFilter(
  approvals: readonly PersonSlotApproval[],
  personId: string,
  filter: 'all' | MealSlotKey | 'snack',
): Set<string> {
  if (filter === 'all') return approvedRecipeIds(approvals, personId);
  if (filter === 'snack') {
    const ids = new Set<string>();
    for (const slot of SNACK_SLOTS) {
      for (const id of approvedRecipeIds(approvals, personId, slot)) ids.add(id);
    }
    return ids;
  }
  return approvedRecipeIds(approvals, personId, filter);
}

export function personHasApprovedList(
  approvals: readonly PersonSlotApproval[],
  personId: string,
): boolean {
  return approvals.some((row) => row.personId === personId);
}

/**
 * Recipes shown in a slot picker.
 * An allowlist is exact: no fallback to the rest of the library.
 */
export function recipesForPicker(
  recipes: readonly Recipe[],
  slot: MealSlotKey,
  approvedIds?: ReadonlySet<string> | null,
): Recipe[] {
  if (approvedIds) {
    const resolved = new Set(
      [...approvedIds]
        .map((id) => recipeForHouseholdView(recipes, id)?.id)
        .filter((id): id is string => Boolean(id)),
    );
    return recipes.filter((recipe) => resolved.has(recipe.id) && !recipe.removed && !recipe.isComponent);
  }
  return recipesForSlot(recipes, slot);
}
