import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import type { Recipe } from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { Chip, OfflineBanner } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { FILTERS, SORTS, type RecipeFilter } from '@/src/features/meals/recipes/filters';
import { colors, radius, space } from '@/src/features/shell/theme';

export function RecipesChrome({
  desktop,
  query,
  setQuery,
  filter,
  setFilter,
  sort,
  setSort,
  online,
  pendingCount,
  extra,
  filters = FILTERS,
  children,
}: {
  desktop: boolean;
  query: string;
  setQuery: (v: string) => void;
  filter: RecipeFilter;
  setFilter: (v: RecipeFilter) => void;
  sort: (typeof SORTS)[number]['id'];
  setSort: (v: (typeof SORTS)[number]['id']) => void;
  online: boolean;
  pendingCount: number;
  extra: string | null;
  filters?: { id: RecipeFilter; label: string }[];
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <Text style={styles.kicker}>Library</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Recipes</Text>
      <OfflineBanner online={online} pendingCount={pendingCount} extra={extra} />
      <Btn
        label={online ? 'Import recipe' : 'Import (needs connection)'}
        onPress={() => router.push('/meals/recipes/import' as Href)}
        disabled={!online}
      />
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Name or cuisine" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {filters.map((item) => (
          <Chip key={item.id} label={item.label} active={filter === item.id} onPress={() => setFilter(item.id)} />
        ))}
      </ScrollView>
      <View style={styles.chips}>
        {SORTS.map((item) => (
          <Chip key={item.id} label={item.label} active={sort === item.id} onPress={() => setSort(item.id)} />
        ))}
      </View>
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
        {showFlag && recipe.imageFlagged ? (
          <View style={styles.flagBadge}>
            <Text style={styles.flagText}>Flagged</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.name} numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text style={styles.meta}>
          {recipe.calories ?? '—'} kcal · {recipe.protein ?? '—'}g
          {favourite ? ' · ♥' : ''}
        </Text>
        {recipe.householdId ? <Text style={styles.tag}>Household</Text> : <Text style={styles.tag}>Catalog</Text>}
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
        <Text style={styles.name}>{recipe.name}</Text>
        <Text style={styles.meta}>
          {recipe.calories ?? '—'} kcal · {recipe.protein ?? '—'}g protein
          {favourite ? ' · ♥' : ''}
          {showFlag && recipe.imageFlagged ? ' · Flagged' : ''}
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
  flagBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  flagText: { color: colors.accent, fontSize: 11, fontWeight: '800' },
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
