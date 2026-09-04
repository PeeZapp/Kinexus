import type { PersonDietary, Recipe } from './types';

export type DietaryOption = {
  id: string;
  label: string;
  emoji: string;
  description: string;
};

export const DIETARY_OPTIONS: readonly DietaryOption[] = [
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥗', description: 'No meat or fish' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱', description: 'No animal products' },
  { id: 'pescatarian', label: 'Pescatarian', emoji: '🐟', description: 'No meat, fish is fine' },
  { id: 'gluten-free', label: 'Gluten-Free', emoji: '🌾', description: 'No wheat, gluten or barley' },
  { id: 'dairy-free', label: 'Dairy-Free', emoji: '🥛', description: 'No milk, cheese or butter' },
  { id: 'egg-free', label: 'Egg-Free', emoji: '🥚', description: 'No eggs' },
  { id: 'nut-free', label: 'Nut-Free', emoji: '🥜', description: 'No tree nuts or peanuts' },
  { id: 'shellfish-free', label: 'Shellfish-Free', emoji: '🦐', description: 'No prawns, crab or molluscs' },
  { id: 'halal', label: 'Halal', emoji: '✅', description: 'No pork or alcohol' },
  { id: 'kosher', label: 'Kosher', emoji: '✡️', description: 'No pork or shellfish' },
  { id: 'low-carb', label: 'Low Carb', emoji: '🍞', description: 'Avoid high-carb recipes' },
];

const MEAT_KW = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'veal', 'duck', 'goose', 'venison', 'bison',
  'mince', 'minced', 'bacon', 'prosciutto', 'pancetta', 'chorizo', 'andouille', 'pepperoni',
  'salami', 'ham', 'sausage', 'lard', 'tallow', 'suet', 'offal', 'liver', 'kidney', 'oxtail',
  'tripe', 'ribs', 'rump', 'sirloin', 'brisket', 'chuck', 'shank', 'tenderloin',
];
const FISH_KW = [
  'salmon', 'tuna', 'cod', 'fish', 'tilapia', 'sardine', 'mackerel', 'trout', 'halibut',
  'snapper', 'mahi', 'anchovy', 'bass', 'sea bass', 'seabass', 'haddock', 'plaice', 'sole',
  'swordfish', 'barramundi',
];
const SHELLFISH_KW = [
  'prawn', 'shrimp', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'scallop', 'squid',
  'octopus', 'crayfish', 'langoustine', 'crawfish',
];
const DAIRY_KW = [
  'milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'ghee', 'creme fraiche',
  'sour cream', 'fromage', 'ricotta', 'mascarpone', 'custard', 'brie', 'cheddar', 'feta',
  'mozzarella', 'parmesan', 'halloumi', 'gouda', 'beurre',
];
const GLUTEN_KW = [
  'flour', 'bread', 'pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'tagliatelle',
  'rigatoni', 'orzo', 'noodle', 'wheat', 'couscous', 'bulgur', 'barley', 'semolina',
  'breadcrumb', 'crouton', 'batter', 'roux', 'sourdough', 'crumpet', 'tortilla', 'wrap',
  'pita', 'croissant', 'bagel', 'ciabatta', 'focaccia',
];
const NUT_KW = [
  'almond', 'cashew', 'walnut', 'pecan', 'peanut', 'hazelnut', 'pistachio', 'macadamia',
  'pine nut', 'brazil nut', 'chestnut', 'praline', 'marzipan', 'nut butter', 'nutella',
];
const PORK_KW = [
  'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'chorizo', 'andouille', 'lard',
  'pepperoni', 'salami', 'mortadella', 'sausage', 'gammon', 'bramble',
];
const ALCOHOL_KW = [
  'wine', 'beer', 'cider', 'vodka', 'rum', 'whiskey', 'bourbon', 'brandy', 'gin', 'sake',
  'champagne', 'prosecco', 'stout', 'ale', 'lager', 'liqueur', 'sherry', 'vermouth', 'port',
  'calvados',
];

function ingNames(recipe: Recipe): string[] {
  return (recipe.ingredients ?? []).map((i) => ` ${i.name.toLowerCase()} `);
}

function anyMatch(names: string[], keywords: string[]): boolean {
  return keywords.some((kw) => names.some((n) => n.includes(kw)));
}

function containsEgg(recipe: Recipe): boolean {
  return (recipe.ingredients ?? []).some((i) => {
    const n = i.name.toLowerCase();
    return /\begg(s)?\b/.test(n) && !n.includes('eggplant');
  });
}

/** True if a recipe conflicts with (should be excluded for) a restriction. */
export function hasConflict(recipe: Recipe, restriction: string): boolean {
  const names = ingNames(recipe);

  switch (restriction) {
    case 'vegetarian':
      if (recipe.vegetarian === true) return false;
      return anyMatch(names, [...MEAT_KW, ...FISH_KW, ...SHELLFISH_KW]);
    case 'vegan':
      if (anyMatch(names, [...MEAT_KW, ...FISH_KW, ...SHELLFISH_KW])) return true;
      if (anyMatch(names, DAIRY_KW)) return true;
      if (containsEgg(recipe)) return true;
      return false;
    case 'pescatarian':
      return anyMatch(names, MEAT_KW);
    case 'gluten-free':
      return anyMatch(names, GLUTEN_KW);
    case 'dairy-free':
      return anyMatch(names, DAIRY_KW);
    case 'egg-free':
      return containsEgg(recipe);
    case 'nut-free':
      return anyMatch(names, NUT_KW);
    case 'shellfish-free':
      return anyMatch(names, SHELLFISH_KW);
    case 'halal':
      return anyMatch(names, [...PORK_KW, ...ALCOHOL_KW]);
    case 'kosher':
      return anyMatch(names, [...PORK_KW, ...SHELLFISH_KW]);
    case 'low-carb':
      if ((recipe.carbs ?? 0) > 50) return true;
      return anyMatch(names, ['pasta', 'rice', 'potato', 'bread', 'noodle', 'couscous', 'quinoa', 'oat']);
    default:
      return false;
  }
}

export function dietaryRestrictionsFromPeople(people: readonly PersonDietary[]): string[] {
  const all = new Set<string>();
  for (const person of people) {
    for (const d of person.dietary ?? []) all.add(d);
  }
  return [...all];
}

export function filterRecipesByDietary(
  recipes: readonly Recipe[],
  restrictions: readonly string[],
): Recipe[] {
  if (restrictions.length === 0) return [...recipes];
  return recipes.filter((r) => !restrictions.some((res) => hasConflict(r, res)));
}

export function filterRecipesForPeople(
  recipes: readonly Recipe[],
  people: readonly PersonDietary[],
): Recipe[] {
  return filterRecipesByDietary(recipes, dietaryRestrictionsFromPeople(people));
}

export function getDietaryOption(id: string): DietaryOption | undefined {
  return DIETARY_OPTIONS.find((d) => d.id === id);
}
