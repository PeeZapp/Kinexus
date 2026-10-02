import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { approvedRecipeIdsForLibraryFilter } from '@kinexus/domain';

import { RecipesDesktop } from '@/src/features/meals/recipes/RecipesDesktop';
import { RecipesMobile } from '@/src/features/meals/recipes/RecipesMobile';
import {
  matchesFilter,
  sortRecipes,
  defaultSortDir,
  EDITOR_LIBRARY_FILTERS,
  LIBRARY_FILTERS,
  type RecipeLibraryFilter,
  type RecipeMealFilter,
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

function allowlistKey(meal: RecipeMealFilter): 'all' | 'snack' | 'breakfast' | 'lunch' | 'dinner' | 'dessert' {
  if (meal === 'breakfast' || meal === 'lunch' || meal === 'dinner' || meal === 'dessert' || meal === 'snack') {
    return meal;
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
  const [meal, setMeal] = useState<RecipeMealFilter>(saved.meal);
  const [library, setLibrary] = useState<RecipeLibraryFilter>(saved.library);
  const [showNotForFamily, setShowNotForFamily] = useState(saved.showNotForFamily);
  const [sort, setSort] = useState<RecipeSort>(saved.sort);
  const [sortDir, setSortDir] = useState<SortDir>(saved.sortDir);
  const userId = user && !user.isDevBypass ? user.id : null;
  const restricted = isRestrictedPicker({ role, people, userId });
  const linked = linkedPersonForUser(people, userId);
  const allowedIds =
    restricted && linked
      ? approvedRecipeIdsForLibraryFilter(meals.slotApprovals, linked.id, allowlistKey(meal))
      : null;

  useEffect(() => {
    setRecipesListUiState({ query, meal, library, showNotForFamily, sort, sortDir });
  }, [query, meal, library, showNotForFamily, sort, sortDir]);

  const recipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = meals.recipes.filter((recipe) => {
      if (allowedIds && !allowedIds.has(recipe.id)) return false;
      if (!matchesFilter(recipe, meal, library, meals.favouriteIds, showNotForFamily)) return false;
      if (!q) return true;
      return recipe.name.toLowerCase().includes(q) || (recipe.cuisine ?? '').toLowerCase().includes(q);
    });
    return sortRecipes(filtered, sort, sortDir);
  }, [allowedIds, library, meal, meals.favouriteIds, meals.recipes, query, showNotForFamily, sort, sortDir]);

  const onSort = (next: RecipeSort) => {
    if (next === sort) return;
    setSort(next);
    setSortDir(defaultSortDir(next));
  };

  const libraryChoices = restricted
    ? LIBRARY_FILTERS.filter((item) => item.id === 'all' || item.id === 'favourites')
    : meals.isCatalogEditor
      ? [...LIBRARY_FILTERS, ...EDITOR_LIBRARY_FILTERS]
      : LIBRARY_FILTERS;

  const totalCount = restricted
    ? meals.recipes.filter((r) => allowedIds?.has(r.id) && !r.removed && !r.excludedFromAuto).length
    : library === 'removed'
      ? meals.recipes.filter((r) => r.removed).length
      : meals.recipes.filter((r) => !r.removed && (showNotForFamily || !r.excludedFromAuto)).length;

  const props = {
    query,
    setQuery,
    meal,
    setMeal,
    library,
    setLibrary,
    libraryChoices,
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
