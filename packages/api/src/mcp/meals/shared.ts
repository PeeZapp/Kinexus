import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DAYS,
  MEAL_SLOTS,
  addDaysIso,
  estimateRecipeNutrition,
  mondayWeekStart,
  shoppingMergeKey,
  type Day,
  type Ingredient,
  type MealSlotKey,
} from '@kinexus/domain';

import type { McpCaller } from '../context.js';
import { writeMcpAudit } from '../audit.js';

export const RECIPE_NOT_FOUND = 'Recipe not found';
export const SLOT_NOT_FOUND = 'Meal slot not found';
export const HOUSEHOLD_REQUIRED = 'No household membership found';
export const WRITE_ROLE_REQUIRED = 'Your household role cannot change meals';

const SLOT_KEY_SET = new Set<string>(MEAL_SLOTS.map((s) => s.key));
const DAY_SET = new Set<string>(DAYS);
const JS_DAY_TO_DAY: Day[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export type CallerHousehold = {
  householdId: string;
  role: string;
};

export type NutritionPayload =
  | {
      source: 'stored' | 'estimate';
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      servings?: number;
    }
  | { source: 'missing'; message: string };

export type RecipeSummary = {
  id: string;
  name: string;
  householdId: string | null;
  cuisine?: string;
  cookTime?: number;
  servings?: number;
  mealSlots: MealSlotKey[];
  ingredients: Ingredient[];
  method: string[];
  sourceUrl?: string;
  nutrition: NutritionPayload;
  visibility: 'household' | 'catalog';
};

export async function resolveCallerHousehold(
  client: SupabaseClient,
  userId: string,
): Promise<CallerHousehold> {
  const { data, error } = await client
    .from('household_members')
    .select('role, household_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.household_id) throw new Error(HOUSEHOLD_REQUIRED);
  return {
    householdId: data.household_id as string,
    role: typeof data.role === 'string' ? data.role : '',
  };
}

export function canManageMeals(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'adult';
}

export function assertCanWrite(role: string): void {
  if (!canManageMeals(role)) throw new Error(WRITE_ROLE_REQUIRED);
}

export function dayFromIso(isoDate: string): Day {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return JS_DAY_TO_DAY[dt.getDay()] ?? 'monday';
}

export function parseIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be YYYY-MM-DD`);
  const day = dayFromIso(value);
  if (!DAY_SET.has(day)) throw new Error(`${label} is not a valid date`);
  return value;
}

export function parseSlotKey(value: string): MealSlotKey {
  if (!SLOT_KEY_SET.has(value)) throw new Error(`Unknown meal slot "${value}"`);
  return value as MealSlotKey;
}

export function weekStartsCovering(fromDate: string, toDate: string): string[] {
  const from = parseIsoDate(fromDate, 'fromDate');
  const to = parseIsoDate(toDate, 'toDate');
  if (from > to) throw new Error('fromDate must be on or before toDate');
  const weeks: string[] = [];
  let cursor = mondayWeekStart(new Date(`${from}T12:00:00`));
  const endWeek = mondayWeekStart(new Date(`${to}T12:00:00`));
  while (cursor <= endWeek) {
    weeks.push(cursor);
    cursor = addDaysIso(cursor, 7);
  }
  return weeks;
}

export function dateForWeekDay(weekStart: string, day: Day): string {
  const index = DAYS.indexOf(day);
  return addDaysIso(weekStart, index < 0 ? 0 : index);
}

export function asNum(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function mapIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (!name) return [];
    return [
      {
        name,
        amount: typeof rec.amount === 'string' ? rec.amount : undefined,
        category: typeof rec.category === 'string' ? rec.category : undefined,
        baseRecipeId: typeof rec.baseRecipeId === 'string' ? rec.baseRecipeId : undefined,
      },
    ];
  });
}

export function mapMethod(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

export function recipeNutrition(row: {
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  servings?: unknown;
  ingredients?: unknown;
}): NutritionPayload {
  const calories = asNum(row.calories);
  const protein = asNum(row.protein);
  const carbs = asNum(row.carbs);
  const fat = asNum(row.fat);
  if (calories != null || protein != null || carbs != null || fat != null) {
    return {
      source: 'stored',
      calories: calories ?? 0,
      protein: protein ?? 0,
      carbs: carbs ?? 0,
      fat: fat ?? 0,
      servings: asNum(row.servings),
    };
  }
  const estimate = estimateRecipeNutrition(mapIngredients(row.ingredients), asNum(row.servings) ?? 1);
  if (!estimate) {
    return { source: 'missing', message: 'Nutrition is not stored and could not be estimated' };
  }
  return {
    source: 'estimate',
    calories: estimate.calories,
    protein: estimate.protein,
    carbs: estimate.carbs,
    fat: estimate.fat,
    servings: estimate.servings,
  };
}

export function recipeFromRow(row: Record<string, unknown>): RecipeSummary {
  const householdId = (row.household_id as string | null) ?? null;
  const mealSlots = Array.isArray(row.meal_slots)
    ? row.meal_slots.filter((s): s is MealSlotKey => typeof s === 'string' && SLOT_KEY_SET.has(s))
    : [];
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    householdId,
    cuisine: typeof row.cuisine === 'string' ? row.cuisine : undefined,
    cookTime: asNum(row.cook_time),
    servings: asNum(row.servings),
    mealSlots,
    ingredients: mapIngredients(row.ingredients),
    method: mapMethod(row.method),
    sourceUrl: typeof row.source_url === 'string' ? row.source_url : undefined,
    nutrition: recipeNutrition(row),
    visibility: householdId ? 'household' : 'catalog',
  };
}

/** Mirror app insert defaults: household-owned, not public. */
export function recipeInsertRow(
  householdId: string,
  draft: {
    name: string;
    ingredients?: Ingredient[];
    method?: string[];
    cuisine?: string;
    cookTime?: number;
    servings?: number;
    mealSlots?: MealSlotKey[];
    sourceUrl?: string;
    notes?: string;
    chefTip?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    vegetarian?: boolean;
    emoji?: string;
  },
): Record<string, unknown> {
  return {
    household_id: householdId,
    name: draft.name.trim(),
    emoji: draft.emoji ?? null,
    cuisine: draft.cuisine ?? null,
    cook_time: draft.cookTime ?? null,
    servings: draft.servings ?? null,
    protein: draft.protein ?? null,
    calories: draft.calories ?? null,
    carbs: draft.carbs ?? null,
    fat: draft.fat ?? null,
    vegetarian: draft.vegetarian ?? null,
    ingredients: draft.ingredients ?? [],
    method: draft.method ?? [],
    chef_tip: draft.chefTip ?? null,
    notes: draft.notes ?? null,
    meal_slots: draft.mealSlots?.length ? draft.mealSlots : ['dinner'],
    is_component: false,
    excluded_from_auto: false,
    is_public: false,
    source_url: draft.sourceUrl ?? null,
  };
}

export function keyIngredientKeys(ingredients: readonly Ingredient[]): string[] {
  const keys = new Set<string>();
  for (const item of ingredients) {
    const key = shoppingMergeKey(item.name);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function recipesShareKeyIngredients(
  a: readonly Ingredient[],
  b: readonly Ingredient[],
  minOverlap = 2,
): boolean {
  const left = new Set(keyIngredientKeys(a));
  const right = new Set(keyIngredientKeys(b));
  if (left.size === 0 || right.size === 0) return false;
  let overlap = 0;
  for (const key of left) {
    if (right.has(key)) overlap += 1;
    if (overlap >= minOverlap) return true;
  }
  // Single-ingredient recipes: one shared key is enough.
  if (left.size === 1 && right.size === 1 && overlap === 1) return true;
  return false;
}

export function titleMatches(a: string, b: string): boolean {
  const norm = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export async function withMcpAudit<T>(
  caller: McpCaller,
  opts: {
    tool: string;
    mode: 'read' | 'write';
    householdId?: string | null;
  },
  run: () => Promise<T>,
): Promise<T> {
  let householdId = opts.householdId ?? null;
  try {
    const result = await run();
    if (
      householdId == null &&
      result &&
      typeof result === 'object' &&
      'householdId' in result &&
      typeof (result as { householdId?: unknown }).householdId === 'string'
    ) {
      householdId = (result as { householdId: string }).householdId;
    }
    await writeMcpAudit(caller.client, {
      userId: caller.userId,
      householdId,
      clientId: caller.clientId,
      platform: caller.platform,
      tool: opts.tool,
      mode: opts.mode,
      success: true,
    });
    return result;
  } catch (err) {
    await writeMcpAudit(caller.client, {
      userId: caller.userId,
      householdId,
      clientId: caller.clientId,
      platform: caller.platform,
      tool: opts.tool,
      mode: opts.mode,
      success: false,
      errorKind: err instanceof Error ? err.message.slice(0, 80) : 'error',
    });
    throw err;
  }
}

