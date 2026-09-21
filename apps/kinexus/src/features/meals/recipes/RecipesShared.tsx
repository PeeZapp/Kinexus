import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { formatCostPerServe, type Recipe } from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { Chip, OfflineBanner } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import {
  dirChipsForSort,
  FILTERS,
  SORTS,
  sortChipLabel,
  type RecipeFilter,
  type RecipeSort,
  type SortDir,
} from '@/src/features/meals/recipes/filters';
import { colors, radius, space } from '@/src/features/shell/theme';

function recipeLibraryTag(recipe: Recipe) {
  if (!recipe.householdId) return 'Catalog';
  if (recipe.replacesSource) return 'Your version';
  return 'Household';
}

export function RecipesChrome({
  desktop,
  query,
  setQuery,
  filter,
  setFilter,
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
  filters = FILTERS,
  showNotForFamily = false,
  setShowNotForFamily,
  showImport = true,
  children,
}: {
  desktop: boolean;
  query: string;
  setQuery: (v: string) => void;
  filter: RecipeFilter;
  setFilter: (v: RecipeFilter) => void;
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
  filters?: { id: RecipeFilter; label: string }[];
  showNotForFamily?: boolean;
  setShowNotForFamily?: (v: boolean) => void;
  showImport?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
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
          onPress={() => router.push('/import' as Href)}
          disabled={!online}
        />
      ) : null}
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Name or cuisine" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {filters.map((item) => (
          <Chip key={item.id} label={item.label} active={filter === item.id} onPress={() => setFilter(item.id)} />
        ))}
      </ScrollView>
      {setShowNotForFamily ? (
        <View style={styles.chips}>
          <Chip
            label="Show not for family"
            active={showNotForFamily}
            onPress={() => setShowNotForFamily(!showNotForFamily)}
          />
        </View>
      ) : null}
      <View style={styles.chips}>
        {SORTS.map((item) => (
          <Chip
            key={item.id}
            label={sortChipLabel(item.id, sortDir, sort === item.id)}
            active={sort === item.id}
            onPress={() => onSort(item.id)}
          />
        ))}
      </View>
      {sort !== 'alpha' ? (
        <View style={styles.chips}>
          {dirChipsForSort(sort).map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={sortDir === item.id}
              onPress={() => setSortDir(item.id)}
            />
          ))}
        </View>
      ) : null}
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
          {recipe.calories ?? '—'} kcal · {recipe.protein ?? '—'}g
          {formatCostPerServe(recipe.cost) ? ` · ${formatCostPerServe(recipe.cost)}` : ''}
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
          {recipe.calories ?? '—'} kcal · {recipe.protein ?? '—'}g protein
          {formatCostPerServe(recipe.cost) ? ` · ${formatCostPerServe(recipe.cost)}` : ''}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
