import type { SupabaseClient } from '@supabase/supabase-js';

import { TALK_ITEM_LIMIT, TALK_ITEM_NOT_FOUND, resolveCallerHousehold } from './shared.js';

export type TalkItemSummary = {
  id: string;
  body: string;
  done: boolean;
  createdBy: string;
  createdAt: string;
};

function mapTalkItem(row: Record<string, unknown>): TalkItemSummary {
  return {
    id: String(row.id),
    body: String(row.body ?? ''),
    done: Boolean(row.done),
    createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

/**
 * Open items plus recent done items (same household, membership via RLS).
 * Caps total at TALK_ITEM_LIMIT, preferring open then newest done.
 */
export async function listTalkItems(
  client: SupabaseClient,
  userId: string,
): Promise<{ householdId: string; open: TalkItemSummary[]; recentDone: TalkItemSummary[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);

  const { data, error } = await client
    .from('household_talk_items')
    .select('id, body, done, created_by, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })
    .limit(TALK_ITEM_LIMIT);
  if (error) throw new Error(error.message);

  const items = (data ?? []).map((row) => mapTalkItem(row as Record<string, unknown>));
  return {
    householdId,
    open: items.filter((item) => !item.done),
    recentDone: items.filter((item) => item.done).slice(-10),
  };
}

export async function getTalkItems(
  client: SupabaseClient,
  userId: string,
): Promise<{ householdId: string; open: TalkItemSummary[]; recentDone: TalkItemSummary[] }> {
  return listTalkItems(client, userId);
}

export async function loadTalkItemOrThrow(
  client: SupabaseClient,
  householdId: string,
  itemId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('household_talk_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(TALK_ITEM_NOT_FOUND);
  const rec = data as Record<string, unknown>;
  if (String(rec.household_id) !== householdId) throw new Error(TALK_ITEM_NOT_FOUND);
  return rec;
}
