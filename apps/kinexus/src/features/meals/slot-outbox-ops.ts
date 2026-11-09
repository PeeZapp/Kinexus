import {
  normalizeAudiencePersonIds,
  type Day,
  type MealSlot,
  type MealSlotKey,
} from '@kinexus/domain';

export type SlotOutboxOp = {
  id: string;
  householdId: string;
  weekStart: string;
  day: Day;
  slotKey: MealSlotKey;
  /** Stable row id once known; preferred match key. */
  slotId?: string | null;
  audiencePersonIds?: string[];
  kind: 'assign' | 'clear' | 'hide' | 'allocate' | 'audience' | 'delete' | 'reset-week';
  recipeId?: string | null;
  recipeName?: string | null;
  emoji?: string | null;
  protein?: number | null;
  calories?: number | null;
  carbs?: number | null;
  fat?: number | null;
  cookTime?: number | null;
  hidden?: boolean;
  /** Hide that also empties the meal. One outbox op per slot, so clear and hide have to travel together. */
  clearMeal?: boolean;
  assignedPersonId?: string | null;
  /** Set on assign when the caller is replacing sides. Omitted leaves the current sides. */
  sideRecipeIds?: string[];
  /**
   * Serves to cook. Set on assign. `null` clears back to the recipe yield.
   * Omitted leaves the current value.
   */
  targetServings?: number | null;
  clientUpdatedAt: string;
};

export type PlanOverlaySlot = MealSlot & { id: string; updatedAt: string };

function audienceEqual(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const left = normalizeAudiencePersonIds(a);
  const right = normalizeAudiencePersonIds(b);
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

export function findOverlaySlot(
  list: readonly PlanOverlaySlot[],
  opts: { slotId?: string | null; day: Day; slotKey: MealSlotKey; audiencePersonIds?: readonly string[] | null },
): PlanOverlaySlot | undefined {
  if (opts.slotId) {
    const byId = list.find((slot) => slot.id === opts.slotId);
    if (byId) return byId;
  }
  return list.find(
    (slot) =>
      slot.day === opts.day &&
      slot.slotKey === opts.slotKey &&
      audienceEqual(slot.audiencePersonIds, opts.audiencePersonIds),
  );
}

/** Apply one outbox op onto a local slots list (optimistic / refetch overlay). */
export function applySlotOpToList(list: readonly PlanOverlaySlot[], op: SlotOutboxOp): PlanOverlaySlot[] {
  if (op.kind === 'reset-week') return [];
  if (op.kind === 'delete') {
    if (!op.slotId) return [...list];
    return list.filter((slot) => slot.id !== op.slotId);
  }
  const existing = findOverlaySlot(list, op);
  const idx = existing ? list.indexOf(existing) : -1;
  const clearsMeal = op.kind === 'clear' || op.clearMeal === true;
  const replacingMeal = op.kind === 'assign';
  const mealField = <T,>(incoming: T | null | undefined, previous: T | undefined): T | undefined => {
    if (clearsMeal) return undefined;
    if (replacingMeal) return incoming ?? undefined;
    return incoming ?? previous;
  };
  const audiencePersonIds =
    op.kind === 'audience'
      ? normalizeAudiencePersonIds(op.audiencePersonIds)
      : normalizeAudiencePersonIds(op.audiencePersonIds ?? existing?.audiencePersonIds);
  const next: PlanOverlaySlot = {
    id: existing?.id ?? op.slotId ?? op.id,
    day: op.day,
    slotKey: op.slotKey,
    recipeId: mealField(op.recipeId, existing?.recipeId),
    recipeName: mealField(op.recipeName, existing?.recipeName),
    emoji: mealField(op.emoji, existing?.emoji),
    protein: mealField(op.protein, existing?.protein),
    calories: mealField(op.calories, existing?.calories),
    carbs: mealField(op.carbs, existing?.carbs),
    fat: mealField(op.fat, existing?.fat),
    cookTime: mealField(op.cookTime, existing?.cookTime),
    hidden:
      op.kind === 'hide'
        ? Boolean(op.hidden)
        : op.kind === 'assign' || op.kind === 'clear' || op.kind === 'audience'
          ? false
          : existing?.hidden,
    assignedPersonId:
      op.kind === 'allocate' || op.clearMeal === true
        ? (op.assignedPersonId ?? undefined)
        : (op.assignedPersonId ?? existing?.assignedPersonId),
    audiencePersonIds,
    sideRecipeIds:
      op.clearMeal === true
        ? []
        : op.kind === 'assign' && op.sideRecipeIds != null
          ? op.sideRecipeIds
          : existing?.sideRecipeIds,
    targetServings: clearsMeal
      ? undefined
      : op.targetServings !== undefined
        ? (op.targetServings ?? undefined)
        : existing?.targetServings,
    updatedAt: op.clientUpdatedAt,
  };
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = next;
    return copy;
  }
  return [...list, next];
}

