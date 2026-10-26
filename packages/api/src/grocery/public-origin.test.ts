import { describe, expect, it } from 'vitest';

import { mcpConnectorUrl, publicSiteOrigin } from './public-origin.js';

describe('public site origin', () => {
  it('prefers the permanent Vercel production host over localhost', () => {
    expect(
      publicSiteOrigin({
        webUrl: 'http://localhost:5300',
        productionHost: 'kinexus.vercel.app',
        requestOrigin: 'http://localhost:5301',
      }),
    ).toBe('https://kinexus.vercel.app');
  });

  it('uses the current deployment on a Vercel preview', () => {
    expect(
      publicSiteOrigin({
        productionHost: 'kinexus.vercel.app',
        deploymentHost: 'kinexus-git-preview.vercel.app',
        vercelEnv: 'preview',
        requestOrigin: 'http://localhost',
      }),
    ).toBe('https://kinexus-git-preview.vercel.app');
  });

  it('keeps a configured public site ahead of the Vercel host', () => {
    expect(
      publicSiteOrigin({
        groceryPublicOrigin: 'https://app.example.com',
        productionHost: 'kinexus.vercel.app',
      }),
    ).toBe('https://app.example.com');
  });

  it('puts the connector token on the public MCP address', () => {
    expect(mcpConnectorUrl('https://kinexus.vercel.app', 'abc+def')).toBe(
      'https://kinexus.vercel.app/mcp?token=abc%2Bdef',
    );
  });
});
