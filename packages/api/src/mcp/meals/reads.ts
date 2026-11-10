import type { SupabaseClient } from '@supabase/supabase-js';
import { mondayWeekStart, type Day, type MealSlotKey } from '@kinexus/domain';

import {
  RECIPE_NOT_FOUND,
  dateForWeekDay,
  dayFromIso,
  parseIsoDate,
  parseSlotKey,
  recipeFromRow,
  recipesShareKeyIngredients,
  resolveCallerHousehold,
  titleMatches,
  weekStartsCovering,
  type RecipeSummary,
} from './shared.js';

export async function searchRecipes(
  client: SupabaseClient,
  userId: string,
  opts: { query?: string; limit?: number },
): Promise<{ householdId: string; recipes: RecipeSummary[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const query = opts.query?.trim() ?? '';

  let builder = client
    .from('recipes')
    .select('*')
    .or(`household_id.eq.${householdId},household_id.is.null`)
    .eq('removed', false)
    .order('name', { ascending: true })
    .limit(limit * 3);

  if (query) {
    builder = builder.ilike('name', `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);

  let recipes = (data ?? []).map((row) => recipeFromRow(row as Record<string, unknown>));
  if (query) {
    const q = query.toLowerCase();
    recipes = recipes.filter(
      (recipe) =>
        recipe.name.toLowerCase().includes(q) ||
        recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(q)) ||
        (recipe.cuisine ?? '').toLowerCase().includes(q),
    );
  }
  return { householdId, recipes: recipes.slice(0, limit) };
}

export async function getRecipe(
  client: SupabaseClient,
  userId: string,
  recipeId: string,
): Promise<{ householdId: string; recipe: RecipeSummary }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const { data, error } = await client.from('recipes').select('*').eq('id', recipeId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(RECIPE_NOT_FOUND);
  const recipe = recipeFromRow(data as Record<string, unknown>);
  if (recipe.householdId && recipe.householdId !== householdId) throw new Error(RECIPE_NOT_FOUND);
  return { householdId, recipe };
}

export async function findDedupeCandidates(
  client: SupabaseClient,
  householdId: string,
  title: string,
  ingredients: { name: string; amount?: string }[],
): Promise<RecipeSummary[]> {
  const { data, error } = await client
    .from('recipes')
    .select('*')
    .or(`household_id.eq.${householdId},household_id.is.null`)
    .eq('removed', false)
    .ilike('name', `%${title.trim()}%`)
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => recipeFromRow(row as Record<string, unknown>))
    .filter(
      (recipe) =>
        titleMatches(recipe.name, title) && recipesShareKeyIngredients(recipe.ingredients, ingredients),
    )
    .slice(0, 8);
}

export type MealPlanSlotView = {
  date: string;
  day: Day;
  slotKey: MealSlotKey;
  slotId?: string;
  recipeId?: string;
  recipeName?: string;
  hidden: boolean;
  filled: boolean;
};

export async function getMealPlan(
  client: SupabaseClient,
  userId: string,
  opts: { fromDate: string; toDate: string },
): Promise<{ householdId: string; slots: MealPlanSlotView[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const fromDate = parseIsoDate(opts.fromDate, 'fromDate');
  const toDate = parseIsoDate(opts.toDate, 'toDate');
  const weeks = weekStartsCovering(fromDate, toDate);
  const slots: MealPlanSlotView[] = [];

  for (const weekStart of weeks) {
    const { data: plan, error: planError } = await client
      .from('meal_plans')
      .select('id, week_start, active_slots')
      .eq('household_id', householdId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!plan) continue;

    const { data: rows, error } = await client.from('meal_slots').select('*').eq('meal_plan_id', plan.id);
    if (error) throw new Error(error.message);

    for (const row of rows ?? []) {
      const day = row.day as Day;
      const date = dateForWeekDay(weekStart, day);
      if (date < fromDate || date > toDate) continue;
      const slotKey = parseSlotKey(String(row.slot_key));
      const filled = Boolean(row.recipe_id || row.recipe_name);
      slots.push({
        date,
        day,
        slotKey,
        slotId: row.id as string,
        recipeId: (row.recipe_id as string | null) ?? undefined,
        recipeName: (row.recipe_name as string | null) ?? undefined,
        hidden: Boolean(row.hidden),
        filled,
      });
    }
  }

  slots.sort((a, b) => (a.date === b.date ? a.slotKey.localeCompare(b.slotKey) : a.date.localeCompare(b.date)));
  return { householdId, slots };
}

export async function getShoppingList(
  client: SupabaseClient,
  userId: string,
  opts: { weekStart?: string },
): Promise<{
  householdId: string;
  weekStart: string;
  items: { id: string; name: string; amount: string | null; category: string | null; checked: boolean }[];
}> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const weekStart = opts.weekStart ? parseIsoDate(opts.weekStart, 'weekStart') : mondayWeekStart();
  const { data, error } = await client
    .from('shopping_items')
    .select('id, name, amount, category, checked')
    .eq('household_id', householdId)
    .eq('week_start', weekStart)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return {
    householdId,
    weekStart,
    items: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      amount: (row.amount as string | null) ?? null,
      category: (row.category as string | null) ?? null,
      checked: Boolean(row.checked),
    })),
  };
}

export async function getPantry(): Promise<{
  available: false;
  message: string;
}> {
  return {
    available: false,
    message: 'Pantry is stored on the device only and is not available through AI chat connectors.',
  };
}

export async function getPicks(
  client: SupabaseClient,
  userId: string,
  opts: { personId?: string; slotKey?: string },
): Promise<{
  householdId: string;
  picks: { personId: string; slotKey: MealSlotKey; recipeId: string }[];
}> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  let builder = client
    .from('household_person_slot_recipes')
    .select('person_id, slot_key, recipe_id')
    .eq('household_id', householdId);
  if (opts.personId) builder = builder.eq('person_id', opts.personId);
  if (opts.slotKey) builder = builder.eq('slot_key', parseSlotKey(opts.slotKey));
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return {
    householdId,
    picks: (data ?? []).map((row) => ({
      personId: row.person_id as string,
      slotKey: parseSlotKey(String(row.slot_key)),
      recipeId: row.recipe_id as string,
    })),
  };
}

export async function loadRecipeOrThrow(
  client: SupabaseClient,
  householdId: string,
  recipeId: string,
): Promise<RecipeSummary> {
  const { data, error } = await client.from('recipes').select('*').eq('id', recipeId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(RECIPE_NOT_FOUND);
  const recipe = recipeFromRow(data as Record<string, unknown>);
  if (recipe.householdId && recipe.householdId !== householdId) throw new Error(RECIPE_NOT_FOUND);
  return recipe;
}

export async function ensureMealPlanId(
  client: SupabaseClient,
  householdId: string,
  weekStart: string,
): Promise<string> {
  const { data, error } = await client.rpc('get_or_create_meal_plan', {
    p_household_id: householdId,
    p_week_start: weekStart,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Could not create meal plan');
  return data as string;
}

export async function findHouseholdSlot(
  client: SupabaseClient,
  planId: string,
  day: Day,
  slotKey: MealSlotKey,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from('meal_slots')
    .select('*')
    .eq('meal_plan_id', planId)
    .eq('day', day)
    .eq('slot_key', slotKey);
  if (error) throw new Error(error.message);
  const household =
    (data ?? []).find((row) => {
      const audience = row.audience_person_ids;
      return !Array.isArray(audience) || audience.length === 0;
    }) ?? null;
  return household as Record<string, unknown> | null;
}

export { dayFromIso, mondayWeekStart };
