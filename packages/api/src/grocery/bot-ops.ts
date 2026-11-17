import {
  CORE_SLOTS,
  DAYS,
  hideReplacedCatalogRecipes,
  isRecipeClass,
  mondayWeekStart,
  shoppingFromPlan,
  shoppingMergeKey,
  withGroceryMatcherVersion,
  type Day,
  type MealSlot,
  type MealSlotKey,
  type Recipe,
  type StoredGroceryQuote,
} from '@kinexus/domain';

import { compareGroceryList } from './compare.js';
import { asWeekStart } from './bot.js';
import { createServiceClient } from '../supabase-admin.js';
import {
  assertCanWrite,
  dateForWeekDay,
  dayFromIso,
  mapIngredients,
  mapMethod,
  parseIsoDate,
  parseSlotKey,
  weekStartsCovering,
} from '../mcp/meals/shared.js';
import { ensureMealPlanId, findHouseholdSlot, loadRecipeOrThrow } from '../mcp/meals/reads.js';

function admin() {
  return createServiceClient();
}

async function memberRole(userId: string, householdId: string): Promise<string> {
  const { data, error } = await admin()
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('You are not in that household.');
  return typeof data.role === 'string' ? data.role : '';
}

async function assertBotCanWrite(userId: string, householdId: string): Promise<void> {
  assertCanWrite(await memberRole(userId, householdId));
}

async function householdCountry(householdId: string): Promise<string> {
  const { data, error } = await admin().from('households').select('country').eq('id', householdId).maybeSingle();
  if (error) throw new Error(error.message);
  const country = typeof data?.country === 'string' ? data.country.trim().toUpperCase() : '';
  return country || 'AU';
}

function recipeFromDb(row: Record<string, unknown>): Recipe {
  const householdId = (row.household_id as string | null) ?? null;
  const mealSlots = Array.isArray(row.meal_slots)
    ? row.meal_slots.filter((s): s is MealSlotKey => typeof s === 'string')
    : [];
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    householdId,
    cuisine: typeof row.cuisine === 'string' ? row.cuisine : undefined,
    cookTime: typeof row.cook_time === 'number' ? row.cook_time : undefined,
    servings: typeof row.servings === 'number' ? row.servings : undefined,
    ingredients: mapIngredients(row.ingredients),
    method: mapMethod(row.method),
    mealSlots,
    recipeClass: (() => {
      const value = typeof row.recipe_class === 'string' ? row.recipe_class : null;
      return isRecipeClass(value) ? value : undefined;
    })(),
    isComponent: Boolean(row.is_component),
    excludedFromAuto: Boolean(row.excluded_from_auto),
    removed: Boolean(row.removed),
    sourcedFromRecipeId: typeof row.sourced_from_recipe_id === 'string' ? row.sourced_from_recipe_id : undefined,
    replacesSource: Boolean(row.replaces_source),
  };
}

export async function botGetFoodPrefs(householdId: string) {
  const { data, error } = await admin()
    .from('household_food_prefs')
    .select('cuisines, allergies, equipment')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    householdId,
    cuisines: Array.isArray(data?.cuisines) ? (data!.cuisines as string[]) : [],
    allergies: Array.isArray(data?.allergies) ? (data!.allergies as string[]) : [],
    equipment: Array.isArray(data?.equipment) ? (data!.equipment as string[]) : [],
  };
}

export async function botGetMealPlan(householdId: string, opts: { fromDate: string; toDate: string }) {
  const fromDate = parseIsoDate(opts.fromDate, 'fromDate');
  const toDate = parseIsoDate(opts.toDate, 'toDate');
  const weeks = weekStartsCovering(fromDate, toDate);
  const client = admin();
  const slots: {
    date: string;
    day: Day;
    slotKey: string;
    slotId?: string;
    recipeId?: string;
    recipeName?: string;
    hidden: boolean;
    filled: boolean;
  }[] = [];

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
  return { householdId, fromDate, toDate, slots };
}

