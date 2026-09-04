import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MEAL_SLOTS, recipesForSlot, type Day, type MealSlotKey, type Recipe } from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { Chip, Sheet } from '@/src/features/meals/meals-kit';
import { RecipePhoto, recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import type { PlanSlot } from '@/src/features/meals/use-meals-sync';
import { colors, radius, space } from '@/src/features/shell/theme';

type Props = {
  visible: boolean;
  day: Day | null;
  slotKey: MealSlotKey | null;
  slot: PlanSlot | undefined;
  recipes: Recipe[];
  onClose: () => void;
  onAssign: (recipe: Recipe) => void;
  onClear: () => void;
  onHide: () => void;
  onShuffle: () => void;
  onOpenRecipe: (id: string) => void;
};

export function SlotSheet({
  visible,
  day,
  slotKey,
  slot,
  recipes,
  onClose,
  onAssign,
  onClear,
  onHide,
  onShuffle,
  onOpenRecipe,
}: Props) {
  const [query, setQuery] = useState('');
  const label = MEAL_SLOTS.find((s) => s.key === slotKey)?.label ?? 'Slot';
  const pool = useMemo(() => {
    if (!slotKey) return [];
    const list = recipesForSlot(recipes, slotKey);
    const q = query.trim().toLowerCase();
    return q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list.slice(0, 40);
  }, [query, recipes, slotKey]);

  return (
    <Sheet visible={visible} title={day ? `${titleCase(day)} · ${label}` : label} onClose={onClose}>
      {slot?.recipeId ? (
        <View style={styles.current}>
          <RecipePhoto
            uri={recipePhotoUrl(recipes, slot.recipeId)}
            emoji={slot.emoji}
            size={56}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{slot.recipeName}</Text>
            <Text style={styles.meta}>
              {slot.calories ?? '—'} kcal · {slot.protein ?? '—'}g protein
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>Pick a recipe for this slot.</Text>
      )}
      <View style={styles.actions}>
        {slot?.recipeId ? (
          <>
            <Btn label="Shuffle" variant="secondary" onPress={onShuffle} />
            <Btn label="View recipe" variant="ghost" onPress={() => slot.recipeId && onOpenRecipe(slot.recipeId)} />
            <Btn label="Clear" variant="ghost" onPress={onClear} />
          </>
        ) : null}
        <Btn label="Hide slot" variant="ghost" onPress={onHide} />
      </View>
      <Field label="Search recipes" value={query} onChangeText={setQuery} placeholder="Name" />
      {pool.map((recipe) => (
        <Pressable key={recipe.id} onPress={() => onAssign(recipe)} style={styles.row}>
          <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{recipe.name}</Text>
            <Text style={styles.meta}>
              {recipe.calories ?? '—'} kcal · {recipe.protein ?? '—'}g · {recipe.cookTime ?? '—'}m
            </Text>
          </View>
          {recipe.id === slot?.recipeId ? <Chip label="Current" active /> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

function titleCase(day: Day): string {
  return day.slice(0, 1).toUpperCase() + day.slice(1);
}

const styles = StyleSheet.create({
  current: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: 12,
  },
  hint: { color: colors.textMuted, marginBottom: 12 },
  actions: { gap: 8, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
