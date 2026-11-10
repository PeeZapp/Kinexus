import { afterEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';

const PREV_SUPABASE = process.env.SUPABASE_URL;

afterEach(() => {
  if (PREV_SUPABASE === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = PREV_SUPABASE;
});

describe('oauth protected resource metadata', () => {
  it('serves resource = /ai/mcp and authorization_servers = Supabase issuer', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    const res = await app.request('https://kinexus-green.vercel.app/.well-known/oauth-protected-resource/ai/mcp');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      resource?: string;
      authorization_servers?: string[];
      bearer_methods_supported?: string[];
    };
    expect(body.resource).toBe('https://kinexus-green.vercel.app/ai/mcp');
    expect(body.authorization_servers).toEqual(['https://example.supabase.co/auth/v1']);
    expect(body.bearer_methods_supported).toEqual(['header']);
  });

  it('serves the same shape at the root protected-resource path', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    const res = await app.request('https://kinexus-green.vercel.app/.well-known/oauth-protected-resource');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resource?: string; authorization_servers?: string[] };
    expect(body.resource).toBe('https://kinexus-green.vercel.app/ai/mcp');
    expect(body.authorization_servers?.[0]).toBe('https://example.supabase.co/auth/v1');
  });
});

describe('oauth authorization server metadata', () => {
  it('returns AS metadata pointing at the Supabase issuer', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    const res = await app.request('https://kinexus-green.vercel.app/.well-known/oauth-authorization-server');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      issuer?: string;
      authorization_endpoint?: string;
      token_endpoint?: string;
      registration_endpoint?: string;
    };
    expect(body.issuer).toBe('https://example.supabase.co/auth/v1');
    expect(body.authorization_endpoint).toBe('https://example.supabase.co/auth/v1/oauth/authorize');
    expect(body.token_endpoint).toBe('https://example.supabase.co/auth/v1/oauth/token');
    expect(body.registration_endpoint).toBe('https://example.supabase.co/auth/v1/oauth/clients/register');
  });
});

describe('unauthenticated /ai/mcp', () => {
  it('returns 401 with WWW-Authenticate resource_metadata', async () => {
    const res = await app.request('https://kinexus-green.vercel.app/ai/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(res.status).toBe(401);
    const www = res.headers.get('WWW-Authenticate') ?? '';
    expect(www).toMatch(/Bearer/);
    expect(www).toMatch(/resource_metadata="https:\/\/kinexus-green\.vercel\.app\/\.well-known\/oauth-protected-resource\/ai\/mcp"/);
  });
});
