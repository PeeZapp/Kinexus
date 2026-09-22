import { createClient } from '@supabase/supabase-js';

export type AuthedUser = { id: string; email?: string };

export async function userFromRequest(request: Request): Promise<{ user: AuthedUser } | { error: string; status: 401 | 500 }> {
  const header = request.headers.get('authorization') ?? '';
  let token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    try {
      token = new URL(request.url).searchParams.get('access_token')?.trim() ?? '';
    } catch {
      token = '';
    }
  }
  if (!token) return { error: 'Sign in required', status: 401 };

  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return { error: 'API auth is not configured', status: 500 };

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: 'Invalid or expired session', status: 401 };
  return { user: { id: data.user.id, email: data.user.email } };
}
