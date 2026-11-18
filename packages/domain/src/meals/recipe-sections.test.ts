import { describe, expect, it } from 'vitest';

import { injectAmountsIntoMethod } from './recipe-sections';

describe('injectAmountsIntoMethod', () => {
  it('injects the best-match ingredient amount into steps', () => {
    const method = ['Add soy sauce', 'Serve'];
    const ingredients = [{ name: 'soy sauce', amount: '1 tbsp' }];
    expect(injectAmountsIntoMethod(method, ingredients, true).map((s) => s.text)).toEqual([
      'Add soy sauce (1 tbsp)',
      'Serve',
    ]);
  });

  it('prefers the longest matching ingredient name', () => {
    const method = ['Add soy sauce'];
    const ingredients = [
      { name: 'soy', amount: '1 tsp' },
      { name: 'soy sauce', amount: '1 tbsp' },
    ];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe('Add soy sauce (1 tbsp)');
  });

  it('does not match inside other words', () => {
    const method = ['Boil pasta'];
    const ingredients = [{ name: 'oil', amount: '1 tbsp' }];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe('Boil pasta');
  });

  it('does not double-inject when the amount is already present', () => {
    const method = ['Add soy sauce (1 tbsp)'];
    const ingredients = [{ name: 'soy sauce', amount: '1 tbsp' }];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe('Add soy sauce (1 tbsp)');
  });

  it('is a no-op when disabled (but still normalizes sections)', () => {
    const method = ['# Sauce', 'Add soy sauce'];
    const ingredients = [{ name: 'soy sauce', amount: '1 tbsp' }];
    expect(injectAmountsIntoMethod(method, ingredients, false)).toEqual([{ text: 'Add soy sauce', section: 'Sauce' }]);
  });

  it('matches prep-word variants via merge keys (minced garlic ≈ garlic cloves)', () => {
    const method = ['Add the minced garlic'];
    const ingredients = [{ name: 'garlic cloves', amount: '6 cloves' }];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe(
      'Add the minced garlic (6 cloves)',
    );
  });

  it('matches cloves-of-garlic style names to garlic mentions', () => {
    const method = ['Stir in the garlic'];
    const ingredients = [{ name: 'cloves of garlic', amount: '6' }];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe(
      'Stir in the garlic (6)',
    );
  });

  it('injects multiple distinct ingredient amounts in one step', () => {
    const method = ['Add the garlic and ginger'];
    const ingredients = [
      { name: 'garlic', amount: '3 cloves' },
      { name: 'ginger', amount: '1 tbsp' },
    ];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe(
      'Add the garlic (3 cloves) and ginger (1 tbsp)',
    );
  });

  it('expands sauce ingredient phrases to the section list', () => {
    const method = ['Add the sauce ingredients'];
    const ingredients = [
      { name: 'soy sauce', amount: '2 tbsp', section: 'Sauce' },
      { name: 'rice vinegar', amount: '1 tbsp', section: 'Sauce' },
      { name: 'sesame oil', amount: '1 tsp', section: 'Sauce' },
      { name: 'chicken', amount: '500 g', section: 'Main' },
    ];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe(
      'Add the sauce ingredients (2 tbsp soy sauce, 1 tbsp rice vinegar, 1 tsp sesame oil)',
    );
  });

  it('matches For-the section labels to the sauce ingredients phrasing', () => {
    const method = ['Whisk the sauce mixture into the pan'];
    const ingredients = [
      { name: 'honey', amount: '1 tbsp', section: 'For the sauce' },
      { name: 'soy sauce', amount: '2 tbsp', section: 'For the sauce' },
    ];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe(
      'Whisk the sauce mixture (1 tbsp honey, 2 tbsp soy sauce) into the pan',
    );
  });

  it('does not treat soy sauce as a Sauce section reference', () => {
    const method = ['Add soy sauce'];
    const ingredients = [
      { name: 'soy sauce', amount: '2 tbsp', section: 'Sauce' },
      { name: 'mirin', amount: '1 tbsp', section: 'Sauce' },
    ];
    expect(injectAmountsIntoMethod(method, ingredients, true)[0]?.text).toBe('Add soy sauce (2 tbsp)');
  });
});
