import type { RecipeFilter, RecipeSort, SortDir } from '@/src/features/meals/recipes/filters';

export type RecipesListUiState = {
  query: string;
  filter: RecipeFilter;
  showNotForFamily: boolean;
  sort: RecipeSort;
  sortDir: SortDir;
};

const DEFAULT_UI: RecipesListUiState = {
  query: '',
  filter: 'all',
  showNotForFamily: false,
  sort: 'alpha',
  sortDir: 'asc',
};

let uiState: RecipesListUiState = { ...DEFAULT_UI };
let scrollY = 0;

export function getRecipesListUiState(): RecipesListUiState {
  return uiState;
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
