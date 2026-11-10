import {
  containsProfanity,
  type CreatorSearchHit,
  type ProfileItem,
  type ProfileItemKind,
  type PublicProfile,
  type PublicProfileLink,
} from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAnonClient, createRequestClient, createUserClient, readBearerToken, userFromRequest } from '../auth.js';
import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';

const PROFILE_KINDS = new Set<ProfileItemKind>(['recipe', 'workout', 'plan', 'watchlist']);
const MAX_LINKS = 5;

export type PublicProfileRpcClient = {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

type ProfileRow = {
  permanent_id: string;
  handle: string;
  avatar_preset: string | null;
  is_verified: boolean;
  bio: string | null;
  links: unknown;
};

type ItemRow = {
  id: string;
  kind: string;
  title: string;
  image_url: string | null;
  published_at: string;
};

type SearchRow = {
  permanent_id: string;
  handle: string;
  avatar_preset: string | null;
  is_verified: boolean;
};

function rpcMessage(error: { message: string } | null | undefined, fallback: string): never {
  throw new Error(error?.message?.trim() || fallback);
}

function parseLinks(value: unknown): PublicProfileLink[] {
  if (!Array.isArray(value)) return [];
  const out: PublicProfileLink[] = [];
  for (const row of value) {
    if (typeof row === 'string') {
      const url = row.trim();
      if (url) out.push({ url });
      continue;
    }
    if (!row || typeof row !== 'object') continue;
    const url = typeof (row as { url?: unknown }).url === 'string' ? (row as { url: string }).url.trim() : '';
    if (!url) continue;
    const labelRaw = (row as { label?: unknown }).label;
    const label = typeof labelRaw === 'string' ? labelRaw.trim() : '';
    out.push(label ? { url, label } : { url });
  }
  return out;
}

function mapProfile(row: ProfileRow): PublicProfile {
  return {
    permanentId: row.permanent_id,
    handle: row.handle,
    avatarPreset: row.avatar_preset,
    isVerified: Boolean(row.is_verified),
    bio: row.bio,
    links: parseLinks(row.links),
  };
}

function mapItem(row: ItemRow): ProfileItem | null {
  if (!PROFILE_KINDS.has(row.kind as ProfileItemKind)) return null;
  return {
    id: row.id,
    kind: row.kind as ProfileItemKind,
    title: row.title,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
  };
}

function mapSearchHit(row: SearchRow): CreatorSearchHit {
  return {
    permanentId: row.permanent_id,
    handle: row.handle,
    avatarPreset: row.avatar_preset,
    isVerified: Boolean(row.is_verified),
  };
}

export function assertHttpsLinks(links: unknown): PublicProfileLink[] {
  if (links == null) return [];
  if (!Array.isArray(links)) throw new Error('Links must be an array');
  if (links.length > MAX_LINKS) throw new Error('At most 5 links');

  const out: PublicProfileLink[] = [];
  for (const row of links) {
    let url = '';
    let label: string | undefined;
    if (typeof row === 'string') {
      url = row.trim();
    } else if (row && typeof row === 'object') {
      url = typeof (row as { url?: unknown }).url === 'string' ? (row as { url: string }).url.trim() : '';
      const labelRaw = (row as { label?: unknown }).label;
      if (typeof labelRaw === 'string' && labelRaw.trim()) label = labelRaw.trim();
    } else {
      throw new Error('Each link must be a URL string or {url, label}');
    }
    if (!url.toLowerCase().startsWith('https://')) throw new Error('Links must use https://');
    if (url.length > 500) throw new Error('Link is too long');
    if (label) {
      if (label.length > 40) throw new Error('Link label is too long');
      if (containsProfanity(label)) throw new Error('Link label not allowed');
    }
    out.push(label ? { url, label } : { url });
  }
  return out;
}

export function assertBio(bio: unknown): string | null {
  if (bio == null) return null;
  if (typeof bio !== 'string') throw new Error('Bio must be text');
  const trimmed = bio.trim();
  if (!trimmed) return null;
  if (trimmed.length > 280) throw new Error('Bio must be 280 characters or fewer');
  if (containsProfanity(trimmed)) throw new Error('Bio not allowed');
  return trimmed;
}

export function parseProfileItemKind(value: unknown): ProfileItemKind {
  const kind = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!PROFILE_KINDS.has(kind as ProfileItemKind)) {
    throw new Error('kind must be recipe, workout, plan, or watchlist');
  }
  return kind as ProfileItemKind;
}

export async function fetchPublicProfile(
  client: PublicProfileRpcClient,
  key: string,
): Promise<PublicProfile | null> {
  const { data, error } = await client.rpc('get_public_profile', { p_key: key });
  if (error) rpcMessage(error, 'Could not load profile');
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as ProfileRow | undefined;
  return row ? mapProfile(row) : null;
}

export async function fetchProfileItems(
  client: PublicProfileRpcClient,
  key: string,
  kind: ProfileItemKind,
  limit = 20,
  cursor?: string | null,
): Promise<{ items: ProfileItem[]; nextCursor: string | null }> {
  const { data, error } = await client.rpc('get_profile_items', {
    p_key: key,
    p_kind: kind,
    p_limit: limit,
    p_cursor: cursor ?? null,
  });
  if (error) rpcMessage(error, 'Could not load profile items');
  const rows = (Array.isArray(data) ? data : []) as ItemRow[];
  const items = rows.map(mapItem).filter((row): row is ProfileItem => row != null);
  const last = items[items.length - 1];
  const nextCursor =
    items.length >= limit && last ? `${last.publishedAt}|${last.id}` : null;
  return { items, nextCursor };
}

