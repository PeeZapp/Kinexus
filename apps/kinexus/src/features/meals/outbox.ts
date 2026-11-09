import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { mealSlotRecordKey, normalizeAudiencePersonIds } from '@kinexus/domain';

import type { SlotOutboxOp } from '@/src/features/meals/slot-outbox-ops';

export type { PlanOverlaySlot, SlotOutboxOp } from '@/src/features/meals/slot-outbox-ops';
export {
  applySlotOpToList,
  findOverlaySlot,
  inverseSlotOp,
  overlayPendingSlotOps,
  slotOpTouchesShopping,
} from '@/src/features/meals/slot-outbox-ops';

function canUseStorage() {
  return !(Platform.OS === 'web' && typeof window === 'undefined');
}

const OUTBOX_KEY = 'kinexus.slotOutbox.v2';

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

export async function enqueueSlotOp(op: Omit<SlotOutboxOp, 'id'> & { id?: string }): Promise<SlotOutboxOp> {
  const full: SlotOutboxOp = {
    ...op,
    id: op.id ?? Crypto.randomUUID(),
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
