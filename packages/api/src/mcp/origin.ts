import { publicSiteOriginFromRequest } from '../grocery/public-origin.js';

export function mcpPublicOrigin(request: Request): string {
  return publicSiteOriginFromRequest(request);
}

export function supabaseAuthIssuer(): string {
  const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
  if (!url) return '';
  return `${url.replace(/\/$/, '')}/auth/v1`;
}

export function supabaseAuthorizationServerMetadataUrl(): string {
  const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
  if (!url) return '';
  const origin = url.replace(/\/$/, '');
  return `${origin}/.well-known/oauth-authorization-server/auth/v1`;
}

export function mcpResourceUrl(origin: string): string {
  return new URL('/ai/mcp', origin.endsWith('/') ? origin : `${origin}/`).toString().replace(/\/$/, '');
}

export function oauthProtectedResourceMetadataUrl(origin: string): string {
  return new URL('/.well-known/oauth-protected-resource/ai/mcp', origin.endsWith('/') ? origin : `${origin}/`).toString();
}
