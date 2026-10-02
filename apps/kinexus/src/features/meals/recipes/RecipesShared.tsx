import { type ReactNode, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { formatCostPerServe, type Recipe } from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { OfflineBanner } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import {
  defaultSortDir,
  dirChipsForSort,
  LIBRARY_FILTERS,
  MEAL_FILTERS,
  SORTS,
  type RecipeLibraryFilter,
  type RecipeMealFilter,
  type RecipeSort,
  type SortDir,
} from '@/src/features/meals/recipes/filters';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { isLinkOnlyRecipe } from '@/src/features/meals/recipes/link-recipe';
import {
  getRecipesListScrollY,
  setRecipesListScrollY,
} from '@/src/features/meals/recipes/recipes-list-state';
import { colors, radius, space } from '@/src/features/shell/theme';

function recipeLibraryTag(recipe: Recipe) {
  if (isLinkOnlyRecipe(recipe)) return 'Link only';
  if (!recipe.householdId) return 'Catalog';
  if (recipe.replacesSource) return 'Your version';
  return 'Household';
}

export function RecipesChrome({
  desktop,
  query,
  setQuery,
  meal,
  setMeal,
  library,
  setLibrary,
  sort,
  sortDir,
  onSort,
  setSortDir,
  online,
  pendingCount,
  extra,
  totalCount,
  shownCount,
  loading,
  libraryChoices = LIBRARY_FILTERS,
  showNotForFamily = false,
  setShowNotForFamily,
  showImport = true,
  children,
}: {
  desktop: boolean;
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
  totalCount: number;
  shownCount: number;
  loading?: boolean;
  libraryChoices?: { id: RecipeLibraryFilter; label: string }[];
  showNotForFamily?: boolean;
  setShowNotForFamily?: (v: boolean) => void;
  showImport?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const mealLabel = MEAL_FILTERS.find((item) => item.id === meal)?.label ?? 'All';
  const libraryLabel = libraryChoices.find((item) => item.id === library)?.label ?? 'All';
  const sortLabel = SORTS.find((item) => item.id === sort)?.label ?? 'A–Z';
  const orderOptions = dirChipsForSort(sort);
  const orderLabel = orderOptions.find((item) => item.id === sortDir)?.label ?? orderOptions[0]?.label ?? 'Order';
  const scrollRef = useRef<ScrollView>(null);
  const restoredRef = useRef(false);
  const pendingY = useRef(getRecipesListScrollY());

  useEffect(() => {
    restoredRef.current = false;
    pendingY.current = getRecipesListScrollY();
  }, []);

  function restoreScroll(_width?: number, height?: number) {
    const y = pendingY.current;
    if (restoredRef.current || y <= 0) return;
    if (typeof height === 'number' && height > 0 && height < y) return;
    restoredRef.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setRecipesListScrollY(e.nativeEvent.contentOffset.y);
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onContentSizeChange={restoreScroll}>
      <Text style={styles.kicker}>Library</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Recipes</Text>
      <Text style={styles.count}>
        {loading && totalCount === 0
          ? 'Loading recipes…'
          : shownCount === totalCount
            ? `${totalCount.toLocaleString()} recipes in library`
            : `Showing ${shownCount.toLocaleString()} of ${totalCount.toLocaleString()} recipes in library`}
      </Text>
      <OfflineBanner online={online} pendingCount={pendingCount} extra={extra} />
      {showImport ? (
        <Btn
          label={online ? 'Import recipe' : 'Import (needs connection)'}
          onPress={() => router.push('/meals/recipes/import' as Href)}
          disabled={!online}
        />
      ) : null}
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Name or cuisine" />
      <FilterBar>
        <FilterDropdown<RecipeMealFilter>
          id="meal"
          label="Meal"
          value={meal}
          valueLabel={mealLabel}
          active={meal !== 'all'}
          open={openMenu === 'meal'}
          options={MEAL_FILTERS.map((item) => ({ value: item.id, label: item.label }))}
          onToggle={toggleMenu}
          onSelect={pick(setMeal)}
        />
        <FilterDropdown<RecipeLibraryFilter>
          id="library"
          label="Library"
          value={library}
          valueLabel={libraryLabel}
          active={library !== 'all'}
          open={openMenu === 'library'}
          options={libraryChoices.map((item) => ({ value: item.id, label: item.label }))}
          onToggle={toggleMenu}
          onSelect={pick(setLibrary)}
        />
        {setShowNotForFamily ? (
          <FilterDropdown<'family' | 'all'>
            id="family"
            label="Family"
            value={showNotForFamily ? 'all' : 'family'}
            valueLabel={showNotForFamily ? 'Show all' : 'Family only'}
            active={showNotForFamily}
            open={openMenu === 'family'}
            options={[
              { value: 'family', label: 'Family only' },
              { value: 'all', label: 'Show all' },
            ]}
            onToggle={toggleMenu}
            onSelect={pick((value) => setShowNotForFamily(value === 'all'))}
          />
        ) : null}
        <FilterDropdown<RecipeSort>
          id="sort"
          label="Sort"
          value={sort}
          valueLabel={sortLabel}
          active={sort !== 'alpha'}
          open={openMenu === 'sort'}
          options={SORTS.map((item) => ({ value: item.id, label: item.label }))}
          onToggle={toggleMenu}
          onSelect={pick(onSort)}
        />
        <FilterDropdown<SortDir>
          id="order"
          label="Order"
          value={sortDir}
          valueLabel={orderLabel}
          active={sortDir !== defaultSortDir(sort)}
          open={openMenu === 'order'}
          options={orderOptions.map((item) => ({ value: item.id, label: item.label }))}
          onToggle={toggleMenu}
          onSelect={pick(setSortDir)}
        />
      </FilterBar>
      {children}
    </ScrollView>
  );
}

export function RecipeCard({
  recipe,
  favourite,
  onPress,
  wide,
  showFlag,
}: {
  recipe: Recipe;
  favourite: boolean;
  onPress: () => void;
  wide?: boolean;
  showFlag?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.card, wide && styles.cardWide]}>
      <View style={styles.cardPhoto}>
        <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size="fill" radius={0} />
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.name} numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text style={styles.meta}>
          {isLinkOnlyRecipe(recipe)
            ? 'Full recipe not found'
            : `${recipe.calories ?? '—'} kcal · ${recipe.protein ?? '—'}g`}
          {!isLinkOnlyRecipe(recipe) && formatCostPerServe(recipe.cost) ? ` · ${formatCostPerServe(recipe.cost)}` : ''}
          {favourite ? ' · ♥' : ''}
        </Text>
        <Text style={styles.tag}>{recipeLibraryTag(recipe)}</Text>
        {recipe.excludedFromAuto ? <Text style={styles.tag}>Not for family</Text> : null}
        {showFlag && recipe.removed ? <Text style={styles.tag}>Removed</Text> : null}
      </View>
    </Pressable>
  );
}

export function RecipeRow({
  recipe,
  favourite,
  onPress,
  showFlag,
}: {
  recipe: Recipe;
  favourite: boolean;
  onPress: () => void;
  showFlag?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size={56} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {recipe.name}
        </Text>
        <Text style={styles.meta}>
          {isLinkOnlyRecipe(recipe)
            ? 'Full recipe not found'
            : `${recipe.calories ?? '—'} kcal · ${recipe.protein ?? '—'}g protein`}
          {!isLinkOnlyRecipe(recipe) && formatCostPerServe(recipe.cost) ? ` · ${formatCostPerServe(recipe.cost)}` : ''}
          {favourite ? ' · ♥' : ''}
          {` · ${recipeLibraryTag(recipe)}`}
          {recipe.excludedFromAuto ? ' · Not for family' : ''}
          {showFlag && recipe.removed ? ' · Removed' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 12, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 48, maxWidth: 1200 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  count: { color: colors.textMuted, fontSize: 14, marginTop: -4 },
  card: {
    width: 220,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardWide: { width: 240 },
  cardPhoto: { height: 140, width: '100%' },
  cardCopy: { padding: space.sm, gap: 6 },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 64,
  },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 12 },
  tag: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
