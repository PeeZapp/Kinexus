import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

export type McpConnection = {
  id: string;
  clientId: string;
  clientName: string | null;
  platform: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type ApiRow = {
  id: string;
  client_id: string;
  client_name: string | null;
  platform: string;
  scopes: string[] | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
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

function mapRow(row: ApiRow): McpConnection {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    platform: row.platform,
    scopes: row.scopes ?? [],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export async function listMcpConnections(): Promise<McpConnection[]> {
  if (!isConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(`${apiBase()}/mcp/connections`, {
    method: 'GET',
    headers: await authHeader(),
  });
  const data = (await res.json().catch(() => ({}))) as { connections?: ApiRow[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return (data.connections ?? []).map(mapRow).filter((row) => !row.revokedAt);
}

export async function revokeMcpConnection(id: string): Promise<void> {
  if (!isConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(`${apiBase()}/mcp/connections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeader(),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
}
