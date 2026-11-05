import { createElement, type CSSProperties, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { Recipe } from '@kinexus/domain';

import { RecipeCard, RecipesChrome } from '@/src/features/meals/recipes/RecipesShared';
import type { RecipeLibraryFilter, RecipeMealFilter, RecipeSort, SortDir } from '@/src/features/meals/recipes/filters';
import { EmptyState } from '@/src/features/shell/states';

const webGrid: CSSProperties = {
  alignSelf: 'stretch',
  width: '100%',
  minWidth: 0,
  gap: 12,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
};

function RecipeGrid({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return createElement('div', { style: webGrid }, children);
  }
  return <View style={styles.nativeGrid}>{children}</View>;
}

export function RecipesDesktop(props: {
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
      desktop
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
        <RecipeGrid>
          {props.recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              favourite={props.favouriteIds.has(recipe.id)}
              wide
              showFlag={props.showFlag}
              onPress={() => props.onOpen(recipe.id)}
            />
          ))}
        </RecipeGrid>
      )}
    </RecipesChrome>
  );
}

const styles = StyleSheet.create({
  nativeGrid: {
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    gap: 12,
  },
});
