import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

export type HouseholdAiKeyMeta = {
  hasKey: boolean;
  provider: string | null;
  providerLabel: string | null;
  last4: string | null;
  keyStatus: string | null;
  lastCheckedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  allowed: boolean;
};

export type HouseholdAiKeyAccessRow = {
  userId: string;
  displayName: string;
  handle: string | null;
  allowed: boolean;
};

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

function apiBase(): string {
  return configuredUrl();
}

function isConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!isConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: await authHeader(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; needsProvider?: boolean };
  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (${res.status})`) as Error & { needsProvider?: boolean };
    if (data.needsProvider) err.needsProvider = true;
    throw err;
  }
  return data;
}

export async function getHouseholdAiKey(householdId: string): Promise<HouseholdAiKeyMeta> {
  return request('GET', `/ai/keys?householdId=${encodeURIComponent(householdId)}`);
}

export async function setHouseholdAiKey(input: {
  householdId: string;
  key: string;
  provider?: string;
}): Promise<HouseholdAiKeyMeta> {
  return request('POST', '/ai/keys', input);
}

export async function removeHouseholdAiKey(householdId: string): Promise<void> {
  await request('DELETE', '/ai/keys', { householdId });
}

export async function getHouseholdAiKeyAccess(householdId: string): Promise<{ members: HouseholdAiKeyAccessRow[] }> {
  return request('GET', `/ai/keys/access?householdId=${encodeURIComponent(householdId)}`);
}

export async function setHouseholdAiKeyAccess(input: {
  householdId: string;
  userId: string;
  allowed: boolean;
}): Promise<void> {
  await request('PUT', '/ai/keys/access', input);
}

export const AI_PROVIDER_OPTIONS = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'perplexity', label: 'Perplexity' },
] as const;
