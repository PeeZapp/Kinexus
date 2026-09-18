import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import type { Day, MealSlotKey } from '@kinexus/domain';

function canUseStorage() {
  return !(Platform.OS === 'web' && typeof window === 'undefined');
}

const OUTBOX_KEY = 'kinexus.slotOutbox.v1';

export type SlotOutboxOp = {
  id: string;
  householdId: string;
  weekStart: string;
  day: Day;
  slotKey: MealSlotKey;
  kind: 'assign' | 'clear' | 'hide' | 'allocate';
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
  clientUpdatedAt: string;
};

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
  const full: SlotOutboxOp = { ...op, id: Crypto.randomUUID() };
  const current = await readSlotOutbox();
  const next = current.filter(
    (item) =>
      !(
        item.householdId === full.householdId &&
        item.weekStart === full.weekStart &&
        item.day === full.day &&
        item.slotKey === full.slotKey
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

export async function householdOutbox(householdId: string): Promise<SlotOutboxOp[]> {
  const all = await readSlotOutbox();
  return all.filter((op) => op.householdId === householdId);
}
