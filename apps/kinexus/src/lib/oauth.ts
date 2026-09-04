import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

if (typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession();
}

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
