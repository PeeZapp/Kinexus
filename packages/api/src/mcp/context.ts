import type { SupabaseClient } from '@supabase/supabase-js';

import { createUserClient, readBearerToken } from '../auth.js';
import { DEFAULT_MCP_SCOPES } from './scopes.js';
import { inferMcpPlatform, type McpPlatform } from './platform.js';
import { logMcp } from './log.js';

export type McpCaller = {
  userId: string;
  accessToken: string;
  client: SupabaseClient;
  clientId: string | null;
  clientName: string | null;
  platform: McpPlatform;
  connectionId: string | null;
  scopes: readonly string[];
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function mcpWwwAuthenticate(resourceMetadataUrl: string): string {
  return `Bearer realm="mcp", resource_metadata="${resourceMetadataUrl}"`;
}

export async function resolveMcpCaller(request: Request): Promise<
  | { ok: true; caller: McpCaller }
  | { ok: false; status: 401 | 500; error: string }
> {
  const accessToken = readBearerToken(request);
  if (!accessToken) return { ok: false, status: 401, error: 'Sign in required' };

  let client: SupabaseClient;
  try {
    client = createUserClient(accessToken);
  } catch {
    return { ok: false, status: 500, error: 'API auth is not configured' };
  }

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return { ok: false, status: 401, error: 'Invalid or expired session' };

  const payload = decodeJwtPayload(accessToken);
  const clientId =
    (typeof payload?.client_id === 'string' && payload.client_id) ||
    (typeof payload?.app_metadata === 'object' &&
      payload.app_metadata &&
      typeof (payload.app_metadata as { client_id?: unknown }).client_id === 'string' &&
      (payload.app_metadata as { client_id: string }).client_id) ||
    null;

  if (clientId) {
    const connection = await touchConnection(client, data.user.id, clientId);
    if (connection.status === 'revoked') {
      return { ok: false, status: 401, error: 'Connection revoked' };
    }
    return {
      ok: true,
      caller: {
        userId: data.user.id,
        accessToken,
        client,
        clientId,
        clientName: connection.clientName,
        platform: connection.platform,
        connectionId: connection.id || null,
        scopes: connection.scopes.length ? connection.scopes : DEFAULT_MCP_SCOPES,
      },
    };
  }

  return {
    ok: true,
    caller: {
      userId: data.user.id,
      accessToken,
      client,
      clientId: null,
      clientName: null,
      platform: 'other',
      connectionId: null,
      scopes: DEFAULT_MCP_SCOPES,
    },
  };
}

async function touchConnection(
  client: SupabaseClient,
  userId: string,
  clientId: string,
): Promise<
  | { status: 'ok'; id: string; clientName: string | null; platform: McpPlatform; scopes: string[] }
  | { status: 'revoked' }
> {
  const now = new Date().toISOString();
  const { data: existing } = await client
    .from('mcp_connections')
    .select('id, client_name, platform, scopes, revoked_at')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (existing?.revoked_at) {
    logMcp({ event: 'connection_revoked_token', userId, clientId });
    return { status: 'revoked' };
  }

  if (existing) {
    await client.from('mcp_connections').update({ last_used_at: now }).eq('id', existing.id);
    return {
      status: 'ok',
      id: existing.id as string,
      clientName: (existing.client_name as string | null) ?? null,
      platform: (existing.platform as McpPlatform) ?? 'other',
      scopes: (existing.scopes as string[]) ?? [...DEFAULT_MCP_SCOPES],
    };
  }

  const platform = inferMcpPlatform(null);
  const { data: inserted, error } = await client
    .from('mcp_connections')
    .insert({
      user_id: userId,
      client_id: clientId,
      platform,
      scopes: [...DEFAULT_MCP_SCOPES],
      last_used_at: now,
    })
    .select('id, client_name, platform, scopes')
    .maybeSingle();

  if (error || !inserted) {
    logMcp({ event: 'connection_touch_failed', error: error?.message ?? 'insert failed', userId, clientId });
    return {
      status: 'ok',
      id: '',
      clientName: null,
      platform,
      scopes: [...DEFAULT_MCP_SCOPES],
    };
  }

  return {
    status: 'ok',
    id: inserted.id as string,
    clientName: (inserted.client_name as string | null) ?? null,
    platform: (inserted.platform as McpPlatform) ?? platform,
    scopes: (inserted.scopes as string[]) ?? [...DEFAULT_MCP_SCOPES],
  };
}

export async function upsertMcpConnection(
  client: SupabaseClient,
  opts: {
    userId: string;
    clientId: string;
    clientName?: string | null;
    platform?: McpPlatform;
    scopes?: readonly string[];
  },
): Promise<{ id: string } | { error: string }> {
  const platform = opts.platform ?? inferMcpPlatform(opts.clientName);
  const scopes = [...(opts.scopes ?? DEFAULT_MCP_SCOPES)];
  const { data, error } = await client
    .from('mcp_connections')
    .upsert(
      {
        user_id: opts.userId,
        client_id: opts.clientId,
        client_name: opts.clientName ?? null,
        platform,
        scopes,
        revoked_at: null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,client_id' },
    )
    .select('id')
    .maybeSingle();
  if (error || !data) return { error: error?.message ?? 'Could not save connection' };
  return { id: data.id as string };
}
