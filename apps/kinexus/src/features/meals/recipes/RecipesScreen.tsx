import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { approvedRecipeIdsForLibraryFilter } from '@kinexus/domain';

import { RecipesDesktop } from '@/src/features/meals/recipes/RecipesDesktop';
import { RecipesMobile } from '@/src/features/meals/recipes/RecipesMobile';
import {
  matchesFilter,
  sortRecipes,
  defaultSortDir,
  EDITOR_FILTERS,
  FILTERS,
  type RecipeFilter,
  type RecipeSort,
  type SortDir,
} from '@/src/features/meals/recipes/filters';
import {
  getRecipesListUiState,
  setRecipesListUiState,
} from '@/src/features/meals/recipes/recipes-list-state';
import { isRestrictedPicker, linkedPersonForUser } from '@/src/features/meals/picker-access';
import { recipeHref } from '@/src/features/meals/recipe-href';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

function allowlistKey(filter: RecipeFilter): 'all' | 'snack' | 'breakfast' | 'lunch' | 'dinner' | 'dessert' {
  if (filter === 'breakfast' || filter === 'lunch' || filter === 'dinner' || filter === 'dessert' || filter === 'snack') {
    return filter;
  }
  return 'all';
}

export function RecipesScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const meals = useMealsSync();
  const { user } = useAuth();
  const { people, role } = useHousehold();
  const saved = getRecipesListUiState();
  const [query, setQuery] = useState(saved.query);
  const [filter, setFilter] = useState<RecipeFilter>(saved.filter);
  const [showNotForFamily, setShowNotForFamily] = useState(saved.showNotForFamily);
  const [sort, setSort] = useState<RecipeSort>(saved.sort);
  const [sortDir, setSortDir] = useState<SortDir>(saved.sortDir);
  const userId = user && !user.isDevBypass ? user.id : null;
  const restricted = isRestrictedPicker({ role, people, userId });
  const linked = linkedPersonForUser(people, userId);
  const allowedIds =
    restricted && linked
      ? approvedRecipeIdsForLibraryFilter(meals.slotApprovals, linked.id, allowlistKey(filter))
      : null;

  useEffect(() => {
    setRecipesListUiState({ query, filter, showNotForFamily, sort, sortDir });
  }, [query, filter, showNotForFamily, sort, sortDir]);

  const recipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = meals.recipes.filter((recipe) => {
      if (allowedIds && !allowedIds.has(recipe.id)) return false;
      if (!matchesFilter(recipe, filter, meals.favouriteIds, showNotForFamily)) return false;
      if (!q) return true;
      return recipe.name.toLowerCase().includes(q) || (recipe.cuisine ?? '').toLowerCase().includes(q);
    });
    return sortRecipes(filtered, sort, sortDir);
  }, [allowedIds, filter, meals.favouriteIds, meals.recipes, query, showNotForFamily, sort, sortDir]);

  const onSort = (next: RecipeSort) => {
    if (next === sort) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSort(next);
    setSortDir(defaultSortDir(next));
  };

  const filters = restricted
    ? FILTERS.filter((item) =>
        ['all', 'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'favourites'].includes(item.id),
      )
    : meals.isCatalogEditor
      ? [...FILTERS, ...EDITOR_FILTERS]
      : FILTERS;

  const totalCount = restricted
    ? meals.recipes.filter((r) => allowedIds?.has(r.id) && !r.removed && !r.excludedFromAuto).length
    : filter === 'removed'
      ? meals.recipes.filter((r) => r.removed).length
      : meals.recipes.filter((r) => !r.removed && (showNotForFamily || !r.excludedFromAuto)).length;

  const props = {
    query,
    setQuery,
    filter,
    setFilter,
    sort,
    sortDir,
    onSort,
    setSortDir,
    online: meals.online,
    pendingCount: meals.pendingCount,
    extra: meals.importBlockedReason,
    recipes,
    totalCount,
    loading: meals.isLoading,
    favouriteIds: meals.favouriteIds,
    filters,
    showNotForFamily,
    setShowNotForFamily: restricted ? undefined : setShowNotForFamily,
    showFlag: meals.isCatalogEditor && !restricted,
    showImport: !restricted,
    emptyBody: restricted
      ? 'Only recipes approved for you are listed. Lunch and dinner are separate lists — ask an owner to add more in Picks.'
      : undefined,
    onOpen: (id: string) => router.push(recipeHref(id)),
  };

  return mode === 'desktop' ? <RecipesDesktop {...props} /> : <RecipesMobile {...props} />;
}