export async function botSearchRecipes(householdId: string, opts: { query?: string; limit?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const query = opts.query?.trim() ?? '';
  let builder = admin()
    .from('recipes')
    .select('id, name, cuisine, cook_time, servings, meal_slots, household_id, removed')
    .or(`household_id.eq.${householdId},household_id.is.null`)
    .eq('removed', false)
    .order('name', { ascending: true })
    .limit(limit * 3);
  if (query) builder = builder.ilike('name', `%${query}%`);
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  let recipes = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    cuisine: typeof row.cuisine === 'string' ? row.cuisine : null,
    cookTime: typeof row.cook_time === 'number' ? row.cook_time : null,
    servings: typeof row.servings === 'number' ? row.servings : null,
    mealSlots: Array.isArray(row.meal_slots) ? row.meal_slots : [],
    visibility: row.household_id ? 'household' : 'catalog',
  }));
  if (query) {
    const q = query.toLowerCase();
    recipes = recipes.filter((recipe) => recipe.name.toLowerCase().includes(q));
  }
  return { householdId, recipes: recipes.slice(0, limit) };
}

export async function botGetPicks(householdId: string, opts: { personId?: string; slotKey?: string }) {
  let builder = admin()
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

export async function botPlanMeals(
  userId: string,
  householdId: string,
  meals: { date: string; slotKey: string; recipeId: string; overwrite?: boolean }[],
) {
  await assertBotCanWrite(userId, householdId);
  if (!meals.length) throw new Error('meals must include at least one slot');
  const client = admin();
  const steps: {
    date: string;
    day: Day;
    slotKey: MealSlotKey;
    recipeId: string;
    recipeName: string;
    overwrite: boolean;
    slotId?: string;
  }[] = [];

  for (const meal of meals) {
    const date = parseIsoDate(meal.date, 'date');
    const day = dayFromIso(date);
    const slotKey = parseSlotKey(meal.slotKey);
    const recipe = await loadRecipeOrThrow(client, householdId, meal.recipeId);
    const weekStart = mondayWeekStart(new Date(`${date}T12:00:00`));
    const planId = await ensureMealPlanId(client, householdId, weekStart);
    const existing = await findHouseholdSlot(client, planId, day, slotKey);
    const existingRecipeId = (existing?.recipe_id as string | null) ?? undefined;
    const existingRecipeName = (existing?.recipe_name as string | null) ?? undefined;
    const filled = Boolean(existingRecipeId || existingRecipeName);
    const overwrite = Boolean(meal.overwrite);
    if (filled && !overwrite) {
      return {
        ok: false as const,
        blocked: true,
        message: `Slot ${day} ${slotKey} already has ${existingRecipeName ?? 'a meal'}. Pass overwrite: true to replace it.`,
        existing: { recipeId: existingRecipeId, recipeName: existingRecipeName },
      };
    }
    steps.push({
      date,
      day,
      slotKey,
      recipeId: recipe.id,
      recipeName: recipe.name,
      overwrite: filled ? true : overwrite,
      slotId: existing?.id ? String(existing.id) : undefined,
    });
  }

  const affectedIds: string[] = [];
  for (const step of steps) {
    const weekStart = mondayWeekStart(new Date(`${step.date}T12:00:00`));
    const planId = await ensureMealPlanId(client, householdId, weekStart);
    const existing = await findHouseholdSlot(client, planId, step.day, step.slotKey);
    const now = new Date().toISOString();
    const row = {
      meal_plan_id: planId,
      household_id: householdId,
      day: step.day,
      slot_key: step.slotKey,
      recipe_id: step.recipeId,
      recipe_name: step.recipeName,
      emoji: null,
      protein: null,
      calories: null,
      carbs: null,
      fat: null,
      cook_time: null,
      hidden: false,
      audience_person_ids: [] as string[],
      side_recipe_ids: [] as string[],
      client_updated_at: now,
    };
    if (existing?.id) {
      const { data, error } = await client.from('meal_slots').update(row).eq('id', existing.id).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      affectedIds.push((data?.id as string | undefined) ?? String(existing.id));
    } else {
      const { data, error } = await client.from('meal_slots').insert(row).select('id').single();
      if (error) throw new Error(error.message);
      affectedIds.push(data.id as string);
    }
  }

  return { ok: true as const, householdId, affectedIds, steps };
}

export async function botGetShoppingList(householdId: string, weekStartRaw?: unknown) {
  const weekStart = asWeekStart(weekStartRaw);
  const { data, error } = await admin()
    .from('shopping_items')
    .select('id, name, amount, category, checked, grocery_quote')
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
      hasQuote: Boolean(row.grocery_quote),
    })),
  };
}

