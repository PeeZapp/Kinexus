import { Platform } from 'react-native';

import {
  runGoogleAvatarOptIn as runGoogleAvatarOptInFlow,
  type GoogleAvatarOptInDeps,
  type GoogleAvatarOptInResult,
  type GoogleAvatarReauthFn,
} from '@/src/lib/profile-avatar-google-flow';
import { supabase } from '@/src/lib/supabase';

export {
  clearGoogleAvatarIntent,
  sessionHasLinkedGoogleIdentity,
  storeGoogleAvatarIntent,
  takeGoogleAvatarIntent,
  type GoogleAvatarIntent,
  type GoogleAvatarOptInResult,
  type GoogleAvatarReauthFn,
} from '@/src/lib/profile-avatar-google-flow';

type IntentResponse = { intentId?: string; expiresAt?: string; error?: string };
type CompleteResponse = { ok?: boolean; avatarSource?: string; error?: string };

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

export async function currentUserHasLinkedGoogleIdentity(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  const identities = data.user?.identities;
  if (!identities?.length) return false;
  return identities.some((identity) => identity.provider === 'google');
}

export async function createGoogleAvatarIntent(): Promise<{ intentId: string; expiresAt: string }> {
  if (!apiReady()) {
    throw new Error('API is not configured');
  }
  const res = await fetch(`${apiBase()}/profile/avatar/google/intent`, {
    method: 'POST',
    headers: await bearerHeaders(),
    body: '{}',
  });
  const payload = (await res.json().catch(() => ({}))) as IntentResponse;
  if (!res.ok || typeof payload.intentId !== 'string') {
    throw new Error(payload.error || `Could not start Google photo (${res.status})`);
  }
  return {
    intentId: payload.intentId,
    expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : '',
  };
}

export async function completeGoogleAvatarIntent(
  intentId: string,
  googleAccessToken: string,
): Promise<{ ok: true; avatarSource: 'google' }> {
  if (!apiReady()) {
    throw new Error('API is not configured');
  }
  const res = await fetch(`${apiBase()}/profile/avatar/google/complete`, {
    method: 'POST',
    headers: await bearerHeaders(),
    body: JSON.stringify({ intentId, googleAccessToken }),
  });
  const payload = (await res.json().catch(() => ({}))) as CompleteResponse;
  if (!res.ok || payload.ok !== true) {
    const err = new Error(payload.error || `Could not use Google photo (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return { ok: true, avatarSource: 'google' };
}

export async function runGoogleAvatarOptIn(deps: {
  expectedUserId: string;
  reauth: GoogleAvatarReauthFn;
}): Promise<GoogleAvatarOptInResult> {
  const flowDeps: GoogleAvatarOptInDeps = {
    expectedUserId: deps.expectedUserId,
    createIntent: createGoogleAvatarIntent,
    reauth: deps.reauth,
    complete: completeGoogleAvatarIntent,
  };
  return runGoogleAvatarOptInFlow(flowDeps);
}
