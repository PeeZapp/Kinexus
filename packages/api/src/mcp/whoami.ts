import type { SupabaseClient } from '@supabase/supabase-js';

export type WhoamiResult = {
  handle: string;
  householdName: string;
  role: string;
};

export async function runWhoami(client: SupabaseClient, userId: string): Promise<WhoamiResult> {
  const [{ data: profile }, { data: membership }] = await Promise.all([
    client.from('profiles').select('username, global_handle').eq('id', userId).maybeSingle(),
    client
      .from('household_members')
      .select('role, households(name)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const username = typeof profile?.username === 'string' ? profile.username.trim() : '';
  const globalHandle = typeof profile?.global_handle === 'string' ? profile.global_handle.trim() : '';
  const handle = username || globalHandle || userId;

  const household = membership?.households as { name?: string } | { name?: string }[] | null | undefined;
  const householdName = Array.isArray(household)
    ? (household[0]?.name ?? '')
    : (household?.name ?? '');
  const role = typeof membership?.role === 'string' ? membership.role : '';

  return {
    handle,
    householdName,
    role,
  };
}
