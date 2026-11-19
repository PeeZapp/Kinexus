import { STAFF_ALERT_SEGMENT, type AlertScope, type AlertSegment } from '@/src/features/alerts/segments';
import { supabase } from '@/src/lib/supabase';

export type AlertRow = {
  id: string;
  householdId: string | null;
  actorUserId: string | null;
  segment: AlertSegment | string;
  title: string;
  body: string | null;
  href: string | null;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
};

function mapAlert(row: {
  id: string;
  household_id: string | null;
  actor_user_id: string | null;
  segment: string;
  title: string;
  body: string | null;
  href: string | null;
  payload: unknown;
  read_at: string | null;
  created_at: string;
}): AlertRow {
  return {
    id: row.id,
    householdId: row.household_id,
    actorUserId: row.actor_user_id,
    segment: row.segment,
    title: row.title,
    body: row.body ?? null,
    href: row.href ?? null,
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function fetchUnreadAlertCount(scope: AlertScope = 'household'): Promise<number> {
  if (!supabase) return 0;
  let query = supabase.from('user_alerts').select('id', { count: 'exact', head: true }).is('read_at', null);
  query = scope === 'staff' ? query.eq('segment', STAFF_ALERT_SEGMENT) : query.neq('segment', STAFF_ALERT_SEGMENT);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchAlerts(limit = 60, scope: AlertScope = 'household'): Promise<AlertRow[]> {
  if (!supabase) return [];
  let query = supabase
    .from('user_alerts')
    .select('id, household_id, actor_user_id, segment, title, body, href, payload, read_at, created_at')
    .order('read_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  query = scope === 'staff' ? query.eq('segment', STAFF_ALERT_SEGMENT) : query.neq('segment', STAFF_ALERT_SEGMENT);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapAlert);
}

export async function markAlertRead(alertId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('user_alerts').update({ read_at: new Date().toISOString() }).eq('id', alertId);
  if (error) throw error;
}

export async function markAllAlertsRead(scope: AlertScope = 'household'): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  let query = supabase.from('user_alerts').update({ read_at: new Date().toISOString() }).is('read_at', null);
  query = scope === 'staff' ? query.eq('segment', STAFF_ALERT_SEGMENT) : query.neq('segment', STAFF_ALERT_SEGMENT);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteAlert(alertId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('user_alerts').delete().eq('id', alertId);
  if (error) throw error;
}

export async function clearAllAlerts(scope: AlertScope = 'household'): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Sign in to clear alerts');
  let query = supabase.from('user_alerts').delete().eq('user_id', userId);
  query = scope === 'staff' ? query.eq('segment', STAFF_ALERT_SEGMENT) : query.neq('segment', STAFF_ALERT_SEGMENT);
  const { error } = await query;
  if (error) throw error;
}

export async function clearReadAlerts(scope: AlertScope = 'household'): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Sign in to clear alerts');
  let query = supabase.from('user_alerts').delete().eq('user_id', userId).not('read_at', 'is', null);
  query = scope === 'staff' ? query.eq('segment', STAFF_ALERT_SEGMENT) : query.neq('segment', STAFF_ALERT_SEGMENT);
  const { error } = await query;
  if (error) throw error;
}

export async function fetchDisabledAlertSegments(householdId: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from('user_alert_prefs')
    .select('segment, enabled')
    .eq('household_id', householdId)
    .eq('enabled', false)
    .neq('segment', STAFF_ALERT_SEGMENT);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.segment));
}

export async function setAlertSegmentEnabled(
  householdId: string,
  segment: AlertSegment,
  enabled: boolean,
  userId: string,
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  if (segment === STAFF_ALERT_SEGMENT) return;
  if (enabled) {
    const { error } = await supabase
      .from('user_alert_prefs')
      .delete()
      .eq('household_id', householdId)
      .eq('segment', segment)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('user_alert_prefs').upsert(
    {
      user_id: userId,
      household_id: householdId,
      segment,
      enabled: false,
    },
    { onConflict: 'user_id,household_id,segment' },
  );
  if (error) throw error;
}
