import {
  mcpPublicOrigin,
  mcpResourceUrl,
  supabaseAuthIssuer,
  supabaseAuthorizationServerMetadataUrl,
} from './origin.js';

export function oauthProtectedResourceBody(request: Request): Record<string, unknown> {
  const origin = mcpPublicOrigin(request);
  const resource = mcpResourceUrl(origin);
  // RFC 9728 + Claude/ChatGPT: authorization_servers must list issuer URLs (not metadata URLs).
  const authorizationServers = [supabaseAuthIssuer()].filter(Boolean);
  return {
    resource,
    authorization_servers: authorizationServers,
    bearer_methods_supported: ['header'],
    scopes_supported: [
      'openid',
      'email',
      'profile',
      'offline_access',
      'meals:read',
      'meals:write',
      'fitness:read',
      'fitness:write',
      'watchlists:read',
      'watchlists:write',
      'wishlists:read',
      'wishlists:write',
    ],
    resource_documentation: new URL('/docs/ai-connectors', origin.endsWith('/') ? origin : `${origin}/`).toString(),
  };
}

export async function oauthAuthorizationServerBody(): Promise<Record<string, unknown>> {
  const metadataUrl = supabaseAuthorizationServerMetadataUrl();
  const issuer = supabaseAuthIssuer();
  if (metadataUrl) {
    try {
      const res = await fetch(metadataUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const body = (await res.json()) as Record<string, unknown>;
        return body;
      }
    } catch {
      // fall through to local stub
    }
  }

  if (!issuer) {
    return {
      error: 'SUPABASE_URL is not configured',
    };
  }

  // Stub used when Supabase discovery is unreachable. ChatGPT needs DCR + refresh
  // (`offline_access`) advertised so custom MCP connections stay signed in.
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/clients/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
  };
}
