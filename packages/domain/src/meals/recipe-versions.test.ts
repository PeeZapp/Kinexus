import { describe, expect, it } from 'vitest';

import { findReplacingRecipe, hideReplacedCatalogRecipes, recipeForHouseholdView } from './recipe-versions';
import type { Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

const catalog = recipe({ id: 'cat-burger', name: 'Chicken halloumi burger' });
const otherCatalog = recipe({ id: 'cat-pasta', name: 'Pasta' });
const householdCopy = recipe({
  id: 'hh-burger',
  name: 'Chicken halloumi burger',
  householdId: 'hh-1',
  sourcedFromRecipeId: 'cat-burger',
  replacesSource: true,
});
const extraVersion = recipe({
  id: 'hh-burger-spicy',
  name: 'Spicy chicken halloumi burger',
  householdId: 'hh-1',
  sourcedFromRecipeId: 'cat-burger',
  replacesSource: false,
});

describe('hideReplacedCatalogRecipes', () => {
  it('hides catalog recipes that a household copy replaces', () => {
    const next = hideReplacedCatalogRecipes([catalog, otherCatalog, householdCopy, extraVersion]);
    expect(next.map((item) => item.id)).toEqual(['cat-pasta', 'hh-burger', 'hh-burger-spicy']);
  });

  it('keeps catalog recipes when the household copy is only a save-as', () => {
    const next = hideReplacedCatalogRecipes([catalog, extraVersion]);
    expect(next.map((item) => item.id)).toEqual(['cat-burger', 'hh-burger-spicy']);
  });
});

describe('recipeForHouseholdView', () => {
  it('returns the household overwrite even when the catalog recipe is still in the list', () => {
    expect(recipeForHouseholdView([catalog, householdCopy], 'cat-burger')?.id).toBe('hh-burger');
  });

  it('returns the household overwrite when the catalog id is no longer listed', () => {
    const listed = hideReplacedCatalogRecipes([catalog, householdCopy]);
    expect(recipeForHouseholdView(listed, 'cat-burger')?.id).toBe('hh-burger');
  });

  it('returns the recipe itself when it is still in the list', () => {
    expect(recipeForHouseholdView([catalog, extraVersion], 'cat-burger')?.id).toBe('cat-burger');
    expect(recipeForHouseholdView([catalog, householdCopy], 'hh-burger')?.id).toBe('hh-burger');
  });
});
