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
});

