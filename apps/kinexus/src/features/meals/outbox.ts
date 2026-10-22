import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { mealSlotRecordKey, normalizeAudiencePersonIds, type Day, type MealSlotKey } from '@kinexus/domain';

function canUseStorage() {
  return !(Platform.OS === 'web' && typeof window === 'undefined');
}

const OUTBOX_KEY = 'kinexus.slotOutbox.v2';

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

function opCellKey(op: Pick<SlotOutboxOp, 'day' | 'slotKey' | 'slotId' | 'audiencePersonIds'>): string {
  if (op.slotId) return `id:${op.slotId}`;
  return mealSlotRecordKey(op.day, op.slotKey, op.audiencePersonIds);
}

export async function readSlotOutbox(): Promise<SlotOutboxOp[]> {
  if (!canUseStorage()) return [];
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SlotOutboxOp[]) : [];
  } catch {
    return [];
  }
}

export async function writeSlotOutbox(ops: SlotOutboxOp[]): Promise<void> {
  if (!canUseStorage()) return;
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
}

export async function enqueueSlotOp(op: Omit<SlotOutboxOp, 'id'>): Promise<SlotOutboxOp> {
  const full: SlotOutboxOp = {
    ...op,
    id: Crypto.randomUUID(),
    audiencePersonIds: normalizeAudiencePersonIds(op.audiencePersonIds),
  };
  const current = await readSlotOutbox();
  const key = opCellKey(full);
  const next = current.filter(
    (item) =>
      !(
        item.householdId === full.householdId &&
        item.weekStart === full.weekStart &&
        opCellKey(item) === key
      ),
  );
  next.push(full);
  await writeSlotOutbox(next);
  return full;
}

export async function removeSlotOps(ids: string[]): Promise<void> {
  const current = await readSlotOutbox();
  await writeSlotOutbox(current.filter((op) => !ids.includes(op.id)));
}

/** Drop every queued slot change for one household week so a reset is not replayed over. */
export async function dropHouseholdWeekOutbox(householdId: string, weekStart: string): Promise<void> {
  const current = await readSlotOutbox();
  await writeSlotOutbox(current.filter((op) => !(op.householdId === householdId && op.weekStart === weekStart)));
}

export async function householdOutbox(householdId: string): Promise<SlotOutboxOp[]> {
  const all = await readSlotOutbox();
  return all.filter((op) => op.householdId === householdId);
}
