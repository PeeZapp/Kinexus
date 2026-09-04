import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { MealSlot, NutritionGoals, Recipe } from '@kinexus/domain';

function canUseStorage() {
  return !(Platform.OS === 'web' && typeof window === 'undefined');
}

export type MealsCacheSnapshot = {
  planId: string | null;
  activeSlots: string[];
  slots: (MealSlot & { id: string; updatedAt: string })[];
  recipes: Recipe[];
  goals: NutritionGoals | null;
  shoppingCount: number;
};

function cacheKey(householdId: string, weekStart: string) {
  return `kinexus.mealsCache.${householdId}.${weekStart}`;
}

export async function readMealsCache(
  householdId: string,
  weekStart: string,
): Promise<MealsCacheSnapshot | null> {
  if (!canUseStorage()) return null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(householdId, weekStart));
    if (!raw) return null;
    return JSON.parse(raw) as MealsCacheSnapshot;
  } catch {
    return null;
  }
}

export async function writeMealsCache(
  householdId: string,
  weekStart: string,
  snapshot: MealsCacheSnapshot,
): Promise<void> {
  if (!canUseStorage()) return;
  await AsyncStorage.setItem(cacheKey(householdId, weekStart), JSON.stringify(snapshot));
}
