import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Btn } from '@/src/features/household/ui';
import {
  moveRow,
  newRowId,
  type RecipeFormState,
  type RecipeIngredientRow,
  type RecipeMethodRow,
} from '@/src/features/meals/recipes/recipe-form';
import { colors, radius } from '@/src/features/shell/theme';

export function IngredientEditor({
  ingredients,
  setForm,
  hint = true,
}: {
  ingredients: RecipeIngredientRow[];
  setForm: (patch: Partial<RecipeFormState>) => void;
  hint?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const compact = width > 0 && width < 520;

  function update(id: string, patch: Partial<RecipeIngredientRow>) {
    setForm({
      ingredients: ingredients.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  }

  return (
    <View
      style={styles.block}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}>
      <Text style={styles.heading}>Ingredients</Text>
      {hint ? <Text style={styles.hint}>One ingredient per row. Amount is optional.</Text> : null}
      {ingredients.length === 0 ? (
        <Text style={styles.empty}>No ingredients yet.</Text>
      ) : (
        ingredients.map((row, index) => (
          <View key={row.id} style={styles.item}>
            <View style={styles.ingredientRow}>
              <TextInput
                value={row.amount}
                onChangeText={(amount) => update(row.id, { amount })}
                placeholder="Amount"
                placeholderTextColor={colors.textDim}
                style={[styles.input, styles.amount]}
                autoCorrect={false}
              />
              <TextInput
                value={row.name}
                onChangeText={(name) => update(row.id, { name })}
                placeholder="Ingredient"
                placeholderTextColor={colors.textDim}
                style={[styles.input, styles.grow]}
                autoCorrect
              />
              {compact ? null : (
                <RowActions
                  index={index}
                  count={ingredients.length}
                  onMove={(to) => setForm({ ingredients: moveRow(ingredients, index, to) })}
                  onRemove={() => setForm({ ingredients: ingredients.filter((item) => item.id !== row.id) })}
                />
              )}
            </View>
            {compact ? (
              <RowActions
                index={index}
                count={ingredients.length}
                onMove={(to) => setForm({ ingredients: moveRow(ingredients, index, to) })}
                onRemove={() => setForm({ ingredients: ingredients.filter((item) => item.id !== row.id) })}
              />
            ) : null}
          </View>
        ))
      )}
      <Btn
        label="Add ingredient"
        variant="secondary"
        onPress={() =>
          setForm({
            ingredients: [...ingredients, { id: newRowId('ing'), amount: '', name: '' }],
          })
        }
      />
    </View>
  );
}

export function MethodEditor({
  method,
  setForm,
  hint = true,
}: {
  method: RecipeMethodRow[];
  setForm: (patch: Partial<RecipeFormState>) => void;
  hint?: boolean;
}) {
  function update(id: string, text: string) {
    setForm({
      method: method.map((row) => (row.id === id ? { ...row, text } : row)),
    });
  }

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>Method</Text>
      {hint ? <Text style={styles.hint}>Each step is its own box. Add, remove, or reorder as you go.</Text> : null}
      {method.length === 0 ? (
        <Text style={styles.empty}>No steps yet.</Text>
      ) : (
        method.map((row, index) => (
          <View key={row.id} style={styles.item}>
            <View style={styles.stepRow}>
              <Text style={styles.stepNum}>{index + 1}</Text>
              <TextInput
                value={row.text}
                onChangeText={(text) => update(row.id, text)}
                placeholder="What to do in this step…"
                placeholderTextColor={colors.textDim}
                style={[styles.input, styles.stepInput, Platform.OS === 'web' && styles.stepInputWeb]}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>
            <RowActions
              index={index}
              count={method.length}
              indent
              onMove={(to) => setForm({ method: moveRow(method, index, to) })}
              onRemove={() => setForm({ method: method.filter((item) => item.id !== row.id) })}
            />
          </View>
        ))
      )}
      <Btn
        label="Add step"
        variant="secondary"
        onPress={() => setForm({ method: [...method, { id: newRowId('step'), text: '' }] })}
      />
    </View>
  );
}

function RowActions({
  index,
  count,
  indent,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  indent?: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.actions, indent && styles.actionsIndent]}>
      <Pressable
        onPress={() => onMove(index - 1)}
        disabled={index === 0}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Move up"
        style={[styles.iconBtn, index === 0 && styles.iconDisabled]}>
        <Text style={styles.iconLabel}>↑</Text>
      </Pressable>
      <Pressable
        onPress={() => onMove(index + 1)}
        disabled={index === count - 1}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Move down"
        style={[styles.iconBtn, index === count - 1 && styles.iconDisabled]}>
        <Text style={styles.iconLabel}>↓</Text>
      </Pressable>
      <Pressable
        onPress={onRemove}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Remove"
        style={styles.iconBtn}>
        <Text style={styles.removeLabel}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: -6 },
  empty: { color: colors.textMuted, fontSize: 14 },
  item: { gap: 6 },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    minWidth: 0,
  },
  amount: { width: 96, flexGrow: 0, flexShrink: 0 },
  grow: { flex: 1, minWidth: 0 },
  stepNum: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    minWidth: 28,
    paddingTop: 14,
  },
  stepInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 96,
    paddingTop: 12,
  },
  stepInputWeb: {
    height: 'auto',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  actionsIndent: { paddingLeft: 36 },
  iconBtn: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDisabled: { opacity: 0.35 },
  iconLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  removeLabel: { color: colors.danger, fontSize: 20, fontWeight: '500', lineHeight: 22 },
});
