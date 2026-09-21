import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CleanRecipe } from '@kinexus/domain';

const RECIPE_KEY = (id: string) => `kinexus.cookRecipe.${id}`;
const CHECKS_KEY = (id: string) => `kinexus.cookChecks.${id}`;
const SAVED_MAP_KEY = 'kinexus.cookSavedMap';
const PENDING_SAVE_KEY = 'kinexus.cookPendingSave';
const RETURN_TO_KEY = 'kinexus.cookReturnTo';

export type PendingCookSave = {
  importId: string;
  recipe: CleanRecipe;
};

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheCookRecipe(id: string, recipe: CleanRecipe): Promise<void> {
  await AsyncStorage.setItem(RECIPE_KEY(id), JSON.stringify(recipe));
}

export async function readCachedCookRecipe(id: string): Promise<CleanRecipe | null> {
  return readJson<CleanRecipe>(RECIPE_KEY(id));
}

export async function readCookChecks(id: string): Promise<string[]> {
  const value = await readJson<string[]>(CHECKS_KEY(id));
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

export async function writeCookChecks(id: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(CHECKS_KEY(id), JSON.stringify(ids));
}

async function readSavedMap(): Promise<Record<string, string>> {
  const value = await readJson<Record<string, string>>(SAVED_MAP_KEY);
  if (!value || typeof value !== 'object') return {};
  return value;
}

export async function readSavedHouseholdId(importId: string): Promise<string | null> {
  const map = await readSavedMap();
  return map[importId] ?? null;
}

export async function writeSavedHouseholdId(importId: string, householdRecipeId: string): Promise<void> {
  const map = await readSavedMap();
  map[importId] = householdRecipeId;
  await AsyncStorage.setItem(SAVED_MAP_KEY, JSON.stringify(map));
}

export async function writePendingCookSave(pending: PendingCookSave): Promise<void> {
  await AsyncStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(pending));
}

export async function readPendingCookSave(): Promise<PendingCookSave | null> {
  const value = await readJson<PendingCookSave>(PENDING_SAVE_KEY);
  if (!value?.importId || !value.recipe) return null;
  return value;
}

export async function clearPendingCookSave(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_SAVE_KEY);
}

export async function writeCookReturnTo(path: string): Promise<void> {
  await AsyncStorage.setItem(RETURN_TO_KEY, path);
}

export async function readCookReturnTo(): Promise<string | null> {
  return AsyncStorage.getItem(RETURN_TO_KEY);
}

export async function clearCookReturnTo(): Promise<void> {
  await AsyncStorage.removeItem(RETURN_TO_KEY);
}

export function isSafeCookReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false;
  return path.startsWith('/recipes') || path.startsWith('/import');
}