export async function botRebuildShopping(userId: string, householdId: string, weekStartRaw?: unknown) {
  await assertBotCanWrite(userId, householdId);
  const weekStart = asWeekStart(weekStartRaw);
  const client = admin();
  const country = await householdCountry(householdId);

  const { data: plan, error: planError } = await client
    .from('meal_plans')
    .select('id, active_slots')
    .eq('household_id', householdId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new Error('No meal plan for that week yet. Plan meals first.');

  const activeSlots = Array.isArray(plan.active_slots)
    ? (plan.active_slots.filter((s): s is MealSlotKey => typeof s === 'string') as MealSlotKey[])
    : [...CORE_SLOTS];

  const { data: slotRows, error: slotError } = await client.from('meal_slots').select('*').eq('meal_plan_id', plan.id);
  if (slotError) throw new Error(slotError.message);

  const slots: MealSlot[] = (slotRows ?? []).map((row) => ({
    day: row.day as Day,
    slotKey: parseSlotKey(String(row.slot_key)),
    recipeId: (row.recipe_id as string | null) ?? undefined,
    recipeName: (row.recipe_name as string | null) ?? undefined,
    hidden: Boolean(row.hidden),
    audiencePersonIds: Array.isArray(row.audience_person_ids)
      ? (row.audience_person_ids as string[])
      : [],
    sideRecipeIds: Array.isArray(row.side_recipe_ids) ? (row.side_recipe_ids as string[]) : [],
    targetServings: typeof row.target_servings === 'number' ? row.target_servings : undefined,
  }));

  const { data: recipeRows, error: recipeError } = await client
    .from('recipes')
    .select('*')
    .or(`household_id.eq.${householdId},household_id.is.null`)
    .eq('removed', false);
  if (recipeError) throw new Error(recipeError.message);
  const recipes = hideReplacedCatalogRecipes((recipeRows ?? []).map((row) => recipeFromDb(row as Record<string, unknown>)));

  const { data: existingRows, error: existingError } = await client
    .from('shopping_items')
    .select('id, name, amount, category, checked, metadata')
    .eq('household_id', householdId)
    .eq('week_start', weekStart);
  if (existingError) throw new Error(existingError.message);

  type Existing = {
    id: string;
    name: string;
    amount: string | null;
    category: string | null;
    checked: boolean;
    metadata: Record<string, unknown> | null;
  };
  const existing: Existing[] = (existingRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    amount: (row.amount as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    checked: Boolean(row.checked),
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null,
  }));

  const existingByKey = new Map<string, Existing>();
  const keptMakeIds = new Set<string>();
  for (const item of existing) {
    const key = shoppingMergeKey(item.name) || item.name.toLowerCase().trim();
    if (key && !existingByKey.has(key)) existingByKey.set(key, item);
    const made = item.metadata?.madeFromRecipeId;
    if (typeof made === 'string' && made) keptMakeIds.add(made);
  }

  const derived = shoppingFromPlan({
    plan: { activeSlots, slots },
    recipes,
    country,
    makeRecipeIds: [...keptMakeIds],
  });
  const derivedKeys = new Set(derived.map((item) => shoppingMergeKey(item.name) || item.name.toLowerCase().trim()));
  const touchedIds = new Set<string>();
  const inserts: Record<string, unknown>[] = [];

  for (const item of derived) {
    const key = shoppingMergeKey(item.name) || item.name.toLowerCase().trim();
    const prev = key ? existingByKey.get(key) : undefined;
    const prevMeta = prev?.metadata ?? {};
    const prevSources = Array.isArray(prevMeta.recipeSources) ? (prevMeta.recipeSources as unknown[]) : [];
    const sources = [...prevSources];
    for (const source of item.recipeSources) {
      if (!sources.some((row) => row && typeof row === 'object' && (row as { recipeId?: string }).recipeId === source.recipeId)) {
        sources.push(source);
      }
    }
    const prevMerged = Array.isArray(prevMeta.mergedFrom) ? (prevMeta.mergedFrom as string[]) : [];
    const mergedFrom = [...new Set([...prevMerged, ...(item.mergedFrom ?? [])].filter(Boolean))];

    if (prev && prevMeta.manual === true) {
      touchedIds.add(prev.id);
      const { error } = await client
        .from('shopping_items')
        .update({
          metadata: {
            ...prevMeta,
            manual: true,
            recipeSources: sources,
            sharedMealCount: Math.max(Number(prevMeta.sharedMealCount ?? 0), item.sharedMealCount),
            mergedFrom,
          },
        })
        .eq('id', prev.id);
      if (error) throw new Error(error.message);
      continue;
    }

    const metadata = {
      recipeSources: sources,
      sharedMealCount: item.sharedMealCount,
      isBaseRecipe: item.isBaseRecipe ?? false,
      baseRecipeId: item.baseRecipeId ?? null,
      linkedRecipeId: item.linkedRecipeId ?? null,
      linkedRecipeName: item.linkedRecipeName ?? null,
      madeFromRecipeId: item.madeFromRecipeId ?? null,
      madeFromRecipeName: item.madeFromRecipeName ?? null,
      mergedFrom,
      manual: false,
    };

    if (prev) {
      touchedIds.add(prev.id);
      const { error } = await client
        .from('shopping_items')
        .update({
          name: item.name,
          amount: item.amount ?? null,
          category: item.category,
          checked: prev.checked,
          metadata,
        })
        .eq('id', prev.id);
      if (error) throw new Error(error.message);
      continue;
    }

    inserts.push({
      household_id: householdId,
      week_start: weekStart,
      name: item.name,
      amount: item.amount ?? null,
      category: item.category,
      checked: false,
      metadata,
    });
  }

  if (inserts.length > 0) {
    const { error } = await client.from('shopping_items').insert(inserts);
    if (error) throw new Error(error.message);
  }

  const staleIds = existing
    .filter((item) => {
      if (item.metadata?.manual === true || touchedIds.has(item.id)) return false;
      const key = shoppingMergeKey(item.name) || item.name.toLowerCase().trim();
      return !derivedKeys.has(key);
    })
    .map((item) => item.id);
  if (staleIds.length > 0) {
    const { error } = await client.from('shopping_items').delete().in('id', staleIds);
    if (error) throw new Error(error.message);
  }

  const list = await botGetShoppingList(householdId, weekStart);
  return {
    householdId,
    weekStart,
    added: inserts.length,
    updated: touchedIds.size,
    removed: staleIds.length,
    itemCount: list.items.length,
    items: list.items,
  };
}

