import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { MealSlot, NutritionGoals, Recipe, RecipeCostEstimate } from '@kinexus/domain';

function canUseStorage() {
  return !(Platform.OS === 'web' && typeof window === 'undefined');
}

const PREFIX = 'kinexus.mealsCache.';
const WEEK_PREFIX = `${PREFIX}v2.week.`;
const RECIPES_PREFIX = `${PREFIX}v2.recipes.`;
const MAX_RECIPES_CHARS = 1_200_000;

export type MealsCacheSnapshot = {
  planId: string | null;
  activeSlots: string[];
  slots: (MealSlot & { id: string; updatedAt: string })[];
  recipes: Recipe[];
  goals: NutritionGoals | null;
  shoppingCount: number;
};

type WeekSnapshot = Omit<MealsCacheSnapshot, 'recipes'>;

let pruneLegacyPromise: Promise<void> | null = null;

function weekCacheKey(householdId: string, weekStart: string) {
  return `${WEEK_PREFIX}${householdId}.${weekStart}`;
}

function recipesCacheKey(householdId: string) {
  return `${RECIPES_PREFIX}${householdId}`;
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string; code?: number };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    (typeof e.message === 'string' && /quota/i.test(e.message))
  );
}

function slimCost(cost: RecipeCostEstimate | undefined): RecipeCostEstimate | undefined {
  if (!cost) return undefined;
  return {
    totalCost: cost.totalCost,
    costPerServe: cost.costPerServe,
    currency: cost.currency,
    country: cost.country,
    stores: cost.stores,
    pricedAt: cost.pricedAt,
    servingsBasis: cost.servingsBasis,
    breakdown: [],
    coveredIngredients: cost.coveredIngredients,
    totalIngredients: cost.totalIngredients,
  };
}

function slimRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    method: undefined,
    chefTip: undefined,
    notes: undefined,
    cost: slimCost(recipe.cost),
  };
}

function recipesForCache(recipes: Recipe[]): Recipe[] | null {
  const slim =
    Platform.OS === 'web' ? recipes.filter((recipe) => recipe.householdId != null).map(slimRecipe) : recipes.map(slimRecipe);
  if (!slim.length) return [];
  const encoded = JSON.stringify(slim);
  if (encoded.length <= MAX_RECIPES_CHARS) return slim;
  const householdOnly = slim.filter((recipe) => recipe.householdId != null);
  if (!householdOnly.length) return null;
  return JSON.stringify(householdOnly).length <= MAX_RECIPES_CHARS ? householdOnly : null;
}

async function mealsCacheKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(PREFIX));
}

async function pruneLegacyCache(): Promise<void> {
  if (!pruneLegacyPromise) {
    pruneLegacyPromise = (async () => {
      const keys = await mealsCacheKeys();
      const legacy = keys.filter((key) => !key.startsWith(`${PREFIX}v2.`));
      if (legacy.length) await AsyncStorage.multiRemove(legacy);
    })().catch(() => {
      pruneLegacyPromise = null;
    });
  }
  await pruneLegacyPromise;
}

async function pruneTo(keep: string[]): Promise<void> {
  const keys = await mealsCacheKeys();
  const keepSet = new Set(keep);
  const drop = keys.filter((key) => !keepSet.has(key));
  if (drop.length) await AsyncStorage.multiRemove(drop);
}

async function setJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function readMealsCache(
  householdId: string,
  weekStart: string,
): Promise<MealsCacheSnapshot | null> {
  if (!canUseStorage()) return null;
  try {
    await pruneLegacyCache();
    const [weekRaw, recipesRaw] = await Promise.all([
      AsyncStorage.getItem(weekCacheKey(householdId, weekStart)),
      AsyncStorage.getItem(recipesCacheKey(householdId)),
    ]);
    if (!weekRaw && !recipesRaw) return null;
    const week = weekRaw ? (JSON.parse(weekRaw) as WeekSnapshot) : null;
    const recipes = recipesRaw ? (JSON.parse(recipesRaw) as Recipe[]) : [];
    return {
      planId: week?.planId ?? null,
      activeSlots: week?.activeSlots ?? [],
      slots: week?.slots ?? [],
      recipes: Array.isArray(recipes) ? recipes : [],
      goals: week?.goals ?? null,
      shoppingCount: week?.shoppingCount ?? 0,
    };
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

  const weekKey = weekCacheKey(householdId, weekStart);
  const recKey = recipesCacheKey(householdId);
  const weekPayload: WeekSnapshot = {
    planId: snapshot.planId,
    activeSlots: snapshot.activeSlots,
    slots: snapshot.slots,
    goals: snapshot.goals,
    shoppingCount: snapshot.shoppingCount,
  };
  const recipesPayload = recipesForCache(snapshot.recipes);

  const persist = async (recipes: Recipe[] | null) => {
    await setJson(weekKey, weekPayload);
    if (recipes !== null) await setJson(recKey, recipes);
  };

  try {
    await pruneLegacyCache();
    await persist(recipesPayload);
  } catch (error) {
    if (!isQuotaError(error)) return;
    try {
      await pruneTo(recipesPayload ? [weekKey, recKey] : [weekKey]);
      await persist(recipesPayload);
    } catch (retryError) {
      if (!isQuotaError(retryError)) return;
      try {
        await pruneTo([weekKey]);
        await persist(null);
      } catch {
        // Cache is best-effort; never crash the app over quota.
      }
    }
  }
}
