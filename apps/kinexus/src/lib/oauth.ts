import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { GoogleAvatarReauthFn } from '@/src/lib/profile-avatar-google-flow';
import { supabase } from '@/src/lib/supabase';

if (typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession();
}

/** Profile-photo re-auth only — never Calendar scopes. */
const GOOGLE_AVATAR_SCOPES = 'openid email profile';

export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }

  return makeRedirectUri({
    scheme: 'kinexus',
    path: 'auth/callback',
  });
}

function paramsFromUrl(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const parts: string[] = [];

  if (queryIndex >= 0) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    parts.push(url.slice(queryIndex + 1, end));
  }
  if (hashIndex >= 0) {
    parts.push(url.slice(hashIndex + 1));
  }

  const out: Record<string, string> = {};
  for (const part of parts) {
    for (const [key, value] of new URLSearchParams(part)) {
      out[key] = value;
    }
  }
  return out;
}

export async function createSessionFromUrl(url: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const params = paramsFromUrl(url);
  if (params.error) {
    throw new Error(params.error_description ?? params.error);
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return;
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
  }
}

/** Drop in-memory provider tokens after a one-shot handoff (storage already strips on write). */
async function clearProviderTokensFromMemorySession(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.refresh_token) return;
  if (!session.provider_token && !session.provider_refresh_token) return;
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  if (Platform.OS === 'web') return;
  if (!data.url) {
    throw new Error('No OAuth URL returned from Supabase');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return;
  }
  if (result.type !== 'success') {
    throw new Error('Google sign-in did not complete');
  }

  await createSessionFromUrl(result.url);
}

/**
 * One-shot Google re-auth for profile photo. Uses the same PKCE Google helper,
 * scopes openid email profile only, skipBrowserRedirect so we can restore the
 * prior session if OAuth returns a different Supabase user.
 */
export const reauthGoogleForAvatar: GoogleAvatarReauthFn = async (expectedUserId) => {
  if (!supabase) {
    return { ok: false, code: 'oauth', error: 'Supabase is not configured' };
  }

  const { data: before } = await supabase.auth.getSession();
  const previous = before.session;
  if (!previous?.access_token || !previous.refresh_token || previous.user.id !== expectedUserId) {
    return { ok: false, code: 'oauth', error: 'Sign in required' };
  }

  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: GOOGLE_AVATAR_SCOPES,
      queryParams: {
        prompt: 'consent',
      },
    },
  });

  if (error) {
    return { ok: false, code: 'oauth', error: error.message };
  }
  if (!data.url) {
    return { ok: false, code: 'oauth', error: 'No OAuth URL returned from Supabase' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, code: 'cancelled', error: 'Google sign-in was cancelled' };
  }
  if (result.type !== 'success') {
    return { ok: false, code: 'oauth', error: 'Google sign-in did not complete' };
  }

  const params = paramsFromUrl(result.url);
  if (params.error) {
    return {
      ok: false,
      code: 'oauth',
      error: params.error_description ?? params.error,
    };
  }
  if (!params.code) {
    return { ok: false, code: 'oauth', error: 'Google sign-in did not return a code' };
  }

  const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    params.code,
  );
  if (exchangeError) {
    await supabase.auth.setSession({
      access_token: previous.access_token,
      refresh_token: previous.refresh_token,
    });
    return { ok: false, code: 'oauth', error: exchangeError.message };
  }

  const next = exchanged.session;
  if (!next || next.user.id !== expectedUserId) {
    await supabase.auth.setSession({
      access_token: previous.access_token,
      refresh_token: previous.refresh_token,
    });
    return {
      ok: false,
      code: 'mismatch',
      error: 'Google sign-in did not match your account',
    };
  }

  const providerToken = next.provider_token;
  if (!providerToken) {
    await clearProviderTokensFromMemorySession();
    return {
      ok: false,
      code: 'no_token',
      error: 'Google did not return an access token',
    };
  }

  // Token stays in this return value only; drop it from the live session next.
  await clearProviderTokensFromMemorySession();
  return { ok: true, userId: expectedUserId, providerToken };
};
