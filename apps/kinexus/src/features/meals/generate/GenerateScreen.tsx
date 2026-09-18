import { useEffect, useMemo, useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  CORE_SLOTS,
  filterRecipesForPeople,
  generateMealPlan,
  getDietaryOption,
  pickRandomSwapRecipe,
  plannedDays,
  recipesForSlot,
  rememberSwapId,
  slotTarget,
  type Day,
  type GeneratedSlot,
  type MealSlotKey,
  type NutritionGoals,
  type Recipe,
  type SwapRecipeFilters,
} from '@kinexus/domain';

import { GenerateDesktop } from '@/src/features/meals/generate/GenerateDesktop';
import { GenerateMobile } from '@/src/features/meals/generate/GenerateMobile';
import { Sheet } from '@/src/features/meals/meals-kit';
import { canManageMealPlan } from '@/src/features/meals/picker-access';
import { RecipePeek } from '@/src/features/meals/RecipePeek';
import { SwapRecipePicker } from '@/src/features/meals/SwapRecipePicker';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const FALLBACK_GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };
const EMPTY_FILTERS: SwapRecipeFilters = {};

export function GenerateScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const router = useRouter();
  const meals = useMealsSync();
  const { people, role } = useHousehold();
  const [selected, setSelected] = useState<Set<MealSlotKey>>(() => new Set(CORE_SLOTS));
  const [goalsDraft, setGoalsDraft] = useState<NutritionGoals | null>(null);
  const [preview, setPreview] = useState<GeneratedSlot[] | null>(null);
  const [swapFor, setSwapFor] = useState<{ day: Day; slot: MealSlotKey } | null>(null);
  const [swapFilters, setSwapFilters] = useState<SwapRecipeFilters>(EMPTY_FILTERS);
  const [swapViewing, setSwapViewing] = useState<Recipe | null>(null);
  const [peek, setPeek] = useState<{ day: Day; slot: MealSlotKey; recipe: Recipe } | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotsInited = useRef(false);
  const recentSwaps = useRef(new Map<string, string[]>());
  const goals = goalsDraft ?? meals.goals ?? FALLBACK_GOALS;

  useEffect(() => {
    if (slotsInited.current || meals.activeSlots.length === 0) return;
    setSelected(new Set(meals.activeSlots));
    slotsInited.current = true;
  }, [meals.activeSlots]);

  const filtered = useMemo(
    () => filterRecipesForPeople(meals.recipes.filter((r) => !r.removed && !r.excludedFromAuto), people),
    [meals.recipes, people],
  );
  const dietarySummary = useMemo(() => {
    const ids = [...new Set(people.flatMap((p) => p.dietary))];
    if (people.length === 0) return 'No people yet — add dietary notes in Settings. Catalog is unfiltered.';
    if (ids.length === 0) return `${people.length} people · no restrictions.`;
    return `${people.map((p) => p.name).join(', ')} · ${ids.map((id) => getDietaryOption(id)?.label ?? id).join(', ')}`;
  }, [people]);

  const selectedArray = useMemo(() => [...selected], [selected]);

  const planDays = useMemo(
    () => plannedDays(meals.activeSlots.length > 0 ? meals.activeSlots : [...CORE_SLOTS], meals.slotMap),
    [meals.activeSlots, meals.slotMap],
  );

  const hiddenSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const slot of meals.slots) {
      if (slot.hidden) keys.add(`${slot.day}_${slot.slotKey}`);
    }
    return keys;
  }, [meals.slots]);

  const fillableCount = useMemo(() => {
    let count = 0;
    for (const day of planDays) {
      for (const slot of selectedArray) {
        if (!hiddenSlotKeys.has(`${day}_${slot}`)) count += 1;
      }
    }
    return count;
  }, [hiddenSlotKeys, planDays, selectedArray]);

  const totals = useMemo(() => {
    if (!preview || preview.length === 0) return { avgCal: 0, avgProt: 0 };
    const cal = preview.reduce((sum, row) => sum + (row.recipe.calories ?? 0), 0);
    const prot = preview.reduce((sum, row) => sum + (row.recipe.protein ?? 0), 0);
    const dayCount = Math.max(planDays.length, 1);
    return { avgCal: Math.round(cal / dayCount), avgProt: Math.round(prot / dayCount) };
  }, [planDays.length, preview]);

  const swapSlot = swapFor ?? peek;
  const swapTarget = swapSlot ? slotTarget(swapSlot.slot, selectedArray, goals) : null;
  const swapPool = useMemo(() => {
    if (!swapFor) return [];
    return recipesForSlot(filtered, swapFor.slot);
  }, [filtered, swapFor]);
  const currentPreviewRecipe = swapSlot
    ? preview?.find((row) => row.day === swapSlot.day && row.slot === swapSlot.slot)?.recipe ?? null
    : null;

  function remember(day: Day, slot: MealSlotKey, recipeId: string) {
    const key = `${day}_${slot}`;
    recentSwaps.current.set(key, rememberSwapId(recentSwaps.current.get(key) ?? [], recipeId));
  }

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
    const reserved = new Set(
      meals.slots
        .filter((slot) => slot.assignedPersonId || slot.hidden)
        .map((slot) => `${slot.day}_${slot.slotKey}`),
    );
    const results = generateMealPlan(selectedArray, reserved, filtered, goals, { days: planDays });
    if (results.length === 0) {
      setError('No matching recipes. Relax dietary filters or add recipes.');
      setPreview(null);
      return;
    }
    recentSwaps.current.clear();
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

  function applySwap(recipe: Recipe, at: { day: Day; slot: MealSlotKey }) {
    const target = slotTarget(at.slot, selectedArray, goals);
    remember(at.day, at.slot, recipe.id);
    setPreview((current) =>
      (current ?? []).map((row) =>
        row.day === at.day && row.slot === at.slot
          ? { ...row, recipe, targetCalories: target.calories, targetProtein: target.protein }
          : row,
      ),
    );
    setPeek((current) => (current && current.day === at.day && current.slot === at.slot ? { ...current, recipe } : current));
  }

  function randomAt(day: Day, slot: MealSlotKey): Recipe | null {
    const current = preview?.find((row) => row.day === day && row.slot === slot)?.recipe ?? null;
    const pick = pickRandomSwapRecipe({
      recipes: recipesForSlot(filtered, slot),
      currentId: current?.id,
      current,
      target: slotTarget(slot, selectedArray, goals),
      recentIds: recentSwaps.current.get(`${day}_${slot}`) ?? [],
    });
    if (!pick) return null;
    applySwap(pick, { day, slot });
    return pick;
  }

  function closeSwap() {
    setSwapFor(null);
    setSwapFilters(EMPTY_FILTERS);
    setSwapViewing(null);
  }

  const viewProps = {
    weekStart: meals.weekStart,
    onPrevWeek: () => meals.shiftWeek(-1),
    onNextWeek: () => meals.shiftWeek(1),
    selected,
    onToggleSlot: toggleSlot,
    goals,
    onChangeGoals: setGoalsDraft,
    dietarySummary,
    recipeCount: filtered.length,
    planDays,
    hiddenSlotKeys,
    fillableCount,
    onGenerate: runGenerate,
    preview,
    avgCal: totals.avgCal,
    avgProt: totals.avgProt,
    onSwap: (day: Day, slot: MealSlotKey) => {
      setPeek(null);
      setSwapFilters(EMPTY_FILTERS);
      setSwapViewing(null);
      setSwapFor({ day, slot });
    },
    onRandom: (day: Day, slot: MealSlotKey) => {
      randomAt(day, slot);
    },
    onApply: () => void apply(),
    applying,
    error,
    onOpenRecipe: (id: string, day: Day, slot: MealSlotKey) => {
      const recipe =
        preview?.find((row) => row.day === day && row.slot === slot && row.recipe.id === id)?.recipe ??
        filtered.find((item) => item.id === id);
      if (!recipe) return;
      setSwapFor(null);
      setPeek({ day, slot, recipe });
    },
  };

  if (!canManageMealPlan(role)) {
    return <Redirect href="/meals" />;
  }

  return (
    <>
      {desktop ? <GenerateDesktop {...viewProps} /> : <GenerateMobile {...viewProps} />}
      <Sheet visible={swapFor !== null} title="Swap recipe" onClose={closeSwap}>
        {swapFor ? (
          <SwapRecipePicker
            recipes={swapPool}
            currentId={currentPreviewRecipe?.id}
            current={currentPreviewRecipe}
            target={swapTarget}
            filters={swapFilters}
            viewing={swapViewing}
            onChangeFilters={setSwapFilters}
            onView={setSwapViewing}
            onPick={(recipe) => {
              applySwap(recipe, swapFor);
              closeSwap();
            }}
            onRandom={() => {
              const picked = randomAt(swapFor.day, swapFor.slot);
              if (picked) setSwapViewing(picked);
            }}
          />
        ) : null}
      </Sheet>
      <Sheet
        visible={peek !== null}
        title="Recipe"
        onClose={() => setPeek(null)}>
        {peek ? (
          <RecipePeek
            recipe={peek.recipe}
            target={slotTarget(peek.slot, selectedArray, goals)}
            useLabel="Accept"
            onUse={() => setPeek(null)}
            onSwap={() => {
              const at = { day: peek.day, slot: peek.slot };
              setPeek(null);
              setSwapFilters(EMPTY_FILTERS);
              setSwapViewing(null);
              setSwapFor(at);
            }}
            onRandom={() => {
              const picked = randomAt(peek.day, peek.slot);
              if (picked) setPeek({ ...peek, recipe: picked });
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}
