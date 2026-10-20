import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  CORE_SLOTS,
  isHouseholdAudience,
  mondayWeekStart,
  normalizeAudiencePersonIds,
  pickRandomSwapRecipe,
  recipeForHouseholdView,
  recipesForPicker,
  rememberSwapId,
  slotTarget,
  type Day,
  type MealSlotKey,
  type NutritionGoals,
  type Recipe,
} from '@kinexus/domain';

import { PlanDesktop } from '@/src/features/meals/plan/PlanDesktop';
import { PlanMobile } from '@/src/features/meals/plan/PlanMobile';
import {
  AddMealSheet,
  dayPlanSlots,
  familyAddMealSlotOptions,
  type PlanPersonFilter,
} from '@/src/features/meals/plan/PlanShared';
import { SlotSheet } from '@/src/features/meals/plan/SlotSheet';
import {
  canEditSlot,
  canManageMealPlan,
  isRestrictedPicker,
  linkedPersonForUser,
  personName,
} from '@/src/features/meals/picker-access';
import { recipeEditHref, recipeHref } from '@/src/features/meals/recipe-href';
import { useMealsSync, type PlanSlot } from '@/src/features/meals/use-meals-sync';
import { todayDay } from '@/src/features/meals/week-labels';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const FALLBACK_GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };

function defaultSelectedDay(weekStart: string): Day {
  return weekStart === mondayWeekStart() ? todayDay() : 'monday';
}