/** Overlay pending outbox ops for one week onto server rows so a refetch cannot snap back. */
export function overlayPendingSlotOps(
  serverSlots: readonly PlanOverlaySlot[],
  pending: readonly SlotOutboxOp[],
  weekStart: string,
): PlanOverlaySlot[] {
  const weekOps = pending.filter((op) => op.weekStart === weekStart);
  if (weekOps.some((op) => op.kind === 'reset-week')) return [];
  return weekOps.reduce<PlanOverlaySlot[]>((list, op) => applySlotOpToList(list, op), [...serverSlots]);
}

export function slotOpTouchesShopping(op: SlotOutboxOp): boolean {
  return (
    op.kind === 'assign' ||
    op.kind === 'clear' ||
    op.kind === 'delete' ||
    op.kind === 'reset-week' ||
    (op.kind === 'hide' && op.clearMeal === true)
  );
}

/** Inverse of a queued op, using the slot snapshot taken before the forward op. */
export function inverseSlotOp(
  op: SlotOutboxOp,
  previous: PlanOverlaySlot | null | undefined,
): Omit<SlotOutboxOp, 'id' | 'clientUpdatedAt'> | null {
  if (op.kind === 'reset-week') return null;
  if (op.kind === 'hide') {
    if (op.hidden) {
      if (op.clearMeal && previous && (previous.recipeId || previous.recipeName)) {
        return {
          householdId: op.householdId,
          weekStart: op.weekStart,
          kind: 'assign',
          day: op.day,
          slotKey: op.slotKey,
          slotId: op.slotId ?? previous.id,
          audiencePersonIds: normalizeAudiencePersonIds(op.audiencePersonIds ?? previous.audiencePersonIds),
          recipeId: previous.recipeId ?? null,
          recipeName: previous.recipeName ?? null,
          emoji: previous.emoji ?? null,
          protein: previous.protein ?? null,
          calories: previous.calories ?? null,
          carbs: previous.carbs ?? null,
          fat: previous.fat ?? null,
          cookTime: previous.cookTime ?? null,
          sideRecipeIds: previous.sideRecipeIds ?? [],
          targetServings: previous.targetServings ?? null,
          assignedPersonId: previous.assignedPersonId ?? null,
          hidden: false,
        };
      }
      return {
        householdId: op.householdId,
        weekStart: op.weekStart,
        kind: 'hide',
        day: op.day,
        slotKey: op.slotKey,
        slotId: op.slotId ?? previous?.id,
        audiencePersonIds: normalizeAudiencePersonIds(op.audiencePersonIds ?? previous?.audiencePersonIds),
        hidden: false,
        assignedPersonId: previous?.assignedPersonId ?? null,
      };
    }
    return {
      householdId: op.householdId,
      weekStart: op.weekStart,
      kind: 'hide',
      day: op.day,
      slotKey: op.slotKey,
      slotId: op.slotId ?? previous?.id,
      audiencePersonIds: normalizeAudiencePersonIds(op.audiencePersonIds ?? previous?.audiencePersonIds),
      hidden: true,
      assignedPersonId: previous?.assignedPersonId ?? op.assignedPersonId ?? null,
    };
  }
  if (op.kind === 'delete') {
    if (!previous) return null;
    const audiencePersonIds = normalizeAudiencePersonIds(previous.audiencePersonIds);
    if (previous.recipeId || previous.recipeName) {
      return {
        householdId: op.householdId,
        weekStart: op.weekStart,
        kind: 'assign',
        day: previous.day,
        slotKey: previous.slotKey,
        slotId: previous.id,
        audiencePersonIds,
        recipeId: previous.recipeId ?? null,
        recipeName: previous.recipeName ?? null,
        emoji: previous.emoji ?? null,
        protein: previous.protein ?? null,
        calories: previous.calories ?? null,
        carbs: previous.carbs ?? null,
        fat: previous.fat ?? null,
        cookTime: previous.cookTime ?? null,
        sideRecipeIds: previous.sideRecipeIds ?? [],
        targetServings: previous.targetServings ?? null,
        assignedPersonId: previous.assignedPersonId ?? null,
        hidden: false,
      };
    }
    return {
      householdId: op.householdId,
      weekStart: op.weekStart,
      kind: 'audience',
      day: previous.day,
      slotKey: previous.slotKey,
      slotId: previous.id,
      audiencePersonIds,
      assignedPersonId: previous.assignedPersonId ?? null,
      hidden: false,
    };
  }
  if (op.kind === 'clear' && previous) {
    if (previous.recipeId || previous.recipeName) {
      return {
        householdId: op.householdId,
        weekStart: op.weekStart,
        kind: 'assign',
        day: op.day,
        slotKey: op.slotKey,
        slotId: op.slotId ?? previous.id,
        audiencePersonIds: normalizeAudiencePersonIds(op.audiencePersonIds ?? previous.audiencePersonIds),
        recipeId: previous.recipeId ?? null,
        recipeName: previous.recipeName ?? null,
        emoji: previous.emoji ?? null,
        protein: previous.protein ?? null,
        calories: previous.calories ?? null,
        carbs: previous.carbs ?? null,
        fat: previous.fat ?? null,
        cookTime: previous.cookTime ?? null,
        sideRecipeIds: previous.sideRecipeIds ?? [],
        targetServings: previous.targetServings ?? null,
        assignedPersonId: previous.assignedPersonId ?? null,
      };
    }
  }
  if ((op.kind === 'assign' || op.kind === 'allocate' || op.kind === 'audience') && previous) {
    if (!previous.recipeId && !previous.recipeName && op.kind === 'assign') {
      return {
        householdId: op.householdId,
        weekStart: op.weekStart,
        kind: 'clear',
        day: op.day,
        slotKey: op.slotKey,
        slotId: op.slotId ?? previous.id,
        audiencePersonIds: normalizeAudiencePersonIds(op.audiencePersonIds ?? previous.audiencePersonIds),
        assignedPersonId: previous.assignedPersonId ?? null,
      };
    }
    return {
      householdId: op.householdId,
      weekStart: op.weekStart,
      kind: previous.recipeId || previous.recipeName ? 'assign' : op.kind === 'allocate' ? 'allocate' : 'audience',
      day: previous.day,
      slotKey: previous.slotKey,
      slotId: previous.id,
      audiencePersonIds: normalizeAudiencePersonIds(previous.audiencePersonIds),
      recipeId: previous.recipeId ?? null,
      recipeName: previous.recipeName ?? null,
      emoji: previous.emoji ?? null,
      protein: previous.protein ?? null,
      calories: previous.calories ?? null,
      carbs: previous.carbs ?? null,
      fat: previous.fat ?? null,
      cookTime: previous.cookTime ?? null,
      sideRecipeIds: previous.sideRecipeIds ?? [],
      targetServings: previous.targetServings ?? null,
      assignedPersonId: previous.assignedPersonId ?? null,
      hidden: previous.hidden ?? false,
    };
  }
  if (op.kind === 'assign' && !previous) {
    return {
      householdId: op.householdId,
      weekStart: op.weekStart,
      kind: 'clear',
      day: op.day,
      slotKey: op.slotKey,
      slotId: op.slotId,
      audiencePersonIds: normalizeAudiencePersonIds(op.audiencePersonIds),
      assignedPersonId: op.assignedPersonId ?? null,
    };
  }
  return null;
}

