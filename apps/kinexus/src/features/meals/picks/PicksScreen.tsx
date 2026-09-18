import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MEAL_SLOTS, type MealSlotKey, type Recipe } from '@kinexus/domain';

import { ErrorText, Field } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { canManageMealPlan } from '@/src/features/meals/picker-access';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function PicksScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const insets = useSafeAreaInsets();
  const { people, role } = useHousehold();
  const meals = useMealsSync();
  const [selectedIds, setSelectedIds] = useState<string[]>(people[0] ? [people[0].id] : []);
  const [slotKey, setSlotKey] = useState<MealSlotKey>('dinner');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageMealPlan(role);

  useEffect(() => {
    const valid = new Set(people.map((person) => person.id));
    setSelectedIds((current) => {
      const next = current.filter((id) => valid.has(id));
      if (next.length > 0) return next;
      return people[0] ? [people[0].id] : [];
    });
  }, [people]);

  const allSelected = people.length > 0 && selectedIds.length === people.length;
  const selectedPeople = people.filter((person) => selectedIds.includes(person.id));
  const approvedByRecipe = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of meals.slotApprovals) {
      if (row.slotKey !== slotKey || !selectedIds.includes(row.personId)) continue;
      map.set(row.recipeId, (map.get(row.recipeId) ?? 0) + 1);
    }
    return map;
  }, [meals.slotApprovals, selectedIds, slotKey]);

  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = meals.recipes.filter((recipe) => !recipe.removed && !recipe.isComponent);
    const filtered = q
      ? list.filter(
          (recipe) =>
            recipe.name.toLowerCase().includes(q) || (recipe.cuisine ?? '').toLowerCase().includes(q),
        )
      : list;
    const needed = selectedIds.length;
    return [...filtered]
      .sort((a, b) => {
        const aOn = (approvedByRecipe.get(a.id) ?? 0) >= needed ? 0 : 1;
        const bOn = (approvedByRecipe.get(b.id) ?? 0) >= needed ? 0 : 1;
        if (aOn !== bOn) return aOn - bOn;
        return a.name.localeCompare(b.name);
      })
      .slice(0, q ? 80 : 60);
  }, [approvedByRecipe, meals.recipes, query, selectedIds.length]);

  if (!canManage) {
    return <Redirect href="/meals" />;
  }

  async function toggle(recipe: Recipe) {
    if (selectedIds.length === 0) return;
    const count = approvedByRecipe.get(recipe.id) ?? 0;
    const approved = count < selectedIds.length;
    setError(null);
    try {
      await meals.setSlotApproval(selectedIds, slotKey, recipe.id, approved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update approved recipes');
    }
  }

  const slotLabel = MEAL_SLOTS.find((slot) => slot.key === slotKey)?.label ?? slotKey;
  const unlinked = selectedPeople.filter((person) => !person.userId);
  const names =
    allSelected && people.length > 1
      ? 'everyone'
      : selectedPeople.map((person) => person.name).join(' and ') || 'Select a person';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        desktop && styles.contentDesktop,
        !desktop && { paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>Family</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Approved picks</Text>
      <Text style={styles.lede}>
        Choose which recipes each person can pick when you assign a meal slot to them. Use All to apply
        the same lunch or dinner list to every kid at once.
      </Text>
      <ErrorText message={error ?? meals.error} />
      {people.length === 0 ? (
        <Text style={styles.hint}>Add people in Settings first, then come back to curate their lists.</Text>
      ) : (
        <>
          <Text style={styles.section}>Person</Text>
          <View style={styles.chips}>
            {people.length > 1 ? (
              <Chip label="All" active={allSelected} onPress={() => setSelectedIds(people.map((person) => person.id))} />
            ) : null}
            {people.map((person) => (
              <Chip
                key={person.id}
                label={person.name}
                active={!allSelected && selectedIds.length === 1 && selectedIds[0] === person.id}
                onPress={() => setSelectedIds([person.id])}
              />
            ))}
          </View>
          <Text style={styles.section}>Meal</Text>
          <View style={styles.chips}>
            {MEAL_SLOTS.map((slot) => (
              <Chip
                key={slot.key}
                label={slot.label}
                active={slotKey === slot.key}
                onPress={() => setSlotKey(slot.key)}
              />
            ))}
          </View>
          <Text style={styles.meta}>
            {selectedIds.length === 0
              ? 'Select a person'
              : `${countFullyApproved(approvedByRecipe, selectedIds.length)} approved for ${names} · ${slotLabel}`}
            {unlinked.length
              ? ` · Link ${unlinked.map((person) => person.name).join(' and ')} in Settings so they can pick when signed in`
              : ''}
          </Text>
          <Field label="Search library" value={query} onChangeText={setQuery} placeholder="Name or cuisine" />
          {pool.map((recipe) => {
            const count = approvedByRecipe.get(recipe.id) ?? 0;
            const on = count >= selectedIds.length && selectedIds.length > 0;
            const some = count > 0 && !on;
            return (
              <Pressable key={recipe.id} onPress={() => void toggle(recipe)} style={styles.row}>
                <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{recipe.name}</Text>
                  <Text style={styles.rowMeta}>
                    {recipe.calories ?? '—'} kcal · {recipe.protein ?? '—'}g
                  </Text>
                </View>
                <Chip
                  label={on ? 'Approved' : some ? 'Some' : 'Add'}
                  active={on}
                  onPress={() => void toggle(recipe)}
                />
              </Pressable>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function countFullyApproved(approvedByRecipe: Map<string, number>, selectedCount: number): number {
  if (selectedCount === 0) return 0;
  let n = 0;
  for (const count of approvedByRecipe.values()) {
    if (count >= selectedCount) n += 1;
  }
  return n;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.md, paddingTop: space.sm, gap: 12 },
  contentDesktop: { paddingHorizontal: 32, paddingBottom: 48, maxWidth: 720 },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  lede: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  hint: { color: colors.textMuted },
  section: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { color: colors.textDim, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  rowMeta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
