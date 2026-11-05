import { describe, expect, it } from 'vitest';

import type { Recipe } from './types';
import {
  cleanRecipeToHouseholdDraft,
  householdRecipeToClean,
  scaledQuantityLabel,
  suggestMealSlotsFromTitle,
  userErrorFromCode,
  type CleanRecipe,
} from './clean-recipe';

function sampleClean(overrides: Partial<CleanRecipe> = {}): CleanRecipe {
  return {
    title: 'Pancake stack',
    attribution: {
      inputUrl: 'https://example.com/r',
      sourceUrl: 'https://example.com/r',
      displayName: 'example.com',
    },
    ingredients: [{ id: 'i1', name: 'flour', quantity: { value: 1, unit: 'cup', raw: '1 cup' } }],
    method: [{ id: 's1', type: 'step', text: 'Mix and cook' }],
    extraction: {
      method: 'json-ld',
      sourceKind: 'web',
      confidence: 0.95,
      extractedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('scaledQuantityLabel', () => {
  it('doubles parseable amounts when servings 4 → 8', () => {
    expect(scaledQuantityLabel({ value: 100, unit: 'g', raw: '100g' }, 4, 8)).toBe('200g');
  });

  it('leaves unparseable amounts as raw', () => {
    expect(scaledQuantityLabel({ value: null, raw: 'to taste' }, 4, 8)).toBe('to taste');
  });

  it('does not scale when original servings are missing', () => {
    expect(scaledQuantityLabel({ value: 2, unit: 'cup', raw: '2 cups' }, undefined, 8)).toBe('2 cups');
  });
});

describe('userErrorFromCode', () => {
  it('maps codes onto the three PRD buckets', () => {
    expect(userErrorFromCode('not_a_recipe')).toBe('not_a_recipe');
    expect(userErrorFromCode('extraction_failed')).toBe('not_a_recipe');
    expect(userErrorFromCode('timeout')).toBe('timeout');
    expect(userErrorFromCode('fetch_failed')).toBe('unsupported_url');
    expect(userErrorFromCode('unsupported_url')).toBe('unsupported_url');
    expect(userErrorFromCode('video_no_transcript')).toBe('unsupported_url');
    expect(userErrorFromCode('ssrf_blocked')).toBe('unsupported_url');
  });
});

describe('householdRecipeToClean', () => {
  it('restores heading blocks from # prefixes', () => {
    const recipe: Recipe = {
      id: 'r1',
      name: 'Soup',
      householdId: 'h1',
      servings: 2,
      sourceUrl: 'https://allrecipes.com/recipe/1',
      ingredients: [{ name: 'salt', amount: 'to taste' }],
      method: ['# Sauce', 'Simmer 10 minutes'],
    };
    const clean = householdRecipeToClean(recipe);
    expect(clean.method).toEqual([
      { id: 'h-1', type: 'heading', text: 'Sauce' },
      { id: 's-2', type: 'step', text: 'Simmer 10 minutes' },
    ]);
    expect(clean.attribution.displayName).toBe('allrecipes.com');
  });
});

describe('cleanRecipeToHouseholdDraft', () => {
  it('does not force dinner when the import has no meal slots', () => {
    const draft = cleanRecipeToHouseholdDraft(sampleClean({ mealSlots: undefined }));
    expect(draft.mealSlots).toEqual([]);
  });

  it('keeps meal slots when the import provides them', () => {
    const draft = cleanRecipeToHouseholdDraft(sampleClean({ mealSlots: ['breakfast', 'dessert'] }));
    expect(draft.mealSlots).toEqual(['breakfast', 'dessert']);
  });
});

describe('suggestMealSlotsFromTitle', () => {
  it('suggests breakfast for pancake titles without applying anything', () => {
    expect(suggestMealSlotsFromTitle('Fluffy buttermilk pancakes')).toEqual(['breakfast']);
  });
});
