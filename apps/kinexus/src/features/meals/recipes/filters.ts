import type { MealSlotKey, Recipe } from '@kinexus/domain';

export type RecipeFilter =
  | 'all'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'dessert'
  | 'base'
  | 'household'
  | 'favourites'
  | 'flagged';

const SNACKS: MealSlotKey[] = ['morning_snack', 'afternoon_snack', 'night_snack'];

export function matchesFilter(recipe: Recipe, filter: RecipeFilter, favouriteIds: Set<string>): boolean {
  if (filter === 'all') return true;
  if (filter === 'base') return Boolean(recipe.isComponent);
  if (filter === 'household') return recipe.householdId !== null;
  if (filter === 'favourites') return favouriteIds.has(recipe.id);
  if (filter === 'flagged') return Boolean(recipe.imageFlagged);
  if (filter === 'snack') return (recipe.mealSlots ?? []).some((s) => SNACKS.includes(s));
  return (recipe.mealSlots ?? []).includes(filter) || (!(recipe.mealSlots ?? []).length && filter === 'dinner');
}

export function sortRecipes(list: Recipe[], key: 'alpha' | 'calories' | 'protein' | 'cook_time', dir: 'asc' | 'desc'): Recipe[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (key === 'alpha') return mul * a.name.localeCompare(b.name);
    if (key === 'calories') return mul * ((a.calories ?? 0) - (b.calories ?? 0));
    if (key === 'protein') return mul * ((a.protein ?? 0) - (b.protein ?? 0));
    return mul * ((a.cookTime ?? 0) - (b.cookTime ?? 0));
  });
}

export const FILTERS: { id: RecipeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'household', label: 'Household' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'base', label: 'Base' },
];

export const EDITOR_FILTERS: { id: RecipeFilter; label: string }[] = [
  { id: 'flagged', label: 'Flagged photos' },
];

export const SORTS: { id: 'alpha' | 'calories' | 'protein' | 'cook_time'; label: string }[] = [
  { id: 'alpha', label: 'A–Z' },
  { id: 'calories', label: 'Calories' },
  { id: 'protein', label: 'Protein' },
  { id: 'cook_time', label: 'Cook time' },
];

