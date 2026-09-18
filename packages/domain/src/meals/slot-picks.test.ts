import { describe, expect, it } from 'vitest';

import { recipesForSlot } from './generate-plan';
import {
  approvedRecipeIds,
  approvedRecipeIdsForLibraryFilter,
  personHasApprovedList,
  recipesForPicker,
} from './slot-picks';
import type { Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

const oats = recipe({ id: 'oats', name: 'Oats', mealSlots: ['breakfast'] });
const pasta = recipe({ id: 'pasta', name: 'Pasta', mealSlots: ['dinner'] });
const soup = recipe({ id: 'soup', name: 'Soup', mealSlots: ['lunch'] });
const stock = recipe({ id: 'stock', name: 'Stock', isComponent: true, mealSlots: ['dinner'] });
const gone = recipe({ id: 'gone', name: 'Gone', removed: true, mealSlots: ['dinner'] });

const approvals = [
  { personId: 'leo', slotKey: 'dinner' as const, recipeId: 'pasta' },
  { personId: 'leo', slotKey: 'lunch' as const, recipeId: 'soup' },
  { personId: 'charlie', slotKey: 'dinner' as const, recipeId: 'oats' },
];

describe('approvedRecipeIds', () => {
  it('filters by person and optional slot', () => {
    expect([...approvedRecipeIds(approvals, 'leo')].sort()).toEqual(['pasta', 'soup']);
    expect([...approvedRecipeIds(approvals, 'leo', 'dinner')]).toEqual(['pasta']);
    expect(personHasApprovedList(approvals, 'leo')).toBe(true);
    expect(personHasApprovedList(approvals, 'mia')).toBe(false);
  });

  it('unions snack slots for the library snack filter', () => {
    const snackApprovals = [
      { personId: 'leo', slotKey: 'morning_snack' as const, recipeId: 'a' },
      { personId: 'leo', slotKey: 'afternoon_snack' as const, recipeId: 'b' },
      { personId: 'leo', slotKey: 'dinner' as const, recipeId: 'c' },
    ];
    expect([...approvedRecipeIdsForLibraryFilter(snackApprovals, 'leo', 'snack')].sort()).toEqual(['a', 'b']);
    expect([...approvedRecipeIdsForLibraryFilter(snackApprovals, 'leo', 'all')].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('recipesForPicker', () => {
  const library = [oats, pasta, soup, stock, gone];

  it('uses the slot pool when there is no allowlist', () => {
    expect(recipesForPicker(library, 'dinner').map((r) => r.id)).toEqual(
      recipesForSlot(library, 'dinner').map((r) => r.id),
    );
  });

  it('restricts to the allowlist with no library fallback', () => {
    expect(recipesForPicker(library, 'dinner', new Set(['pasta', 'gone', 'stock'])).map((r) => r.id)).toEqual([
      'pasta',
    ]);
    expect(recipesForPicker(library, 'dinner', new Set(['oats'])).map((r) => r.id)).toEqual(['oats']);
    expect(recipesForPicker(library, 'dinner', new Set())).toEqual([]);
  });
});
