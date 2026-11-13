import type { AuthUser } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

export const TALK_ITEM_LIMIT = 40;

export type TalkItem = {
  id: string;
  body: string;
  done: boolean;
  createdBy: string;
  createdAt: string;
};

function explain(error: { message?: string; code?: string }): Error {
  const message = error.message ?? 'Could not load talk items.';
  if (error.code === 'PGRST205' || /household_talk_items|schema cache/i.test(message)) {
    return new Error('Talk needs the latest database migration before it can sync.');
  }
  return new Error(message);
}

function mapRow(row: {
  id: string;
  body: string;
  done: boolean;
  created_by: string;
  created_at: string;
}): TalkItem {
  return {
    id: row.id,
    body: row.body,
    done: row.done,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function loadTalkItems(householdId: string): Promise<TalkItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('household_talk_items')
    .select('id, body, done, created_by, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })
    .limit(TALK_ITEM_LIMIT);
  if (error) throw explain(error);
  return (data ?? []).map(mapRow);
}

export async function addTalkItem(
  user: AuthUser,
  householdId: string,
  body: string,
): Promise<TalkItem> {
  if (!supabase || user.isDevBypass) {
    throw new Error('Talk needs a connected household account.');
  }
  const cleaned = body.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!cleaned) throw new Error('Write something to talk about.');

  const { count, error: countError } = await supabase
    .from('household_talk_items')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId);
  if (countError) throw explain(countError);
  if ((count ?? 0) >= TALK_ITEM_LIMIT) {
    throw new Error('The talk list is full. Clear a few first.');
  }

  const { data, error } = await supabase
    .from('household_talk_items')
    .insert({
      household_id: householdId,
      body: cleaned,
      created_by: user.id,
    })
    .select('id, body, done, created_by, created_at')
    .single();
  if (error) throw explain(error);
  return mapRow(data);
}

export async function setTalkItemDone(itemId: string, done: boolean): Promise<void> {
  if (!supabase) throw new Error('Talk needs a connected household account.');
  const { error } = await supabase.from('household_talk_items').update({ done }).eq('id', itemId);
  if (error) throw explain(error);
}

export async function removeTalkItem(itemId: string): Promise<void> {
  if (!supabase) throw new Error('Talk needs a connected household account.');
  const { error } = await supabase.from('household_talk_items').delete().eq('id', itemId);
  if (error) throw explain(error);
}
