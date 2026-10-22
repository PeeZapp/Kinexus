import { describe, expect, it } from 'vitest';

import { linkedRecipeForIngredient, recipeNameKey } from './recipe-class';
import type { Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

describe('linkedRecipeForIngredient', () => {
  const pesto = recipe({ id: 'pesto', name: 'Pesto', recipeClass: 'sauce', householdId: 'hh' });
  const catalog = recipe({ id: 'cat', name: 'Pesto', recipeClass: 'sauce', householdId: null });
  const pasta = recipe({ id: 'pasta', name: 'Pasta', mealSlots: ['dinner'], householdId: 'hh' });

  it('matches an ingredient name to one classed recipe, ignoring case', () => {
    expect(recipeNameKey('  Basil-Pesto ')).toBe('basil pesto');
    expect(linkedRecipeForIngredient('pesto', [pasta, pesto])?.id).toBe('pesto');
  });

  it('prefers the household recipe over a catalog recipe with the same name', () => {
    expect(linkedRecipeForIngredient('Pesto', [catalog, pesto])?.id).toBe('pesto');
  });

  it('does not link when two household recipes share the name', () => {
    const other = recipe({ id: 'other', name: 'Pesto', recipeClass: 'sauce', householdId: 'hh' });
    expect(linkedRecipeForIngredient('Pesto', [pesto, other])).toBeUndefined();
  });

  it('does not link a recipe to itself or to an unclassed meal', () => {
    expect(linkedRecipeForIngredient('Pesto', [pesto], { excludeIds: ['pesto'] })).toBeUndefined();
    expect(linkedRecipeForIngredient('Pasta', [pasta])).toBeUndefined();
  });
});
