import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  filterRecipesForSwap,
  PROTEIN_KINDS,
  proteinKindsInRecipes,
  sortRecipesByNutrition,
  type Recipe,
  type SwapRecipeFilters,
} from '@kinexus/domain';

import { Chip } from '@/src/features/meals/meals-kit';
import { RecipePeek } from '@/src/features/meals/RecipePeek';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { colors, radius } from '@/src/features/shell/theme';

export function SwapRecipePicker({
  recipes,
  currentId,
  current,
  target,
  filters,
  viewing,
  showRandom = true,
  onChangeFilters,
  onView,
  onPick,
  onRandom,
}: {
  recipes: Recipe[];
  currentId?: string | null;
  current?: { calories?: number | null; protein?: number | null } | null;
  target?: { calories: number; protein: number } | null;
  filters: SwapRecipeFilters;
  viewing: Recipe | null;
  showRandom?: boolean;
  onChangeFilters: (next: SwapRecipeFilters) => void;
  onView: (recipe: Recipe | null) => void;
  onPick: (recipe: Recipe) => void;
  onRandom: () => void;
}) {
  const kinds = proteinKindsInRecipes(recipes);
  const hasVegetarian = recipes.some((recipe) => recipe.vegetarian);
  const reference = {
    calories: current?.calories || target?.calories || null,
    protein: current?.protein || target?.protein || null,
  };
  const list = sortRecipesByNutrition(filterRecipesForSwap(recipes, filters), reference);

  if (viewing) {
    return (
      <RecipePeek
        recipe={viewing}
        target={target}
        onUse={() => onPick(viewing)}
        onRandom={showRandom ? onRandom : undefined}
        onBack={() => onView(null)}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <TextInput
        value={filters.query ?? ''}
        onChangeText={(query) => onChangeFilters({ ...filters, query })}
        placeholder="Search name, cuisine, or protein"
        placeholderTextColor={colors.textDim}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {hasVegetarian || kinds.length > 1 || showRandom ? (
        <View style={styles.chips}>
          {hasVegetarian ? (
            <Chip
              label="Vegetarian"
              active={Boolean(filters.vegetarian)}
              onPress={() => onChangeFilters({ ...filters, vegetarian: !filters.vegetarian })}
            />
          ) : null}
          {kinds.map((kind) => {
            const label = PROTEIN_KINDS.find((item) => item.id === kind)?.label ?? kind;
            return (
              <Chip
                key={kind}
                label={label}
                active={filters.proteinKind === kind}
                onPress={() =>
                  onChangeFilters({
                    ...filters,
                    proteinKind: filters.proteinKind === kind ? null : kind,
                  })
                }
              />
            );
          })}
          {showRandom ? <Chip label="Random similar" onPress={onRandom} /> : null}
        </View>
      ) : null}
      <Text style={styles.count}>
        {list.length} recipe{list.length === 1 ? '' : 's'} for this slot
        {reference.calories ? ' · closest nutrition first' : ''}
      </Text>
      {list.length === 0 ? (
        <Text style={styles.hint}>No matching recipes. Clear a filter or search a different name.</Text>
      ) : (
        list.map((recipe) => (
          <View key={recipe.id} style={styles.row}>
            <Pressable onPress={() => onView(recipe)} style={styles.rowMain}>
              <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{recipe.name}</Text>
                <Text style={styles.meta}>
                  {recipe.calories ?? '—'}
                  {target ? ` / ${target.calories}` : ''} kcal · {recipe.protein ?? '—'}
                  {target ? ` / ${target.protein}` : ''}g
                  {recipe.vegetarian ? ' · veg' : ''}
                  {recipe.cuisine ? ` · ${recipe.cuisine}` : ''}
                </Text>
              </View>
            </Pressable>
            {recipe.id === currentId ? <Chip label="Current" active /> : null}
            <Chip label="Use" onPress={() => onPick(recipe)} />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  count: { color: colors.textDim, fontSize: 12 },
  hint: { color: colors.textMuted, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
