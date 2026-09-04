import { View } from 'react-native';

import type { Recipe } from '@kinexus/domain';

import { RecipeRow, RecipesChrome } from '@/src/features/meals/recipes/RecipesShared';
import type { RecipeFilter } from '@/src/features/meals/recipes/filters';
import { SORTS } from '@/src/features/meals/recipes/filters';
import { EmptyState } from '@/src/features/shell/states';

export function RecipesMobile(props: {
  query: string;
  setQuery: (v: string) => void;
  filter: RecipeFilter;
  setFilter: (v: RecipeFilter) => void;
  sort: (typeof SORTS)[number]['id'];
  setSort: (v: (typeof SORTS)[number]['id']) => void;
  online: boolean;
  pendingCount: number;
  extra: string | null;
  recipes: Recipe[];
  favouriteIds: Set<string>;
  filters: { id: RecipeFilter; label: string }[];
  showFlag?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <RecipesChrome
      desktop={false}
      query={props.query}
      setQuery={props.setQuery}
      filter={props.filter}
      setFilter={props.setFilter}
      sort={props.sort}
      setSort={props.setSort}
      online={props.online}
      pendingCount={props.pendingCount}
      extra={props.extra}
      filters={props.filters}>
      {props.recipes.length === 0 ? (
        <EmptyState
          title="No recipes match"
          body="Try another filter or search. Catalog recipes are read-only; import saves a copy to this household."
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