export async function handleGetPublicCreatorProfile(
  request: Request,
  key: string,
  query: { kind?: string; limit?: string; cursor?: string },
): Promise<{ status: number; body: unknown }> {
  const trimmed = key.trim();
  if (!trimmed) return { status: 400, body: { error: 'Profile key required' } };

  let kind: ProfileItemKind = 'recipe';
  try {
    if (query.kind != null && String(query.kind).trim() !== '') {
      kind = parseProfileItemKind(query.kind);
    }
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Invalid kind' } };
  }

  const limitRaw = query.limit != null ? Number(query.limit) : 20;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50) : 20;
  const cursor = query.cursor?.trim() || null;

  let client: SupabaseClient;
  try {
    client = createRequestClient(request);
  } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : 'API auth is not configured' } };
  }

  try {
    const profile = await fetchPublicProfile(client, trimmed);
    if (!profile) return { status: 404, body: { error: 'Profile not found' } };
    const { items, nextCursor } = await fetchProfileItems(client, trimmed, kind, limit, cursor);
    return { status: 200, body: { profile, kind, items, nextCursor } };
  } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : 'Could not load profile' } };
  }
}

export async function handleSearchCreators(
  request: Request,
  q: string | undefined,
  limitParam?: string,
): Promise<{ status: number; body: unknown }> {
  const query = (q ?? '').trim();
  if (!query) return { status: 200, body: { results: [] satisfies CreatorSearchHit[] } };

  const limitRaw = limitParam != null ? Number(limitParam) : 5;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 20) : 5;

  const token = readBearerToken(request);
  let client: PublicProfileRpcClient;
  try {
    if (token) {
      client = createUserClient(token);
    } else if (isServiceRoleConfigured()) {
      client = createServiceClient();
    } else {
      client = createAnonClient();
    }
  } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : 'API auth is not configured' } };
  }

  try {
    const { data, error } = await client.rpc('search_creators', { p_q: query, p_limit: limit });
    if (error) throw new Error(error.message || 'Search failed');
    const rows = (Array.isArray(data) ? data : []) as SearchRow[];
    return { status: 200, body: { results: rows.map(mapSearchHit) } };
  } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : 'Search failed' } };
  }
}

export async function handleUpsertMyProfileMeta(
  request: Request,
  body: { bio?: unknown; links?: unknown; isHidden?: unknown },
): Promise<{ status: number; body: unknown }> {
  const authed = await userFromRequest(request);
  if ('error' in authed) return { status: authed.status, body: { error: authed.error } };

  let bio: string | null;
  let links: PublicProfileLink[];
  let isHidden: boolean | undefined;
  try {
    bio = assertBio(body.bio);
    links = assertHttpsLinks(body.links);
    if (body.isHidden !== undefined) {
      if (typeof body.isHidden !== 'boolean') throw new Error('isHidden must be a boolean');
      isHidden = body.isHidden;
    }
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Invalid profile meta' } };
  }

  const token = readBearerToken(request);
  let client: SupabaseClient;
  try {
    client = createUserClient(token);
  } catch (err) {
    return { status: 500, body: { error: err instanceof Error ? err.message : 'API auth is not configured' } };
  }

  try {
    const { data, error } = await client.rpc('upsert_my_profile_meta', {
      p_bio: bio,
      p_links: links,
    });
    if (error) throw new Error(error.message || 'Could not save profile');
    let row = data as { bio?: string | null; links?: unknown; is_hidden?: boolean } | null;

    if (isHidden !== undefined) {
      const { data: updated, error: hideError } = await client
        .from('public_profiles_meta')
        .update({ is_hidden: isHidden })
        .eq('user_id', authed.user.id)
        .select('bio, links, is_hidden')
        .maybeSingle();
      if (hideError) throw new Error(hideError.message || 'Could not update visibility');
      if (updated) row = updated as { bio?: string | null; links?: unknown; is_hidden?: boolean };
    }

    return {
      status: 200,
      body: {
        bio: row?.bio ?? bio,
        links: parseLinks(row?.links ?? links),
        isHidden: Boolean(row?.is_hidden),
      },
    };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not save profile' } };
  }
}

export async function handleReportProfile(
  request: Request,
  key: string,
  body: { reason?: unknown },
): Promise<{ status: number; body: unknown }> {
  const authed = await userFromRequest(request);
  if ('error' in authed) return { status: authed.status, body: { error: authed.error } };

  const trimmed = key.trim();
  if (!trimmed) return { status: 400, body: { error: 'Profile key required' } };
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return { status: 400, body: { error: 'Reason required' } };

  const token = readBearerToken(request);
  try {
    const client = createUserClient(token);
    const { error } = await client.rpc('report_profile', { p_key: trimmed, p_reason: reason });
    if (error) throw new Error(error.message || 'Could not report profile');
    return { status: 200, body: { ok: true } };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not report profile' } };
  }
}

export async function handleBlockProfile(
  request: Request,
  key: string,
): Promise<{ status: number; body: unknown }> {
  const authed = await userFromRequest(request);
  if ('error' in authed) return { status: authed.status, body: { error: authed.error } };

  const trimmed = key.trim();
  if (!trimmed) return { status: 400, body: { error: 'Profile key required' } };

  const token = readBearerToken(request);
  try {
    const client = createUserClient(token);
    const { error } = await client.rpc('block_profile', { p_key: trimmed });
    if (error) throw new Error(error.message || 'Could not block profile');
    return { status: 200, body: { ok: true } };
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : 'Could not block profile' } };
  }
}
