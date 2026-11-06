/**
 * Facebook profile-photo avatar (backend).
 *
 * Expiring CDN URLs are never stored. We persist the verified Facebook user id
 * and resolve a fresh picture via Graph `/{id}/picture` with the app token.
 *
 * Client contract:
 * 1) POST /profile/avatar/facebook/intent — binds intent to auth.uid() + linked FB id
 * 2) Explicit Facebook OAuth (linkIdentity / reauth) — capture provider_token in memory only
 * 3) POST /profile/avatar/facebook/complete — verify /me id, single-use consume, save facebook id
 * 4) GET /profile/avatar/facebook/picture — short-cached fresh picture URL for the signed-in user
 */

import { createHmac, randomUUID } from 'node:crypto';

import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';
import {
  assertAvatarFacebookCompleteRateLimit,
  assertAvatarFacebookIntentRateLimit,
  assertAvatarFacebookPictureRateLimit,
} from './profile-avatar-facebook-rate-limit.js';

export const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
export const AVATAR_FACEBOOK_INTENT_TTL_MS = 10 * 60 * 1000;
export const AVATAR_FACEBOOK_PICTURE_CACHE_TTL_MS = 5 * 60 * 1000;

type HandlerResult = { status: number; body: Record<string, unknown> };

export type FacebookMeInfo = {
  id: string;
  hasPhoto: boolean;
};

export type ProfileAvatarFacebookDeps = {
  isConfigured: () => boolean;
  facebookAppCredentials: () => { appId: string; appSecret: string } | null;
  resolveLinkedFacebookId: (userId: string) => Promise<string | null>;
  insertIntent: (row: {
    id: string;
    userId: string;
    facebookId: string;
    expiresAt: string;
  }) => Promise<void>;
  loadIntent: (intentId: string) => Promise<{
    id: string;
    userId: string;
    facebookId: string;
    expiresAt: string;
    consumedAt: string | null;
  } | null>;
  consumeIntent: (opts: {
    intentId: string;
    userId: string;
    facebookId: string;
  }) => Promise<boolean>;
  fetchFacebookMe: (accessToken: string, appSecret: string) => Promise<FacebookMeInfo>;
  saveFacebookAvatar: (opts: { userId: string; facebookId: string }) => Promise<void>;
  loadFacebookAvatarId: (userId: string) => Promise<string | null>;
  resolveFacebookPictureUrl: (opts: {
    facebookId: string;
    appId: string;
    appSecret: string;
  }) => Promise<string | null>;
  assertIntentRateLimit: (userId: string) => void;
  assertCompleteRateLimit: (userId: string) => void;
  assertPictureRateLimit: (userId: string) => void;
  now: () => number;
};

type PictureCacheEntry = { url: string; expiresAt: number };
const pictureUrlCache = new Map<string, PictureCacheEntry>();

export function resetFacebookPictureUrlCache(): void {
  pictureUrlCache.clear();
}

function linkedFacebookIdFromIdentities(
  identities: Array<{ provider?: string; id?: string; identity_data?: Record<string, unknown> }> | null | undefined,
): string | null {
  if (!identities?.length) return null;
  for (const identity of identities) {
    if (identity.provider !== 'facebook') continue;
    const data = identity.identity_data ?? {};
    // Trusted Auth identity id only — never user_metadata.picture / avatar_url.
    for (const key of ['user_id', 'sub', 'id'] as const) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    if (typeof identity.id === 'string' && identity.id.trim()) return identity.id.trim();
  }
  return null;
}

export function extractLinkedFacebookId(
  identities: Array<{ provider?: string; id?: string; identity_data?: Record<string, unknown> }> | null | undefined,
): string | null {
  return linkedFacebookIdFromIdentities(identities);
}

