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

type SectionGroup<T> = { section?: string; items: { row: T; index: number }[] };

function groupedBySection<T extends { section: string }>(rows: readonly T[]): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const section = row.section.trim() || undefined;
    const last = groups[groups.length - 1];
    if (last && last.section === section) {
      last.items.push({ row, index });
    } else {
      groups.push({ section, items: [{ row, index }] });
    }
  }
  return groups;
}

export function IngredientEditor({
  ingredients,
  setForm,
}: {
  ingredients: RecipeIngredientRow[];
  setForm: (patch: Partial<RecipeFormState>) => void;
}) {
  const [width, setWidth] = useState(0);
  const compact = width > 0 && width < 520;
  const groups = groupedBySection(ingredients);

  function update(id: string, patch: Partial<RecipeIngredientRow>) {
    setForm({
      ingredients: ingredients.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  }

  function renameSection(from: string | undefined, next: string) {
    const trimmed = next.trim();
    setForm({
      ingredients: ingredients.map((row) => {
        const section = row.section.trim() || undefined;
        if (section !== from) return row;
        return { ...row, section: trimmed };
      }),
    });
  }

  function clearSection(section: string | undefined) {
    if (!section) return;
    setForm({
      ingredients: ingredients.map((row) => {
        const current = row.section.trim() || undefined;
        if (current !== section) return row;
        return { ...row, section: '' };
      }),
    });
  }

  function moveSection(section: string | undefined, dir: -1 | 1) {
    if (!section) return;
    const idx = groups.findIndex((g) => g.section === section);
    if (idx < 0) return;
    const to = idx + dir;
    if (to < 0 || to >= groups.length) return;
    const fromGroup = groups[idx]!;
    const toGroup = groups[to]!;
    const start = fromGroup.items[0]?.index ?? 0;
    const end = fromGroup.items[fromGroup.items.length - 1]?.index ?? start;
    const block = ingredients.slice(start, end + 1);
    const rest = [...ingredients.slice(0, start), ...ingredients.slice(end + 1)];
    const anchorId =
      dir < 0 ? toGroup.items[0]?.row.id : toGroup.items[toGroup.items.length - 1]?.row.id;
    const anchorIndex = anchorId ? rest.findIndex((row) => row.id === anchorId) : -1;
    const insertAt = dir < 0 ? (anchorIndex >= 0 ? anchorIndex : 0) : (anchorIndex >= 0 ? anchorIndex + 1 : rest.length);
    rest.splice(insertAt, 0, ...block);
    setForm({ ingredients: rest });
  }

  function moveWithinSection(globalIndex: number, dir: -1 | 1) {
    const group = groups.find((g) => g.items.some((x) => x.index === globalIndex));
    if (!group) return;
    const local = group.items.findIndex((x) => x.index === globalIndex);
    const toLocal = local + dir;
    if (toLocal < 0 || toLocal >= group.items.length) return;
    const toGlobal = group.items[toLocal]!.index;
    setForm({ ingredients: moveRow(ingredients, globalIndex, toGlobal) });
  }

  return (
    <View
      style={styles.block}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}>
      <Text style={styles.heading}>Ingredients</Text>
      {ingredients.length === 0 ? (
        <Text style={styles.empty}>No ingredients yet.</Text>
      ) : (
        groups.map((group, groupIndex) => (
          <View key={`${group.section ?? 'all'}-${groupIndex}`} style={styles.group}>
            {group.section ? (
              <View style={styles.sectionRow}>
                <TextInput
                  value={group.section}
                  onChangeText={(text) => renameSection(group.section, text)}
                  placeholder="Section"
                  placeholderTextColor={colors.textDim}
                  style={[styles.input, styles.sectionInput]}
                  autoCorrect
                />
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => moveSection(group.section, -1)}
                    disabled={groupIndex === 0}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Move section up"
                    style={[styles.iconBtn, groupIndex === 0 && styles.iconDisabled]}>
                    <Text style={styles.iconLabel}>↑</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => moveSection(group.section, 1)}
                    disabled={groupIndex === groups.length - 1}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Move section down"
                    style={[styles.iconBtn, groupIndex === groups.length - 1 && styles.iconDisabled]}>
                    <Text style={styles.iconLabel}>↓</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => clearSection(group.section)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Remove section"
                    style={styles.iconBtn}>
                    <Text style={styles.removeLabel}>×</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {group.items.map(({ row, index }) => (
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
                      onMoveWithin={(dir) => moveWithinSection(index, dir)}
                    />
                  )}
                </View>
                {compact ? (
                  <RowActions
                    index={index}
                    count={ingredients.length}
                    onMove={(to) => setForm({ ingredients: moveRow(ingredients, index, to) })}
                    onRemove={() => setForm({ ingredients: ingredients.filter((item) => item.id !== row.id) })}
                    onMoveWithin={(dir) => moveWithinSection(index, dir)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}
      <View style={styles.footerRow}>
        <Btn
          label="Add section"
          variant="secondary"
          onPress={() =>
            setForm({
              ingredients: [...ingredients, { id: newRowId('ing'), amount: '', name: '', section: 'Section' }],
            })
          }
        />
        <Btn
          label="Add ingredient"
          variant="secondary"
          onPress={() => {
            const last = ingredients[ingredients.length - 1];
            setForm({
              ingredients: [...ingredients, { id: newRowId('ing'), amount: '', name: '', section: last?.section ?? '' }],
            });
          }}
        />
      </View>
    </View>
  );
}

export function MethodEditor({
  method,
  setForm,
}: {
  method: RecipeMethodRow[];
  setForm: (patch: Partial<RecipeFormState>) => void;
}) {
  const groups = groupedBySection(method);

  function update(id: string, text: string) {
    setForm({
      method: method.map((row) => (row.id === id ? { ...row, text } : row)),
    });
  }

  function renameSection(from: string | undefined, next: string) {
    const trimmed = next.trim();
    setForm({
      method: method.map((row) => {
        const section = row.section.trim() || undefined;
        if (section !== from) return row;
        return { ...row, section: trimmed };
      }),
    });
  }

  function clearSection(section: string | undefined) {
    if (!section) return;
    setForm({
      method: method.map((row) => {
        const current = row.section.trim() || undefined;
        if (current !== section) return row;
        return { ...row, section: '' };
      }),
    });
  }

  function moveSection(section: string | undefined, dir: -1 | 1) {
    if (!section) return;
    const idx = groups.findIndex((g) => g.section === section);
    if (idx < 0) return;
    const to = idx + dir;
    if (to < 0 || to >= groups.length) return;
    const fromGroup = groups[idx]!;
    const toGroup = groups[to]!;
    const start = fromGroup.items[0]?.index ?? 0;
    const end = fromGroup.items[fromGroup.items.length - 1]?.index ?? start;
    const block = method.slice(start, end + 1);
    const rest = [...method.slice(0, start), ...method.slice(end + 1)];
    const anchorId =
      dir < 0 ? toGroup.items[0]?.row.id : toGroup.items[toGroup.items.length - 1]?.row.id;
    const anchorIndex = anchorId ? rest.findIndex((row) => row.id === anchorId) : -1;
    const insertAt = dir < 0 ? (anchorIndex >= 0 ? anchorIndex : 0) : (anchorIndex >= 0 ? anchorIndex + 1 : rest.length);
    rest.splice(insertAt, 0, ...block);
    setForm({ method: rest });
  }

  function moveWithinSection(globalIndex: number, dir: -1 | 1) {
    const group = groups.find((g) => g.items.some((x) => x.index === globalIndex));
    if (!group) return;
    const local = group.items.findIndex((x) => x.index === globalIndex);
    const toLocal = local + dir;
    if (toLocal < 0 || toLocal >= group.items.length) return;
    const toGlobal = group.items[toLocal]!.index;
    setForm({ method: moveRow(method, globalIndex, toGlobal) });
  }

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>Method</Text>
      {method.length === 0 ? (
        <Text style={styles.empty}>No steps yet.</Text>
      ) : (
        groups.map((group, groupIndex) => (
          <View key={`${group.section ?? 'all'}-${groupIndex}`} style={styles.group}>
            {group.section ? (
              <View style={styles.sectionRow}>
                <TextInput
                  value={group.section}
                  onChangeText={(text) => renameSection(group.section, text)}
                  placeholder="Section"
                  placeholderTextColor={colors.textDim}
                  style={[styles.input, styles.sectionInput]}
                  autoCorrect
                />
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => moveSection(group.section, -1)}
                    disabled={groupIndex === 0}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Move section up"
                    style={[styles.iconBtn, groupIndex === 0 && styles.iconDisabled]}>
                    <Text style={styles.iconLabel}>↑</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => moveSection(group.section, 1)}
                    disabled={groupIndex === groups.length - 1}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Move section down"
                    style={[styles.iconBtn, groupIndex === groups.length - 1 && styles.iconDisabled]}>
                    <Text style={styles.iconLabel}>↓</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => clearSection(group.section)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Remove section"
                    style={styles.iconBtn}>
                    <Text style={styles.removeLabel}>×</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {group.items.map(({ row, index }) => (
              <View key={row.id} style={styles.item}>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>{index + 1}</Text>
                  <TextInput
                    value={row.text}
                    onChangeText={(text) => update(row.id, text)}
                    placeholder="What to do…"
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
                  onMoveWithin={(dir) => moveWithinSection(index, dir)}
                />
              </View>
            ))}
          </View>
        ))
      )}
      <View style={styles.footerRow}>
        <Btn
          label="Add section"
          variant="secondary"
          onPress={() =>
            setForm({
              method: [...method, { id: newRowId('step'), text: '', section: 'Section' }],
            })
          }
        />
        <Btn
          label="Add step"
          variant="secondary"
          onPress={() => {
            const last = method[method.length - 1];
            setForm({ method: [...method, { id: newRowId('step'), text: '', section: last?.section ?? '' }] });
          }}
        />
      </View>
    </View>
  );
}

function RowActions({
  index,
  count,
  indent,
  onMove,
  onRemove,
  onMoveWithin,
}: {
  index: number;
  count: number;
  indent?: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
  onMoveWithin?: (dir: -1 | 1) => void;
}) {
  return (
    <View style={[styles.actions, indent && styles.actionsIndent]}>
      <Pressable
        onPress={() => (onMoveWithin ? onMoveWithin(-1) : onMove(index - 1))}
        disabled={onMoveWithin ? false : index === 0}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Move up"
        style={[styles.iconBtn, !onMoveWithin && index === 0 && styles.iconDisabled]}>
        <Text style={styles.iconLabel}>↑</Text>
      </Pressable>
      <Pressable
        onPress={() => (onMoveWithin ? onMoveWithin(1) : onMove(index + 1))}
        disabled={onMoveWithin ? false : index === count - 1}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Move down"
        style={[styles.iconBtn, !onMoveWithin && index === count - 1 && styles.iconDisabled]}>
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
  empty: { color: colors.textMuted, fontSize: 14 },
  group: { gap: 8 },
  item: { gap: 6 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sectionInput: { flex: 1, minWidth: 0, fontWeight: '700' },
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
