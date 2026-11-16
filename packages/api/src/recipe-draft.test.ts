import { describe, expect, it } from 'vitest';

import { normalizeRecipeDraft } from './recipe-draft.js';

describe('normalizeRecipeDraft tags', () => {
  it('normalizes allergens and equipment ids and keeps cuisines', () => {
    const draft = normalizeRecipeDraft({
      name: 'Pad Thai',
      cuisine: 'Thai',
      cuisines: ['Thai', 'Southeast Asian'],
      allergens: ['Nuts', 'soy', 'mystery'],
      equipment: ['Wok', 'blender', 'air fryer'],
      ingredients: [{ name: 'noodles' }],
      method: ['Stir fry'],
      mealSlots: ['dinner'],
    });
    expect(draft.cuisines).toEqual(['Thai', 'Southeast Asian']);
    expect(draft.allergens).toEqual(['nuts', 'soy']);
    expect(draft.equipment).toEqual(['blender', 'air-fryer']);
  });

  it('omits empty tag arrays', () => {
    const draft = normalizeRecipeDraft({
      name: 'Plain rice',
      ingredients: [{ name: 'rice' }],
      method: ['Cook'],
      mealSlots: ['dinner'],
      allergens: [],
      equipment: ['unknown-gadget'],
    });
    expect(draft.allergens).toBeUndefined();
    expect(draft.equipment).toBeUndefined();
  });
});
