import type { MealSlotKey, Recipe } from '@kinexus/domain';

export type RecipeMealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert';
export type RecipeLibraryFilter = 'all' | 'household' | 'favourites' | 'base' | 'removed';

const SNACKS: MealSlotKey[] = ['morning_snack', 'afternoon_snack', 'night_snack'];

function matchesMeal(recipe: Recipe, meal: RecipeMealFilter): boolean {
  if (meal === 'all') return true;
  if (meal === 'snack') return (recipe.mealSlots ?? []).some((slot) => SNACKS.includes(slot));
  return (recipe.mealSlots ?? []).includes(meal) || (!(recipe.mealSlots ?? []).length && meal === 'dinner');
}

export function matchesFilter(
  recipe: Recipe,
  meal: RecipeMealFilter,
  library: RecipeLibraryFilter,
  favouriteIds: Set<string>,
  showNotForFamily = false,
): boolean {
  if (library === 'removed') return Boolean(recipe.removed) && matchesMeal(recipe, meal);
  if (recipe.removed) return false;
  if (recipe.excludedFromAuto && !showNotForFamily) return false;
  if (library === 'base' && !recipe.isComponent) return false;
  if (library === 'household' && recipe.householdId === null) return false;
  if (library === 'favourites' && !favouriteIds.has(recipe.id)) return false;
  return matchesMeal(recipe, meal);
}

export type RecipeSort = 'alpha' | 'calories' | 'protein' | 'cook_time' | 'cost_per_serve' | 'cost_per_dish';
export type SortDir = 'asc' | 'desc';

export function defaultSortDir(key: RecipeSort): SortDir {
  if (key === 'alpha' || key === 'cost_per_serve' || key === 'cost_per_dish') return 'asc';
  return 'desc';
}

export const SORTS: { id: RecipeSort; label: string }[] = [
  { id: 'alpha', label: 'A–Z' },
  { id: 'calories', label: 'Calories' },
  { id: 'protein', label: 'Protein' },
  { id: 'cook_time', label: 'Cook time' },
  { id: 'cost_per_serve', label: 'Cost / serve' },
  { id: 'cost_per_dish', label: 'Cost / dish' },
];

function costValue(recipe: Recipe, key: 'cost_per_serve' | 'cost_per_dish'): number | null {
  if (!recipe.cost) return null;
  return key === 'cost_per_serve' ? recipe.cost.costPerServe : recipe.cost.totalCost;
}

export function sortRecipes(list: Recipe[], key: RecipeSort, dir: SortDir): Recipe[] {
  const mul = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (key === 'alpha') return mul * a.name.localeCompare(b.name);
    if (key === 'calories') return mul * ((a.calories ?? 0) - (b.calories ?? 0));
    if (key === 'protein') return mul * ((a.protein ?? 0) - (b.protein ?? 0));
    if (key === 'cost_per_serve' || key === 'cost_per_dish') {
      const av = costValue(a, key);
      const bv = costValue(b, key);
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return mul * (av - bv);
    }
    return mul * ((a.cookTime ?? 0) - (b.cookTime ?? 0));
  });
}

export const DIR_CHIPS: { id: SortDir; label: string }[] = [
  { id: 'desc', label: 'Largest first' },
  { id: 'asc', label: 'Smallest first' },
];

export function dirChipsForSort(sort: RecipeSort): { id: SortDir; label: string }[] {
  if (sort === 'cost_per_serve' || sort === 'cost_per_dish') {
    return [
      { id: 'asc', label: 'Cheapest first' },
      { id: 'desc', label: 'Most expensive first' },
    ];
  }
  return DIR_CHIPS;
}

export const MEAL_FILTERS: { id: RecipeMealFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
  { id: 'dessert', label: 'Dessert' },
];

export const LIBRARY_FILTERS: { id: RecipeLibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'household', label: 'Household' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'base', label: 'Base' },
];

export const EDITOR_LIBRARY_FILTERS: { id: RecipeLibraryFilter; label: string }[] = [
  { id: 'removed', label: 'Removed' },
];

