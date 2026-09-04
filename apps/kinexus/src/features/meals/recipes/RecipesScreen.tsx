import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { RecipesDesktop } from '@/src/features/meals/recipes/RecipesDesktop';
import { RecipesMobile } from '@/src/features/meals/recipes/RecipesMobile';
import { matchesFilter, sortRecipes, EDITOR_FILTERS, FILTERS, type RecipeFilter } from '@/src/features/meals/recipes/filters';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function RecipesScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const meals = useMealsSync();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const [sort, setSort] = useState<'alpha' | 'calories' | 'protein' | 'cook_time'>('alpha');

  const recipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = meals.recipes.filter((recipe) => {
      if (!matchesFilter(recipe, filter, meals.favouriteIds)) return false;
      if (!q) return true;
      return recipe.name.toLowerCase().includes(q) || (recipe.cuisine ?? '').toLowerCase().includes(q);
    });
    return sortRecipes(filtered, sort, sort === 'alpha' ? 'asc' : 'desc');
  }, [filter, meals.favouriteIds, meals.recipes, query, sort]);

  const filters = meals.isCatalogEditor ? [...FILTERS, ...EDITOR_FILTERS] : FILTERS;

  const props = {
    query,
    setQuery,
    filter,
    setFilter,
    sort,
    setSort,
    online: meals.online,
    pendingCount: meals.pendingCount,
    extra: meals.importBlockedReason,
    recipes,
    favouriteIds: meals.favouriteIds,
    filters,
    showFlag: meals.isCatalogEditor,
    onOpen: (id: string) => router.push(`/meals/recipes/${id}` as Href),
  };

  return mode === 'desktop' ? <RecipesDesktop {...props} /> : <RecipesMobile {...props} />;
}
