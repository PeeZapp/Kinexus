import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveCallerHousehold } from './shared.js';

export const ALERT_NOT_FOUND = 'Alert not found';

export type AlertSummary = {
  id: string;
  segment: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

function mapAlert(row: Record<string, unknown>): AlertSummary {
  return {
    id: String(row.id),
    segment: String(row.segment ?? ''),
    title: String(row.title ?? ''),
    body: typeof row.body === 'string' ? row.body : null,
    href: typeof row.href === 'string' ? row.href : null,
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
    createdAt: String(row.created_at ?? ''),
  };
}

export async function listAlerts(
  client: SupabaseClient,
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<{ householdId: string; alerts: AlertSummary[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);
  let builder = client
    .from('user_alerts')
    .select('id, segment, title, body, href, read_at, created_at')
    .eq('user_id', userId)
    .order('read_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (opts.unreadOnly) builder = builder.is('read_at', null);

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return {
    householdId,
    alerts: (data ?? []).map((row) => mapAlert(row as Record<string, unknown>)),
  };
}

export async function getUnreadAlerts(
  client: SupabaseClient,
  userId: string,
  opts: { limit?: number } = {},
): Promise<{ householdId: string; unreadCount: number; alerts: AlertSummary[] }> {
  const listed = await listAlerts(client, userId, { ...opts, unreadOnly: true });
  const { count, error } = await client
    .from('user_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return {
    householdId: listed.householdId,
    unreadCount: count ?? listed.alerts.length,
    alerts: listed.alerts,
  };
}

export async function loadOwnAlertOrThrow(
  client: SupabaseClient,
  userId: string,
  alertId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('user_alerts')
    .select('*')
    .eq('id', alertId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(ALERT_NOT_FOUND);
  return data as Record<string, unknown>;
}