export function facebookAppSecretProof(accessToken: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

function readFacebookAppCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.FACEBOOK_APP_ID?.trim() ?? '';
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim() ?? '';
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export async function fetchFacebookMe(accessToken: string, appSecret: string): Promise<FacebookMeInfo> {
  const proof = facebookAppSecretProof(accessToken, appSecret);
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/me`);
  url.searchParams.set('fields', 'id,picture');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('appsecret_proof', proof);

  const res = await fetch(url, { method: 'GET', redirect: 'error' });
  if (!res.ok) {
    throw new Error('Facebook profile verification failed');
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) {
    throw new Error('Facebook profile verification failed');
  }

  const picture = body?.picture;
  let hasPhoto = false;
  if (picture && typeof picture === 'object') {
    const data = (picture as { data?: { url?: unknown; is_silhouette?: unknown } }).data;
    const picUrl = typeof data?.url === 'string' ? data.url.trim() : '';
    hasPhoto = Boolean(picUrl) && data?.is_silhouette !== true;
  }

  return { id, hasPhoto };
}

export async function resolveFacebookPictureUrl(opts: {
  facebookId: string;
  appId: string;
  appSecret: string;
}): Promise<string | null> {
  const token = `${opts.appId}|${opts.appSecret}`;
  const url = new URL(`${FACEBOOK_GRAPH_BASE}/${encodeURIComponent(opts.facebookId)}/picture`);
  url.searchParams.set('redirect', 'false');
  url.searchParams.set('type', 'large');
  url.searchParams.set('access_token', token);

  const res = await fetch(url, { method: 'GET', redirect: 'error' });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    data?: { url?: unknown; is_silhouette?: unknown };
  } | null;
  const picUrl = typeof body?.data?.url === 'string' ? body.data.url.trim() : '';
  if (!picUrl || !picUrl.startsWith('https://')) return null;
  if (body?.data?.is_silhouette === true) return null;
  return picUrl;
}

async function defaultResolveLinkedFacebookId(userId: string): Promise<string | null> {
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return linkedFacebookIdFromIdentities(data.user.identities ?? []);
}

async function defaultInsertIntent(row: {
  id: string;
  userId: string;
  facebookId: string;
  expiresAt: string;
}): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin.from('profile_avatar_facebook_intents').insert({
    id: row.id,
    user_id: row.userId,
    facebook_id: row.facebookId,
    expires_at: row.expiresAt,
  });
  if (error) throw new Error('Could not create Facebook avatar intent');
}

async function defaultLoadIntent(intentId: string) {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('profile_avatar_facebook_intents')
    .select('id, user_id, facebook_id, expires_at, consumed_at')
    .eq('id', intentId)
    .maybeSingle();
  if (error) throw new Error('Could not load Facebook avatar intent');
  if (!data) return null;
  return {
    id: data.id as string,
    userId: data.user_id as string,
    facebookId: data.facebook_id as string,
    expiresAt: data.expires_at as string,
    consumedAt: (data.consumed_at as string | null) ?? null,
  };
}

async function defaultConsumeIntent(opts: {
  intentId: string;
  userId: string;
  facebookId: string;
}): Promise<boolean> {
  const admin = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from('profile_avatar_facebook_intents')
    .update({ consumed_at: nowIso })
    .eq('id', opts.intentId)
    .eq('user_id', opts.userId)
    .eq('facebook_id', opts.facebookId)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('Could not complete Facebook avatar intent');
  return Boolean(data?.id);
}

async function defaultSaveFacebookAvatar(opts: { userId: string; facebookId: string }): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin
    .from('profiles')
    .update({
      avatar_source: 'facebook',
      avatar_facebook_id: opts.facebookId,
      avatar_google_url: null,
    })
    .eq('id', opts.userId);
  if (error) throw new Error('Could not save Facebook avatar');
}

async function defaultLoadFacebookAvatarId(userId: string): Promise<string | null> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('profiles')
    .select('avatar_source, avatar_facebook_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error('Could not load Facebook avatar');
  if (!data || data.avatar_source !== 'facebook') return null;
  const id = typeof data.avatar_facebook_id === 'string' ? data.avatar_facebook_id.trim() : '';
  return id || null;
}

function defaultDeps(): ProfileAvatarFacebookDeps {
  return {
    isConfigured: isServiceRoleConfigured,
    facebookAppCredentials: readFacebookAppCredentials,
    resolveLinkedFacebookId: defaultResolveLinkedFacebookId,
    insertIntent: defaultInsertIntent,
    loadIntent: defaultLoadIntent,
    consumeIntent: defaultConsumeIntent,
    fetchFacebookMe,
    saveFacebookAvatar: defaultSaveFacebookAvatar,
    loadFacebookAvatarId: defaultLoadFacebookAvatarId,
    resolveFacebookPictureUrl,
    assertIntentRateLimit: assertAvatarFacebookIntentRateLimit,
    assertCompleteRateLimit: assertAvatarFacebookCompleteRateLimit,
    assertPictureRateLimit: assertAvatarFacebookPictureRateLimit,
    now: () => Date.now(),
  };
}

export async function handleCreateFacebookAvatarIntent(
  userId: string,
  deps: ProfileAvatarFacebookDeps = defaultDeps(),
): Promise<HandlerResult> {
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'API service role is not configured' } };
  }
  if (!deps.facebookAppCredentials()) {
    return { status: 503, body: { error: 'Facebook avatar is not configured' } };
  }

  try {
    deps.assertIntentRateLimit(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Too many attempts';
    return { status: 429, body: { error: message, errorCode: 'rate_limited' } };
  }

  const facebookId = await deps.resolveLinkedFacebookId(userId);
  if (!facebookId) {
    return { status: 403, body: { error: 'Connect Facebook before using your Facebook photo' } };
  }

  const id = randomUUID();
  const expiresAt = new Date(deps.now() + AVATAR_FACEBOOK_INTENT_TTL_MS).toISOString();
  try {
    await deps.insertIntent({ id, userId, facebookId, expiresAt });
  } catch {
    return { status: 500, body: { error: 'Could not create Facebook avatar intent' } };
  }

  return { status: 200, body: { intentId: id, expiresAt } };
}

export async function handleCompleteFacebookAvatarIntent(
  userId: string,
  body: { intentId?: unknown; facebookAccessToken?: unknown },
  deps: ProfileAvatarFacebookDeps = defaultDeps(),
): Promise<HandlerResult> {
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'API service role is not configured' } };
  }

  const credentials = deps.facebookAppCredentials();
  if (!credentials) {
    return { status: 503, body: { error: 'Facebook avatar is not configured' } };
  }

  try {
    deps.assertCompleteRateLimit(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Too many attempts';
    return { status: 429, body: { error: message, errorCode: 'rate_limited' } };
  }

  const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : '';
  const facebookAccessToken =
    typeof body.facebookAccessToken === 'string' ? body.facebookAccessToken.trim() : '';

  if (!intentId || !facebookAccessToken) {
    return { status: 400, body: { error: 'intentId and facebookAccessToken are required' } };
  }

  let intent: Awaited<ReturnType<ProfileAvatarFacebookDeps['loadIntent']>>;
  try {
    intent = await deps.loadIntent(intentId);
  } catch {
    return { status: 500, body: { error: 'Could not load Facebook avatar intent' } };
  }

  if (!intent) {
    return { status: 404, body: { error: 'Facebook avatar intent not found' } };
  }
  if (intent.userId !== userId) {
    return { status: 403, body: { error: 'Facebook avatar intent does not belong to this account' } };
  }
  if (intent.consumedAt) {
    return { status: 409, body: { error: 'Facebook avatar intent was already used' } };
  }
  if (Date.parse(intent.expiresAt) <= deps.now()) {
    return { status: 410, body: { error: 'Facebook avatar intent expired' } };
  }

  const linkedId = await deps.resolveLinkedFacebookId(userId);
  if (!linkedId || linkedId !== intent.facebookId) {
    return { status: 403, body: { error: 'Facebook account is not linked to this profile' } };
  }

  let me: FacebookMeInfo;
  try {
    me = await deps.fetchFacebookMe(facebookAccessToken, credentials.appSecret);
  } catch {
    // Do not consume — verification failed; leave avatar unchanged. Token discarded with request.
    return { status: 401, body: { error: 'Facebook profile verification failed' } };
  }

  if (me.id !== intent.facebookId || me.id !== linkedId) {
    return { status: 403, body: { error: 'Facebook account does not match this profile' } };
  }

  if (!me.hasPhoto) {
    return { status: 400, body: { error: 'Facebook account has no profile photo' } };
  }

  let consumed = false;
  try {
    consumed = await deps.consumeIntent({
      intentId: intent.id,
      userId,
      facebookId: intent.facebookId,
    });
  } catch {
    return { status: 500, body: { error: 'Could not complete Facebook avatar intent' } };
  }

  if (!consumed) {
    return { status: 409, body: { error: 'Facebook avatar intent was already used or expired' } };
  }

  try {
    await deps.saveFacebookAvatar({ userId, facebookId: intent.facebookId });
  } catch {
    return { status: 500, body: { error: 'Could not save Facebook avatar' } };
  }

  pictureUrlCache.delete(intent.facebookId);
  return { status: 200, body: { ok: true, avatarSource: 'facebook' } };
}

export async function handleGetFacebookAvatarPicture(
  userId: string,
  deps: ProfileAvatarFacebookDeps = defaultDeps(),
): Promise<HandlerResult> {
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'API service role is not configured' } };
  }

  const credentials = deps.facebookAppCredentials();
  if (!credentials) {
    return { status: 503, body: { error: 'Facebook avatar is not configured' } };
  }

  try {
    deps.assertPictureRateLimit(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Too many attempts';
    return { status: 429, body: { error: message, errorCode: 'rate_limited' } };
  }

  let facebookId: string | null;
  try {
    facebookId = await deps.loadFacebookAvatarId(userId);
  } catch {
    return { status: 500, body: { error: 'Could not load Facebook avatar' } };
  }

  if (!facebookId) {
    return { status: 404, body: { error: 'Facebook photo is not selected' } };
  }

  const cached = pictureUrlCache.get(facebookId);
  if (cached && cached.expiresAt > deps.now()) {
    return { status: 200, body: { url: cached.url } };
  }

  let url: string | null;
  try {
    url = await deps.resolveFacebookPictureUrl({
      facebookId,
      appId: credentials.appId,
      appSecret: credentials.appSecret,
    });
  } catch {
    return { status: 502, body: { error: 'Could not refresh Facebook photo' } };
  }

  if (!url) {
    pictureUrlCache.delete(facebookId);
    return { status: 404, body: { error: 'Facebook photo is unavailable', fallback: 'preset' } };
  }

  pictureUrlCache.set(facebookId, {
    url,
    expiresAt: deps.now() + AVATAR_FACEBOOK_PICTURE_CACHE_TTL_MS,
  });

  return { status: 200, body: { url } };
}
