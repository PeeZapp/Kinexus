import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { Day, GeneratedSlot, MealSlot, MealSlotKey, NutritionGoals, PersonSlotApproval, Recipe, StoredGroceryQuote } from '@kinexus/domain';
import {
  attachRecipeCost,
  audienceOverlapsExisting,
  CORE_SLOTS,
  creatorPublishError,
  DAYS,
  dayIsRemovedFromPlan,
  favouriteIdsForLibrary,
  findReplacingRecipe,
  hideReplacedCatalogRecipes,
  householdHideSlotMap,
  isHouseholdAudience,
  MEAL_SLOTS,
  marketForHousehold,
  mealSlotRecordKey,
  normalizeAudiencePersonIds,
  orderedMealSlotKeys,
  otherDaysToHideForNewSlot,
  resolveShoppingCategory,
  shoppingFromPlan,
  shoppingMergeKey,
  shouldDropSlotFromActive,
} from '@kinexus/domain';

import { rpc, type Database, type Json } from '@kinexus/db';

import { readMealsCache, writeMealsCache } from '@/src/features/meals/cache';
import {
  denormFromRecipe,
  goalsFromRow,
  priceBookFromRow,
  recipeFromRow,
  recipeToInsert,
  recipeToUpdate,
  shoppingFromRow,
  slotFromRow,
  type ShoppingListItem,
} from '@/src/features/meals/mappers';
import { useMealsWeek } from '@/src/features/meals/MealsWeekContext';
import {
  dropHouseholdWeekOutbox,
  enqueueSlotOp,
  householdOutbox,
  removeSlotOps,
  type SlotOutboxOp,
} from '@/src/features/meals/outbox';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { retainPostgresChannel } from '@/src/lib/realtime';
import { mirrorRecipeImage } from '@/src/lib/meals-api';
import { supabase } from '@/src/lib/supabase';

export type PlanSlot = MealSlot & { id: string; updatedAt: string };

const SLOT_KEYS = new Set<string>(MEAL_SLOTS.map((s) => s.key));
const WEEK_RESET_SLOT_ID = 'week-reset';

let slotSyncChain: Promise<unknown> = Promise.resolve();

/** Slot outbox reads and writes must not interleave with a week reset. */
function runSlotSync<T>(task: () => Promise<T>): Promise<T> {
  const run = slotSyncChain.then(task, task);
  slotSyncChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function recipesKey(householdId: string, country: string, currency: string) {
  return ['meals', 'recipes', householdId, country, currency] as const;
}
function recipesPrefix(householdId: string) {
  return ['meals', 'recipes', householdId] as const;
}
function planKey(householdId: string, weekStart: string) {
  return ['meals', 'plan', householdId, weekStart] as const;
}
function slotsKey(householdId: string, weekStart: string) {
  return ['meals', 'slots', householdId, weekStart] as const;
}
function goalsKey(householdId: string) {
  return ['meals', 'goals', householdId] as const;
}
function shoppingKey(householdId: string, weekStart: string) {
  return ['meals', 'shopping', householdId, weekStart] as const;
}
function outboxKey(householdId: string) {
  return ['meals', 'outbox', householdId] as const;
}
function favKey(userId: string) {
  return ['meals', 'favourites', userId] as const;
}
function hiddenKey(householdId: string) {
  return ['meals', 'hidden-recipes', householdId] as const;
}
function editorKey(userId: string) {
  return ['meals', 'catalog-editor', userId] as const;
}
function approvalsKey(householdId: string) {
  return ['meals', 'slot-approvals', householdId] as const;
}

async function fetchPriceBook(country: string, currency: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('ingredient_price_overrides')
    .select('prices, priced_at')
    .eq('country', country)
    .eq('currency', currency)
    .maybeSingle();
  if (error || !data) return null;
  return priceBookFromRow(data);
}

async function fetchRecipes(householdId: string, country: string, currency: string): Promise<Recipe[]> {
  if (!supabase) return [];
  const pageSize = 1000;
  const rows: Database['public']['Tables']['recipes']['Row'][] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order('name')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  const market = marketForHousehold({ country, currency });
  const book = await fetchPriceBook(country, currency);
  return rows.map((row) => attachRecipeCost(recipeFromRow(row), market, book));
}

export async function fetchRecipeById(id: string, country?: string, currency?: string): Promise<Recipe | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('recipes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const recipe = recipeFromRow(data);
  if (!country || !currency) return recipe;
  const market = marketForHousehold({ country, currency });
  const book = await fetchPriceBook(country, currency);
  return attachRecipeCost(recipe, market, book);
}

function overlayHiddenRecipes(recipes: Recipe[], hiddenIds: readonly string[]): Recipe[] {
  if (hiddenIds.length === 0) return recipes;
  const hidden = new Set(hiddenIds);
  return recipes.map((recipe) =>
    hidden.has(recipe.id) && !recipe.excludedFromAuto ? { ...recipe, excludedFromAuto: true } : recipe,
  );
}

async function ensurePlan(householdId: string, weekStart: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('get_or_create_meal_plan', {
    p_household_id: householdId,
    p_week_start: weekStart,
  });
  if (error) throw error;
  if (!data) throw new Error('Could not create meal plan');
  return data;
}

async function fetchSlots(householdId: string, weekStart: string): Promise<{ planId: string; slots: PlanSlot[] }> {
  const planId = await ensurePlan(householdId, weekStart);
  if (!supabase) return { planId, slots: [] };
  const { data, error } = await supabase.from('meal_slots').select('*').eq('meal_plan_id', planId);
  if (error) throw error;
  return { planId, slots: (data ?? []).map(slotFromRow) };
}

function audienceEqual(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  const left = normalizeAudiencePersonIds(a);
  const right = normalizeAudiencePersonIds(b);
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

function findPlanSlot(
  list: readonly PlanSlot[],
  opts: { slotId?: string | null; day: Day; slotKey: MealSlotKey; audiencePersonIds?: readonly string[] | null },
): PlanSlot | undefined {
  if (opts.slotId) {
    const byId = list.find((slot) => slot.id === opts.slotId);
    if (byId) return byId;
  }
  return list.find(
    (slot) =>
      slot.day === opts.day &&
      slot.slotKey === opts.slotKey &&
      audienceEqual(slot.audiencePersonIds, opts.audiencePersonIds),
  );
}

function throwDbError(error: { message?: string } | null): void {
  if (!error) return;
  throw new Error(error.message?.trim() || 'Database error');
}

async function flushOne(op: SlotOutboxOp): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const planId = await ensurePlan(op.householdId, op.weekStart);
  const audiencePersonIds = normalizeAudiencePersonIds(op.audiencePersonIds);

  if (op.kind === 'reset-week') {
    const { error: deleteError } = await supabase.from('meal_slots').delete().eq('meal_plan_id', planId);
    throwDbError(deleteError);
    const { error: planError } = await supabase
      .from('meal_plans')
      .update({ active_slots: [...CORE_SLOTS] })
      .eq('id', planId);
    throwDbError(planError);
    return;
  }

  if (op.kind === 'delete') {
    if (!op.slotId) return;
    const { error } = await supabase.from('meal_slots').delete().eq('id', op.slotId).eq('meal_plan_id', planId);
    throwDbError(error);
    return;
  }

  let existing: Database['public']['Tables']['meal_slots']['Row'] | null = null;
  if (op.slotId) {
    const { data } = await supabase.from('meal_slots').select('*').eq('id', op.slotId).eq('meal_plan_id', planId).maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data: candidates } = await supabase
      .from('meal_slots')
      .select('*')
      .eq('meal_plan_id', planId)
      .eq('day', op.day)
      .eq('slot_key', op.slotKey);
    existing =
      (candidates ?? []).find((row) => audienceEqual(row.audience_person_ids, audiencePersonIds)) ?? null;
  }
  if (existing?.client_updated_at && existing.client_updated_at > op.clientUpdatedAt) {
    return;
  }

  const assignedPersonId =
    op.kind === 'allocate' || op.clearMeal === true
      ? (op.assignedPersonId ?? null)
      : (op.assignedPersonId ?? existing?.assigned_person_id ?? null);

  const nextAudience =
    op.kind === 'audience' ? audiencePersonIds : normalizeAudiencePersonIds(existing?.audience_person_ids ?? audiencePersonIds);

  const clearsMeal = op.kind === 'clear' || op.clearMeal === true;
  const denorm =
    op.kind === 'assign'
      ? {
          recipe_id: op.recipeId ?? null,
          recipe_name: op.recipeName ?? null,
          emoji: op.emoji ?? null,
          protein: op.protein ?? null,
          calories: op.calories ?? null,
          carbs: op.carbs ?? null,
          fat: op.fat ?? null,
          cook_time: op.cookTime ?? null,
        }
      : clearsMeal
        ? denormFromRecipe(null)
        : {
            recipe_id: existing?.recipe_id ?? null,
            recipe_name: existing?.recipe_name ?? null,
            emoji: existing?.emoji ?? null,
            protein: existing?.protein ?? null,
            calories: existing?.calories ?? null,
            carbs: existing?.carbs ?? null,
            fat: existing?.fat ?? null,
            cook_time: existing?.cook_time ?? null,
          };

  const sidePatch =
    op.clearMeal === true
      ? { side_recipe_ids: [] as string[] }
      : op.kind === 'assign' && op.sideRecipeIds != null
        ? { side_recipe_ids: op.sideRecipeIds }
        : {};
  const targetServings =
    clearsMeal
      ? null
      : op.targetServings !== undefined
        ? op.targetServings
        : (existing?.target_servings ?? null);

  const hidden =
    op.kind === 'hide'
      ? Boolean(op.hidden)
      : op.kind === 'assign' || op.kind === 'clear' || op.kind === 'audience'
        ? false
        : (existing?.hidden ?? false);

  if (existing?.id && (op.kind === 'audience' || op.slotId === existing.id)) {
    const { error } = await supabase
      .from('meal_slots')
      .update({
        client_updated_at: op.clientUpdatedAt,
        assigned_person_id: assignedPersonId,
        audience_person_ids: nextAudience,
        ...denorm,
        ...sidePatch,
        target_servings: targetServings,
        hidden,
      })
      .eq('id', existing.id);
    throwDbError(error);
    return;
  }

  const row: Database['public']['Tables']['meal_slots']['Insert'] = {
    ...(existing?.id ? { id: existing.id } : op.slotId ? { id: op.slotId } : {}),
    meal_plan_id: planId,
    household_id: op.householdId,
    day: op.day,
    slot_key: op.slotKey,
    client_updated_at: op.clientUpdatedAt,
    assigned_person_id: assignedPersonId,
    audience_person_ids: nextAudience,
    ...denorm,
    ...sidePatch,
    target_servings: targetServings,
    hidden,
  };

  const { error } = await supabase
    .from('meal_slots')
    .upsert(row, { onConflict: 'meal_plan_id,day,slot_key,audience_person_ids' });
  throwDbError(error);
}

