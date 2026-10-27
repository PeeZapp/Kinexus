import { describe, expect, it } from 'vitest';

import { favouriteIdsForLibrary, findReplacingRecipe, hideReplacedCatalogRecipes, recipeForHouseholdView } from './recipe-versions';
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

const aglio = recipe({
  id: 'hh-aglio',
  name: 'Aglio olio',
  householdId: 'hh-1',
  ingredients: [{ name: 'spaghetti' }, { name: 'garlic', amount: '3 cloves' }],
  method: ['Boil', 'Toss'],
  cookTime: 20,
});
const publishedAglio = recipe({
  id: 'cat-aglio',
  name: 'Aglio olio',
  creatorSourceRecipeId: 'hh-aglio',
  ingredients: [{ name: 'spaghetti' }, { name: 'garlic', amount: '3 cloves' }],
  method: ['Boil', 'Toss'],
  cookTime: 20,
  imageUrl: 'https://cdn.example/aglio.jpg',
  calories: 640,
});

describe('published household recipes', () => {
  it('shows the catalog recipe once when the household source is unchanged', () => {
    const next = hideReplacedCatalogRecipes([aglio, publishedAglio, otherCatalog]);
    expect(next.map((item) => item.id)).toEqual(['cat-aglio', 'cat-pasta']);
  });

  it('keeps a household edit and hides the catalog copy', () => {
    const edited = recipe({
      ...aglio,
      ingredients: [{ name: 'spaghetti' }, { name: 'garlic', amount: '6 cloves' }],
    });
    const next = hideReplacedCatalogRecipes([edited, publishedAglio]);
    expect(next.map((item) => item.id)).toEqual(['hh-aglio']);
    expect(next[0]?.replacesSource).toBe(true);
    expect(next[0]?.sourcedFromRecipeId).toBe('cat-aglio');
    expect(next[0]?.publishedCatalogId).toBe('cat-aglio');
    expect(recipeForHouseholdView(next, 'cat-aglio')?.id).toBe('hh-aglio');
  });

  it('resolves a plan that still points at the household source', () => {
    const next = hideReplacedCatalogRecipes([aglio, publishedAglio]);
    expect(recipeForHouseholdView(next, 'hh-aglio')?.id).toBe('cat-aglio');
  });

  it('keeps the household recipe when the catalog copy was removed', () => {
    const next = hideReplacedCatalogRecipes([aglio, { ...publishedAglio, removed: true }]);
    expect(next.map((item) => item.id)).toEqual(['hh-aglio', 'cat-aglio']);
  });

  it('carries not-for-family onto the catalog recipe', () => {
    const next = hideReplacedCatalogRecipes([{ ...aglio, excludedFromAuto: true }, publishedAglio]);
    expect(next.find((item) => item.id === 'cat-aglio')?.excludedFromAuto).toBe(true);
  });

  it('ignores photo and nutrition differences', () => {
    const next = hideReplacedCatalogRecipes([aglio, publishedAglio]);
    expect(next.map((item) => item.id)).toEqual(['cat-aglio']);
  });

  it('hides the unchanged household source when another household version replaces the catalog', () => {
    const version = recipe({
      id: 'hh-aglio-home',
      name: 'Aglio olio',
      householdId: 'hh-1',
      sourcedFromRecipeId: 'cat-aglio',
      replacesSource: true,
      ingredients: [{ name: 'spaghetti' }, { name: 'chili' }],
      method: ['Boil'],
    });
    const next = hideReplacedCatalogRecipes([aglio, publishedAglio, version]);
    expect(next.map((item) => item.id)).toEqual(['hh-aglio-home']);
  });

  it('keeps a favourite saved on the household source', () => {
    const listed = hideReplacedCatalogRecipes([aglio, publishedAglio]);
    expect(favouriteIdsForLibrary(listed, ['hh-aglio']).has('cat-aglio')).toBe(true);
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
