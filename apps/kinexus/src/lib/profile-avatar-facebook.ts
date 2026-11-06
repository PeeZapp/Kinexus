import { Platform } from 'react-native';

import {
  runFacebookAvatarOptIn as runFacebookAvatarOptInFlow,
  type FacebookAvatarOptInDeps,
  type FacebookAvatarOptInResult,
  type FacebookAvatarReauthFn,
} from '@/src/lib/profile-avatar-facebook-flow';
import { supabase } from '@/src/lib/supabase';

export {
  clearFacebookAvatarIntent,
  facebookIdentityAlreadyLinkedElsewhere,
  sessionHasLinkedFacebookIdentity,
  storeFacebookAvatarIntent,
  takeFacebookAvatarIntent,
  type FacebookAvatarIntent,
  type FacebookAvatarOptInResult,
  type FacebookAvatarReauthFn,
  type FacebookLinkResult,
} from '@/src/lib/profile-avatar-facebook-flow';

type IntentResponse = { intentId?: string; expiresAt?: string; error?: string };
type CompleteResponse = { ok?: boolean; avatarSource?: string; error?: string };
type PictureResponse = { url?: string; error?: string; fallback?: string };

function apiBase(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

function apiReady(): boolean {
  if (apiBase()) return true;
  return Platform.OS === 'web';
}

async function bearerHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function currentUserHasLinkedFacebookIdentity(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  const identities = data.user?.identities;
  if (!identities?.length) return false;
  return identities.some((identity) => identity.provider === 'facebook');
}

export async function createFacebookAvatarIntent(): Promise<{ intentId: string; expiresAt: string }> {
  if (!apiReady()) {
    throw new Error('API is not configured');
  }
  const res = await fetch(`${apiBase()}/profile/avatar/facebook/intent`, {
    method: 'POST',
    headers: await bearerHeaders(),
    body: '{}',
  });
  const payload = (await res.json().catch(() => ({}))) as IntentResponse;
  if (!res.ok || typeof payload.intentId !== 'string') {
    throw new Error(payload.error || `Could not start Facebook photo (${res.status})`);
  }
  return {
    intentId: payload.intentId,
    expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : '',
  };
}

export async function completeFacebookAvatarIntent(
  intentId: string,
  facebookAccessToken: string,
): Promise<{ ok: true; avatarSource: 'facebook' }> {
  if (!apiReady()) {
    throw new Error('API is not configured');
  }
  const res = await fetch(`${apiBase()}/profile/avatar/facebook/complete`, {
    method: 'POST',
    headers: await bearerHeaders(),
    body: JSON.stringify({ intentId, facebookAccessToken }),
  });
  const payload = (await res.json().catch(() => ({}))) as CompleteResponse;
  if (!res.ok || payload.ok !== true) {
    const err = new Error(payload.error || `Could not use Facebook photo (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return { ok: true, avatarSource: 'facebook' };
}

/** Fresh Graph picture URL for the signed-in user's selected Facebook avatar. */
export async function fetchFacebookAvatarPictureUrl(): Promise<string> {
  if (!apiReady()) {
    throw new Error('API is not configured');
  }
  const res = await fetch(`${apiBase()}/profile/avatar/facebook/picture`, {
    method: 'GET',
    headers: await bearerHeaders(),
  });
  const payload = (await res.json().catch(() => ({}))) as PictureResponse;
  if (!res.ok || typeof payload.url !== 'string' || !payload.url.startsWith('https://')) {
    throw new Error(payload.error || `Could not load Facebook photo (${res.status})`);
  }
  return payload.url;
}

export async function runFacebookAvatarOptIn(deps: {
  expectedUserId: string;
  reauth: FacebookAvatarReauthFn;
}): Promise<FacebookAvatarOptInResult> {
  const flowDeps: FacebookAvatarOptInDeps = {
    expectedUserId: deps.expectedUserId,
    createIntent: createFacebookAvatarIntent,
    reauth: deps.reauth,
    complete: completeFacebookAvatarIntent,
  };
  return runFacebookAvatarOptInFlow(flowDeps);
}