export function useMealsSync() {
  const { activeHousehold } = useHousehold();
  const { user } = useAuth();
  const { weekStart, setWeek, shiftWeek } = useMealsWeek();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const userId = user && !user.isDevBypass ? user.id : null;
  const market = marketForHousehold({
    country: activeHousehold?.country,
    currency: activeHousehold?.currency,
  });
  const recipeKey = householdId ? recipesKey(householdId, market.country, market.currency) : (['meals', 'recipes', 'none'] as const);

  const recipesQuery = useQuery({
    queryKey: recipeKey,
    enabled: Boolean(householdId && supabase && online),
    queryFn: () => fetchRecipes(householdId!, market.country, market.currency),
  });

  const priceBookQuery = useQuery({
    queryKey: ['meals', 'price-book', market.country, market.currency],
    enabled: Boolean(supabase && online),
    queryFn: () => fetchPriceBook(market.country, market.currency),
  });

  const planQuery = useQuery({
    queryKey: householdId ? planKey(householdId, weekStart) : ['meals', 'plan', 'none'],
    enabled: Boolean(householdId && supabase && online),
    queryFn: async () => {
      const planId = await ensurePlan(householdId!, weekStart);
      const pending = await householdOutbox(householdId!);
      if (pending.some((op) => op.kind === 'reset-week' && op.weekStart === weekStart)) {
        return { planId, activeSlots: [...CORE_SLOTS] };
      }
      if (!supabase) return { planId, activeSlots: [...CORE_SLOTS] };
      const { data, error } = await supabase.from('meal_plans').select('*').eq('id', planId).maybeSingle();
      if (error) throw error;
      return {
        planId,
        activeSlots: (data?.active_slots ?? [...CORE_SLOTS]) as MealSlotKey[],
      };
    },
  });

  const slotsQuery = useQuery({
    queryKey: householdId ? slotsKey(householdId, weekStart) : ['meals', 'slots', 'none'],
    enabled: Boolean(householdId && supabase && online),
    queryFn: async () => {
      const pending = await householdOutbox(householdId!);
      if (pending.some((op) => op.kind === 'reset-week' && op.weekStart === weekStart)) return [];
      return fetchSlots(householdId!, weekStart).then((r) => r.slots);
    },
  });

  const goalsQuery = useQuery({
    queryKey: householdId ? goalsKey(householdId) : ['meals', 'goals', 'none'],
    enabled: Boolean(householdId && supabase && online),
    queryFn: async () => {
      if (!supabase) return null;
      await supabase.rpc('ensure_household_nutrition_goals', { p_household_id: householdId! });
      const { data, error } = await supabase
        .from('nutrition_goals')
        .select('*')
        .eq('household_id', householdId!)
        .is('person_id', null)
        .maybeSingle();
      if (error) throw error;
      return data ? goalsFromRow(data) : null;
    },
  });

  const shoppingQuery = useQuery({
    queryKey: householdId ? shoppingKey(householdId, weekStart) : ['meals', 'shopping', 'none'],
    enabled: Boolean(householdId && supabase && online),
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('household_id', householdId!)
        .eq('week_start', weekStart)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(shoppingFromRow);
    },
  });

  const favQuery = useQuery({
    queryKey: userId ? favKey(userId) : ['meals', 'favourites', 'none'],
    enabled: Boolean(userId && supabase && online),
    queryFn: async () => {
      if (!supabase || !userId) return [] as string[];
      const { data, error } = await supabase.from('recipe_favourites').select('recipe_id').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map((row) => row.recipe_id);
    },
  });

  const hiddenQuery = useQuery({
    queryKey: householdId ? hiddenKey(householdId) : ['meals', 'hidden-recipes', 'none'],
    enabled: Boolean(householdId && supabase && online),
    queryFn: async () => {
      if (!supabase || !householdId) return [] as string[];
      const { data, error } = await supabase
        .from('household_hidden_recipes')
        .select('recipe_id')
        .eq('household_id', householdId);
      if (error) throw error;
      return (data ?? []).map((row) => row.recipe_id);
    },
  });

  const approvalsQuery = useQuery({
    queryKey: householdId ? approvalsKey(householdId) : ['meals', 'slot-approvals', 'none'],
    enabled: Boolean(householdId && supabase && online),
    queryFn: async (): Promise<PersonSlotApproval[]> => {
      if (!supabase || !householdId) return [];
      const { data, error } = await supabase
        .from('household_person_slot_recipes')
        .select('person_id, slot_key, recipe_id')
        .eq('household_id', householdId);
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const slotKey = SLOT_KEYS.has(row.slot_key) ? (row.slot_key as MealSlotKey) : null;
        if (!slotKey) return [];
        return [{ personId: row.person_id, slotKey, recipeId: row.recipe_id }];
      });
    },
  });

  const editorQuery = useQuery({
    queryKey: userId ? editorKey(userId) : ['meals', 'catalog-editor', 'none'],
    enabled: Boolean(userId && supabase && online),
    queryFn: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase.rpc('claim_catalog_editor');
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 60_000,
  });

  const outboxQuery = useQuery({
    queryKey: householdId ? outboxKey(householdId) : ['meals', 'outbox', 'none'],
    enabled: Boolean(householdId),
    queryFn: () => (householdId ? householdOutbox(householdId) : []),
  });

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    void readMealsCache(householdId, weekStart).then((snap) => {
      if (cancelled || !snap) return;
      if (!queryClient.getQueryData(slotsKey(householdId, weekStart)) && snap.slots.length) {
        queryClient.setQueryData(slotsKey(householdId, weekStart), snap.slots);
      }
      if (!queryClient.getQueryData(recipeKey) && snap.recipes.length) {
        queryClient.setQueryData(recipeKey, snap.recipes);
      }
      if (!queryClient.getQueryData(planKey(householdId, weekStart)) && snap.planId) {
        queryClient.setQueryData(planKey(householdId, weekStart), {
          planId: snap.planId,
          activeSlots: snap.activeSlots as MealSlotKey[],
        });
      }
      if (!queryClient.getQueryData(goalsKey(householdId)) && snap.goals) {
        queryClient.setQueryData(goalsKey(householdId), snap.goals);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [householdId, queryClient, recipeKey, weekStart]);

  useEffect(() => {
    if (!householdId) return;
    if (!recipesQuery.data && !slotsQuery.data) return;
    void writeMealsCache(householdId, weekStart, {
      planId: planQuery.data?.planId ?? null,
      activeSlots: planQuery.data?.activeSlots ?? [...CORE_SLOTS],
      slots: slotsQuery.data ?? [],
      recipes: recipesQuery.data ?? [],
      goals: goalsQuery.data ?? null,
      shoppingCount: shoppingQuery.data?.length ?? 0,
    });
  }, [
    goalsQuery.data,
    householdId,
    planQuery.data,
    recipesQuery.data,
    shoppingQuery.data,
    slotsQuery.data,
    weekStart,
  ]);

  useEffect(() => {
    const client = supabase;
    if (!client || !householdId || !online) return;
    return retainPostgresChannel(client, `meals-sync:${householdId}`, (channel) =>
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meal_slots', filter: `household_id=eq.${householdId}` },
          () => {
            void queryClient.invalidateQueries({ queryKey: slotsKey(householdId, weekStart) });
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` },
          () => {
            void queryClient.invalidateQueries({ queryKey: shoppingKey(householdId, weekStart) });
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'household_person_slot_recipes', filter: `household_id=eq.${householdId}` },
          () => {
            void queryClient.invalidateQueries({ queryKey: approvalsKey(householdId) });
          },
        ),
    );
  }, [householdId, online, queryClient, weekStart]);

  const flushPending = useCallback(async () => {
    if (!householdId || !online || !supabase) return;
    const pending = await householdOutbox(householdId);
    const done: string[] = [];
    let firstError: unknown = null;
    for (const op of pending) {
      try {
        await flushOne(op);
        done.push(op.id);
      } catch (err) {
        firstError = err;
        break;
      }
    }
    if (done.length) await removeSlotOps(done);
    await queryClient.invalidateQueries({ queryKey: ['meals'] });
    if (firstError) throw firstError;
  }, [householdId, online, queryClient]);

  const flush = useCallback(() => runSlotSync(() => flushPending()), [flushPending]);

  useEffect(() => {
    if (online) void flush();
  }, [flush, online]);

  const applyLocal = useCallback(
    (op: SlotOutboxOp) => {
      if (!householdId) return;
      if (op.kind === 'reset-week') {
        queryClient.setQueryData<PlanSlot[]>(slotsKey(householdId, op.weekStart), []);
        queryClient.setQueryData<{ planId: string; activeSlots: MealSlotKey[] } | undefined>(
          planKey(householdId, op.weekStart),
          (current) => ({
            planId: current?.planId ?? '',
            activeSlots: [...CORE_SLOTS],
          }),
        );
        return;
      }
      queryClient.setQueryData<PlanSlot[]>(slotsKey(householdId, weekStart), (current) => {
        const list = current ?? [];
        if (op.kind === 'delete') {
          if (!op.slotId) return list;
          return list.filter((slot) => slot.id !== op.slotId);
        }
        const existing = findPlanSlot(list, op);
        const idx = existing ? list.indexOf(existing) : -1;
        const clearsMeal = op.kind === 'clear' || op.clearMeal === true;
        const replacingMeal = op.kind === 'assign';
        const mealField = <T,>(incoming: T | null | undefined, previous: T | undefined): T | undefined => {
          if (clearsMeal) return undefined;
          if (replacingMeal) return incoming ?? undefined;
          return incoming ?? previous;
        };
        const audiencePersonIds =
          op.kind === 'audience'
            ? normalizeAudiencePersonIds(op.audiencePersonIds)
            : normalizeAudiencePersonIds(op.audiencePersonIds ?? existing?.audiencePersonIds);
        const next: PlanSlot = {
          id: existing?.id ?? op.slotId ?? op.id,
          day: op.day,
          slotKey: op.slotKey,
          recipeId: mealField(op.recipeId, existing?.recipeId),
          recipeName: mealField(op.recipeName, existing?.recipeName),
          emoji: mealField(op.emoji, existing?.emoji),
          protein: mealField(op.protein, existing?.protein),
          calories: mealField(op.calories, existing?.calories),
          carbs: mealField(op.carbs, existing?.carbs),
          fat: mealField(op.fat, existing?.fat),
          cookTime: mealField(op.cookTime, existing?.cookTime),
          hidden:
            op.kind === 'hide'
              ? Boolean(op.hidden)
              : op.kind === 'assign' || op.kind === 'clear' || op.kind === 'audience'
                ? false
                : existing?.hidden,
          assignedPersonId:
            op.kind === 'allocate' || op.clearMeal === true
              ? (op.assignedPersonId ?? undefined)
              : (op.assignedPersonId ?? existing?.assignedPersonId),
          audiencePersonIds,
          sideRecipeIds:
            op.clearMeal === true
              ? []
              : op.kind === 'assign' && op.sideRecipeIds != null
                ? op.sideRecipeIds
                : existing?.sideRecipeIds,
          targetServings: clearsMeal
            ? undefined
            : op.targetServings !== undefined
              ? (op.targetServings ?? undefined)
              : existing?.targetServings,
          updatedAt: op.clientUpdatedAt,
        };
        if (idx >= 0) {
          const copy = [...list];
          copy[idx] = next;
          return copy;
        }
        return [...list, next];
      });
    },
    [householdId, queryClient, weekStart],
  );

  const mutateSlot = useCallback(
    async (
      partial: Omit<SlotOutboxOp, 'id' | 'householdId' | 'weekStart' | 'clientUpdatedAt'>,
      opts?: { flushNow?: boolean },
    ) => {
      if (!householdId) throw new Error('No household');
      await runSlotSync(async () => {
        const op = await enqueueSlotOp({
          ...partial,
          householdId,
          weekStart,
          clientUpdatedAt: new Date().toISOString(),
        });
        applyLocal(op);
        await queryClient.invalidateQueries({ queryKey: outboxKey(householdId) });
        if (opts?.flushNow !== false && online) await flushPending();
      });
    },
    [applyLocal, flushPending, householdId, online, queryClient, weekStart],
  );

  const clearWeek = useCallback(async () => {
    if (!householdId) throw new Error('No household');
    await runSlotSync(async () => {
      await dropHouseholdWeekOutbox(householdId, weekStart);
      const op = await enqueueSlotOp({
        kind: 'reset-week',
        householdId,
        weekStart,
        day: 'monday',
        slotKey: 'breakfast',
        slotId: WEEK_RESET_SLOT_ID,
        audiencePersonIds: [],
        clientUpdatedAt: new Date().toISOString(),
      });
      applyLocal(op);
      await queryClient.invalidateQueries({ queryKey: outboxKey(householdId) });
      if (online) await flushPending();
    });
  }, [applyLocal, flushPending, householdId, online, queryClient, weekStart]);

  const slotsList = useCallback(() => {
    if (!householdId) return [] as PlanSlot[];
    return queryClient.getQueryData<PlanSlot[]>(slotsKey(householdId, weekStart)) ?? [];
  }, [householdId, queryClient, weekStart]);

  const resolveSlot = useCallback(
    (day: Day, slotKey: MealSlotKey, opts?: { slotId?: string | null; audiencePersonIds?: readonly string[] | null }) =>
      findPlanSlot(slotsList(), {
        day,
        slotKey,
        slotId: opts?.slotId,
        audiencePersonIds: opts?.audiencePersonIds ?? [],
      }),
    [slotsList],
  );

  const assignSlot = useCallback(
    async (
      day: Day,
      slotKey: MealSlotKey,
      recipe: Recipe,
      opts?: { slotId?: string | null; audiencePersonIds?: readonly string[] | null },
    ) => {
      const current = resolveSlot(day, slotKey, opts);
      await mutateSlot({
        kind: 'assign',
        day,
        slotKey,
        slotId: opts?.slotId ?? current?.id,
        audiencePersonIds: normalizeAudiencePersonIds(opts?.audiencePersonIds ?? current?.audiencePersonIds),
        recipeId: recipe.id,
        recipeName: recipe.name,
        emoji: recipe.emoji ?? null,
        protein: recipe.protein ?? null,
        calories: recipe.calories ?? null,
        carbs: recipe.carbs ?? null,
        fat: recipe.fat ?? null,
        cookTime: recipe.cookTime ?? null,
        assignedPersonId: current?.assignedPersonId ?? null,
      });
    },
    [mutateSlot, resolveSlot],
  );

  const assignNamedMeal = useCallback(
    async (
      day: Day,
      slotKey: MealSlotKey,
      name: string,
      opts?: { slotId?: string | null; audiencePersonIds?: readonly string[] | null },
    ) => {
      const title = name.trim();
      if (!title) throw new Error('Enter a meal name');
      const current = resolveSlot(day, slotKey, opts);
      await mutateSlot({
        kind: 'assign',
        day,
        slotKey,
        slotId: opts?.slotId ?? current?.id,
        audiencePersonIds: normalizeAudiencePersonIds(opts?.audiencePersonIds ?? current?.audiencePersonIds),
        recipeId: null,
        recipeName: title,
        emoji: null,
        protein: null,
        calories: null,
        carbs: null,
        fat: null,
        cookTime: null,
        sideRecipeIds: [],
        targetServings: null,
        assignedPersonId: current?.assignedPersonId ?? null,
      });
    },
    [mutateSlot, resolveSlot],
  );

  const clearSlot = useCallback(
    async (day: Day, slotKey: MealSlotKey, opts?: { slotId?: string | null; audiencePersonIds?: readonly string[] | null }) => {
      const current = resolveSlot(day, slotKey, opts);
      await mutateSlot({
        kind: 'clear',
        day,
        slotKey,
        slotId: opts?.slotId ?? current?.id,
        audiencePersonIds: normalizeAudiencePersonIds(opts?.audiencePersonIds ?? current?.audiencePersonIds),
        assignedPersonId: current?.assignedPersonId ?? null,
      });
    },
    [mutateSlot, resolveSlot],
  );

  const hideSlot = useCallback(
    async (
      day: Day,
      slotKey: MealSlotKey,
      hidden: boolean,
      opts?: { slotId?: string | null; audiencePersonIds?: readonly string[] | null },
    ) => {
      const current = resolveSlot(day, slotKey, opts);
      await mutateSlot({
        kind: 'hide',
        day,
        slotKey,
        slotId: opts?.slotId ?? current?.id,
        audiencePersonIds: normalizeAudiencePersonIds(opts?.audiencePersonIds ?? current?.audiencePersonIds),
        hidden,
        assignedPersonId: current?.assignedPersonId ?? null,
      });
    },
    [mutateSlot, resolveSlot],
  );

  const allocateSlot = useCallback(
    async (
      day: Day,
      slotKey: MealSlotKey,
      assignedPersonId: string | null,
      opts?: { slotId?: string | null; audiencePersonIds?: readonly string[] | null },
    ) => {
      const current = resolveSlot(day, slotKey, opts);
      await mutateSlot({
        kind: 'allocate',
        day,
        slotKey,
        slotId: opts?.slotId ?? current?.id,
        audiencePersonIds: normalizeAudiencePersonIds(opts?.audiencePersonIds ?? current?.audiencePersonIds),
        assignedPersonId,
      });
    },
    [mutateSlot, resolveSlot],
  );

  const createAudienceSlot = useCallback(
    async (day: Day, slotKey: MealSlotKey, audiencePersonIds: readonly string[]) => {
      const audience = normalizeAudiencePersonIds(audiencePersonIds);
      if (audience.length === 0) throw new Error('Pick at least one person for a personal meal');
      const list = slotsList();
      // Reuse the same audience row (including empty ones the daily UI doesn't show yet).
      const existing = findPlanSlot(list, { day, slotKey, audiencePersonIds: audience });
      if (existing && !existing.hidden) return existing;
      if (audienceOverlapsExisting(list, day, slotKey, audience, existing?.id)) {
        throw new Error('Someone in that group already has this meal today');
      }
      await mutateSlot({
        kind: 'audience',
        day,
        slotKey,
        slotId: existing?.id,
        audiencePersonIds: audience,
        assignedPersonId: null,
      });
      if (online) await flush();
      return findPlanSlot(slotsList(), { day, slotKey, audiencePersonIds: audience }) ?? null;
    },
    [flush, mutateSlot, online, slotsList],
  );

  const deleteAudienceSlot = useCallback(
    async (slot: PlanSlot) => {
      if (isHouseholdAudience(slot.audiencePersonIds)) {
        await hideSlot(slot.day, slot.slotKey, true, { slotId: slot.id, audiencePersonIds: [] });
        return;
      }
      await mutateSlot({
        kind: 'delete',
        day: slot.day,
        slotKey: slot.slotKey,
        slotId: slot.id,
        audiencePersonIds: normalizeAudiencePersonIds(slot.audiencePersonIds),
      });
    },
    [hideSlot, mutateSlot],
  );

  const setActiveSlots = useCallback(
    async (slots: MealSlotKey[]) => {
      if (!householdId) throw new Error('No household');
      queryClient.setQueryData(planKey(householdId, weekStart), (current: { planId: string; activeSlots: MealSlotKey[] } | undefined) =>
        current ? { ...current, activeSlots: slots } : current,
      );
      if (!online || !supabase) return;
      const planId = planQuery.data?.planId ?? (await ensurePlan(householdId, weekStart));
      const { error } = await supabase.from('meal_plans').update({ active_slots: slots }).eq('id', planId);
      if (error) throw error;
    },
    [householdId, online, planQuery.data?.planId, queryClient, weekStart],
  );

  const addSlotToDay = useCallback(
    async (day: Day, slotKey: MealSlotKey) => {
      const active = planQuery.data?.activeSlots ?? [...CORE_SLOTS];
      const existing = slotsList();
      const cell = findPlanSlot(existing, { day, slotKey, audiencePersonIds: [] });
      if (active.includes(slotKey) && cell && !cell.hidden) return;

      for (const other of otherDaysToHideForNewSlot(slotKey, day, active)) {
        const otherCell = findPlanSlot(existing, { day: other, slotKey, audiencePersonIds: [] });
        if (otherCell && !otherCell.hidden) continue;
        await mutateSlot(
          {
            kind: 'hide',
            day: other,
            slotKey,
            slotId: otherCell?.id,
            audiencePersonIds: [],
            hidden: true,
            assignedPersonId: otherCell?.assignedPersonId ?? null,
          },
          { flushNow: false },
        );
      }
      if (!active.includes(slotKey)) {
        await setActiveSlots(orderedMealSlotKeys([...active, slotKey]));
      }
      await mutateSlot(
        {
          kind: 'hide',
          day,
          slotKey,
          slotId: cell?.id,
          audiencePersonIds: [],
          hidden: false,
          assignedPersonId: cell?.assignedPersonId ?? null,
        },
        { flushNow: false },
      );
      if (online) await flush();
    },
    [flush, mutateSlot, online, planQuery.data?.activeSlots, setActiveSlots, slotsList],
  );

  const removeSlotFromDay = useCallback(
    async (day: Day, slotKey: MealSlotKey) => {
      const active = planQuery.data?.activeSlots ?? [...CORE_SLOTS];
      const existing = slotsList();
      const hideMap = householdHideSlotMap(existing);
      const household = findPlanSlot(existing, { day, slotKey, audiencePersonIds: [] });
      await mutateSlot(
        {
          kind: 'hide',
          day,
          slotKey,
          slotId: household?.id,
          audiencePersonIds: [],
          hidden: true,
          assignedPersonId: household?.assignedPersonId ?? null,
        },
        { flushNow: false },
      );
      for (const slot of existing) {
        if (slot.day !== day || slot.slotKey !== slotKey || isHouseholdAudience(slot.audiencePersonIds)) continue;
        await mutateSlot(
          {
            kind: 'delete',
            day: slot.day,
            slotKey: slot.slotKey,
            slotId: slot.id,
            audiencePersonIds: normalizeAudiencePersonIds(slot.audiencePersonIds),
          },
          { flushNow: false },
        );
      }
      if (shouldDropSlotFromActive(slotKey, day, active, hideMap)) {
        await setActiveSlots(orderedMealSlotKeys(active.filter((key) => key !== slotKey)));
      }
      if (online) await flush();
    },
    [flush, mutateSlot, online, planQuery.data?.activeSlots, setActiveSlots, slotsList],
  );

  const hideDay = useCallback(
    async (day: Day) => {
      const active = orderedMealSlotKeys(planQuery.data?.activeSlots ?? [...CORE_SLOTS]);
      const existing = slotsList();
      for (const slotKey of active) {
        const household = findPlanSlot(existing, { day, slotKey, audiencePersonIds: [] });
        await mutateSlot(
          {
            kind: 'hide',
            day,
            slotKey,
            slotId: household?.id,
            audiencePersonIds: [],
            hidden: true,
            clearMeal: true,
            assignedPersonId: null,
          },
          { flushNow: false },
        );
      }
      for (const slot of existing) {
        if (slot.day !== day || isHouseholdAudience(slot.audiencePersonIds)) continue;
        await mutateSlot(
          {
            kind: 'delete',
            day: slot.day,
            slotKey: slot.slotKey,
            slotId: slot.id,
            audiencePersonIds: normalizeAudiencePersonIds(slot.audiencePersonIds),
          },
          { flushNow: false },
        );
      }
      if (online) await flush();
    },
    [flush, mutateSlot, online, planQuery.data?.activeSlots, slotsList],
  );

  const restoreDay = useCallback(
    async (day: Day) => {
      const active = orderedMealSlotKeys(planQuery.data?.activeSlots ?? [...CORE_SLOTS]);
      const existing = slotsList();
      for (const slotKey of active) {
        const household = findPlanSlot(existing, { day, slotKey, audiencePersonIds: [] });
        await mutateSlot(
          {
            kind: 'hide',
            day,
            slotKey,
            slotId: household?.id,
            audiencePersonIds: [],
            hidden: false,
            assignedPersonId: household?.assignedPersonId ?? null,
          },
          { flushNow: false },
        );
      }
      if (online) await flush();
    },
    [flush, mutateSlot, online, planQuery.data?.activeSlots, slotsList],
  );

  const saveGoals = useCallback(
    async (next: NutritionGoals, preset?: string) => {
      if (!householdId) throw new Error('No household');
      queryClient.setQueryData(goalsKey(householdId), next);
      if (!online || !supabase) return;
      await supabase.rpc('ensure_household_nutrition_goals', { p_household_id: householdId });
      const { error } = await supabase
        .from('nutrition_goals')
        .update({ calories: next.calories, protein: next.protein, carbs: next.carbs, fat: next.fat, preset: preset ?? 'custom' })
        .eq('household_id', householdId)
        .is('person_id', null);
      if (error) throw error;
    },
    [householdId, online, queryClient],
  );

  const applyGeneratedPlan = useCallback(
    async (
      results: GeneratedSlot[],
      selectedSlots: MealSlotKey[],
      opts?: { audiencePersonIds?: readonly string[]; targetServings?: number | null },
    ) => {
      if (!householdId) throw new Error('No household');
      const audience = normalizeAudiencePersonIds(opts?.audiencePersonIds);
      const personal = audience.length > 0;
      const current = slotsList();
      const currentMap = householdHideSlotMap(current);
      const currentActive = planQuery.data?.activeSlots ?? [...CORE_SLOTS];
      const removedDays = new Set(DAYS.filter((day) => dayIsRemovedFromPlan(currentActive, currentMap, day)));
      if (!personal) await setActiveSlots(selectedSlots);

      const scope = current.filter((slot) => audienceEqual(slot.audiencePersonIds, audience));
      const keep = new Set(results.map((row) => mealSlotRecordKey(row.day, row.slot, audience)));
      const assignedKeys = new Set(
        scope.filter((slot) => slot.assignedPersonId).map((slot) => mealSlotRecordKey(slot.day, slot.slotKey, audience)),
      );
      const hiddenKeys = new Set(
        scope.filter((slot) => slot.hidden).map((slot) => mealSlotRecordKey(slot.day, slot.slotKey, audience)),
      );
      const skipKey = (day: Day, slotKey: MealSlotKey) => {
        const key = mealSlotRecordKey(day, slotKey, audience);
        return removedDays.has(day) || assignedKeys.has(key) || hiddenKeys.has(key);
      };

      if (personal) {
        for (const row of results) {
          if (skipKey(row.day, row.slot)) continue;
          const existing = findPlanSlot(slotsList(), { day: row.day, slotKey: row.slot, audiencePersonIds: audience });
          if (!existing && audienceOverlapsExisting(slotsList(), row.day, row.slot, audience)) continue;
          await mutateSlot(
            {
              kind: 'assign',
              day: row.day,
              slotKey: row.slot,
              audiencePersonIds: audience,
              slotId: existing?.id,
              recipeId: row.recipe.id,
              recipeName: row.recipe.name,
              emoji: row.recipe.emoji ?? null,
              protein: row.recipe.protein ?? null,
              calories: row.recipe.calories ?? null,
              carbs: row.recipe.carbs ?? null,
              fat: row.recipe.fat ?? null,
              cookTime: row.recipe.cookTime ?? null,
              sideRecipeIds: (row.sides ?? []).map((side) => side.id),
              targetServings: opts?.targetServings ?? null,
            },
            { flushNow: false },
          );
        }
        if (online) await flush();
        return;
      }

      for (const slot of scope) {
        if (skipKey(slot.day, slot.slotKey)) continue;
        if (!keep.has(mealSlotRecordKey(slot.day, slot.slotKey, audience))) {
          await mutateSlot(
            {
              kind: 'clear',
              day: slot.day,
              slotKey: slot.slotKey,
              slotId: slot.id,
              audiencePersonIds: audience,
              assignedPersonId: slot.assignedPersonId ?? null,
            },
            { flushNow: false },
          );
        }
      }
      for (const day of DAYS) {
        for (const slotKey of selectedSlots) {
          if (skipKey(day, slotKey) || keep.has(mealSlotRecordKey(day, slotKey, audience))) continue;
          const existing = findPlanSlot(slotsList(), { day, slotKey, audiencePersonIds: audience });
          await mutateSlot(
            {
              kind: 'clear',
              day,
              slotKey,
              slotId: existing?.id,
              audiencePersonIds: audience,
              assignedPersonId: existing?.assignedPersonId ?? null,
            },
            { flushNow: false },
          );
        }
      }
      for (const row of results) {
        if (skipKey(row.day, row.slot)) continue;
        const existing = findPlanSlot(slotsList(), { day: row.day, slotKey: row.slot, audiencePersonIds: audience });
        await mutateSlot(
          {
            kind: 'assign',
            day: row.day,
            slotKey: row.slot,
            slotId: existing?.id,
            audiencePersonIds: audience,
            recipeId: row.recipe.id,
            recipeName: row.recipe.name,
            emoji: row.recipe.emoji ?? null,
            protein: row.recipe.protein ?? null,
            calories: row.recipe.calories ?? null,
            carbs: row.recipe.carbs ?? null,
            fat: row.recipe.fat ?? null,
            cookTime: row.recipe.cookTime ?? null,
            assignedPersonId: existing?.assignedPersonId ?? null,
            sideRecipeIds: (row.sides ?? []).map((side) => side.id),
            targetServings: opts?.targetServings ?? null,
          },
          { flushNow: false },
        );
      }
      if (online) await flush();
    },
    [flush, householdId, mutateSlot, online, planQuery.data?.activeSlots, setActiveSlots, slotsList],
  );

  const toggleShoppingItem = useCallback(
    async (id: string, checked: boolean) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Checking off shopping items needs a connection');
      queryClient.setQueryData<ShoppingListItem[]>(shoppingKey(householdId, weekStart), (current) =>
        (current ?? []).map((item) => (item.id === id ? { ...item, checked } : item)),
      );
      const { error } = await supabase.from('shopping_items').update({ checked }).eq('id', id);
      if (error) throw error;
    },
    [householdId, online, queryClient, weekStart],
  );

  const addShoppingItem = useCallback(
    async (name: string, amount?: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Adding shopping items needs a connection');
      const { error } = await supabase.from('shopping_items').insert({
        household_id: householdId,
        week_start: weekStart,
        name: name.trim(),
        amount: amount?.trim() || null,
        category: 'Other',
        checked: false,
        metadata: { manual: true, recipeSources: [], sharedMealCount: 0, mergedFrom: [] },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: shoppingKey(householdId, weekStart) });
    },
    [householdId, online, queryClient, weekStart],
  );

  const updateShoppingItem = useCallback(
    async (id: string, name: string, amount?: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Editing shopping items needs a connection');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Name is required');
      const nextAmount = amount?.trim() || null;
      const key = shoppingKey(householdId, weekStart);
      const previous = queryClient.getQueryData<ShoppingListItem[]>(key);
      const currentItem = previous?.find((item) => item.id === id);
      let category = currentItem?.category ?? 'Other';
      if (!currentItem || trimmed.toLowerCase() !== currentItem.name.trim().toLowerCase()) {
        const nextCategory = resolveShoppingCategory(undefined, trimmed);
        if (nextCategory !== 'Other') category = nextCategory;
      }
      queryClient.setQueryData<ShoppingListItem[]>(key, (current) =>
        (current ?? []).map((item) =>
          item.id === id ? { ...item, name: trimmed, amount: nextAmount, category } : item,
        ),
      );
      const { error } = await supabase
        .from('shopping_items')
        .update({ name: trimmed, amount: nextAmount, category })
        .eq('id', id);
      if (error) {
        queryClient.setQueryData(key, previous);
        throw new Error(error.message);
      }
    },
    [householdId, online, queryClient, weekStart],
  );

  const saveShoppingQuotes = useCallback(
    async (rows: { id: string; quote: StoredGroceryQuote }[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Saving prices needs a connection');
      const key = shoppingKey(householdId, weekStart);
      for (const row of rows) {
        const { error } = await supabase
          .from('shopping_items')
          .update({ grocery_quote: row.quote as unknown as Json })
          .eq('id', row.id);
        if (error) throw new Error(error.message);
      }
      queryClient.setQueryData<ShoppingListItem[]>(key, (current) =>
        (current ?? []).map((item) => {
          const next = rows.find((row) => row.id === item.id);
          return next ? { ...item, groceryQuote: next.quote } : item;
        }),
      );
    },
    [householdId, online, queryClient, weekStart],
  );

  const deleteShoppingItem = useCallback(
    async (id: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Removing shopping items needs a connection');
      const { error } = await supabase.from('shopping_items').delete().eq('id', id);
      if (error) throw error;
      queryClient.setQueryData<ShoppingListItem[]>(shoppingKey(householdId, weekStart), (current) =>
        (current ?? []).filter((item) => item.id !== id),
      );
    },
    [householdId, online, queryClient, weekStart],
  );

  const clearCheckedShopping = useCallback(async () => {
    if (!householdId || !supabase) throw new Error('Not ready');
    if (!online) throw new Error('Clearing shopping items needs a connection');
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('household_id', householdId)
      .eq('week_start', weekStart)
      .eq('checked', true);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: shoppingKey(householdId, weekStart) });
  }, [householdId, online, queryClient, weekStart]);

  const toggleFavourite = useCallback(
    async (recipeId: string) => {
      if (!userId || !supabase) throw new Error('Sign in required');
      if (!online) throw new Error('Favourites need a connection');
      const current = favQuery.data ?? [];
      const related = new Set<string>([recipeId]);
      for (const recipe of recipesQuery.data ?? []) {
        if (recipe.id === recipeId && recipe.creatorSourceRecipeId) related.add(recipe.creatorSourceRecipeId);
        if (recipe.creatorSourceRecipeId === recipeId) related.add(recipe.id);
        if (recipe.id === recipeId && recipe.replacesSource && recipe.sourcedFromRecipeId) related.add(recipe.sourcedFromRecipeId);
        if (recipe.replacesSource && recipe.sourcedFromRecipeId === recipeId) related.add(recipe.id);
      }
      const isFav = [...related].some((id) => current.includes(id));
      queryClient.setQueryData<string[]>(
        favKey(userId),
        isFav ? current.filter((id) => !related.has(id)) : [...current, recipeId],
      );
      if (isFav) {
        const { error } = await supabase.from('recipe_favourites').delete().eq('user_id', userId).in('recipe_id', [...related]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recipe_favourites').insert({ user_id: userId, recipe_id: recipeId });
        if (error) throw error;
      }
    },
    [favQuery.data, online, queryClient, recipesQuery.data, userId],
  );

  const toggleNotForFamily = useCallback(
    async (recipeId: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Updating recipes needs a connection');
      const current = hiddenQuery.data ?? [];
      const hidden = current.includes(recipeId);
      const next = hidden ? current.filter((id) => id !== recipeId) : [...current, recipeId];
      queryClient.setQueryData<string[]>(hiddenKey(householdId), next);
      try {
        if (hidden) {
          queryClient.setQueryData<Recipe[]>(recipeKey, (list) =>
            (list ?? []).map((recipe) =>
              recipe.id === recipeId ? { ...recipe, excludedFromAuto: false } : recipe,
            ),
          );
          const { error } = await supabase
            .from('household_hidden_recipes')
            .delete()
            .eq('household_id', householdId)
            .eq('recipe_id', recipeId);
          if (error) throw error;
          await supabase
            .from('recipes')
            .update({ excluded_from_auto: false })
            .eq('id', recipeId)
            .eq('household_id', householdId);
        } else {
          const { error } = await supabase.from('household_hidden_recipes').upsert(
            { household_id: householdId, recipe_id: recipeId, created_by: userId },
            { onConflict: 'household_id,recipe_id' },
          );
          if (error) throw error;
        }
      } catch (err) {
        queryClient.setQueryData<string[]>(hiddenKey(householdId), current);
        throw err;
      }
    },
    [hiddenQuery.data, householdId, online, queryClient, recipeKey, userId],
  );

  const saveHouseholdRecipe = useCallback(
    async (draft: Omit<Recipe, 'id' | 'householdId'>) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Saving recipes needs a connection');
      const { data, error } = await supabase.from('recipes').insert(recipeToInsert(householdId, draft)).select('*').single();
      if (error) throw error;
      let row = data;
      if (row.source_url) {
        try {
          const mirrored = await mirrorRecipeImage(row.id);
          if (mirrored.imageUrl) row = { ...row, image_url: mirrored.imageUrl };
        } catch {
          // The recipe is saved. A remote photo URL still shows if the copy fails.
        }
      }
      await queryClient.invalidateQueries({ queryKey: recipesPrefix(householdId) });
      return recipeFromRow(row);
    },
    [householdId, online, queryClient],
  );

  const deleteHouseholdRecipe = useCallback(
    async (recipeId: string) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Deleting recipes needs a connection');
      const { error } = await supabase.from('recipes').delete().eq('id', recipeId).eq('household_id', householdId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: recipesPrefix(householdId) });
    },
    [householdId, online, queryClient],
  );

  const publishCreatorRecipe = useCallback(
    async (sourceRecipeId: string) => {
      if (!supabase) throw new Error('Not ready');
      if (!online) throw new Error('Publishing recipes needs a connection');
      const source = (recipesQuery.data ?? []).find((r) => r.id === sourceRecipeId);
      if (source) {
        const validation = creatorPublishError({
          name: source.name,
          ingredientsCount: source.ingredients?.length ?? 0,
          methodStepsCount: source.method?.length ?? 0,
        });
        if (validation) throw new Error(validation);
      }
      const { data, error } = await supabase.rpc(rpc.publishCreatorRecipe, {
        p_source_recipe_id: sourceRecipeId,
      });
      if (error) throw error;
      if (householdId) {
        await queryClient.invalidateQueries({ queryKey: recipesPrefix(householdId) });
      }
      await queryClient.invalidateQueries({ queryKey: ['meals', 'recipe', data] });
      return data as string;
    },
    [householdId, online, queryClient, recipesQuery.data],
  );

  const unpublishCreatorRecipe = useCallback(
    async (catalogRecipeId: string) => {
      if (!supabase) throw new Error('Not ready');
      if (!online) throw new Error('Updating recipes needs a connection');
      const { error } = await supabase.rpc(rpc.unpublishCreatorRecipe, {
        p_recipe_id: catalogRecipeId,
      });
      if (error) throw error;
      if (householdId) {
        await queryClient.invalidateQueries({ queryKey: recipesPrefix(householdId) });
      }
    },
    [householdId, online, queryClient],
  );

  const updateHouseholdRecipe = useCallback(
    async (recipeId: string, patch: { notes?: string | null }) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Updating recipes needs a connection');
      const { error } = await supabase
        .from('recipes')
        .update({
          notes: patch.notes,
        })
        .eq('id', recipeId)
        .eq('household_id', householdId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: recipesPrefix(householdId) });
    },
    [householdId, online, queryClient],
  );

  const retargetRecipeUsage = useCallback(
    async (fromId: string, toRecipe: Recipe) => {
      if (!householdId || !supabase) return;
      const denorm = denormFromRecipe(toRecipe);
      const { error: slotsError } = await supabase
        .from('meal_slots')
        .update({
          recipe_id: toRecipe.id,
          recipe_name: denorm.recipe_name,
          emoji: denorm.emoji,
          protein: denorm.protein,
          calories: denorm.calories,
          carbs: denorm.carbs,
          fat: denorm.fat,
          cook_time: denorm.cook_time,
        })
        .eq('household_id', householdId)
        .eq('recipe_id', fromId);
      if (slotsError) throw slotsError;
      if (fromId === toRecipe.id) return;

      const { data: approvals, error: approvalsReadError } = await supabase
        .from('household_person_slot_recipes')
        .select('person_id, slot_key, created_by')
        .eq('household_id', householdId)
        .eq('recipe_id', fromId);
      if (approvalsReadError) throw approvalsReadError;
      if (approvals?.length) {
        const { error: approvalsInsertError } = await supabase.from('household_person_slot_recipes').insert(
          approvals.map((row) => ({
            household_id: householdId,
            person_id: row.person_id,
            slot_key: row.slot_key,
            recipe_id: toRecipe.id,
            created_by: row.created_by,
          })),
        );
        if (approvalsInsertError && approvalsInsertError.code !== '23505') throw approvalsInsertError;
        const { error: approvalsDeleteError } = await supabase
          .from('household_person_slot_recipes')
          .delete()
          .eq('household_id', householdId)
          .eq('recipe_id', fromId);
        if (approvalsDeleteError) throw approvalsDeleteError;
      }

      if (userId && (favQuery.data ?? []).includes(fromId)) {
        const { error: favError } = await supabase.from('recipe_favourites').insert({
          user_id: userId,
          recipe_id: toRecipe.id,
        });
        if (favError && favError.code !== '23505') throw favError;
      }
    },
    [favQuery.data, householdId, userId],
  );

  const refreshRecipeQueries = useCallback(async () => {
    if (!householdId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: recipesPrefix(householdId) }),
      queryClient.invalidateQueries({ queryKey: ['meals', 'slots', householdId] }),
      queryClient.invalidateQueries({ queryKey: approvalsKey(householdId) }),
      userId ? queryClient.invalidateQueries({ queryKey: favKey(userId) }) : Promise.resolve(),
    ]);
  }, [householdId, queryClient, userId]);

  const saveRecipeForHousehold = useCallback(
    async (source: Recipe, draft: Omit<Recipe, 'id' | 'householdId'>, mode: 'overwrite' | 'save_as') => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Saving recipes needs a connection');
      if (mode === 'save_as') {
        return saveHouseholdRecipe({
          ...draft,
          sourcedFromRecipeId: source.id,
          replacesSource: false,
        });
      }

      const owned = Boolean(source.householdId && source.householdId === householdId);
      if (owned) {
        const { data, error } = await supabase
          .from('recipes')
          .update(recipeToUpdate(draft))
          .eq('id', source.id)
          .eq('household_id', householdId)
          .select('*')
          .single();
        if (error) throw error;
        const updated = recipeFromRow(data);
        await retargetRecipeUsage(source.id, updated);
        await refreshRecipeQueries();
        return updated;
      }

      const existing = findReplacingRecipe(recipesQuery.data ?? [], source.id);
      if (existing) {
        const { data, error } = await supabase
          .from('recipes')
          .update(recipeToUpdate(draft))
          .eq('id', existing.id)
          .eq('household_id', householdId)
          .select('*')
          .single();
        if (error) throw error;
        const updated = recipeFromRow(data);
        await retargetRecipeUsage(source.id, updated);
        if (existing.id !== source.id) await retargetRecipeUsage(existing.id, updated);
        await refreshRecipeQueries();
        return updated;
      }

      const saved = await saveHouseholdRecipe({
        ...draft,
        sourcedFromRecipeId: source.id,
        replacesSource: true,
      });
      await retargetRecipeUsage(source.id, saved);
      await refreshRecipeQueries();
      return saved;
    },
    [
      householdId,
      online,
      recipesQuery.data,
      refreshRecipeQueries,
      retargetRecipeUsage,
      saveHouseholdRecipe,
    ],
  );

  const reviewCatalogRecipe = useCallback(
    async (recipeId: string, action: 'remove' | 'restore') => {
      if (!supabase) throw new Error('Not ready');
      if (!online) throw new Error('Catalog review needs a connection');
      const { error } = await supabase.rpc('review_catalog_recipe', {
        p_recipe_id: recipeId,
        p_action: action,
      });
      if (error) throw error;
      if (householdId) await queryClient.invalidateQueries({ queryKey: recipesPrefix(householdId) });
    },
    [householdId, online, queryClient],
  );

  const setSlotApproval = useCallback(
    async (personIds: string | readonly string[], slotKey: MealSlotKey, recipeId: string, approved: boolean) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Updating approved recipes needs a connection');
      const uniqueIds = [...new Set(typeof personIds === 'string' ? [personIds] : [...personIds])];
      if (uniqueIds.length === 0) return;
      const current = approvalsQuery.data ?? [];
      const next = uniqueIds.reduce<PersonSlotApproval[]>((list, personId) => {
        const exists = list.some(
          (row) => row.personId === personId && row.slotKey === slotKey && row.recipeId === recipeId,
        );
        if (approved) return exists ? list : [...list, { personId, slotKey, recipeId }];
        return list.filter(
          (row) => !(row.personId === personId && row.slotKey === slotKey && row.recipeId === recipeId),
        );
      }, current);
      queryClient.setQueryData<PersonSlotApproval[]>(approvalsKey(householdId), next);
      try {
        if (approved) {
          const rows = uniqueIds
            .filter(
              (personId) =>
                !current.some(
                  (row) => row.personId === personId && row.slotKey === slotKey && row.recipeId === recipeId,
                ),
            )
            .map((personId) => ({
              household_id: householdId,
              person_id: personId,
              slot_key: slotKey,
              recipe_id: recipeId,
              created_by: userId,
            }));
          if (rows.length) {
            const { error } = await supabase.from('household_person_slot_recipes').insert(rows);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase
            .from('household_person_slot_recipes')
            .delete()
            .eq('household_id', householdId)
            .eq('slot_key', slotKey)
            .eq('recipe_id', recipeId)
            .in('person_id', uniqueIds);
          if (error) throw error;
        }
      } catch (err) {
        queryClient.setQueryData<PersonSlotApproval[]>(approvalsKey(householdId), current);
        throw err;
      }
    },
    [approvalsQuery.data, householdId, online, queryClient, userId],
  );

  const rebuildShopping = useMutation({
    mutationFn: async (makeRecipeIds?: readonly string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Shopping rebuild needs a connection');
      const slots = (slotsQuery.data ?? []).filter(
        (slot) => !slot.hidden && (slot.recipeId || (slot.sideRecipeIds?.length ?? 0) > 0),
      );
      const recipes = hideReplacedCatalogRecipes(overlayHiddenRecipes(recipesQuery.data ?? [], hiddenQuery.data ?? []));
      const activeSlots = planQuery.data?.activeSlots ?? [...CORE_SLOTS];
      const existing = shoppingQuery.data ?? [];
      const checkedByKey = new Map<string, boolean>();
      const keptMakeIds = new Set<string>();
      for (const item of existing) {
        if (item.checked) {
          const key = shoppingMergeKey(item.name) || item.name.toLowerCase().trim();
          checkedByKey.set(key, true);
        }
        if (item.madeFromRecipeId) keptMakeIds.add(item.madeFromRecipeId);
      }
      const manuals = existing.filter((item) => item.manual);
      const derived = shoppingFromPlan({
        plan: { activeSlots, slots },
        recipes,
        country: market.country,
        makeRecipeIds: makeRecipeIds ?? [...keptMakeIds],
      });
      await supabase.from('shopping_items').delete().eq('household_id', householdId).eq('week_start', weekStart);
      const planRows = derived.map((item) => {
        const key = shoppingMergeKey(item.name) || item.name.toLowerCase().trim();
        return {
          household_id: householdId,
          week_start: weekStart,
          name: item.name,
          amount: item.amount ?? null,
          category: item.category,
          checked: checkedByKey.get(key) === true,
          metadata: {
            recipeSources: item.recipeSources,
            sharedMealCount: item.sharedMealCount,
            isBaseRecipe: item.isBaseRecipe ?? false,
            baseRecipeId: item.baseRecipeId ?? null,
            linkedRecipeId: item.linkedRecipeId ?? null,
            linkedRecipeName: item.linkedRecipeName ?? null,
            madeFromRecipeId: item.madeFromRecipeId ?? null,
            madeFromRecipeName: item.madeFromRecipeName ?? null,
            mergedFrom: item.mergedFrom ?? [],
            manual: false,
          },
        };
      });
      const derivedKeys = new Set(
        derived.map((item) => shoppingMergeKey(item.name) || item.name.toLowerCase().trim()),
      );
      const manualRows = manuals
        .filter((item) => {
          const key = shoppingMergeKey(item.name) || item.name.toLowerCase().trim();
          return !derivedKeys.has(key);
        })
        .map((item) => ({
          household_id: householdId,
          week_start: weekStart,
          name: item.name,
          amount: item.amount,
          category: item.category,
          checked: item.checked,
          metadata: {
            manual: true,
            recipeSources: item.recipeSources,
            sharedMealCount: item.sharedMealCount,
            mergedFrom: item.mergedFrom,
          },
        }));
      const rows = [...planRows, ...manualRows];
      if (rows.length === 0) return;
      const { error } = await supabase.from('shopping_items').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      if (householdId) void queryClient.invalidateQueries({ queryKey: shoppingKey(householdId, weekStart) });
    },
  });

  const setShoppingPurchase = useCallback(
    async (recipeId: string, mode: 'buy' | 'make') => {
      const ids = new Set<string>();
      for (const item of shoppingQuery.data ?? []) {
        if (item.madeFromRecipeId) ids.add(item.madeFromRecipeId);
      }
      if (mode === 'make') ids.add(recipeId);
      else ids.delete(recipeId);
      await rebuildShopping.mutateAsync([...ids]);
    },
    [rebuildShopping, shoppingQuery.data],
  );

  const setSlotSides = useCallback(
    async (slotId: string, sideRecipeIds: readonly string[]) => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Updating the plan needs a connection');
      const unique = [...new Set(sideRecipeIds.filter(Boolean))];
      const key = slotsKey(householdId, weekStart);
      const previous = queryClient.getQueryData<PlanSlot[]>(key);
      queryClient.setQueryData<PlanSlot[]>(key, (current) =>
        (current ?? []).map((slot) => (slot.id === slotId ? { ...slot, sideRecipeIds: unique } : slot)),
      );
      const { error } = await supabase
        .from('meal_slots')
        .update({ side_recipe_ids: unique })
        .eq('id', slotId)
        .eq('household_id', householdId);
      if (error) {
        queryClient.setQueryData(key, previous);
        throw error;
      }
    },
    [householdId, online, queryClient, weekStart],
  );

  const slots = slotsQuery.data ?? [];
  const hiddenRecipeIds = useMemo(() => new Set(hiddenQuery.data ?? []), [hiddenQuery.data]);
  const recipes = useMemo(
    () => hideReplacedCatalogRecipes(overlayHiddenRecipes(recipesQuery.data ?? [], hiddenQuery.data ?? [])),
    [hiddenQuery.data, recipesQuery.data],
  );
  const favouriteIds = useMemo(
    () => favouriteIdsForLibrary(recipes, favQuery.data ?? []),
    [favQuery.data, recipes],
  );
  /** Household hide flags for week structure (dayPlanSlots / generate reserved days). */
  const slotMap = useMemo(() => householdHideSlotMap(slots), [slots]);

  /** All meal cells keyed by day_slot[+audience]. */
  const slotCells = useMemo(() => {
    const map = new Map<string, PlanSlot>();
    for (const slot of slots) {
      map.set(mealSlotRecordKey(slot.day, slot.slotKey, slot.audiencePersonIds), slot);
    }
    return map;
  }, [slots]);

  return {
    householdId,
    market,
    priceBook: priceBookQuery.data ?? null,
    weekStart,
    setWeek,
    shiftWeek,
    online,
    pendingCount: outboxQuery.data?.length ?? 0,
    recipes,
    hiddenRecipeIds,
    slotApprovals: approvalsQuery.data ?? [],
    slots,
    slotMap,
    slotCells,
    activeSlots: planQuery.data?.activeSlots ?? [...CORE_SLOTS],
    goals: goalsQuery.data,
    shoppingItems: shoppingQuery.data ?? [],
    shoppingCount: shoppingQuery.data?.length ?? 0,
    favouriteIds,
    isCatalogEditor: Boolean(editorQuery.data),
    catalogCount: recipes.filter((r) => r.householdId === null && !r.removed).length,
    isLoading: Boolean(householdId && online && (recipesQuery.isLoading || slotsQuery.isLoading)),
    error:
      recipesQuery.error?.message ??
      hiddenQuery.error?.message ??
      approvalsQuery.error?.message ??
      slotsQuery.error?.message ??
      planQuery.error?.message ??
      goalsQuery.error?.message ??
      null,
    assignSlot,
    assignNamedMeal,
    allocateSlot,
    clearSlot,
    clearWeek,
    hideSlot,
    hideDay,
    restoreDay,
    addSlotToDay,
    removeSlotFromDay,
    createAudienceSlot,
    deleteAudienceSlot,
    setActiveSlots,
    saveGoals,
    applyGeneratedPlan,
    toggleShoppingItem,
    addShoppingItem,
    updateShoppingItem,
    saveShoppingQuotes,
    deleteShoppingItem,
    clearCheckedShopping,
    toggleFavourite,
    toggleNotForFamily,
    setSlotApproval,
    saveHouseholdRecipe,
    saveRecipeForHousehold,
    deleteHouseholdRecipe,
    updateHouseholdRecipe,
    publishCreatorRecipe,
    unpublishCreatorRecipe,
    reviewCatalogRecipe,
    rebuildShopping: () => rebuildShopping.mutateAsync(undefined),
    setShoppingPurchase,
    setSlotSides,
    shoppingBusy: rebuildShopping.isPending,
    shoppingError: rebuildShopping.error?.message ?? null,
    flush,
    importBlockedReason: online ? null : 'Recipe import and AI generate need a connection.',
  };
}
