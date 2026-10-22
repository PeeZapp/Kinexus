import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { recipeForHouseholdView, type Recipe } from '@kinexus/domain';

import { colors, radius } from '@/src/features/shell/theme';

export function SideDishPicker({
  recipes,
  selectedIds,
  excludeIds,
  error,
  onAdd,
  onRemove,
  onQueryChange,
}: {
  recipes: readonly Recipe[];
  selectedIds: readonly string[];
  excludeIds?: readonly string[];
  error?: string | null;
  onAdd: (recipe: Recipe) => void;
  onRemove: (recipeId: string) => void;
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = selectedIds.flatMap((id) => {
    const recipe = recipeForHouseholdView(recipes, id);
    return recipe ? [recipe] : [];
  });
  const taken = useMemo(() => {
    const ids = new Set<string>([...selectedIds, ...(excludeIds ?? [])]);
    for (const recipe of selected) ids.add(recipe.id);
    return ids;
  }, [excludeIds, selected, selectedIds]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes
      .filter((recipe) => {
        if (recipe.removed || taken.has(recipe.id)) return false;
        if (!q) return recipe.recipeClass === 'side';
        return (
          recipe.name.toLowerCase().includes(q) ||
          (recipe.cuisine ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (!q) return a.name.localeCompare(b.name);
        const rank = searchRank(a, q) - searchRank(b, q);
        return rank !== 0 ? rank : a.name.localeCompare(b.name);
      });
  }, [query, recipes, taken]);
  const searching = query.trim().length > 0;

  return (
    <View style={styles.stack}>
      {selected.length > 0 ? (
        <View style={styles.selected}>
          {selected.map((side) => (
            <View key={side.id} style={styles.row}>
              <Text style={styles.name}>{side.name}</Text>
              <Pressable onPress={() => onRemove(side.id)} hitSlop={6}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        value={query}
        onChangeText={(next) => {
          setQuery(next);
          onQueryChange?.(next);
        }}
        placeholder="Search dishes"
        placeholderTextColor={colors.textDim}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        {searching ? 'Matching dishes' : 'Sides from your recipe book. Search to add any dish.'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {list.length === 0 ? (
        <Text style={styles.empty}>
          {searching ? 'No dishes match that search.' : 'No sides yet. Search for a dish to add one.'}
        </Text>
      ) : (
        list.map((recipe) => (
          <Pressable key={recipe.id} onPress={() => onAdd(recipe)} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.name}>{recipe.name}</Text>
              {recipe.calories != null ? <Text style={styles.meta}>{recipe.calories} kcal</Text> : null}
            </View>
            <Text style={styles.add}>Add</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function searchRank(recipe: Recipe, query: string): number {
  const name = recipe.name.trim().toLowerCase();
  const nameHit = name.includes(query);
  const boundary = name.charAt(query.length);
  const prefix = name.startsWith(query) && (boundary === '' || !/[a-z0-9]/i.test(boundary));
  if (name === query) return 0;
  if (prefix) return 1;
  if (nameHit && recipe.recipeClass === 'side') return 2;
  if (nameHit) return 3;
  if (recipe.recipeClass === 'side') return 4;
  return 5;
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  selected: { gap: 8, marginBottom: 4 },
  search: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textDim, fontSize: 12 },
  add: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  remove: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
});
