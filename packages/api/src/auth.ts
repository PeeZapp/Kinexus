import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AuthedUser = { id: string; email?: string };

export function readBearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  let token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    try {
      token = new URL(request.url).searchParams.get('access_token')?.trim() ?? '';
    } catch {
      token = '';
    }
  }
  return token;
}

export function createUserClient(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error('API auth is not configured');
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createAnonClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error('API auth is not configured');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Prefer the caller's JWT so RPC auth.uid() works; fall back to anon for signed-out public reads. */
export function createRequestClient(request: Request): SupabaseClient {
  const token = readBearerToken(request);
  return token ? createUserClient(token) : createAnonClient();
}

export async function userFromRequest(request: Request): Promise<{ user: AuthedUser } | { error: string; status: 401 | 500 }> {
  const token = readBearerToken(request);
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
