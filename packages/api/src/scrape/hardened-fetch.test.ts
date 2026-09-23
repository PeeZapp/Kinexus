import { afterEach, describe, expect, it, vi } from 'vitest';

import { isBotProtectedPage, isStillBotBlocked, recoveredHtmlLooksUsable } from './bot-page.js';
import { fetchPublicHtml } from './index.js';
import { normalizeResidentialProxyBase, residentialProxyConfigured } from './residential-proxy.js';

describe('bot page detection', () => {
  it('treats Cloudflare challenges and 403s as blocked', () => {
    expect(isBotProtectedPage('<title>Just a moment...</title>', 403)).toBe(true);
    expect(isBotProtectedPage('<html>ok</html>', 403)).toBe(true);
    expect(isBotProtectedPage('<html>real catalog</html>'.repeat(40), 200)).toBe(false);
    expect(
      isBotProtectedPage('Verifying that you are not a robot. This site is exceeding reCAPTCHA Enterprise free quota.'),
    ).toBe(true);
    expect(isStillBotBlocked('<title>Just a moment...</title>')).toBe(true);
    expect(recoveredHtmlLooksUsable('<title>Just a moment...</title>')).toBe(false);
    expect(recoveredHtmlLooksUsable(`<html><h1>75192 Millennium Falcon</h1>${'x'.repeat(2000)}</html>`)).toBe(true);
  });
});

describe('residential proxy config', () => {
  const prevUrl = process.env.RESIDENTIAL_PROXY_URL;
  const prevKey = process.env.RESIDENTIAL_PROXY_KEY;

  afterEach(() => {
    process.env.RESIDENTIAL_PROXY_URL = prevUrl;
    process.env.RESIDENTIAL_PROXY_KEY = prevKey;
  });

  it('normalises trailing slashes and colons', () => {
    expect(normalizeResidentialProxyBase('https://pi-proxy.example.com/:')).toBe('https://pi-proxy.example.com');
  });

  it('is configured only when URL and key are both set', () => {
    process.env.RESIDENTIAL_PROXY_URL = '';
    process.env.RESIDENTIAL_PROXY_KEY = '';
    expect(residentialProxyConfigured()).toBe(false);
    process.env.RESIDENTIAL_PROXY_URL = 'https://pi-proxy.example.com';
    process.env.RESIDENTIAL_PROXY_KEY = 'secret';
    expect(residentialProxyConfigured()).toBe(true);
  });
});

describe('fetchPublicHtml', () => {
  it('uses an injected fetch and does not escalate', async () => {
    const fetch = vi.fn(async () => new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const response = await fetchPublicHtml('https://catalog.example/set', {
      lookup: async () => ['8.8.8.8'],
      fetch,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('ok');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('still blocks hostnames that resolve privately', async () => {
    await expect(
      fetchPublicHtml('https://evil.example/set', {
        lookup: async () => ['127.0.0.1'],
        fetch: async () => {
          throw new Error('fetch should not run');
        },
      }),
    ).rejects.toThrow(/not allowed/i);
  });
});
