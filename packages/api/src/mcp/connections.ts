import { createUserClient, readBearerToken, userFromRequest } from '../auth.js';
import { upsertMcpConnection } from './context.js';
import { inferMcpPlatform, type McpPlatform } from './platform.js';
import { DEFAULT_MCP_SCOPES } from './scopes.js';
import { logMcp } from './log.js';

export async function handleListMcpConnections(request: Request): Promise<{ status: number; body: unknown }> {
  const authed = await userFromRequest(request);
  if ('error' in authed) return { status: authed.status, body: { error: authed.error } };

  const token = readBearerToken(request);
  if (!token) return { status: 401, body: { error: 'Sign in required' } };
  const client = createUserClient(token);

  const { data, error } = await client
    .from('mcp_connections')
    .select('id, client_id, client_name, platform, scopes, created_at, last_used_at, revoked_at')
    .eq('user_id', authed.user.id)
    .order('created_at', { ascending: false });

  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { connections: data ?? [] } };
}

export async function handleRevokeMcpConnection(
  request: Request,
  connectionId: string,
): Promise<{ status: number; body: unknown }> {
  const authed = await userFromRequest(request);
  if ('error' in authed) return { status: authed.status, body: { error: authed.error } };

  const token = readBearerToken(request);
  if (!token) return { status: 401, body: { error: 'Sign in required' } };

  const client = createUserClient(token);
  const { data: row, error } = await client
    .from('mcp_connections')
    .select('id, client_id, revoked_at')
    .eq('id', connectionId)
    .eq('user_id', authed.user.id)
    .maybeSingle();

  if (error) return { status: 500, body: { error: error.message } };
  if (!row) return { status: 404, body: { error: 'Connection not found' } };

  if (!row.revoked_at) {
    const { error: updateError } = await client
      .from('mcp_connections')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('user_id', authed.user.id);
    if (updateError) return { status: 500, body: { error: updateError.message } };
  }

  try {
    const { error: revokeError } = await client.auth.oauth.revokeGrant({ clientId: row.client_id as string });
    if (revokeError) {
      logMcp({ event: 'revoke_grant_failed', error: revokeError.message, connectionId });
    }
  } catch (err) {
    logMcp({
      event: 'revoke_grant_exception',
      error: err instanceof Error ? err.message : String(err),
      connectionId,
    });
  }

  return { status: 200, body: { ok: true, id: row.id } };
}

export async function handleRegisterMcpConnection(request: Request): Promise<{ status: number; body: unknown }> {
  const authed = await userFromRequest(request);
  if ('error' in authed) return { status: authed.status, body: { error: authed.error } };

  const token = readBearerToken(request);
  if (!token) return { status: 401, body: { error: 'Sign in required' } };

  const body = (await request.json().catch(() => ({}))) as {
    clientId?: unknown;
    clientName?: unknown;
    platform?: unknown;
  };
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  if (!clientId) return { status: 400, body: { error: 'clientId required' } };
  const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : null;
  const platform =
    typeof body.platform === 'string' && body.platform
      ? (body.platform as McpPlatform)
      : inferMcpPlatform(clientName);

  const client = createUserClient(token);
  const result = await upsertMcpConnection(client, {
    userId: authed.user.id,
    clientId,
    clientName,
    platform,
    scopes: DEFAULT_MCP_SCOPES,
  });
  if ('error' in result) return { status: 500, body: { error: result.error } };
  return { status: 200, body: { id: result.id } };
}
