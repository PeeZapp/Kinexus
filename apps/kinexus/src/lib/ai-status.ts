import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

export type AiBlockedReason = 'no_access' | 'key_paused';

export type AiStatus = {
  keySource: 'household' | 'platform' | null;
  blocked: AiBlockedReason | null;
  hasKey: boolean;
  isAdmin: boolean;
};

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

function isConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

export async function getAiStatus(householdId: string): Promise<AiStatus> {
  if (!isConfigured()) {
    return { keySource: 'platform', blocked: null, hasKey: false, isAdmin: false };
  }
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  const res = await fetch(`${configuredUrl()}/ai/status?householdId=${encodeURIComponent(householdId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = (await res.json().catch(() => ({}))) as AiStatus & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return {
    keySource: body.keySource ?? null,
    blocked: body.blocked ?? null,
    hasKey: Boolean(body.hasKey),
    isAdmin: Boolean(body.isAdmin),
  };
}

export function aiBlockedMessage(blocked: AiBlockedReason, isAdmin: boolean): string {
  if (blocked === 'no_access') return 'AI is turned off for you in this household. Ask an admin.';
  if (isAdmin) return "Your household's AI key isn't working. AI is paused until an admin fixes it.";
  return "Your household's AI key isn't working. AI is paused until an admin fixes it.";
}
