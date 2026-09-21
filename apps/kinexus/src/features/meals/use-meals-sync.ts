import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { Day, GeneratedSlot, MealSlot, MealSlotKey, NutritionGoals, PersonSlotApproval, Recipe } from '@kinexus/domain';
import {
  attachRecipeCost,
  CORE_SLOTS,
  DAYS,
  dayIsRemovedFromPlan,
  findReplacingRecipe,
  hideReplacedCatalogRecipes,
  MEAL_SLOTS,
  marketForHousehold,
  orderedMealSlotKeys,
  otherDaysToHideForNewSlot,
  shoppingFromPlan,
  shouldDropSlotFromActive,
} from '@kinexus/domain';

import type { Database } from '@kinexus/db';

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
  enqueueSlotOp,
  householdOutbox,
  removeSlotOps,
  type SlotOutboxOp,
} from '@/src/features/meals/outbox';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { retainPostgresChannel } from '@/src/lib/realtime';
import { supabase } from '@/src/lib/supabase';

export type PlanSlot = MealSlot & { id: string; updatedAt: string };

const SLOT_KEYS = new Set<string>(MEAL_SLOTS.map((s) => s.key));

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

async function flushOne(op: SlotOutboxOp): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const planId = await ensurePlan(op.householdId, op.weekStart);
  const { data: existing } = await supabase
    .from('meal_slots')
    .select('*')
    .eq('meal_plan_id', planId)
    .eq('day', op.day)
    .eq('slot_key', op.slotKey)
    .maybeSingle();
  if (existing?.client_updated_at && existing.client_updated_at > op.clientUpdatedAt) {
    return;
  }

  const assignedPersonId =
    op.kind === 'allocate' ? (op.assignedPersonId ?? null) : (op.assignedPersonId ?? existing?.assigned_person_id ?? null);

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
      : op.kind === 'clear'
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

  const row: Database['public']['Tables']['meal_slots']['Insert'] = {
    meal_plan_id: planId,
    household_id: op.householdId,
    day: op.day,
    slot_key: op.slotKey,
    client_updated_at: op.clientUpdatedAt,
    assigned_person_id: assignedPersonId,
    ...denorm,
    hidden:
      op.kind === 'hide'
        ? Boolean(op.hidden)
        : op.kind === 'assign' || op.kind === 'clear'
          ? false
          : (existing?.hidden ?? false),
  };

  const { error } = await supabase.from('meal_slots').upsert(row, { onConflict: 'meal_plan_id,day,slot_key' });
  if (error) throw error;
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

  const planQuery = useQuery({
    queryKey: householdId ? planKey(householdId, weekStart) : ['meals', 'plan', 'none'],
    enabled: Boolean(householdId && supabase && online),
    queryFn: async () => {
      const planId = await ensurePlan(householdId!, weekStart);
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
    queryFn: () => fetchSlots(householdId!, weekStart).then((r) => r.slots),
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

  const flush = useCallback(async () => {
    if (!householdId || !online || !supabase) return;
    const pending = await householdOutbox(householdId);
    const done: string[] = [];
    for (const op of pending) {
      await flushOne(op);
      done.push(op.id);
    }
    if (done.length) await removeSlotOps(done);
    await queryClient.invalidateQueries({ queryKey: ['meals'] });
  }, [householdId, online, queryClient]);

  useEffect(() => {
    if (online) void flush();
  }, [flush, online]);

  const applyLocal = useCallback(
    (op: SlotOutboxOp) => {
      if (!householdId) return;
      queryClient.setQueryData<PlanSlot[]>(slotsKey(householdId, weekStart), (current) => {
        const list = current ?? [];
        const idx = list.findIndex((s) => s.day === op.day && s.slotKey === op.slotKey);
        const next: PlanSlot = {
          id: idx >= 0 ? (list[idx]?.id ?? op.id) : op.id,
          day: op.day,
          slotKey: op.slotKey,
          recipeId: op.kind === 'clear' ? undefined : (op.recipeId ?? list[idx]?.recipeId),
          recipeName: op.kind === 'clear' ? undefined : (op.recipeName ?? list[idx]?.recipeName),
          emoji: op.kind === 'clear' ? undefined : (op.emoji ?? list[idx]?.emoji),
          protein: op.kind === 'clear' ? undefined : (op.protein ?? list[idx]?.protein),
          calories: op.kind === 'clear' ? undefined : (op.calories ?? list[idx]?.calories),
          carbs: op.kind === 'clear' ? undefined : (op.carbs ?? list[idx]?.carbs),
          fat: op.kind === 'clear' ? undefined : (op.fat ?? list[idx]?.fat),
          cookTime: op.kind === 'clear' ? undefined : (op.cookTime ?? list[idx]?.cookTime),
          hidden:
            op.kind === 'hide'
              ? Boolean(op.hidden)
              : op.kind === 'assign' || op.kind === 'clear'
                ? false
                : list[idx]?.hidden,
          assignedPersonId:
            op.kind === 'allocate'
              ? (op.assignedPersonId ?? undefined)
              : (op.assignedPersonId ?? list[idx]?.assignedPersonId),
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
      const op = await enqueueSlotOp({
        ...partial,
        householdId,
        weekStart,
        clientUpdatedAt: new Date().toISOString(),
      });
      applyLocal(op);
      await queryClient.invalidateQueries({ queryKey: outboxKey(householdId) });
      if (opts?.flushNow !== false && online) await flush();
    },
    [applyLocal, flush, householdId, online, queryClient, weekStart],
  );

  const currentAssigned = useCallback(
    (day: Day, slotKey: MealSlotKey) => {
      if (!householdId) return null;
      const list = queryClient.getQueryData<PlanSlot[]>(slotsKey(householdId, weekStart)) ?? [];
      return list.find((slot) => slot.day === day && slot.slotKey === slotKey)?.assignedPersonId ?? null;
    },
    [householdId, queryClient, weekStart],
  );

  const assignSlot = useCallback(
    async (day: Day, slotKey: MealSlotKey, recipe: Recipe) => {
      await mutateSlot({
        kind: 'assign',
        day,
        slotKey,
        recipeId: recipe.id,
        recipeName: recipe.name,
        emoji: recipe.emoji ?? null,
        protein: recipe.protein ?? null,
        calories: recipe.calories ?? null,
        carbs: recipe.carbs ?? null,
        fat: recipe.fat ?? null,
        cookTime: recipe.cookTime ?? null,
        assignedPersonId: currentAssigned(day, slotKey),
      });
    },
    [currentAssigned, mutateSlot],
  );

  const clearSlot = useCallback(
    async (day: Day, slotKey: MealSlotKey) => {
      await mutateSlot({ kind: 'clear', day, slotKey, assignedPersonId: currentAssigned(day, slotKey) });
    },
    [currentAssigned, mutateSlot],
  );

  const hideSlot = useCallback(
    async (day: Day, slotKey: MealSlotKey, hidden: boolean) => {
      await mutateSlot({ kind: 'hide', day, slotKey, hidden, assignedPersonId: currentAssigned(day, slotKey) });
    },
    [currentAssigned, mutateSlot],
  );

  const allocateSlot = useCallback(
    async (day: Day, slotKey: MealSlotKey, assignedPersonId: string | null) => {
      await mutateSlot({ kind: 'allocate', day, slotKey, assignedPersonId });
    },
    [mutateSlot],
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
      const existing =
        queryClient.getQueryData<PlanSlot[]>(householdId ? slotsKey(householdId, weekStart) : ['meals', 'slots', 'none']) ?? [];
      const cell = existing.find((slot) => slot.day === day && slot.slotKey === slotKey);
      if (active.includes(slotKey) && !cell?.hidden) return;

      for (const other of otherDaysToHideForNewSlot(slotKey, day, active)) {
        const otherCell = existing.find((slot) => slot.day === other && slot.slotKey === slotKey);
        if (otherCell && !otherCell.hidden) continue;
        await mutateSlot(
          { kind: 'hide', day: other, slotKey, hidden: true, assignedPersonId: currentAssigned(other, slotKey) },
          { flushNow: false },
        );
      }
      if (!active.includes(slotKey)) {
        await setActiveSlots(orderedMealSlotKeys([...active, slotKey]));
      }
      await mutateSlot(
        { kind: 'hide', day, slotKey, hidden: false, assignedPersonId: currentAssigned(day, slotKey) },
        { flushNow: false },
      );
      if (online) await flush();
    },
    [currentAssigned, flush, householdId, mutateSlot, online, planQuery.data?.activeSlots, queryClient, setActiveSlots, weekStart],
  );

  const removeSlotFromDay = useCallback(
    async (day: Day, slotKey: MealSlotKey) => {
      const active = planQuery.data?.activeSlots ?? [...CORE_SLOTS];
      const existing =
        queryClient.getQueryData<PlanSlot[]>(householdId ? slotsKey(householdId, weekStart) : ['meals', 'slots', 'none']) ?? [];
      const slotMap = new Map(existing.map((slot) => [`${slot.day}_${slot.slotKey}`, slot] as const));
      await mutateSlot(
        { kind: 'hide', day, slotKey, hidden: true, assignedPersonId: currentAssigned(day, slotKey) },
        { flushNow: false },
      );
      if (shouldDropSlotFromActive(slotKey, day, active, slotMap)) {
        await setActiveSlots(orderedMealSlotKeys(active.filter((key) => key !== slotKey)));
      }
      if (online) await flush();
    },
    [currentAssigned, flush, householdId, mutateSlot, online, planQuery.data?.activeSlots, queryClient, setActiveSlots, weekStart],
  );

  const hideDay = useCallback(
    async (day: Day) => {
      const active = orderedMealSlotKeys(planQuery.data?.activeSlots ?? [...CORE_SLOTS]);
      for (const slotKey of active) {
        await mutateSlot(
          { kind: 'hide', day, slotKey, hidden: true, assignedPersonId: currentAssigned(day, slotKey) },
          { flushNow: false },
        );
      }
      if (online) await flush();
    },
    [currentAssigned, flush, mutateSlot, online, planQuery.data?.activeSlots],
  );

  const restoreDay = useCallback(
    async (day: Day) => {
      const active = orderedMealSlotKeys(planQuery.data?.activeSlots ?? [...CORE_SLOTS]);
      for (const slotKey of active) {
        await mutateSlot(
          { kind: 'hide', day, slotKey, hidden: false, assignedPersonId: currentAssigned(day, slotKey) },
          { flushNow: false },
        );
      }
      if (online) await flush();
    },
    [currentAssigned, flush, mutateSlot, online, planQuery.data?.activeSlots],
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
    async (results: GeneratedSlot[], selectedSlots: MealSlotKey[]) => {
      if (!householdId) throw new Error('No household');
      const current = queryClient.getQueryData<PlanSlot[]>(slotsKey(householdId, weekStart)) ?? [];
      const currentMap = new Map(current.map((slot) => [`${slot.day}_${slot.slotKey}`, slot] as const));
      const currentActive = planQuery.data?.activeSlots ?? [...CORE_SLOTS];
      const removedDays = new Set(DAYS.filter((day) => dayIsRemovedFromPlan(currentActive, currentMap, day)));
      await setActiveSlots(selectedSlots);
      const keep = new Set(results.map((row) => `${row.day}_${row.slot}`));
      const assignedKeys = new Set(
        current.filter((slot) => slot.assignedPersonId).map((slot) => `${slot.day}_${slot.slotKey}`),
      );
      const hiddenKeys = new Set(
        current.filter((slot) => slot.hidden).map((slot) => `${slot.day}_${slot.slotKey}`),
      );
      const skipKey = (day: Day, slotKey: MealSlotKey) => {
        const key = `${day}_${slotKey}`;
        return removedDays.has(day) || assignedKeys.has(key) || hiddenKeys.has(key);
      };
      for (const slot of current) {
        if (skipKey(slot.day, slot.slotKey)) continue;
        if (!keep.has(`${slot.day}_${slot.slotKey}`)) {
          await mutateSlot({ kind: 'clear', day: slot.day, slotKey: slot.slotKey }, { flushNow: false });
        }
      }
      for (const day of DAYS) {
        for (const slotKey of selectedSlots) {
          if (skipKey(day, slotKey) || keep.has(`${day}_${slotKey}`)) continue;
          await mutateSlot({ kind: 'clear', day, slotKey }, { flushNow: false });
        }
      }
      for (const row of results) {
        if (skipKey(row.day, row.slot)) continue;
        await mutateSlot(
          {
            kind: 'assign',
            day: row.day,
            slotKey: row.slot,
            recipeId: row.recipe.id,
            recipeName: row.recipe.name,
            emoji: row.recipe.emoji ?? null,
            protein: row.recipe.protein ?? null,
            calories: row.recipe.calories ?? null,
            carbs: row.recipe.carbs ?? null,
            fat: row.recipe.fat ?? null,
            cookTime: row.recipe.cookTime ?? null,
          },
          { flushNow: false },
        );
      }
      if (online) await flush();
    },
    [flush, householdId, mutateSlot, online, planQuery.data?.activeSlots, queryClient, setActiveSlots, weekStart],
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
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: shoppingKey(householdId, weekStart) });
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
      const isFav = current.includes(recipeId);
      queryClient.setQueryData<string[]>(favKey(userId), isFav ? current.filter((id) => id !== recipeId) : [...current, recipeId]);
      if (isFav) {
        const { error } = await supabase.from('recipe_favourites').delete().eq('user_id', userId).eq('recipe_id', recipeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recipe_favourites').insert({ user_id: userId, recipe_id: recipeId });
        if (error) throw error;
      }
    },
    [favQuery.data, online, queryClient, userId],
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
      await queryClient.invalidateQueries({ queryKey: recipesPrefix(householdId) });
      return recipeFromRow(data);
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
    mutationFn: async () => {
      if (!householdId || !supabase) throw new Error('Not ready');
      if (!online) throw new Error('Shopping rebuild needs a connection');
      const slots = (slotsQuery.data ?? []).filter((slot) => !slot.hidden && slot.recipeId);
      const recipes = hideReplacedCatalogRecipes(overlayHiddenRecipes(recipesQuery.data ?? [], hiddenQuery.data ?? []));
      const activeSlots = planQuery.data?.activeSlots ?? [...CORE_SLOTS];
      const derived = shoppingFromPlan({
        plan: { activeSlots, slots },
        recipes,
      });
      await supabase.from('shopping_items').delete().eq('household_id', householdId).eq('week_start', weekStart);
      if (derived.length === 0) return;
      const { error } = await supabase.from('shopping_items').insert(
        derived.map((item) => ({
          household_id: householdId,
          week_start: weekStart,
          name: item.name,
          amount: item.amount ?? null,
          category: item.category,
          checked: false,
          metadata: {
            recipeSources: item.recipeSources,
            sharedMealCount: item.sharedMealCount,
            isBaseRecipe: item.isBaseRecipe ?? false,
            baseRecipeId: item.baseRecipeId ?? null,
          },
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      if (householdId) void queryClient.invalidateQueries({ queryKey: shoppingKey(householdId, weekStart) });
    },
  });

  const slots = slotsQuery.data ?? [];
  const hiddenRecipeIds = useMemo(() => new Set(hiddenQuery.data ?? []), [hiddenQuery.data]);
  const recipes = useMemo(
    () => hideReplacedCatalogRecipes(overlayHiddenRecipes(recipesQuery.data ?? [], hiddenQuery.data ?? [])),
    [hiddenQuery.data, recipesQuery.data],
  );
  const slotMap = useMemo(() => {
    const map = new Map<string, PlanSlot>();
    for (const slot of slots) map.set(`${slot.day}_${slot.slotKey}`, slot);
    return map;
  }, [slots]);

  return {
    householdId,
    market,
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
    activeSlots: planQuery.data?.activeSlots ?? [...CORE_SLOTS],
    goals: goalsQuery.data,
    shoppingItems: shoppingQuery.data ?? [],
    shoppingCount: shoppingQuery.data?.length ?? 0,
    favouriteIds: new Set(favQuery.data ?? []),
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
    allocateSlot,
    clearSlot,
    hideSlot,
    hideDay,
    restoreDay,
    addSlotToDay,
    removeSlotFromDay,
    setActiveSlots,
    saveGoals,
    applyGeneratedPlan,
    toggleShoppingItem,
    addShoppingItem,
    deleteShoppingItem,
    clearCheckedShopping,
    toggleFavourite,
    toggleNotForFamily,
    setSlotApproval,
    saveHouseholdRecipe,
    saveRecipeForHousehold,
    deleteHouseholdRecipe,
    updateHouseholdRecipe,
    reviewCatalogRecipe,
    rebuildShopping: () => rebuildShopping.mutateAsync(),
    shoppingBusy: rebuildShopping.isPending,
    shoppingError: rebuildShopping.error?.message ?? null,
    flush,
    importBlockedReason: online ? null : 'Recipe import and AI generate need a connection.',
  };
}
