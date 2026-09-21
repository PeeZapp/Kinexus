import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  CORE_SLOTS,
  mondayWeekStart,
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
import { DaySlotSheet, dayPlanSlots } from '@/src/features/meals/plan/PlanShared';
import { SlotSheet } from '@/src/features/meals/plan/SlotSheet';
import {
  canEditSlot,
  canManageMealPlan,
  isRestrictedPicker,
  linkedPersonForUser,
  personName,
} from '@/src/features/meals/picker-access';
import { recipeEditHref, recipeHref } from '@/src/features/meals/recipe-href';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { todayDay } from '@/src/features/meals/week-labels';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const FALLBACK_GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };

export function PlanScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const meals = useMealsSync();
  const { user } = useAuth();
  const { people, role } = useHousehold();
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
  const [sheetSlot, setSheetSlot] = useState<MealSlotKey | null>(null);
  const [slotDayEdit, setSlotDayEdit] = useState<{ day: Day; action: 'add' | 'remove' } | null>(null);
  const [expandedDays, setExpandedDays] = useState<Day[]>(() =>
    meals.weekStart === mondayWeekStart() ? [todayDay()] : [],
  );
  const recentSwaps = useRef(new Map<string, string[]>());
  const userId = user && !user.isDevBypass ? user.id : null;
  const canAssign = canManageMealPlan(role);
  const restricted = isRestrictedPicker({ role, people, userId });
  const linked = linkedPersonForUser(people, userId);

  useEffect(() => {
    setExpandedDays(meals.weekStart === mondayWeekStart() ? [todayDay()] : []);
  }, [meals.weekStart]);

  function toggleDay(day: Day) {
    setExpandedDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  const sheetSlotRow = sheetDay && sheetSlot ? meals.slotMap.get(`${sheetDay}_${sheetSlot}`) : undefined;
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

  function openSlot(day: Day, slot: MealSlotKey) {
    setSheetDay(day);
    setSheetSlot(slot);
  }

  async function pickDaySlot(slot: MealSlotKey) {
    if (!slotDayEdit || !canAssign) return;
    const { day, action } = slotDayEdit;
    setSlotDayEdit(null);
    if (action === 'add') {
      await meals.addSlotToDay(day, slot);
      setExpandedDays((current) => (current.includes(day) ? current : [...current, day]));
      openSlot(day, slot);
      return;
    }
    await meals.removeSlotFromDay(day, slot);
  }

  function rememberSwap(day: Day, slot: MealSlotKey, recipeId: string) {
    const key = `${day}_${slot}`;
    recentSwaps.current.set(key, rememberSwapId(recentSwaps.current.get(key) ?? [], recipeId));
  }

  async function assign(recipe: Recipe) {
    if (!sheetDay || !sheetSlot || !sheetCanEdit) return;
    rememberSwap(sheetDay, sheetSlot, recipe.id);
    await meals.assignSlot(sheetDay, sheetSlot, recipe);
    setSheetDay(null);
    setSheetSlot(null);
  }

  async function shuffle(): Promise<Recipe | null> {
    if (!sheetDay || !sheetSlot || !sheetCanEdit) return null;
    const key = `${sheetDay}_${sheetSlot}`;
    const current = meals.slotMap.get(key);
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
    rememberSwap(sheetDay, sheetSlot, pick.id);
    await meals.assignSlot(sheetDay, sheetSlot, pick);
    return pick;
  }

  function openRecipePage(href: Href) {
    setSheetDay(null);
    setSheetSlot(null);
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
      onClose={() => {
        setSheetDay(null);
        setSheetSlot(null);
      }}
      onAssign={(recipe) => void assign(recipe)}
      onAllocate={(personId) => {
        if (sheetDay && sheetSlot && canAssign) void meals.allocateSlot(sheetDay, sheetSlot, personId);
      }}
      onClear={() => {
        if (sheetDay && sheetSlot && sheetCanEdit) void meals.clearSlot(sheetDay, sheetSlot);
        setSheetDay(null);
        setSheetSlot(null);
      }}
      onHide={() => {
        if (sheetDay && sheetSlot && canAssign) void meals.removeSlotFromDay(sheetDay, sheetSlot);
        setSheetDay(null);
        setSheetSlot(null);
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
  const slotDayOptions = slotDayEdit
    ? dayPlanSlots(meals.activeSlots, meals.slotMap, slotDayEdit.day)[slotDayEdit.action === 'add' ? 'addable' : 'visible']
    : [];

  const planProps = {
    meals,
    personNames,
    expandedDays,
    showGenerate: canAssign,
    canManage: canAssign,
    onToggleDay: toggleDay,
    onOpenSlot: openSlot,
    onAddSlot: (day: Day) => setSlotDayEdit({ day, action: 'add' }),
    onRemoveSlot: (day: Day) => setSlotDayEdit({ day, action: 'remove' }),
    onRemoveDay: (day: Day) => {
      if (!canAssign) return;
      setExpandedDays((current) => current.filter((item) => item !== day));
      void meals.hideDay(day);
    },
    onRestoreDay: (day: Day) => {
      if (!canAssign) return;
      setExpandedDays((current) => (current.includes(day) ? current : [...current, day]));
      void meals.restoreDay(day);
    },
    onGenerate: goGenerate,
    onShopping: goShopping,
  };

  if (mode === 'desktop') {
    return (
      <>
        <PlanDesktop {...planProps} />
        {sheet}
        {slotDayEdit ? (
          <DaySlotSheet
            day={slotDayEdit.day}
            action={slotDayEdit.action}
            options={slotDayOptions}
            onClose={() => setSlotDayEdit(null)}
            onPick={(slot) => void pickDaySlot(slot)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <PlanMobile {...planProps} />
      {sheet}
      {slotDayEdit ? (
        <DaySlotSheet
          day={slotDayEdit.day}
          action={slotDayEdit.action}
          options={slotDayOptions}
          onClose={() => setSlotDayEdit(null)}
          onPick={(slot) => void pickDaySlot(slot)}
        />
      ) : null}
    </>
  );
}
