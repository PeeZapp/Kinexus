import { describe, expect, it } from 'vitest';

import { formatIngredientSwaps, ingredientSwaps } from './ingredient-swaps';

describe('ingredientSwaps', () => {
  it('keeps the braised beef chilli swaps', () => {
    expect(ingredientSwaps('Chorizo')).toEqual(['another type of cured sausage']);
    expect(ingredientSwaps('Allspice')).toContain('cinnamon, cloves, and nutmeg');
    expect(ingredientSwaps('Cumin')).toEqual(['ground coriander', 'caraway', 'chilli powder']);
    expect(ingredientSwaps('Ancho Chillies')).toEqual([
      'pasilla chillies',
      'mulato chillies',
      'ancho chilli powder',
    ]);
    expect(ingredientSwaps('Borlotti Beans')).toEqual(['kidney beans', 'cannellini beans', 'chickpeas', 'black beans']);
    expect(ingredientSwaps('Bay Leaf')).toEqual(['dried thyme']);
    expect(ingredientSwaps('Cloves')).toEqual(['ground allspice', 'ground cinnamon', 'ground nutmeg']);
  });

  it('covers other catalogue ingredients that have a cited substitute', () => {
    expect(ingredientSwaps('Garlic Clove')).toEqual(['garlic powder', 'garlic granules']);
    expect(ingredientSwaps('Fish Sauce')).toEqual(['light soy sauce']);
    expect(ingredientSwaps('Oyster Sauce')).toEqual(['soy sauce', 'hoisin sauce']);
    expect(ingredientSwaps('Chicken Breast')).toEqual(['chicken thighs']);
    expect(ingredientSwaps('Minced Beef')).toEqual(['pork mince', 'chicken mince', 'turkey mince']);
    expect(ingredientSwaps('Double Cream')).toEqual(['whipping cream', 'single cream']);
    expect(ingredientSwaps('Sour Cream')).toEqual(['plain yogurt', 'crème fraîche']);
    expect(ingredientSwaps('Self-raising Flour')).toEqual(['plain flour and baking powder']);
    expect(ingredientSwaps('Spring Onions')).toEqual(['onion', 'leeks']);
    expect(ingredientSwaps('Red Chilli')).toEqual(['chilli flakes', 'chilli powder']);
    expect(ingredientSwaps('Kidney Beans')).toContain('chickpeas');
    expect(ingredientSwaps('Spaghetti')).toEqual(['another pasta shape']);
    expect(ingredientSwaps('Cilantro')).toEqual(['parsley']);
    expect(ingredientSwaps('fresh basil')).toEqual(['oregano', 'thyme']);
    expect(ingredientSwaps('Lemon Juice')).toEqual(['lime juice']);
  });

  it('does not treat a lookalike name as a substitute', () => {
    for (const name of [
      'Cumin Seeds',
      'Allspice Berries',
      'Cinnamon Stick',
      'Lamb Kidney',
      'Chicken Stock',
      'Cream Cheese',
      'Cream Of Tartar',
      'Egg Plants',
      'Mincemeat',
      'Dill Pickles',
      'Lemongrass',
      'Lime Leaves',
      'Plain Flour',
      'Garlic Sauce',
      'cauliflower rice',
      'Sweet chilli sauce',
      'Baking Powder',
      'Cocoa Powder',
      'Curry Powder',
      'Chickpea Flour',
      'Serrano Ham',
      'Sour Milk',
      'Coconut Flakes',
      'onion powder',
    ]) {
      expect(ingredientSwaps(name), name).toEqual([]);
    }
  });

  it('joins several swaps into one line', () => {
    expect(formatIngredientSwaps(ingredientSwaps('Ancho Chillies'))).toBe(
      'pasilla chillies, mulato chillies, or ancho chilli powder',
    );
  });
});
