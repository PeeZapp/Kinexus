import { DAYS, MEAL_SLOTS, type Day, type MealSlotKey } from './types';

export function orderedMealSlotKeys(keys: readonly MealSlotKey[]): MealSlotKey[] {
  const set = new Set(keys);
  return MEAL_SLOTS.map((slot) => slot.key).filter((key) => set.has(key));
}

export function hiddenMealSlotKeysForDay(
  slotMap: ReadonlyMap<string, { hidden?: boolean }>,
  day: Day,
): Set<MealSlotKey> {
  const hidden = new Set<MealSlotKey>();
  for (const slot of MEAL_SLOTS) {
    if (slotMap.get(`${day}_${slot.key}`)?.hidden) hidden.add(slot.key);
  }
  return hidden;
}

export function visibleMealSlotKeys(
  activeSlots: readonly MealSlotKey[],
  hiddenOnDay: ReadonlySet<MealSlotKey>,
): MealSlotKey[] {
  return orderedMealSlotKeys(activeSlots).filter((key) => !hiddenOnDay.has(key));
}

/** True when every active slot type is hidden on that day (the day is off this week's plan). */
export function dayIsRemovedFromPlan(
  activeSlots: readonly MealSlotKey[],
  slotMap: ReadonlyMap<string, { hidden?: boolean }>,
  day: Day,
): boolean {
  const selected = orderedMealSlotKeys(activeSlots);
  if (selected.length === 0) return false;
  const hidden = hiddenMealSlotKeysForDay(slotMap, day);
  return selected.every((key) => hidden.has(key));
}

export function plannedDays(
  activeSlots: readonly MealSlotKey[],
  slotMap: ReadonlyMap<string, { hidden?: boolean }>,
): Day[] {
  return DAYS.filter((day) => !dayIsRemovedFromPlan(activeSlots, slotMap, day));
}

export function addableMealSlotKeys(visibleOnDay: readonly MealSlotKey[]): MealSlotKey[] {
  const visible = new Set(visibleOnDay);
  return MEAL_SLOTS.map((slot) => slot.key).filter((key) => !visible.has(key));
}

/** Other days to hide when a slot type is added to only one day for the first time this week. */
export function otherDaysToHideForNewSlot(slotKey: MealSlotKey, day: Day, activeSlots: readonly MealSlotKey[]): Day[] {
  if (activeSlots.includes(slotKey)) return [];
  return DAYS.filter((other) => other !== day);
}

/** True when hiding this slot on `day` leaves no visible instance of that type on the week. */
export function shouldDropSlotFromActive(
  slotKey: MealSlotKey,
  day: Day,
  activeSlots: readonly MealSlotKey[],
  slotMap: ReadonlyMap<string, { hidden?: boolean }>,
): boolean {
  if (!activeSlots.includes(slotKey)) return false;
  return DAYS.every((other) => other === day || Boolean(slotMap.get(`${other}_${slotKey}`)?.hidden));
}
