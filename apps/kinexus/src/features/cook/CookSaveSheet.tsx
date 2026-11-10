import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  cleanRecipeToHouseholdDraft,
  MEAL_SLOTS,
  RECIPE_CLASSES,
  suggestMealSlotsFromTitle,
  type CleanRecipe,
  type MealSlotKey,
  type RecipeClass,
} from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { Chip, Sheet } from '@/src/features/meals/meals-kit';
import { ImportFieldsCard } from '@/src/features/meals/recipes/ImportShared';
import { RecipeCoverPicker } from '@/src/features/meals/recipes/RecipeCoverPicker';
import { ingredientRowsFrom, methodRowsFrom, type RecipeFormState } from '@/src/features/meals/recipes/recipe-form';
import { ErrorBanner } from '@/src/features/shell/states';
import { colors } from '@/src/features/shell/theme';

export function formFromCleanRecipe(recipe: CleanRecipe): RecipeFormState {
  const draft = cleanRecipeToHouseholdDraft(recipe);
  return {
    url: draft.sourceUrl ?? recipe.attribution.sourceUrl ?? '',
    name: draft.name,
    emoji: '🍽️',
    cuisine: draft.cuisine ?? '',
    cookTime: draft.cookTime != null ? String(draft.cookTime) : '',
    servings: draft.servings != null ? String(draft.servings) : '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    ingredients: ingredientRowsFrom(draft.ingredients ?? []),
    method: methodRowsFrom(draft.method ?? []),
    chefTip: draft.chefTip ?? '',
    notes: '',
    slots: draft.mealSlots ?? [],
    recipeClass: null,
    imageUrl: draft.imageUrl ?? '',
    imageCandidates: recipe.imageCandidates ?? (draft.imageUrl ? [draft.imageUrl] : []),
  };
}

export function CookSaveSheet({
  visible,
  form,
  setForm,
  busy,
  error,
  onClose,
  onSave,
}: {
  visible: boolean;
  form: RecipeFormState;
  setForm: (patch: Partial<RecipeFormState>) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const suggestions = useMemo(
    () => suggestMealSlotsFromTitle(form.name).filter((slot) => !form.slots.includes(slot)),
    [form.name, form.slots],
  );

  function toggleSlot(slot: MealSlotKey) {
    setForm({
      slots: form.slots.includes(slot) ? form.slots.filter((entry) => entry !== slot) : [...form.slots, slot],
    });
  }

  return (
    <Sheet visible={visible} title="Save recipe" onClose={onClose} wide desktopMaxWidth={720}>
      <View style={styles.body}>
        {form.imageUrl || form.imageCandidates.length ? (
          <RecipeCoverPicker
            imageUrl={form.imageUrl}
            imageCandidates={form.imageCandidates}
            onSelect={(imageUrl) => setForm({ imageUrl })}
          />
        ) : null}
        <Field label="Title" value={form.name} onChangeText={(name) => setForm({ name })} />
        <Field
          label="Short description"
          value={form.chefTip}
          onChangeText={(chefTip) => setForm({ chefTip })}
          placeholder="Optional note"
          multiline
        />

        <Text style={styles.section}>Meal slots</Text>
        <View style={styles.chips}>
          {MEAL_SLOTS.map((slot) => (
            <Chip
              key={slot.key}
              label={slot.label}
              active={form.slots.includes(slot.key)}
              onPress={() => toggleSlot(slot.key)}
            />
          ))}
        </View>
        {suggestions.length ? (
          <View style={styles.suggestRow}>
            <Text style={styles.suggestLabel}>Suggested</Text>
            {suggestions.map((slot) => (
              <Chip
                key={slot}
                label={MEAL_SLOTS.find((item) => item.key === slot)?.label ?? slot}
                onPress={() => toggleSlot(slot)}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.section}>Class</Text>
        <View style={styles.chips}>
          {RECIPE_CLASSES.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              active={form.recipeClass === item.key}
              onPress={() =>
                setForm({
                  recipeClass: (form.recipeClass === item.key ? null : item.key) as RecipeClass | null,
                })
              }
            />
          ))}
        </View>

        <Pressable onPress={() => setEditing((current) => !current)} style={styles.expander}>
          <Text style={styles.expanderLabel}>{editing ? 'Hide details' : 'Edit details'}</Text>
        </Pressable>
        {editing ? <ImportFieldsCard form={form} setForm={setForm} showCover={false} /> : null}

        {error ? <ErrorBanner message={error} /> : null}
        <Btn label="Save to household" onPress={onSave} busy={busy} disabled={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
    paddingBottom: 32,
  },
  section: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  suggestLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  expander: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  expanderLabel: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
