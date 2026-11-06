/**
 * Google profile-photo avatar (backend only — part 1).
 *
 * Part 2 client contract (do not implement capture/UI here):
 *
 * 1) POST /profile/avatar/google/intent
 *    Authorization: Bearer <supabase access token>
 *    Body: {}
 *    200: { intentId: string, expiresAt: string }
 *    Binds the intent server-side to auth.uid() + linked Google subject from Auth identities.
 *    403 if the user has no linked Google identity.
 *
 * 2) Re-auth with Google via the existing Supabase Google OAuth sign-in helper.
 *    Capture session.provider_token in memory only (never persist / never put in URLs).
 *    The Supabase session must remain the same Kinexus user that created the intent.
 *
 * 3) POST /profile/avatar/google/complete
 *    Authorization: Bearer <same supabase access token>
 *    Body: { intentId: string, googleAccessToken: string }
 *    200: { ok: true, avatarSource: 'google' }
 *    Server resolves photo via https://www.googleapis.com/oauth2/v3/userinfo only.
 *    UserInfo.sub must match both the intent and the user's linked Google identity.
 *    On missing picture / verification failure, the existing avatar choice is unchanged.
 *
 * Binding is safe: intent is single-use, user-scoped, subject-scoped, and short-lived.
 * A provider_token for a different Google account fails the subject match.
 */

import { randomUUID } from 'node:crypto';

import { isPrivateHost } from './scrape/ssrf.js';
import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';
import {
  assertAvatarGoogleCompleteRateLimit,
  assertAvatarGoogleIntentRateLimit,
} from './profile-avatar-google-rate-limit.js';

export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const AVATAR_GOOGLE_INTENT_TTL_MS = 10 * 60 * 1000;

type HandlerResult = { status: number; body: Record<string, unknown> };

export type GoogleUserInfo = {
  sub: string;
  picture?: string;
};

export type ProfileAvatarGoogleDeps = {
  isConfigured: () => boolean;
  resolveLinkedGoogleSub: (userId: string) => Promise<string | null>;
  insertIntent: (row: {
    id: string;
    userId: string;
    googleSub: string;
    expiresAt: string;
  }) => Promise<void>;
  loadIntent: (intentId: string) => Promise<{
    id: string;
    userId: string;
    googleSub: string;
    expiresAt: string;
    consumedAt: string | null;
  } | null>;
  consumeIntent: (opts: {
    intentId: string;
    userId: string;
    googleSub: string;
  }) => Promise<boolean>;
  fetchGoogleUserInfo: (accessToken: string) => Promise<GoogleUserInfo>;
  saveGoogleAvatar: (opts: { userId: string; photoUrl: string }) => Promise<void>;
  assertIntentRateLimit: (userId: string) => void;
  assertCompleteRateLimit: (userId: string) => void;
  now: () => number;
};

function linkedGoogleSubFromIdentities(
  identities: Array<{ provider?: string; id?: string; identity_data?: Record<string, unknown> }> | null | undefined,
): string | null {
  if (!identities?.length) return null;
  for (const identity of identities) {
    if (identity.provider !== 'google') continue;
    const data = identity.identity_data ?? {};
    // Trusted Auth identity subject only — never user_metadata.picture / avatar_url.
    if (typeof data.sub === 'string' && data.sub.trim()) return data.sub.trim();
    if (typeof identity.id === 'string' && identity.id.trim()) return identity.id.trim();
  }
  return null;
}

export function extractLinkedGoogleSub(
  identities: Array<{ provider?: string; id?: string; identity_data?: Record<string, unknown> }> | null | undefined,
): string | null {
  return linkedGoogleSubFromIdentities(identities);
}

/** Validate a UserInfo picture URL after provider provenance is proven. Does not fetch. */
export function assertSafeGooglePhotoUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('Google profile photo URL is invalid');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Google profile photo must be https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Google profile photo URL is invalid');
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('Google profile photo URL is not allowed');
  }
  const href = parsed.toString();
  if (href.length < 12 || href.length > 2048) {
    throw new Error('Google profile photo URL is invalid');
  }
  return href;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: 'error',
  });
  if (!res.ok) {
    throw new Error('Google profile verification failed');
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const sub = typeof body?.sub === 'string' ? body.sub.trim() : '';
  if (!sub) {
    throw new Error('Google profile verification failed');
  }
  const picture = typeof body?.picture === 'string' ? body.picture.trim() : undefined;
  return picture ? { sub, picture } : { sub };
}

async function defaultResolveLinkedGoogleSub(userId: string): Promise<string | null> {
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return linkedGoogleSubFromIdentities(data.user.identities ?? []);
}

async function defaultInsertIntent(row: {
  id: string;
  userId: string;
  googleSub: string;
  expiresAt: string;
}): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin.from('profile_avatar_google_intents').insert({
    id: row.id,
    user_id: row.userId,
    google_sub: row.googleSub,
    expires_at: row.expiresAt,
  });
  if (error) throw new Error('Could not create Google avatar intent');
}

async function defaultLoadIntent(intentId: string) {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('profile_avatar_google_intents')
    .select('id, user_id, google_sub, expires_at, consumed_at')
    .eq('id', intentId)
    .maybeSingle();
  if (error) throw new Error('Could not load Google avatar intent');
  if (!data) return null;
  return {
    id: data.id as string,
    userId: data.user_id as string,
    googleSub: data.google_sub as string,
    expiresAt: data.expires_at as string,
    consumedAt: (data.consumed_at as string | null) ?? null,
  };
}

