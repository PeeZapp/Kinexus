import { describe, expect, it } from 'vitest';

import { addPantryIngredients, matchRecipesToPantry, parsePantryIngredients } from './pantry-match';
import type { Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: 'h', ...partial };
}

const stirFry = recipe({
  id: 'stir',
  name: 'Chicken stir fry',
  ingredients: [
    { name: 'chicken thigh' },
    { name: 'broccoli' },
    { name: 'soy sauce' },
    { name: 'garlic cloves' },
    { name: 'salt' },
    { name: 'olive oil' },
  ],
});

const redOnionSalad = recipe({
  id: 'salad',
  name: 'Red onion salad',
  ingredients: [{ name: 'red onion' }, { name: 'tomato' }, { name: 'pepper' }],
});

const pasta = recipe({
  id: 'pasta',
  name: 'Tomato pasta',
  ingredients: [
    { name: 'pasta' },
    { name: 'cherry tomatoes' },
    { name: 'garlic' },
    { name: 'basil' },
    { name: 'parmesan' },
  ],
});

const linkOnly = recipe({ id: 'link', name: 'Blog pasta', sourceUrl: 'https://example.com' });

describe('parsePantryIngredients', () => {
  it('splits commas and drops duplicate spellings', () => {
    expect(parsePantryIngredients('chicken, 2 onions\ngarlic cloves; Onion')).toEqual([
      'chicken',
      'onions',
      'garlic cloves',
    ]);
  });
});

describe('matchRecipesToPantry', () => {
  it('returns nothing until the pantry has an ingredient', () => {
    expect(matchRecipesToPantry([stirFry], [])).toEqual([]);
  });

  it('marks a recipe ready when only staples are left over', () => {
    const [match] = matchRecipesToPantry([stirFry, linkOnly], ['chicken', 'broccoli', 'soy sauce', 'garlic']);
    expect(match?.recipe.id).toBe('stir');
    expect(match?.status).toBe('ready');
    expect(match?.missing).toEqual([]);
  });

  it('lists near matches and keeps a generic onion from covering a named variety', () => {
    const matches = matchRecipesToPantry(
      [stirFry, redOnionSalad, pasta],
      ['chicken', 'broccoli', 'tomato', 'onion', 'pasta', 'garlic'],
    );
    const close = matches.find((match) => match.recipe.id === 'stir');
    expect(close?.status).toBe('close');
    expect(close?.missing).toEqual(['soy sauce']);

    const salad = matches.find((match) => match.recipe.id === 'salad');
    expect(salad?.missing.map((name) => name.toLowerCase())).toContain('red onion');

    const pastaMatch = matches.find((match) => match.recipe.id === 'pasta');
    expect(pastaMatch?.status).toBe('close');
    expect(pastaMatch?.covered).toContain('cherry tomatoes');
    expect(pastaMatch?.missing).toEqual(['basil', 'parmesan']);
  });

  it('lets a specific pantry item cover the generic ingredient', () => {
    const onionDish = recipe({
      id: 'soup',
      name: 'Onion soup',
      ingredients: [{ name: 'onion' }, { name: 'stock' }],
    });
    const [match] = matchRecipesToPantry([onionDish], ['red onion', 'stock']);
    expect(match?.status).toBe('ready');
  });

  it('skips dishes that share too little with the pantry', () => {
    const matches = matchRecipesToPantry([pasta], ['chicken']);
    expect(matches).toEqual([]);
  });

  it('merges new names onto an existing list', () => {
    expect(addPantryIngredients(['Chicken'], ['chicken', 'rice'])).toEqual(['Chicken', 'rice']);
  });
});
