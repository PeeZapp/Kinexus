import { useEffect, useMemo, useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  CORE_SLOTS,
  DAYS,
  MEAL_SLOTS,
  filterRecipesForPeople,
  formatMoney,
  generateMealPlan,
  getDietaryOption,
  parseWeeklyFoodBudget,
  pickRandomSwapRecipe,
  planBudgetCap,
  planShoppingCost,
  plannedDays,
  recipesAffordableForBudget,
  recipesForSlot,
  rememberSwapId,
  slotOccurrenceBudget,
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
import { recipeEditHref } from '@/src/features/meals/recipe-href';
import { RecipePeek } from '@/src/features/meals/RecipePeek';
import { SwapRecipePicker } from '@/src/features/meals/SwapRecipePicker';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const FALLBACK_GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };
const EMPTY_FILTERS: SwapRecipeFilters = {};
const SLOT_SPEND_LABEL: Record<MealSlotKey, string> = {
  breakfast: 'breakfasts',
  morning_snack: 'morning snacks',
  lunch: 'lunches',
  afternoon_snack: 'afternoon snacks',
  dinner: 'dinners',
  night_snack: 'night snacks',
  dessert: 'desserts',
};

export function GenerateScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const router = useRouter();
  const meals = useMealsSync();
  const { people, role, activeHousehold } = useHousehold();
  const [selected, setSelected] = useState<Set<MealSlotKey>>(() => new Set(CORE_SLOTS));
  const [weeklyBudgetText, setWeeklyBudgetText] = useState('');
  const [goalsDraft, setGoalsDraft] = useState<NutritionGoals | null>(null);
  const [preview, setPreview] = useState<GeneratedSlot[] | null>(null);
  const [swapFor, setSwapFor] = useState<{ day: Day; slot: MealSlotKey } | null>(null);
  const [swapFilters, setSwapFilters] = useState<SwapRecipeFilters>(EMPTY_FILTERS);
  const [swapViewing, setSwapViewing] = useState<Recipe | null>(null);
  const [peek, setPeek] = useState<{ day: Day; slot: MealSlotKey; recipe: Recipe } | null>(null);
  const [applying, setApplying] = useState(false);
  const [hidingFamily, setHidingFamily] = useState(false);
  const [peekNote, setPeekNote] = useState<string | null>(null);
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
  const weeklyBudget = parseWeeklyFoodBudget(weeklyBudgetText);
  const currency = activeHousehold?.currency || 'AUD';

  const planDays = useMemo(
    () => plannedDays(meals.activeSlots.length > 0 ? meals.activeSlots : [...CORE_SLOTS], meals.slotMap),
    [meals.activeSlots, meals.slotMap],
  );

  const budgetLines = useMemo(() => {
    if (weeklyBudget == null || selected.size === 0) return [];
    return MEAL_SLOTS.filter((slot) => selected.has(slot.key)).map((slot) => {
      const amount = slotOccurrenceBudget(weeklyBudget, slot.key) * DAYS.length;
      return `${formatMoney(amount, currency)} will be used for ${SLOT_SPEND_LABEL[slot.key]}.`;
    });
  }, [currency, selected, weeklyBudget]);

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
    if (!preview || preview.length === 0) return { avgCal: 0, avgProt: 0, spend: null as string | null, overBudget: false };
    const cal = preview.reduce((sum, row) => sum + (row.recipe.calories ?? 0), 0);
    const prot = preview.reduce((sum, row) => sum + (row.recipe.protein ?? 0), 0);
    const dayCount = Math.max(planDays.length, 1);
    const shopping = planShoppingCost(preview);
    const cap = weeklyBudget != null ? planBudgetCap(weeklyBudget, selectedArray, planDays.length) : null;
    const overBudget = cap != null && Math.round(shopping.total * 100) > Math.round(cap * 100);
    const spend =
      weeklyBudget == null
        ? null
        : shopping.missing > 0
          ? `${formatMoney(shopping.total, currency)} priced${overBudget ? ' · over the meal share' : ''}`
          : `${formatMoney(shopping.total, currency)} shopping${overBudget ? ' · over the meal share' : ''}`;
    return { avgCal: Math.round(cal / dayCount), avgProt: Math.round(prot / dayCount), spend, overBudget };
  }, [currency, planDays.length, preview, selectedArray, weeklyBudget]);

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
    const results = generateMealPlan(selectedArray, reserved, filtered, goals, {
      days: planDays,
      weeklyBudget: weeklyBudget ?? undefined,
    });
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

  function replacementFor(day: Day, slot: MealSlotKey, excludeId: string, current: Recipe): Recipe | null {
    const slotRecipes = recipesForSlot(filtered, slot).filter((item) => item.id !== excludeId);
    const affordable =
      weeklyBudget != null ? recipesAffordableForBudget(slotRecipes, slotOccurrenceBudget(weeklyBudget, slot)) : slotRecipes;
    const pool = affordable.length > 0 ? affordable : slotRecipes;
    return pickRandomSwapRecipe({
      recipes: pool,
      currentId: excludeId,
      current,
      target: slotTarget(slot, selectedArray, goals),
      recentIds: recentSwaps.current.get(`${day}_${slot}`) ?? [],
    });
  }

  async function markNotForFamily(at: { day: Day; slot: MealSlotKey }, recipe: Recipe) {
    if (hidingFamily) return;
    setHidingFamily(true);
    setPeekNote(null);
    try {
      if (!recipe.excludedFromAuto && !meals.hiddenRecipeIds.has(recipe.id)) {
        await meals.toggleNotForFamily(recipe.id);
      }
      const replacements = new Map<string, Recipe>();
      for (const row of preview ?? []) {
        if (row.recipe.id !== recipe.id) continue;
        const pick = replacementFor(row.day, row.slot, recipe.id, row.recipe);
        if (!pick) continue;
        remember(row.day, row.slot, pick.id);
        replacements.set(`${row.day}_${row.slot}`, pick);
      }
      setPreview((current) =>
        (current ?? []).flatMap((row) => {
          if (row.recipe.id !== recipe.id) return [row];
          const pick = replacements.get(`${row.day}_${row.slot}`);
          if (!pick) return [];
          const target = slotTarget(row.slot, selectedArray, goals);
          return [{ ...row, recipe: pick, targetCalories: target.calories, targetProtein: target.protein }];
        }),
      );
      const next = replacements.get(`${at.day}_${at.slot}`);
      if (next) {
        setPeek({ day: at.day, slot: at.slot, recipe: next });
        setPeekNote('Hidden from plans and recommendations. This slot now shows a different recipe.');
      }
      else {
        setPeek(null);
        setError('Marked not for your family. No other recipe fits that slot.');
      }
    } catch (err) {
      setPeekNote(err instanceof Error ? err.message : 'Could not update recipe');
    } finally {
      setHidingFamily(false);
    }
  }

  function randomAt(day: Day, slot: MealSlotKey): Recipe | null {
    const current = preview?.find((row) => row.day === day && row.slot === slot)?.recipe ?? null;
    const slotRecipes = recipesForSlot(filtered, slot);
    const affordable =
      weeklyBudget != null ? recipesAffordableForBudget(slotRecipes, slotOccurrenceBudget(weeklyBudget, slot)) : slotRecipes;
    const pick = pickRandomSwapRecipe({
      recipes: affordable,
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
    weeklyBudget: weeklyBudgetText,
    onChangeWeeklyBudget: (value: string) => {
      setWeeklyBudgetText(value);
      setPreview(null);
    },
    budgetLines,
    onGenerate: runGenerate,
    preview,
    avgCal: totals.avgCal,
    avgProt: totals.avgProt,
    previewSpend: totals.spend,
    previewOverBudget: totals.overBudget,
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
      setPeekNote(null);
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
            onEdit={() => {
              const id = peek.recipe.id;
              setPeek(null);
              setTimeout(() => {
                router.push(recipeEditHref(id));
              }, 0);
            }}
            onUse={() => setPeek(null)}
            onSwap={() => {
              setPeekNote(null);
              const at = { day: peek.day, slot: peek.slot };
              setPeek(null);
              setSwapFilters(EMPTY_FILTERS);
              setSwapViewing(null);
              setSwapFor(at);
            }}
            onRandom={() => {
              setPeekNote(null);
              const picked = randomAt(peek.day, peek.slot);
              if (picked) setPeek({ ...peek, recipe: picked });
            }}
            onNotForFamily={() => void markNotForFamily({ day: peek.day, slot: peek.slot }, peek.recipe)}
            notForFamilyBusy={hidingFamily}
            note={peekNote}
          />
        ) : null}
      </Sheet>
    </>
  );
}
