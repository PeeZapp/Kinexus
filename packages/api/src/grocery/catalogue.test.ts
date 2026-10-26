import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../scrape/residential-proxy.js', () => ({
  fetchViaResidentialProxy: vi.fn(),
  residentialProxyConfigured: vi.fn(() => true),
}));

import { catalogueJson } from './catalogue.js';
import { fetchViaResidentialProxy } from '../scrape/residential-proxy.js';

const proxied = vi.mocked(fetchViaResidentialProxy);

describe('catalogue json', () => {
  const prevVercel = process.env.VERCEL;

  afterEach(() => {
    process.env.VERCEL = prevVercel;
    proxied.mockReset();
    vi.unstubAllGlobals();
  });

  it('asks the home proxy when the shop returns a block page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>blocked</html>', { status: 200, headers: { 'content-type': 'text/html' } })),
    );
    proxied.mockResolvedValue(
      new Response('{"results":[{"id":1}]}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const data = await catalogueJson<{ results: { id: number }[] }>('https://www.coles.com.au', 'https://www.coles.com.au/api/search', {
      method: 'GET',
      headers: { 'ocp-apim-subscription-key': 'key' },
    });

    expect(data.results[0]?.id).toBe(1);
    expect(proxied).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://www.coles.com.au/api/search',
        cookieFrom: 'https://www.coles.com.au',
        headers: expect.objectContaining({ 'ocp-apim-subscription-key': 'key' }),
      }),
    );
  });

  it('uses the home proxy first on Vercel', async () => {
    process.env.VERCEL = '1';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    proxied.mockResolvedValue(
      new Response('{"Products":[]}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await catalogueJson('https://www.woolworths.com.au', 'https://www.woolworths.com.au/apis/ui/Search/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"SearchTerm":"butter"}',
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(proxied).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', body: '{"SearchTerm":"butter"}' }));
  });
});
