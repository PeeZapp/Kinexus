import { Platform } from 'react-native';

import type {
  CreatorSearchHit,
  ProfileItem,
  ProfileItemKind,
  PublicProfile,
  PublicProfileLink,
} from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

function isApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

/** Same-origin `/u/:key` is the Expo page; hit the API entry for profile JSON. */
function resolveUrl(path: string): string {
  const base = configuredUrl();
  if (base) return `${base}${path}`;
  const qIndex = path.indexOf('?');
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const search = qIndex >= 0 ? path.slice(qIndex + 1) : '';
  if (
    pathname.startsWith('/u/') &&
    !pathname.endsWith('/report') &&
    !pathname.endsWith('/block')
  ) {
    const params = new URLSearchParams(search);
    params.set('__path', pathname);
    return `/api?${params.toString()}`;
  }
  return path;
}

async function optionalAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!supabase) return headers;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requireAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseJson<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}

export type PublicCreatorProfileResponse = {
  profile: PublicProfile;
  kind: ProfileItemKind;
  items: ProfileItem[];
  nextCursor: string | null;
};

export async function fetchPublicCreatorProfile(
  key: string,
  opts?: { kind?: ProfileItemKind; limit?: number; cursor?: string | null },
): Promise<PublicCreatorProfileResponse> {
  if (!isApiConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const params = new URLSearchParams();
  if (opts?.kind) params.set('kind', opts.kind);
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  const qs = params.toString();
  const path = `/u/${encodeURIComponent(key.trim())}${qs ? `?${qs}` : ''}`;
  const res = await fetch(resolveUrl(path), { headers: await optionalAuthHeaders() });
  return parseJson<PublicCreatorProfileResponse>(res);
}

export async function searchCreators(q: string, limit = 3): Promise<CreatorSearchHit[]> {
  if (!isApiConfigured()) return [];
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
  const res = await fetch(resolveUrl(`/creators/search?${params.toString()}`), {
    headers: await optionalAuthHeaders(),
  });
  const payload = await parseJson<{ results: CreatorSearchHit[] }>(res);
  return Array.isArray(payload.results) ? payload.results.slice(0, limit) : [];
}

export type ProfileMeta = {
  bio: string | null;
  links: PublicProfileLink[];
  isHidden: boolean;
};

export async function fetchOwnProfileMeta(): Promise<ProfileMeta> {
  if (!supabase) throw new Error('Sign in required');
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) throw new Error('Sign in required');
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { bio: string | null; links: unknown; is_hidden: boolean } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from('public_profiles_meta')
    .select('bio, links, is_hidden')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Could not load profile');
  const linksRaw = data?.links;
  const links: PublicProfileLink[] = Array.isArray(linksRaw)
    ? linksRaw.flatMap((row) => {
        if (typeof row === 'string' && row.trim()) return [{ url: row.trim() }];
        if (!row || typeof row !== 'object') return [];
        const url = typeof (row as { url?: unknown }).url === 'string' ? (row as { url: string }).url.trim() : '';
        if (!url) return [];
        const labelRaw = (row as { label?: unknown }).label;
        const label = typeof labelRaw === 'string' ? labelRaw.trim() : '';
        return [label ? { url, label } : { url }];
      })
    : [];
  return {
    bio: typeof data?.bio === 'string' ? data.bio : null,
    links,
    isHidden: Boolean(data?.is_hidden),
  };
}

export async function saveOwnProfileMeta(input: {
  bio: string | null;
  links: PublicProfileLink[];
  isHidden: boolean;
}): Promise<ProfileMeta> {
  if (!isApiConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(resolveUrl('/me/profile-meta'), {
    method: 'PUT',
    headers: await requireAuthHeaders(),
    body: JSON.stringify({
      bio: input.bio,
      links: input.links,
      isHidden: input.isHidden,
    }),
  });
  return parseJson<ProfileMeta>(res);
}

export async function reportCreatorProfile(key: string, reason: string): Promise<void> {
  if (!isApiConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(resolveUrl(`/u/${encodeURIComponent(key.trim())}/report`), {
    method: 'POST',
    headers: await requireAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  await parseJson<{ ok: true }>(res);
}

export async function blockCreatorProfile(key: string): Promise<void> {
  if (!isApiConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(resolveUrl(`/u/${encodeURIComponent(key.trim())}/block`), {
    method: 'POST',
    headers: await requireAuthHeaders(),
    body: '{}',
  });
  await parseJson<{ ok: true }>(res);
}

export function creatorProfileHref(handleOrId: string): `/u/${string}` {
  return `/u/${encodeURIComponent(handleOrId.trim())}`;
}