export function PlanScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const meals = useMealsSync();
  const { user } = useAuth();
  const { people, role } = useHousehold();
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
  const [sheetSlot, setSheetSlot] = useState<MealSlotKey | null>(null);
  const [sheetCellId, setSheetCellId] = useState<string | null>(null);
  const [addMealDay, setAddMealDay] = useState<Day | null>(null);
  const [addMealError, setAddMealError] = useState<string | null>(null);
  const [addMealBusy, setAddMealBusy] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Day>(() => defaultSelectedDay(meals.weekStart));
  const recentSwaps = useRef(new Map<string, string[]>());
  const userId = user && !user.isDevBypass ? user.id : null;
  const canAssign = canManageMealPlan(role);
  const restricted = isRestrictedPicker({ role, people, userId });
  const linked = linkedPersonForUser(people, userId);
  const [personFilter, setPersonFilter] = useState<PlanPersonFilter>('all');

  useEffect(() => {
    setSelectedDay(defaultSelectedDay(meals.weekStart));
  }, [meals.weekStart]);

  useEffect(() => {
    if (linked?.id) setPersonFilter(linked.id);
  }, [linked?.id]);

  const sheetSlotRow = useMemo(() => {
    if (!sheetDay || !sheetSlot) return undefined;
    if (sheetCellId) return meals.slots.find((slot) => slot.id === sheetCellId);
    return meals.slots.find(
      (slot) =>
        slot.day === sheetDay &&
        slot.slotKey === sheetSlot &&
        isHouseholdAudience(slot.audiencePersonIds) &&
        !slot.hidden,
    );
  }, [meals.slots, sheetCellId, sheetDay, sheetSlot]);

  const sheetCanEdit = canEditSlot({
    role,
    people,
    userId,
    assignedPersonId: sheetSlotRow?.assignedPersonId,
  });
  const sheetApprovedIds = useMemo(() => {
    if (!sheetSlot || !restricted || !linked || sheetSlotRow?.assignedPersonId !== linked.id) return null;
    const ids = new Set(
      meals.slotApprovals
        .filter((row) => row.personId === linked.id && row.slotKey === sheetSlot)
        .map((row) => row.recipeId),
    );
    return ids;
  }, [linked, meals.slotApprovals, restricted, sheetSlot, sheetSlotRow?.assignedPersonId]);

  function openSlot(day: Day, slot: MealSlotKey, cell?: PlanSlot) {
    setSheetDay(day);
    setSheetSlot(slot);
    setSheetCellId(cell?.id ?? null);
  }

  function closeSlotSheet() {
    setSheetDay(null);
    setSheetSlot(null);
    setSheetCellId(null);
  }

  async function confirmAddMeal(slot: MealSlotKey, audiencePersonIds: string[]) {
    if (!addMealDay || !canAssign) return;
    const day = addMealDay;
    setAddMealBusy(true);
    setAddMealError(null);
    try {
      const audience = normalizeAudiencePersonIds(audiencePersonIds);
      if (audience.length === 0) {
        // Empty breakfast/lunch/dinner are already on the day — open picker, don't re-sync.
        if (dayPlanSlots(meals.activeSlots, meals.slotMap, day).visible.includes(slot)) {
          setAddMealDay(null);
          openSlot(day, slot);
          return;
        }
        await meals.addSlotToDay(day, slot);
        setAddMealDay(null);
        openSlot(day, slot);
        return;
      }
      const created = await meals.createAudienceSlot(day, slot, audience);
      setAddMealDay(null);
      openSlot(day, slot, created ?? undefined);
    } catch (err) {
      setAddMealError(messageFromUnknown(err, 'Could not add meal'));
    } finally {
      setAddMealBusy(false);
    }
  }

  function rememberSwap(day: Day, slot: MealSlotKey, recipeId: string, cellId?: string | null) {
    const key = `${day}_${slot}_${cellId ?? 'family'}`;
    recentSwaps.current.set(key, rememberSwapId(recentSwaps.current.get(key) ?? [], recipeId));
  }

  const slotOpts = {
    slotId: sheetSlotRow?.id ?? sheetCellId,
    audiencePersonIds: sheetSlotRow?.audiencePersonIds ?? [],
  };

  async function assign(recipe: Recipe) {
    if (!sheetDay || !sheetSlot || !sheetCanEdit) return;
    rememberSwap(sheetDay, sheetSlot, recipe.id, sheetSlotRow?.id);
    await meals.assignSlot(sheetDay, sheetSlot, recipe, slotOpts);
    closeSlotSheet();
  }

  async function shuffle(): Promise<Recipe | null> {
    if (!sheetDay || !sheetSlot || !sheetCanEdit) return null;
    const key = `${sheetDay}_${sheetSlot}_${sheetSlotRow?.id ?? 'family'}`;
    const current = sheetSlotRow;
    const currentRecipe = recipeForHouseholdView(meals.recipes, current?.recipeId) ?? null;
    const pool = recipesForPicker(meals.recipes, sheetSlot, sheetApprovedIds);
    const goals = meals.goals ?? FALLBACK_GOALS;
    const selected = meals.activeSlots.length > 0 ? meals.activeSlots : [...CORE_SLOTS];
    const pick = pickRandomSwapRecipe({
      recipes: pool,
      currentId: current?.recipeId,
      current: currentRecipe,
      target: slotTarget(sheetSlot, selected, goals),
      recentIds: recentSwaps.current.get(key) ?? [],
    });
    if (!pick) return null;
    rememberSwap(sheetDay, sheetSlot, pick.id, sheetSlotRow?.id);
    await meals.assignSlot(sheetDay, sheetSlot, pick, slotOpts);
    return pick;
  }

  function openRecipePage(href: Href) {
    closeSlotSheet();
    setTimeout(() => {
      router.push(href);
    }, 0);
  }

  const sheet = (
    <SlotSheet
      visible={sheetDay !== null && sheetSlot !== null}
      day={sheetDay}
      slotKey={sheetSlot}
      slot={sheetSlotRow}
      recipes={meals.recipes}
      people={people}
      canAssign={canAssign}
      canEdit={sheetCanEdit}
      assigneeName={personName(people, sheetSlotRow?.assignedPersonId)}
      approvedIds={sheetApprovedIds}
      target={
        sheetSlot
          ? slotTarget(
              sheetSlot,
              meals.activeSlots.length > 0 ? meals.activeSlots : [...CORE_SLOTS],
              meals.goals ?? FALLBACK_GOALS,
            )
          : null
      }
      onClose={closeSlotSheet}
      onAssign={(recipe) => void assign(recipe)}
      onAllocate={(personId) => {
        if (sheetDay && sheetSlot && canAssign) void meals.allocateSlot(sheetDay, sheetSlot, personId, slotOpts);
      }}
      onClear={() => {
        if (sheetDay && sheetSlot && sheetCanEdit) void meals.clearSlot(sheetDay, sheetSlot, slotOpts);
        closeSlotSheet();
      }}
      onHide={() => {
        if (!sheetDay || !sheetSlot || !canAssign) return;
        if (sheetSlotRow && !isHouseholdAudience(sheetSlotRow.audiencePersonIds)) {
          void meals.deleteAudienceSlot(sheetSlotRow);
        } else {
          void meals.removeSlotFromDay(sheetDay, sheetSlot);
        }
        closeSlotSheet();
      }}
      onShuffle={() => void shuffle()}
      onOpenRecipe={(id) => openRecipePage(recipeHref(id))}
      onEditRecipe={(id) => openRecipePage(recipeEditHref(id))}
    />
  );

  const goGenerate = () => router.push('/meals/generate' as Href);
  const goShopping = () => router.push('/meals/shopping' as Href);
  const personNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) map.set(person.id, person.name);
    return map;
  }, [people]);
  const peopleOptions = useMemo(() => people.map((person) => ({ id: person.id, name: person.name })), [people]);
  const familySlotOptions = addMealDay
    ? familyAddMealSlotOptions(meals.activeSlots, meals.slotMap, meals.slots, addMealDay)
    : [];

  const planProps = {
    meals,
    personNames,
    peopleOptions,
    personFilter,
    onPersonFilter: setPersonFilter,
    selectedDay,
    onSelectDay: setSelectedDay,
    showGenerate: canAssign,
    canManage: canAssign,
    onOpenSlot: openSlot,
    onAddMeal: (day: Day) => {
      setAddMealError(null);
      setAddMealDay(day);
    },
    onRemoveDay: (day: Day) => {
      if (!canAssign) return;
      void meals.hideDay(day);
    },
    onRestoreDay: (day: Day) => {
      if (!canAssign) return;
      void meals.restoreDay(day);
    },
    onGenerate: goGenerate,
    onShopping: goShopping,
  };

  const addMealSheet = (
    <AddMealSheet
      day={addMealDay}
      people={peopleOptions}
      familySlotOptions={familySlotOptions}
      error={addMealError}
      busy={addMealBusy}
      onClose={() => {
        setAddMealDay(null);
        setAddMealError(null);
      }}
      onConfirm={(slot, audience) => void confirmAddMeal(slot, audience)}
    />
  );

  if (mode === 'desktop') {
    return (
      <>
        <PlanDesktop {...planProps} />
        {sheet}
        {addMealSheet}
      </>
    );
  }

  return (
    <>
      <PlanMobile {...planProps} />
      {sheet}
      {addMealSheet}
    </>
  );
}

function messageFromUnknown(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
