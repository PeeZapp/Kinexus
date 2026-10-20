import { useEffect, useMemo, useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  audienceOverlapsExisting,
  CORE_SLOTS,
  DAYS,
  MEAL_SLOTS,
  defaultMealPrepDaysToCover,
  filterRecipesForPeople,
  formatMoney,
  generateMealPlan,
  generateMealPrepPlan,
  getDietaryOption,
  isHouseholdAudience,
  mealPrepCookListCost,
  mealPrepCookSummary,
  mealSlotRecordKey,
  normalizeAudiencePersonIds,
  parseWeeklyFoodBudget,
  pickRandomSwapRecipe,
  planBudgetCap,
  planShoppingCost,
  plannedDays,
  recipesAffordableForBudget,
  recipesForMealPrep,
  recipesForSlot,
  rememberSwapId,
  slotOccurrenceBudget,
  slotTarget,
  type Day,
  type GeneratedSlot,
  type MealPrepResult,
  type MealPrepStyle,
  type MealSlotKey,
  type NutritionGoals,
  type Recipe,
  type SwapRecipeFilters,
} from '@kinexus/domain';

import type { GenerateMode } from '@/src/features/meals/generate/controls';
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
  const [generateMode, setGenerateMode] = useState<GenerateMode>('weekly');
  const [audienceIds, setAudienceIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<MealSlotKey>>(() => new Set(CORE_SLOTS));
  const [selectedDays, setSelectedDays] = useState<Set<Day>>(() => new Set(DAYS));
  const [daysInited, setDaysInited] = useState(false);
  const [weeklyBudgetText, setWeeklyBudgetText] = useState('');
  const [goalsDraft, setGoalsDraft] = useState<NutritionGoals | null>(null);
  const [prepStyle, setPrepStyle] = useState<MealPrepStyle>('week_portions');
  const [cookDay, setCookDay] = useState<Day>('sunday');
  const [dishCount, setDishCount] = useState(2);
  const [daysToCover, setDaysToCover] = useState(() => defaultMealPrepDaysToCover('sunday'));
  const [preview, setPreview] = useState<GeneratedSlot[] | null>(null);
  const [prepResult, setPrepResult] = useState<MealPrepResult | null>(null);
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

  useEffect(() => {
    if (planDays.length === 0) return;
    if (!daysInited) {
      setSelectedDays(new Set(planDays));
      setDaysInited(true);
      return;
    }
    setSelectedDays((current) => {
      const next = new Set([...current].filter((day) => planDays.includes(day)));
      if (next.size === 0) return new Set(planDays);
      if (next.size === current.size && [...next].every((day) => current.has(day))) return current;
      return next;
    });
  }, [daysInited, planDays]);

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

  const maxDaysToCover = useMemo(() => defaultMealPrepDaysToCover(cookDay), [cookDay]);

  useEffect(() => {
    setDaysToCover((current) => Math.min(current, maxDaysToCover));
  }, [maxDaysToCover]);

  const prepCoverDays = useMemo(() => {
    const start = DAYS.indexOf(cookDay);
    if (start < 0) return [] as Day[];
    return DAYS.slice(start, start + daysToCover);
  }, [cookDay, daysToCover]);

  const fillDays = useMemo(() => {
    if (generateMode === 'meal_prep') return prepCoverDays;
    return DAYS.filter((day) => selectedDays.has(day) && planDays.includes(day));
  }, [generateMode, planDays, prepCoverDays, selectedDays]);

  const fillableCount = useMemo(() => {
    let count = 0;
    for (const day of fillDays) {
      for (const slot of selectedArray) {
        if (!hiddenSlotKeys.has(`${day}_${slot}`)) count += 1;
      }
    }
    return count;
  }, [fillDays, hiddenSlotKeys, selectedArray]);

  const totals = useMemo(() => {
    if (!preview || preview.length === 0) return { avgCal: 0, avgProt: 0, spend: null as string | null, overBudget: false };
    const cal = preview.reduce((sum, row) => sum + (row.recipe.calories ?? 0), 0);
    const prot = preview.reduce((sum, row) => sum + (row.recipe.protein ?? 0), 0);
    const dayCount = Math.max(new Set(preview.map((row) => row.day)).size, 1);
    const shopping =
      generateMode === 'meal_prep' && prepResult
        ? mealPrepCookListCost(prepResult.cookList)
        : planShoppingCost(preview);
    const capDays = fillDays.length;
    const cap = weeklyBudget != null ? planBudgetCap(weeklyBudget, selectedArray, capDays) : null;
    const overBudget = cap != null && Math.round(shopping.total * 100) > Math.round(cap * 100);
    const spend =
      weeklyBudget == null
        ? null
        : shopping.missing > 0
          ? `${formatMoney(shopping.total, currency)} priced${overBudget ? ' · over the meal share' : ''}`
          : `${formatMoney(shopping.total, currency)} shopping${overBudget ? ' · over the meal share' : ''}`;
    return { avgCal: Math.round(cal / dayCount), avgProt: Math.round(prot / dayCount), spend, overBudget };
  }, [currency, fillDays.length, generateMode, prepResult, preview, selectedArray, weeklyBudget]);

  const cookSummary = useMemo(
    () => (generateMode === 'meal_prep' && prepResult ? mealPrepCookSummary(prepResult) : null),
    [generateMode, prepResult],
  );

  const swapSlot = swapFor ?? peek;
  const swapTarget = swapSlot ? slotTarget(swapSlot.slot, selectedArray, goals) : null;
  const swapPool = useMemo(() => {
    if (!swapFor) return [];
    return generateMode === 'meal_prep'
      ? recipesForMealPrep(filtered, swapFor.slot, prepStyle)
      : recipesForSlot(filtered, swapFor.slot);
  }, [filtered, generateMode, prepStyle, swapFor]);
  const currentPreviewRecipe = swapSlot
    ? preview?.find((row) => row.day === swapSlot.day && row.slot === swapSlot.slot)?.recipe ?? null
    : null;

  function remember(day: Day, slot: MealSlotKey, recipeId: string) {
    const key = `${day}_${slot}`;
    recentSwaps.current.set(key, rememberSwapId(recentSwaps.current.get(key) ?? [], recipeId));
  }

  function clearPreview() {
    setPreview(null);
    setPrepResult(null);
  }

  const audience = useMemo(() => normalizeAudiencePersonIds(audienceIds), [audienceIds]);
  const personalGenerate = audience.length > 0;

  function toggleSlot(slot: MealSlotKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
    clearPreview();
  }

  function changeGenerateMode(next: GenerateMode) {
    setGenerateMode(next);
    clearPreview();
    if (next === 'meal_prep' && selected.size === 0) {
      setSelected(new Set<MealSlotKey>(['dinner']));
    }
  }

  function changeAudience(ids: string[]) {
    setAudienceIds(normalizeAudiencePersonIds(ids));
    clearPreview();
  }

  function toggleDay(day: Day) {
    setSelectedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) {
        if (next.size <= 1) return current;
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
    clearPreview();
  }

  function selectAllDays() {
    setSelectedDays(new Set(planDays));
    clearPreview();
  }

  function runGenerate() {
    setError(null);
    const reserved = new Set<string>();
    for (const slot of meals.slots) {
      const key = mealSlotRecordKey(slot.day, slot.slotKey);
      if (personalGenerate) {
        const sameAudience =
          normalizeAudiencePersonIds(slot.audiencePersonIds).join(',') === audience.join(',');
        if (sameAudience && (slot.assignedPersonId || slot.hidden)) {
          reserved.add(key);
          continue;
        }
        if (!sameAudience && audienceOverlapsExisting([slot], slot.day, slot.slotKey, audience)) {
          reserved.add(key);
        }
        continue;
      }
      if (isHouseholdAudience(slot.audiencePersonIds) && (slot.assignedPersonId || slot.hidden)) {
        reserved.add(key);
      }
    }

    if (generateMode === 'meal_prep') {
      const result = generateMealPrepPlan(filtered, reserved, {
        style: prepStyle,
        cookDay,
        slots: selectedArray,
        dishCount,
        daysToCover,
        goals,
        weeklyBudget: weeklyBudget ?? undefined,
      });
      if (result.slots.length === 0) {
        setError('No matching prep recipes. Relax dietary filters or add recipes.');
        clearPreview();
        return;
      }
      recentSwaps.current.clear();
      setPrepResult(result);
      setPreview(result.slots);
      return;
    }

    if (fillDays.length === 0) {
      setError('Pick at least one day to fill.');
      clearPreview();
      return;
    }

    const results = generateMealPlan(selectedArray, reserved, filtered, goals, {
      days: fillDays,
      weeklyBudget: weeklyBudget ?? undefined,
    });
    if (results.length === 0) {
      setError('No matching recipes. Relax dietary filters or add recipes.');
      clearPreview();
      return;
    }
    recentSwaps.current.clear();
    setPrepResult(null);
    setPreview(results);
  }

  async function apply() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      if (!personalGenerate) await meals.saveGoals(goals);
      await meals.applyGeneratedPlan(preview, selectedArray, {
        audiencePersonIds: audience,
      });
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
    const next = (preview ?? []).map((row) =>
      row.day === at.day && row.slot === at.slot
        ? { ...row, recipe, targetCalories: target.calories, targetProtein: target.protein }
        : row,
    );
    setPreview(next);
    refreshPrepSummary(next);
    setPeek((current) => (current && current.day === at.day && current.slot === at.slot ? { ...current, recipe } : current));
  }

  function poolForSlot(slot: MealSlotKey): Recipe[] {
    return generateMode === 'meal_prep'
      ? recipesForMealPrep(filtered, slot, prepStyle)
      : recipesForSlot(filtered, slot);
  }

  function replacementFor(day: Day, slot: MealSlotKey, excludeId: string, current: Recipe): Recipe | null {
    const slotRecipes = poolForSlot(slot).filter((item) => item.id !== excludeId);
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
      const nextPreview = (preview ?? []).flatMap((row) => {
        if (row.recipe.id !== recipe.id) return [row];
        const pick = replacements.get(`${row.day}_${row.slot}`);
        if (!pick) return [];
        const target = slotTarget(row.slot, selectedArray, goals);
        return [{ ...row, recipe: pick, targetCalories: target.calories, targetProtein: target.protein }];
      });
      setPreview(nextPreview);
      refreshPrepSummary(nextPreview);
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
    const slotRecipes = poolForSlot(slot);
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

  function refreshPrepSummary(nextPreview: GeneratedSlot[]) {
    if (generateMode !== 'meal_prep' || !prepResult) return;
    const cookList: Recipe[] = [];
    const seen = new Set<string>();
    const portionsByRecipeId: Record<string, number> = {};
    for (const row of nextPreview) {
      portionsByRecipeId[row.recipe.id] = (portionsByRecipeId[row.recipe.id] ?? 0) + 1;
      if (!seen.has(row.recipe.id)) {
        seen.add(row.recipe.id);
        cookList.push(row.recipe);
      }
    }
    setPrepResult({
      ...prepResult,
      slots: nextPreview,
      cookList,
      portionsByRecipeId,
    });
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
    mode: generateMode,
    onChangeMode: changeGenerateMode,
    people: people.map((person) => ({ id: person.id, name: person.name })),
    audienceIds: audience,
    onChangeAudience: changeAudience,
    selected,
    onToggleSlot: toggleSlot,
    goals,
    onChangeGoals: setGoalsDraft,
    dietarySummary,
    recipeCount: filtered.length,
    planDays: fillDays,
    availableDays: planDays,
    selectedDays,
    onToggleDay: toggleDay,
    onSelectAllDays: selectAllDays,
    hiddenSlotKeys,
    fillableCount,
    weeklyBudget: weeklyBudgetText,
    onChangeWeeklyBudget: (value: string) => {
      setWeeklyBudgetText(value);
      clearPreview();
    },
    budgetLines,
    prepStyle,
    onChangePrepStyle: (style: MealPrepStyle) => {
      setPrepStyle(style);
      clearPreview();
    },
    cookDay,
    onChangeCookDay: (day: Day) => {
      setCookDay(day);
      setDaysToCover(defaultMealPrepDaysToCover(day));
      clearPreview();
    },
    dishCount,
    onChangeDishCount: (count: number) => {
      setDishCount(count);
      clearPreview();
    },
    daysToCover,
    onChangeDaysToCover: (days: number) => {
      setDaysToCover(days);
      clearPreview();
    },
    maxDaysToCover,
    cookSummary,
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
