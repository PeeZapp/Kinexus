import { View } from 'react-native';

import type { Recipe } from '@kinexus/domain';

import { RecipeRow, RecipesChrome } from '@/src/features/meals/recipes/RecipesShared';
import type { RecipeLibraryFilter, RecipeMealFilter, RecipeSort, SortDir } from '@/src/features/meals/recipes/filters';
import { EmptyState } from '@/src/features/shell/states';

export function RecipesMobile(props: {
  query: string;
  setQuery: (v: string) => void;
  meal: RecipeMealFilter;
  setMeal: (v: RecipeMealFilter) => void;
  library: RecipeLibraryFilter;
  setLibrary: (v: RecipeLibraryFilter) => void;
  sort: RecipeSort;
  sortDir: SortDir;
  onSort: (v: RecipeSort) => void;
  setSortDir: (v: SortDir) => void;
  online: boolean;
  pendingCount: number;
  extra: string | null;
  recipes: Recipe[];
  totalCount: number;
  loading?: boolean;
  favouriteIds: Set<string>;
  libraryChoices: { id: RecipeLibraryFilter; label: string }[];
  showNotForFamily?: boolean;
  setShowNotForFamily?: (v: boolean) => void;
  showFlag?: boolean;
  showImport?: boolean;
  emptyBody?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <RecipesChrome
      desktop={false}
      query={props.query}
      setQuery={props.setQuery}
      meal={props.meal}
      setMeal={props.setMeal}
      library={props.library}
      setLibrary={props.setLibrary}
      sort={props.sort}
      sortDir={props.sortDir}
      onSort={props.onSort}
      setSortDir={props.setSortDir}
      online={props.online}
      pendingCount={props.pendingCount}
      extra={props.extra}
      totalCount={props.totalCount}
      shownCount={props.recipes.length}
      loading={props.loading}
      libraryChoices={props.libraryChoices}
      showNotForFamily={props.showNotForFamily}
      setShowNotForFamily={props.setShowNotForFamily}
      showImport={props.showImport}>
      {props.recipes.length === 0 ? (
        <EmptyState
          title="No recipes match"
          body={
            props.emptyBody ??
            'Try another filter or search. Catalog recipes are read-only; import saves a copy to this household.'
          }
        />
      ) : (
        <View style={{ gap: 8 }}>
          {props.recipes.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              recipe={recipe}
              favourite={props.favouriteIds.has(recipe.id)}
              showFlag={props.showFlag}
              onPress={() => props.onOpen(recipe.id)}
            />
          ))}
        </View>
      )}
    </RecipesChrome>
  );
}
