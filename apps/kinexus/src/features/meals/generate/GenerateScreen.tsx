import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  CORE_SLOTS,
  filterRecipesForPeople,
  generateMealPlan,
  getDietaryOption,
  recipesForSlot,
  slotTarget,
  type Day,
  type GeneratedSlot,
  type MealSlotKey,
  type NutritionGoals,
  type Recipe,
} from '@kinexus/domain';

import { Field } from '@/src/features/household/ui';
import { GenerateDesktop } from '@/src/features/meals/generate/GenerateDesktop';
import { GenerateMobile } from '@/src/features/meals/generate/GenerateMobile';
import { Sheet } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { colors } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const FALLBACK_GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };

export function GenerateScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const router = useRouter();
  const meals = useMealsSync();
  const { people } = useHousehold();
  const [selected, setSelected] = useState<Set<MealSlotKey>>(() => new Set(CORE_SLOTS));
  const [goalsDraft, setGoalsDraft] = useState<NutritionGoals | null>(null);
  const [preview, setPreview] = useState<GeneratedSlot[] | null>(null);
  const [swapFor, setSwapFor] = useState<{ day: Day; slot: MealSlotKey } | null>(null);
  const [swapQuery, setSwapQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotsInited = useRef(false);
  const goals = goalsDraft ?? meals.goals ?? FALLBACK_GOALS;

  useEffect(() => {
    if (slotsInited.current || meals.activeSlots.length === 0) return;
    setSelected(new Set(meals.activeSlots));
    slotsInited.current = true;
  }, [meals.activeSlots]);

  const filtered = useMemo(() => filterRecipesForPeople(meals.recipes, people), [meals.recipes, people]);
  const dietarySummary = useMemo(() => {
    const ids = [...new Set(people.flatMap((p) => p.dietary))];
    if (people.length === 0) return 'No people yet — add dietary notes in Settings. Catalog is unfiltered.';
    if (ids.length === 0) return `${people.length} people · no restrictions.`;
    return `${people.map((p) => p.name).join(', ')} · ${ids.map((id) => getDietaryOption(id)?.label ?? id).join(', ')}`;
  }, [people]);

  const selectedArray = useMemo(() => [...selected], [selected]);

  const totals = useMemo(() => {
    if (!preview || preview.length === 0) return { avgCal: 0, avgProt: 0 };
    const cal = preview.reduce((sum, row) => sum + (row.recipe.calories ?? 0), 0);
    const prot = preview.reduce((sum, row) => sum + (row.recipe.protein ?? 0), 0);
    return { avgCal: Math.round(cal / 7), avgProt: Math.round(prot / 7) };
  }, [preview]);

  const swapPool = useMemo(() => {
    if (!swapFor) return [];
    const target = slotTarget(swapFor.slot, selectedArray, goals);
    const q = swapQuery.trim().toLowerCase();
    return recipesForSlot(filtered, swapFor.slot)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .slice(0, 40)
      .map((recipe) => ({ recipe, target }));
  }, [filtered, goals, selectedArray, swapFor, swapQuery]);

  function toggleSlot(slot: MealSlotKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
    setPreview(null);
  }

  function runGenerate() {
    setError(null);
    const results = generateMealPlan(selectedArray, new Set(), filtered, goals);
    if (results.length === 0) {
      setError('No matching recipes. Relax dietary filters or add recipes.');
      setPreview(null);
      return;
    }
    setPreview(results);
  }

  async function apply() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      await meals.saveGoals(goals);
      await meals.applyGeneratedPlan(preview, selectedArray);
      router.push('/meals' as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply plan');
    } finally {
      setApplying(false);
    }
  }

  function applySwap(recipe: Recipe) {
    if (!swapFor) return;
    const target = slotTarget(swapFor.slot, selectedArray, goals);
    setPreview((current) =>
      (current ?? []).map((row) =>
        row.day === swapFor.day && row.slot === swapFor.slot
          ? { ...row, recipe, targetCalories: target.calories, targetProtein: target.protein }
          : row,
      ),
    );
    setSwapFor(null);
    setSwapQuery('');
  }

  const viewProps = {
    weekStart: meals.weekStart,
    selected,
    onToggleSlot: toggleSlot,
    goals,
    onChangeGoals: setGoalsDraft,
    dietarySummary,
    recipeCount: filtered.length,
    onGenerate: runGenerate,
    preview,
    avgCal: totals.avgCal,
    avgProt: totals.avgProt,
    onSwap: (day: Day, slot: MealSlotKey) => setSwapFor({ day, slot }),
    onApply: () => void apply(),
    applying,
    error,
    onOpenRecipe: (id: string) => router.push(`/meals/recipes/${id}` as Href),
  };

  return (
    <>
      {desktop ? <GenerateDesktop {...viewProps} /> : <GenerateMobile {...viewProps} />}
      <Sheet
        visible={swapFor !== null}
        title="Swap recipe"
        onClose={() => {
          setSwapFor(null);
          setSwapQuery('');
        }}>
        <Field label="Search" value={swapQuery} onChangeText={setSwapQuery} placeholder="Filter library" />
        {swapPool.map(({ recipe, target }) => (
          <Pressable key={recipe.id} onPress={() => applySwap(recipe)} style={styles.swapRow}>
            <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.swapName}>{recipe.name}</Text>
              <Text style={styles.swapMeta}>
                {recipe.calories ?? '—'} / {target.calories} kcal · {recipe.protein ?? '—'} / {target.protein}g
              </Text>
            </View>
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  swapName: { color: colors.text, fontWeight: '700' },
  swapMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