export async function botMatchShoppingPrices(userId: string, householdId: string, weekStartRaw?: unknown) {
  await assertBotCanWrite(userId, householdId);
  const weekStart = asWeekStart(weekStartRaw);
  const client = admin();
  const country = await householdCountry(householdId);

  const { data: rows, error } = await client
    .from('shopping_items')
    .select('id, name, amount, grocery_quote')
    .eq('household_id', householdId)
    .eq('week_start', weekStart)
    .eq('checked', false);
  if (error) throw new Error(error.message);
  if (!rows?.length) return { householdId, weekStart, matched: 0, warnings: [] as string[] };

  const items = rows.map((row) => {
    const quote = row.grocery_quote as StoredGroceryQuote | null;
    return {
      id: row.id as string,
      name: row.name as string,
      amount: (row.amount as string | null) ?? null,
      pins: quote && Array.isArray(quote.pins) ? quote.pins : undefined,
    };
  });

  const result = await compareGroceryList({
    country,
    householdId,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      pins: item.pins,
    })),
  });
  if (!result.ok) throw new Error(result.error);

  let matched = 0;
  for (const item of items) {
    const fresh = result.comparison.items.find((row) => row.itemId === item.id)?.quotes ?? [];
    const quote = withGroceryMatcherVersion({
      name: item.name,
      amount: item.amount,
      quotes: [...fresh],
      pins: item.pins,
    });
    const { error: saveError } = await client
      .from('shopping_items')
      .update({ grocery_quote: quote })
      .eq('id', item.id)
      .eq('household_id', householdId);
    if (saveError) throw new Error(saveError.message);
    if (fresh.length > 0) matched += 1;
  }

  return {
    householdId,
    weekStart,
    matched,
    itemCount: items.length,
    pricesAsOf: result.pricesAsOf,
    warnings: result.warnings.map((w) => w.message),
  };
}

export function nextWeekRange(from = new Date()): { weekStart: string; fromDate: string; toDate: string } {
  const thisMonday = mondayWeekStart(from);
  const nextMonday = (() => {
    const [y, m, d] = thisMonday.split('-').map(Number);
    const dt = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 7);
    return mondayWeekStart(dt);
  })();
  const sunday = dateForWeekDay(nextMonday, 'sunday');
  return { weekStart: nextMonday, fromDate: nextMonday, toDate: sunday };
}
