import type { RecipeLibraryFilter, RecipeMealFilter, RecipeSort, SortDir } from '@/src/features/meals/recipes/filters';

export type RecipesListUiState = {
  query: string;
  meal: RecipeMealFilter;
  library: RecipeLibraryFilter;
  showNotForFamily: boolean;
  sort: RecipeSort;
  sortDir: SortDir;
};

const DEFAULT_UI: RecipesListUiState = {
  query: '',
  meal: 'all',
  library: 'all',
  showNotForFamily: false,
  sort: 'alpha',
  sortDir: 'asc',
};

const MEALS = new Set<RecipeMealFilter>(['all', 'breakfast', 'lunch', 'dinner', 'snack', 'dessert']);
const LIBRARIES = new Set<RecipeLibraryFilter>(['all', 'household', 'favourites', 'base', 'removed']);

let uiState: RecipesListUiState = { ...DEFAULT_UI };
let scrollY = 0;

export function getRecipesListUiState(): RecipesListUiState {
  const current = uiState as RecipesListUiState & { filter?: string };
  const legacy = current.filter;
  return {
    query: current.query ?? '',
    meal: MEALS.has(current.meal) ? current.meal : MEALS.has(legacy as RecipeMealFilter) ? (legacy as RecipeMealFilter) : 'all',
    library: LIBRARIES.has(current.library)
      ? current.library
      : LIBRARIES.has(legacy as RecipeLibraryFilter)
        ? (legacy as RecipeLibraryFilter)
        : 'all',
    showNotForFamily: Boolean(current.showNotForFamily),
    sort: current.sort ?? 'alpha',
    sortDir: current.sortDir ?? 'asc',
  };
}

export function setRecipesListUiState(next: RecipesListUiState): void {
  uiState = next;
}

export function getRecipesListScrollY(): number {
  return scrollY;
}

export function setRecipesListScrollY(y: number): void {
  scrollY = y;
}
