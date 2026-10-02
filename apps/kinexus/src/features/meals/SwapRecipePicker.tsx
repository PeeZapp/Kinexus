import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  filterRecipesForSwap,
  PROTEIN_KINDS,
  proteinKindsInRecipes,
  sortRecipesByNutrition,
  type Recipe,
  type RecipeProteinKind,
  type SwapRecipeFilters,
} from '@kinexus/domain';

import { Chip } from '@/src/features/meals/meals-kit';
import { RecipePeek } from '@/src/features/meals/RecipePeek';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
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
  const { openMenu, toggleMenu, pick } = useFilterMenus();
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
        <FilterBar>
          {hasVegetarian ? (
            <FilterDropdown<'any' | 'vegetarian'>
              id="diet"
              label="Diet"
              value={filters.vegetarian ? 'vegetarian' : 'any'}
              valueLabel={filters.vegetarian ? 'Vegetarian' : 'Any'}
              active={Boolean(filters.vegetarian)}
              open={openMenu === 'diet'}
              options={[
                { value: 'any', label: 'Any' },
                { value: 'vegetarian', label: 'Vegetarian' },
              ]}
              onToggle={toggleMenu}
              onSelect={pick((value) => onChangeFilters({ ...filters, vegetarian: value === 'vegetarian' }))}
            />
          ) : null}
          {kinds.length > 1 ? (
            <FilterDropdown<RecipeProteinKind | null>
              id="protein"
              label="Protein"
              value={filters.proteinKind ?? null}
              valueLabel={
                PROTEIN_KINDS.find((item) => item.id === filters.proteinKind)?.label ?? 'Any'
              }
              open={openMenu === 'protein'}
              options={[
                { value: null, label: 'Any' },
                ...kinds.map((kind) => ({
                  value: kind,
                  label: PROTEIN_KINDS.find((item) => item.id === kind)?.label ?? kind,
                })),
              ]}
              onToggle={toggleMenu}
              onSelect={pick((value) => onChangeFilters({ ...filters, proteinKind: value }))}
            />
          ) : null}
          {showRandom ? <Chip label="Random similar" onPress={onRandom} /> : null}
        </FilterBar>
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
