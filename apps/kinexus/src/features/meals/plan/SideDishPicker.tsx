import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { recipeForHouseholdView, type Recipe } from '@kinexus/domain';

import { RecipePeek } from '@/src/features/meals/RecipePeek';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { colors, radius } from '@/src/features/shell/theme';

export function AttachedSideDishes({
  sides,
  onOpen,
  onEdit,
  onRemove,
  onAdd,
  style,
}: {
  sides: readonly { id: string; name: string }[];
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (sides.length === 0 && !onAdd) return null;
  return (
    <View style={[styles.attached, style]}>
      {sides.map((side) => (
        <View key={side.id} style={styles.attachedRow}>
          <Pressable
            onPress={() => onOpen(side.id)}
            style={styles.attachedNameHit}
            accessibilityRole="button"
            accessibilityLabel={`View ${side.name}`}>
            <Text style={styles.attachedName} numberOfLines={1}>
              {side.name}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onEdit(side.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${side.name}`}>
            <Text style={styles.action}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => onRemove(side.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${side.name}`}>
            <Text style={styles.action}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {onAdd ? (
        <Pressable onPress={onAdd} hitSlop={6} accessibilityRole="button" accessibilityLabel="Add side dish">
          <Text style={styles.action}>Add side dish</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SideDishRemove({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${name}`}>
      <Text style={styles.action}>Remove</Text>
    </Pressable>
  );
}

export function SideDishPicker({
  recipes,
  selectedIds,
  excludeIds,
  error,
  viewServings,
  onAdd,
  onRemove,
  onEdit,
  onQueryChange,
}: {
  recipes: readonly Recipe[];
  selectedIds: readonly string[];
  excludeIds?: readonly string[];
  error?: string | null;
  viewServings?: number | null;
  onAdd: (recipe: Recipe) => void;
  onRemove: (recipeId: string) => void;
  onEdit?: (recipe: Recipe) => void;
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<Recipe | null>(null);
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

  if (viewing) {
    const already = selected.some((side) => side.id === viewing.id);
    return (
      <RecipePeek
        recipe={viewing}
        viewServings={viewServings}
        useLabel="Add"
        onUse={
          already
            ? undefined
            : () => {
                onAdd(viewing);
                setViewing(null);
              }
        }
        onBack={() => setViewing(null)}
        onEdit={onEdit ? () => onEdit(viewing) : undefined}
        belowActions={
          already ? (
            <SideDishRemove
              name={viewing.name}
              onPress={() => {
                onRemove(viewing.id);
                setViewing(null);
              }}
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <View style={styles.stack}>
      {selected.length > 0 ? (
        <View style={styles.selected}>
          {selected.map((side) => (
            <View key={side.id} style={styles.row}>
              <Pressable
                onPress={() => setViewing(side)}
                style={styles.copyRow}
                accessibilityRole="button"
                accessibilityLabel={`View ${side.name}`}>
                <RecipePhoto uri={side.imageUrl} emoji={side.emoji} size={40} />
                <Text style={styles.name}>{side.name}</Text>
              </Pressable>
              {onEdit ? (
                <Pressable
                  onPress={() => onEdit(side)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${side.name}`}>
                  <Text style={styles.action}>Edit</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => onRemove(side.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${side.name}`}>
                <Text style={styles.action}>Remove</Text>
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {list.length === 0 ? (
        <Text style={styles.empty}>
          {searching ? 'No dishes match that search.' : 'No sides yet. Search for a dish to add one.'}
        </Text>
      ) : (
        list.map((recipe) => (
          <View key={recipe.id} style={styles.row}>
            <Pressable
              onPress={() => setViewing(recipe)}
              style={styles.copyRow}
              accessibilityRole="button"
              accessibilityLabel={`View ${recipe.name}`}>
              <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size={40} />
              <View style={styles.copy}>
                <Text style={styles.name}>{recipe.name}</Text>
                {recipe.calories != null ? <Text style={styles.meta}>{recipe.calories} kcal</Text> : null}
              </View>
            </Pressable>
            <Pressable
              onPress={() => onAdd(recipe)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Add ${recipe.name}`}>
              <Text style={styles.add}>Add</Text>
            </Pressable>
          </View>
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
  attached: { gap: 8 },
  attachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
    paddingLeft: 10,
    paddingRight: 8,
    backgroundColor: colors.bgHover,
    borderRadius: radius.sm,
  },
  attachedNameHit: { flex: 1, minWidth: 0 },
  attachedName: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 18 },
  action: { color: colors.accent, fontSize: 12, fontWeight: '700' },
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
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  copyRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textDim, fontSize: 12 },
  add: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
