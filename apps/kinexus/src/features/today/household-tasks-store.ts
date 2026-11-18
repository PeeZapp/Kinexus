import { HOUSEHOLD_DAY_TASK_LIMIT } from '@kinexus/domain';
import { rpc } from '@kinexus/db';

import type { AuthUser } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

export type HouseholdDayTask = {
  id: string;
  day: string;
  label: string;
  done: boolean;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
};

function explain(error: { message?: string; code?: string }): Error {
  const message = error.message ?? 'Could not load household tasks.';
  if (error.code === 'PGRST205' || /household_day_tasks|schema cache/i.test(message)) {
    return new Error('Shared tasks need the latest database migration before they can sync.');
  }
  return new Error(message);
}

function mapRow(row: {
  id: string;
  day: string;
  label: string;
  done: boolean;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
}): HouseholdDayTask {
  return {
    id: row.id,
    day: row.day,
    label: row.label,
    done: row.done,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function loadHouseholdDayTasks(
  householdId: string,
  day: string,
): Promise<HouseholdDayTask[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('household_day_tasks')
    .select('id, day, label, done, assigned_to, created_by, created_at')
    .eq('household_id', householdId)
    .eq('day', day)
    .order('created_at', { ascending: true })
    .limit(HOUSEHOLD_DAY_TASK_LIMIT);
  if (error) throw explain(error);
  return (data ?? []).map(mapRow);
}

export async function rollHouseholdDayTasksForward(
  householdId: string,
  today: string,
): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from('household_day_tasks')
    .update({ day: today })
    .eq('household_id', householdId)
    .lt('day', today)
    .eq('done', false)
    .select('id');
  if (error) throw explain(error);
  return data?.length ?? 0;
}

export async function addHouseholdDayTask(
  user: AuthUser,
  householdId: string,
  day: string,
  label: string,
  assignedTo: string | null,
): Promise<HouseholdDayTask> {
  if (!supabase || user.isDevBypass) {
    throw new Error('Shared tasks need a connected household account.');
  }
  const cleaned = label.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!cleaned) throw new Error('Write a task first.');

  const { count, error: countError } = await supabase
    .from('household_day_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .eq('day', day);
  if (countError) throw explain(countError);
  if ((count ?? 0) >= HOUSEHOLD_DAY_TASK_LIMIT) {
    throw new Error('The shared task list is full for this day.');
  }

  const { data, error } = await supabase
    .from('household_day_tasks')
    .insert({
      household_id: householdId,
      day,
      label: cleaned,
      assigned_to: assignedTo,
      created_by: user.id,
    })
    .select('id, day, label, done, assigned_to, created_by, created_at')
    .single();
  if (error) throw explain(error);
  try {
    await supabase.rpc(rpc.notifyHouseholdAlert, {
      p_household_id: householdId,
      p_segment: 'tasks',
      p_title: cleaned,
      p_body: null,
      p_href: '/today',
      p_payload: { taskId: data.id, day, assignedTo },
    });
  } catch {
    // Non-blocking.
  }
  return mapRow(data);
}

export async function setHouseholdDayTaskDone(taskId: string, done: boolean): Promise<void> {
  if (!supabase) throw new Error('Shared tasks need a connected household account.');
  const { error } = await supabase.from('household_day_tasks').update({ done }).eq('id', taskId);
  if (error) throw explain(error);
}

export async function removeHouseholdDayTask(taskId: string): Promise<void> {
  if (!supabase) throw new Error('Shared tasks need a connected household account.');
  const { error } = await supabase.from('household_day_tasks').delete().eq('id', taskId);
  if (error) throw explain(error);
}
