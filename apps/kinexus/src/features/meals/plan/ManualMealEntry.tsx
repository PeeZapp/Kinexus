import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { MealSlotKey, Recipe } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { IngredientEditor, MethodEditor } from '@/src/features/meals/recipes/recipe-editors';
import { draftFromForm, EMPTY_RECIPE_FORM, type RecipeFormState } from '@/src/features/meals/recipes/recipe-form';
import { colors, radius } from '@/src/features/shell/theme';

type Draft = Omit<Recipe, 'id' | 'householdId'>;

export function ManualMealEntry({
  name,
  slot,
  allowTitle = true,
  onUseTitle,
  onSave,
}: {
  name: string;
  slot: MealSlotKey;
  /** Title-only meals are already on the day, so hide "This day". */
  allowTitle?: boolean;
  onUseTitle: (name: string) => void | Promise<void>;
  onSave: (draft: Draft) => Promise<void>;
}) {
  const title = name.trim();
  const [mode, setMode] = useState<'choose' | 'explain' | 'recipe'>('choose');
  const [notes, setNotes] = useState('');
  const [form, setForm] = useState<RecipeFormState>(() => ({
    ...EMPTY_RECIPE_FORM,
    name: title,
    cookTime: '',
    servings: '',
    slots: [slot],
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(draft: Draft) {
    setBusy(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that recipe');
    } finally {
      setBusy(false);
    }
  }

  if (!title) return null;

  if (mode === 'choose') {
    return (
      <View style={styles.box}>
        <Text style={styles.name}>{title}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          {allowTitle ? (
            <Chip
              label="This day"
              onPress={() => {
                setError(null);
                void Promise.resolve(onUseTitle(title)).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Could not save that meal');
                });
              }}
            />
          ) : null}
          <Chip label="Explain" onPress={() => setMode('explain')} />
          <Chip label="Full recipe" onPress={() => setMode('recipe')} />
        </View>
      </View>
    );
  }

  if (mode === 'explain') {
    return (
      <View style={styles.box}>
        <Text style={styles.name}>{title}</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="What this dish is"
          placeholderTextColor={colors.textDim}
          style={[styles.input, styles.notes]}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Btn
            label="Add recipe"
            busy={busy}
            onPress={() => {
              const text = notes.trim();
              if (!text) {
                setError('Write what the dish is.');
                return;
              }
              void save({
                name: title,
                emoji: '🍽️',
                notes: text,
                ingredients: [],
                method: [],
                mealSlots: [slot],
              });
            }}
          />
          <Btn label="Back" variant="secondary" onPress={() => setMode('choose')} disabled={busy} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.name}>{title}</Text>
      <IngredientEditor
        ingredients={form.ingredients}
        hint={false}
        setForm={(patch) => setForm((current) => ({ ...current, ...patch, name: title, slots: [slot] }))}
      />
      <MethodEditor
        method={form.method}
        hint={false}
        setForm={(patch) => setForm((current) => ({ ...current, ...patch, name: title, slots: [slot] }))}
      />
      <TextInput
        value={form.notes}
        onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))}
        placeholder="Notes"
        placeholderTextColor={colors.textDim}
        style={[styles.input, styles.notes]}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Btn
          label="Add recipe"
          busy={busy}
          onPress={() => {
            const draft = draftFromForm({ ...form, name: title, slots: [slot] });
            if (!(draft.ingredients?.length || draft.method?.length)) {
              setError('Add an ingredient or a step.');
              return;
            }
            void save(draft);
          }}
        />
        <Btn label="Back" variant="secondary" onPress={() => setMode('choose')} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  notes: { minHeight: 96 },
  error: { color: colors.danger, fontSize: 13 },
});
