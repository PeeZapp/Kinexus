import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  CORE_SLOTS,
  isHouseholdAudience,
  mondayWeekStart,
  slotHasMeal,
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

import { Sheet } from '@/src/features/meals/meals-kit';
import { PlanDesktop } from '@/src/features/meals/plan/PlanDesktop';
import { PlanMobile } from '@/src/features/meals/plan/PlanMobile';
import { SideDishPicker } from '@/src/features/meals/plan/SideDishPicker';
import {
  AllocateMealSheet,
  dayPlanSlots,
  EatForSheet,
  familyAddMealSlotOptions,
  PickMealSheet,
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
import { Toast } from '@/src/features/meals/Toast';
import { useMealsSync, type PlanSlot } from '@/src/features/meals/use-meals-sync';
import type { SlotOutboxOp } from '@/src/features/meals/outbox';
import { todayDay } from '@/src/features/meals/week-labels';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const FALLBACK_GOALS: NutritionGoals = { calories: 2000, protein: 120, carbs: 250, fat: 65 };

type PlanToast = {
  message: string;
  actionLabel: string;
  onAction: () => void | Promise<void>;
  onDismiss?: () => void | Promise<void>;
};

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
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pendingPick, setPendingPick] = useState<{ slot: MealSlotKey; recipe?: Recipe; title?: string } | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [sideCellId, setSideCellId] = useState<string | null>(null);
  const [sideError, setSideError] = useState<string | null>(null);
  const [sideListToken, setSideListToken] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Day>(() => defaultSelectedDay(meals.weekStart));
  const [clearingWeek, setClearingWeek] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [toast, setToast] = useState<PlanToast | null>(null);
  const recentSwaps = useRef(new Map<string, string[]>());
  const userId = user && !user.isDevBypass ? user.id : null;

  function showUndoToast(
    message: string,
    ops: readonly SlotOutboxOp[],
    previousSlots: readonly PlanSlot[],
  ) {
    setToast({
      message,
      actionLabel: 'Undo',
      onAction: async () => {
        setToast(null);
        await meals.undoSlotOps(ops, previousSlots);
      },
    });
  }

  function showSyncToast(err: unknown) {
    const failureKey =
      err && typeof err === 'object' && 'failureKey' in err && typeof (err as { failureKey: unknown }).failureKey === 'string'
        ? (err as { failureKey: string }).failureKey
        : meals.slotSyncFailures[0]?.key;
    setToast({
      message: "Couldn't sync",
      actionLabel: 'Retry',
      onAction: async () => {
        setToast(null);
        try {
          await meals.retrySlotSync();
        } catch (retryErr) {
          showSyncToast(retryErr);
        }
      },
      onDismiss: async () => {
        setToast(null);
        if (failureKey) await meals.dismissSlotSyncFailure(failureKey);
      },
    });
  }
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

  function familySlotFilled(slot: MealSlotKey) {
    return meals.slots.some(
      (item) =>
        item.day === selectedDay &&
        item.slotKey === slot &&
        isHouseholdAudience(item.audiencePersonIds) &&
        !item.hidden &&
        slotHasMeal(item),
    );
  }

  async function placeMeal(
    slot: MealSlotKey,
    audiencePersonIds: string[],
    personId: string | null,
    recipe?: Recipe,
    title?: string,
  ) {
    if (!canAssign) return;
    const day = selectedDay;
    setPlaceBusy(true);
    setPlaceError(null);
    try {
      const audience = normalizeAudiencePersonIds(audiencePersonIds);
      if (audience.length === 0) {
        if (!dayPlanSlots(meals.activeSlots, meals.slotMap, day).visible.includes(slot)) {
          await meals.addSlotToDay(day, slot);
        }
        if (recipe) await meals.assignSlot(day, slot, recipe, { audiencePersonIds: [] });
        else if (title?.trim()) await meals.assignNamedMeal(day, slot, title, { audiencePersonIds: [] });
        if ((!recipe && !title?.trim()) || personId) await meals.allocateSlot(day, slot, personId, { audiencePersonIds: [] });
        return;
      }
      const created = await meals.createAudienceSlot(day, slot, audience);
      const opts = { slotId: created?.id, audiencePersonIds: audience };
      if (recipe) await meals.assignSlot(day, slot, recipe, opts);
      else if (title?.trim()) await meals.assignNamedMeal(day, slot, title, opts);
      if ((!recipe && !title?.trim()) || personId) await meals.allocateSlot(day, slot, personId, opts);
    } catch (err) {
      const message = messageFromUnknown(err, 'Could not save that meal');
      setPlaceError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setPlaceBusy(false);
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

  async function assignTitle(name: string) {
    if (!sheetDay || !sheetSlot || !sheetCanEdit) return;
    await meals.assignNamedMeal(sheetDay, sheetSlot, name, slotOpts);
    closeSlotSheet();
  }

  async function saveManualRecipe(draft: Omit<Recipe, 'id' | 'householdId'>) {
    const saved = await meals.saveHouseholdRecipe({
      ...draft,
      mealSlots: draft.mealSlots?.length ? draft.mealSlots : sheetSlot ? [sheetSlot] : draft.mealSlots,
    });
    await assign(saved);
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
      onClear={async () => {
        if (!sheetDay || !sheetSlot || !sheetCanEdit) return;
        closeSlotSheet();
        try {
          await meals.clearSlot(sheetDay, sheetSlot, slotOpts);
        } catch (err) {
          showSyncToast(err);
        }
      }}
      onHide={async () => {
        if (!sheetDay || !sheetSlot || !canAssign) return;
        closeSlotSheet();
        try {
          if (sheetSlotRow && !isHouseholdAudience(sheetSlotRow.audiencePersonIds)) {
            const previousSlots = [...meals.slots];
            const op = await meals.deleteAudienceSlot(sheetSlotRow);
            showUndoToast('Meal removed', op ? [op] : [], previousSlots);
          } else {
            const result = await meals.removeSlotFromDay(sheetDay, sheetSlot);
            showUndoToast('Meal removed', result.ops, result.previousSlots);
          }
        } catch (err) {
          showSyncToast(err);
        }
      }}
      onShuffle={() => void shuffle()}
      onOpenRecipe={(id, serves) => openRecipePage(recipeHref(id, serves ? { serves } : undefined))}
      onEditRecipe={(id) => openRecipePage(recipeEditHref(id))}
      onSetSides={
        sheetSlotRow
          ? async (sideRecipeIds) => {
              try {
                await meals.setSlotSides(sheetSlotRow.id, sideRecipeIds);
              } catch (err) {
                showSyncToast(err);
              }
            }
          : undefined
      }
      onUseTitle={(name) => assignTitle(name)}
      onSaveManual={saveManualRecipe}
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
  const familySlotOptions = familyAddMealSlotOptions(meals.activeSlots, meals.slotMap, meals.slots, selectedDay);

  async function confirmClearWeek() {
    const message =
      'This empties every meal on this week, brings removed days back, and drops slot changes still waiting to sync. The shopping list is left as it is.';
    const confirmed =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(`Clear this week?\n\n${message}`)
        : await new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (value: boolean) => {
              if (settled) return;
              settled = true;
              resolve(value);
            };
            Alert.alert(
              'Clear this week?',
              message,
              [
                { text: 'Keep', style: 'cancel', onPress: () => settle(false) },
                { text: 'Clear week', style: 'destructive', onPress: () => settle(true) },
              ],
              { cancelable: true, onDismiss: () => settle(false) },
            );
          });
    if (!confirmed) return;
    setClearError(null);
    setClearingWeek(true);
    try {
      const snapshot = await meals.clearWeek();
      setToast({
        message: 'Week cleared',
        actionLabel: 'Undo',
        onAction: async () => {
          setToast(null);
          await meals.restoreClearedWeek(snapshot);
        },
      });
    } catch (err) {
      setClearError(messageFromUnknown(err, 'Could not clear this week'));
      showSyncToast(err);
    } finally {
      setClearingWeek(false);
    }
  }

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
    onAllocateMeal: () => {
      setPlaceError(null);
      setAllocateOpen(true);
    },
    onPickMeal: () => {
      setPlaceError(null);
      setPickOpen(true);
    },
    onRemoveDay: async (day: Day) => {
      if (!canAssign) return;
      try {
        const result = await meals.hideDay(day);
        showUndoToast('Day cleared', result.ops, result.previousSlots);
      } catch (err) {
        showSyncToast(err);
      }
    },
    onRestoreDay: async (day: Day) => {
      if (!canAssign) return;
      try {
        await meals.restoreDay(day);
      } catch (err) {
        showSyncToast(err);
      }
    },
    onClearWeek: () => {
      if (!canAssign || clearingWeek) return;
      void confirmClearWeek();
    },
    clearingWeek,
    clearError,
    onGenerate: goGenerate,
    onShopping: goShopping,
    onAddSide: (cell: PlanSlot) => {
      setSideError(null);
      setSideCellId(cell.id);
      setSideListToken((token) => token + 1);
    },
    onAllocate: async (cell: PlanSlot, personId: string | null) => {
      if (!canAssign) return;
      try {
        await meals.allocateSlot(cell.day, cell.slotKey, personId, {
          slotId: cell.id,
          audiencePersonIds: cell.audiencePersonIds,
        });
      } catch (err) {
        showSyncToast(err);
      }
    },
    canEditCell: (cell: PlanSlot) =>
      canEditSlot({
        role,
        people,
        userId,
        assignedPersonId: cell.assignedPersonId,
      }),
  };

  const sideCell = sideCellId ? meals.slots.find((slot) => slot.id === sideCellId) : undefined;

  async function changeSides(ids: string[]) {
    if (!sideCell) return;
    setSideError(null);
    try {
      await meals.setSlotSides(sideCell.id, ids);
    } catch (err) {
      setSideError(messageFromUnknown(err, 'Could not update sides'));
    }
  }

  const sideSheet = (
    <Sheet
      visible={sideCellId !== null}
      title="Add side dish"
      scrollTopToken={sideListToken}
      onClose={() => {
        setSideCellId(null);
        setSideError(null);
      }}>
      {sideCell ? (
        <SideDishPicker
          recipes={meals.recipes}
          selectedIds={sideCell.sideRecipeIds ?? []}
          excludeIds={sideCell.recipeId ? [sideCell.recipeId] : []}
          error={sideError}
          onQueryChange={() => setSideListToken((token) => token + 1)}
          onAdd={(recipe) => void changeSides([...(sideCell.sideRecipeIds ?? []), recipe.id])}
          onRemove={(id) => void changeSides((sideCell.sideRecipeIds ?? []).filter((item) => item !== id))}
        />
      ) : null}
    </Sheet>
  );

  const planModals = (
    <>
      <AllocateMealSheet
        visible={allocateOpen}
        people={peopleOptions}
        familySlotOptions={familySlotOptions}
        error={allocateOpen ? placeError : null}
        busy={placeBusy}
        onClose={() => {
          setAllocateOpen(false);
          setPlaceError(null);
        }}
        onConfirm={async (slot, audience, personId) => {
          await placeMeal(slot, audience, personId);
          setAllocateOpen(false);
        }}
      />
      <PickMealSheet
        visible={pickOpen}
        recipes={meals.recipes}
        slotOptions={familySlotOptions}
        goals={meals.goals ?? FALLBACK_GOALS}
        activeSlots={meals.activeSlots.length > 0 ? meals.activeSlots : [...CORE_SLOTS]}
        onClose={() => setPickOpen(false)}
        onPicked={(slot, recipe) => {
          setPickOpen(false);
          setPlaceError(null);
          setPendingPick({ slot, recipe });
        }}
        onUseTitle={(slot, name) => {
          setPickOpen(false);
          setPlaceError(null);
          setPendingPick({ slot, title: name });
        }}
        onSaveManual={async (slot, draft) => {
          const saved = await meals.saveHouseholdRecipe({
            ...draft,
            mealSlots: draft.mealSlots?.length ? draft.mealSlots : [slot],
          });
          setPickOpen(false);
          setPlaceError(null);
          setPendingPick({ slot, recipe: saved });
        }}
      />
      <EatForSheet
        visible={pendingPick !== null}
        recipeName={pendingPick?.recipe?.name ?? pendingPick?.title ?? ''}
        people={peopleOptions}
        familyBlocked={pendingPick ? familySlotFilled(pendingPick.slot) : false}
        error={pendingPick ? placeError : null}
        busy={placeBusy}
        onClose={() => {
          setPendingPick(null);
          setPlaceError(null);
        }}
        onConfirm={async (audience) => {
          if (!pendingPick) return;
          await placeMeal(pendingPick.slot, audience, null, pendingPick.recipe, pendingPick.title);
          setPendingPick(null);
        }}
      />
    </>
  );

  const toastNode = (
    <Toast
      visible={toast !== null}
      message={toast?.message ?? ''}
      actionLabel={toast?.actionLabel}
      onAction={() => {
        void toast?.onAction();
      }}
      onDismiss={() => {
        const dismiss = toast?.onDismiss;
        setToast(null);
        if (dismiss) void dismiss();
      }}
    />
  );

  if (mode === 'desktop') {
    return (
      <>
        <PlanDesktop {...planProps} />
        {sheet}
        {sideSheet}
        {planModals}
        {toastNode}
      </>
    );
  }

  return (
    <>
      <PlanMobile {...planProps} />
      {sheet}
      {sideSheet}
      {planModals}
      {toastNode}
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