async function defaultConsumeIntent(opts: {
  intentId: string;
  userId: string;
  googleSub: string;
}): Promise<boolean> {
  const admin = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from('profile_avatar_google_intents')
    .update({ consumed_at: nowIso })
    .eq('id', opts.intentId)
    .eq('user_id', opts.userId)
    .eq('google_sub', opts.googleSub)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('Could not complete Google avatar intent');
  return Boolean(data?.id);
}

async function defaultSaveGoogleAvatar(opts: { userId: string; photoUrl: string }): Promise<void> {
  const admin = createServiceClient();
  const { error } = await admin
    .from('profiles')
    .update({
      avatar_source: 'google',
      avatar_google_url: opts.photoUrl,
    })
    .eq('id', opts.userId);
  if (error) throw new Error('Could not save Google avatar');
}

function defaultDeps(): ProfileAvatarGoogleDeps {
  return {
    isConfigured: isServiceRoleConfigured,
    resolveLinkedGoogleSub: defaultResolveLinkedGoogleSub,
    insertIntent: defaultInsertIntent,
    loadIntent: defaultLoadIntent,
    consumeIntent: defaultConsumeIntent,
    fetchGoogleUserInfo,
    saveGoogleAvatar: defaultSaveGoogleAvatar,
    assertIntentRateLimit: assertAvatarGoogleIntentRateLimit,
    assertCompleteRateLimit: assertAvatarGoogleCompleteRateLimit,
    now: () => Date.now(),
  };
}

export async function handleCreateGoogleAvatarIntent(
  userId: string,
  deps: ProfileAvatarGoogleDeps = defaultDeps(),
): Promise<HandlerResult> {
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'API service role is not configured' } };
  }

  try {
    deps.assertIntentRateLimit(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Too many attempts';
    return { status: 429, body: { error: message, errorCode: 'rate_limited' } };
  }

  const googleSub = await deps.resolveLinkedGoogleSub(userId);
  if (!googleSub) {
    return { status: 403, body: { error: 'Link a Google account before using your Google photo' } };
  }

  const id = randomUUID();
  const expiresAt = new Date(deps.now() + AVATAR_GOOGLE_INTENT_TTL_MS).toISOString();
  try {
    await deps.insertIntent({ id, userId, googleSub, expiresAt });
  } catch {
    return { status: 500, body: { error: 'Could not create Google avatar intent' } };
  }

  return { status: 200, body: { intentId: id, expiresAt } };
}

export async function handleCompleteGoogleAvatarIntent(
  userId: string,
  body: { intentId?: unknown; googleAccessToken?: unknown },
  deps: ProfileAvatarGoogleDeps = defaultDeps(),
): Promise<HandlerResult> {
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'API service role is not configured' } };
  }

  try {
    deps.assertCompleteRateLimit(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Too many attempts';
    return { status: 429, body: { error: message, errorCode: 'rate_limited' } };
  }

  const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : '';
  const googleAccessToken =
    typeof body.googleAccessToken === 'string' ? body.googleAccessToken.trim() : '';

  if (!intentId || !googleAccessToken) {
    return { status: 400, body: { error: 'intentId and googleAccessToken are required' } };
  }

  let intent: Awaited<ReturnType<ProfileAvatarGoogleDeps['loadIntent']>>;
  try {
    intent = await deps.loadIntent(intentId);
  } catch {
    return { status: 500, body: { error: 'Could not load Google avatar intent' } };
  }

  if (!intent) {
    return { status: 404, body: { error: 'Google avatar intent not found' } };
  }
  if (intent.userId !== userId) {
    return { status: 403, body: { error: 'Google avatar intent does not belong to this account' } };
  }
  if (intent.consumedAt) {
    return { status: 409, body: { error: 'Google avatar intent was already used' } };
  }
  if (Date.parse(intent.expiresAt) <= deps.now()) {
    return { status: 410, body: { error: 'Google avatar intent expired' } };
  }

  const linkedSub = await deps.resolveLinkedGoogleSub(userId);
  if (!linkedSub || linkedSub !== intent.googleSub) {
    return { status: 403, body: { error: 'Google account is not linked to this profile' } };
  }

  let userInfo: GoogleUserInfo;
  try {
    userInfo = await deps.fetchGoogleUserInfo(googleAccessToken);
  } catch {
    // Do not consume — verification failed; leave avatar unchanged.
    return { status: 401, body: { error: 'Google profile verification failed' } };
  }

  if (userInfo.sub !== intent.googleSub || userInfo.sub !== linkedSub) {
    // Wrong Google subject — leave avatar unchanged; do not consume.
    return { status: 403, body: { error: 'Google account does not match this profile' } };
  }

  if (!userInfo.picture) {
    return { status: 400, body: { error: 'Google account has no profile photo' } };
  }

  let photoUrl: string;
  try {
    photoUrl = assertSafeGooglePhotoUrl(userInfo.picture);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google profile photo URL is invalid';
    return { status: 400, body: { error: message } };
  }

  let consumed = false;
  try {
    consumed = await deps.consumeIntent({
      intentId: intent.id,
      userId,
      googleSub: intent.googleSub,
    });
  } catch {
    return { status: 500, body: { error: 'Could not complete Google avatar intent' } };
  }

  if (!consumed) {
    return { status: 409, body: { error: 'Google avatar intent was already used or expired' } };
  }

  try {
    await deps.saveGoogleAvatar({ userId, photoUrl });
  } catch {
    return { status: 500, body: { error: 'Could not save Google avatar' } };
  }

  return { status: 200, body: { ok: true, avatarSource: 'google' } };
}
