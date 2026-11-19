import type { SupabaseClient } from '@supabase/supabase-js';
import { mondayWeekStart, normalizeDayTasks, type Day } from '@kinexus/domain';

import type { McpCaller } from '../context.js';
import { hasScope } from '../scopes.js';
import { getMealPlan, getShoppingList } from '../meals/reads.js';
import { dayFromIso } from '../meals/shared.js';
import { listTrainingPlans } from '../fitness/reads.js';
import { getCalendar } from './calendar-reads.js';
import { listTalkItems } from './talk-reads.js';
import { resolveCallerHousehold } from './shared.js';

export type TodayOverview = {
  date: string;
  householdId: string;
  tasks: {
    id: string;
    label: string;
    done: boolean;
    scope: 'personal' | 'household';
    visibility: 'private' | 'household' | 'people';
    visibleTo: string[];
  }[];
  talk: { id: string; body: string; createdBy: string }[];
  calendar: {
    id: string;
    title: string;
    allDay: boolean;
    startTime: string | null;
    endTime: string | null;
    location: string;
  }[];
  meals: {
    available: boolean;
    courses: { slotKey: string; recipeName: string }[];
  };
  shopping: {
    available: boolean;
    weekStart: string | null;
    uncheckedCount: number;
    topItems: { name: string; amount: string | null }[];
  };
  alerts: {
    unreadCount: number;
    latest: { id: string; title: string; segment: string; createdAt: string }[];
  };
  train: {
    available: boolean;
    planName: string | null;
    day: {
      restDay: boolean;
      status: string;
      workoutName: string | null;
      focus: string[];
    } | null;
  };
  excluded: string[];
};

async function loadDayTasks(
  client: SupabaseClient,
  userId: string,
  householdId: string,
  date: string,
): Promise<TodayOverview['tasks']> {
  const personal = client
    .from('user_days')
    .select('tasks')
    .eq('user_id', userId)
    .eq('day', date)
    .maybeSingle();
  const shared = client
    .from('household_day_tasks')
    .select('id, label, done, visibility, visible_to')
    .eq('household_id', householdId)
    .eq('day', date)
    .order('created_at', { ascending: true })
    .limit(40);

  // Intentionally select only task fields — never journal / workout notes / PIN content.
  const [{ data, error }, sharedResult] = await Promise.all([personal, shared]);
  if (error) throw new Error(error.message);
  if (sharedResult.error) throw new Error(sharedResult.error.message);

  const personalTasks = normalizeDayTasks(data?.tasks).map((task) => ({
    id: task.id,
    label: task.label,
    done: task.done,
    scope: 'personal' as const,
    visibility: 'private' as const,
    visibleTo: [] as string[],
  }));
  const householdTasks = (sharedResult.data ?? []).map((row) => {
    const visibility =
      (row as { visibility?: string }).visibility === 'people' ? ('people' as const) : ('household' as const);
    const visibleTo = Array.isArray((row as { visible_to?: unknown }).visible_to)
      ? ((row as { visible_to: string[] }).visible_to ?? []).filter(Boolean)
      : [];
    return {
      id: String((row as { id: string }).id),
      label: String((row as { label: string }).label ?? ''),
      done: Boolean((row as { done: boolean }).done),
      scope: 'household' as const,
      visibility,
      visibleTo,
    };
  });
  return [...personalTasks, ...householdTasks];
}

async function loadAlertsBrief(
  client: SupabaseClient,
  userId: string,
): Promise<TodayOverview['alerts']> {
  const { count, error: countError } = await client
    .from('user_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (countError) throw new Error(countError.message);

  const { data, error } = await client
    .from('user_alerts')
    .select('id, title, segment, created_at, read_at')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);

  return {
    unreadCount: count ?? 0,
    latest: (data ?? []).map((row) => ({
      id: String((row as { id: string }).id),
      title: String((row as { title: string }).title ?? ''),
      segment: String((row as { segment: string }).segment ?? ''),
      createdAt: String((row as { created_at: string }).created_at ?? ''),
    })),
  };
}

/**
 * Concise household + personal brief for a date.
 * Never includes private journal / PIN content, puzzles, or other members' private lists.
 */
export async function getTodayOverview(
  caller: McpCaller,
  input: { date?: string } = {},
): Promise<TodayOverview> {
  const date = (input.date?.trim() || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');

  const { householdId } = await resolveCallerHousehold(caller.client, caller.userId);
  const excluded = [
    'private_journal',
    'journal_pin',
    'puzzles',
    'other_members_private_lists',
    'personal_google_calendar',
  ];

  const [tasks, talk, calendar, alerts] = await Promise.all([
    loadDayTasks(caller.client, caller.userId, householdId, date),
    listTalkItems(caller.client, caller.userId).then((r) =>
      r.open.map((item) => ({ id: item.id, body: item.body, createdBy: item.createdBy })),
    ),
    getCalendar(caller.client, caller.userId, { date }).then((r) =>
      r.events.map((event) => ({
        id: event.id,
        title: event.title,
        allDay: event.allDay,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
      })),
    ),
    loadAlertsBrief(caller.client, caller.userId),
  ]);

  let meals: TodayOverview['meals'] = { available: false, courses: [] };
  let shopping: TodayOverview['shopping'] = {
    available: false,
    weekStart: null,
    uncheckedCount: 0,
    topItems: [],
  };
  if (hasScope(caller.scopes, 'meals:read')) {
    const plan = await getMealPlan(caller.client, caller.userId, { fromDate: date, toDate: date });
    meals = {
      available: true,
      courses: plan.slots
        .filter((slot) => !slot.hidden && slot.filled && slot.recipeName)
        .map((slot) => ({ slotKey: slot.slotKey, recipeName: slot.recipeName! })),
    };
    const weekStart = mondayWeekStart(new Date(`${date}T12:00:00`));
    const list = await getShoppingList(caller.client, caller.userId, { weekStart });
    const unchecked = list.items.filter((item) => !item.checked);
    shopping = {
      available: true,
      weekStart: list.weekStart,
      uncheckedCount: unchecked.length,
      topItems: unchecked.slice(0, 8).map((item) => ({ name: item.name, amount: item.amount })),
    };
  }

  let train: TodayOverview['train'] = { available: false, planName: null, day: null };
  if (hasScope(caller.scopes, 'fitness:read')) {
    const weekStart = mondayWeekStart(new Date(`${date}T12:00:00`));
    const weekday = dayFromIso(date) as Day;
    const { plans } = await listTrainingPlans(caller.client, caller.userId, {
      weekStart,
      limit: 5,
    });
    // Prefer the caller's own plan; family/buddy shared plans are fallback only.
    const mine = plans.filter((p) => p.isMine);
    const pool = mine.length > 0 ? mine : plans;
    const plan =
      pool.find((p) => p.days.some((d) => d.day === weekday && (!d.restDay || d.workoutName))) ??
      pool[0] ??
      null;
    const day = plan?.days.find((d) => d.day === weekday) ?? null;
    train = {
      available: true,
      planName: plan?.name ?? null,
      day: day
        ? {
            restDay: day.restDay,
            status: day.status,
            workoutName: day.workoutName,
            focus: day.focus,
          }
        : null,
    };
  }

  return {
    date,
    householdId,
    tasks,
    talk,
    calendar,
    meals,
    shopping,
    alerts,
    train,
    excluded,
  };
}
