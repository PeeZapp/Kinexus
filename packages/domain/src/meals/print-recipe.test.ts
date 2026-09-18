import { describe, expect, it } from 'vitest';

import { escapeHtml, recipePrintHtml } from './print-recipe';
import type { Recipe } from './types';

function recipe(partial: Partial<Recipe> & Pick<Recipe, 'id' | 'name'>): Recipe {
  return { householdId: null, ...partial };
}

describe('recipePrintHtml', () => {
  it('renders the recipe as a printable document', () => {
    const html = recipePrintHtml(
      recipe({
        id: '1',
        name: 'Chicken Tikka',
        cuisine: 'Indian',
        cookTime: 45,
        servings: 4,
        calories: 520,
        protein: 38,
        carbs: 22,
        fat: 18,
        vegetarian: false,
        mealSlots: ['dinner'],
        ingredients: [{ amount: '400g', name: 'chicken' }, { name: 'yogurt' }],
        method: ['Marinate the chicken.', 'Grill until charred.'],
        chefTip: 'Rest before slicing.',
        notes: 'Use leftover rice.',
        sourceUrl: 'https://example.com/tikka',
        emoji: '🍗',
        cost: {
          totalCost: 12.4,
          costPerServe: 3.1,
          currency: 'AUD',
          country: 'AU',
          stores: ['Woolworths', 'Coles'],
          pricedAt: '2026-09-01T00:00:00.000Z',
          servingsBasis: 4,
          breakdown: [{ name: 'chicken', amount: '400g', lineCost: 6.2, store: 'Woolworths' }],
        },
      }),
    );

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Chicken Tikka</title>');
    expect(html).toContain('Indian · 45 min · 4 servings');
    expect(html).toContain('/ serve');
    expect(html).toContain('Dinner');
    expect(html).toContain('400g');
    expect(html).toContain('chicken');
    expect(html).toContain('Woolworths and Coles');
    expect(html).toContain('Marinate the chicken.');
    expect(html).toContain('Chef tip');
    expect(html).toContain('Rest before slicing.');
    expect(html).toContain('Use leftover rice.');
    expect(html).toContain('https://example.com/tikka');
    expect(html).toContain('@media print');
  });

  it('escapes untrusted recipe text', () => {
    const html = recipePrintHtml(
      recipe({
        id: '2',
        name: '<script>alert(1)</script>',
        chefTip: 'Use <b>ghee</b> & "heat"',
        ingredients: [{ name: '<img src=x onerror=alert(1)>' }],
        method: ['<iframe></iframe>'],
        imageUrl: 'https://cdn.example/photo.jpg?a="b"',
      }),
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Use &lt;b&gt;ghee&lt;/b&gt; &amp; &quot;heat&quot;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('src="https://cdn.example/photo.jpg?a=&quot;b&quot;"');
  });

  it('shows empty copy when ingredients and method are missing', () => {
    const html = recipePrintHtml(recipe({ id: '3', name: 'Toast' }));
    expect(html).toContain('No ingredients listed.');
    expect(html).toContain('No method listed.');
    expect(html).not.toContain('Chef tip');
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<a href="x">a&b</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;a&amp;b&lt;/a&gt;');
  });
});
