import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchHtmlViaResidentialProxy = vi.fn(async (_url: string) => null as string | null);
const residentialProxyConfigured = vi.fn(() => false);
const fetchHtmlViaPlaywright = vi.fn(async (_url: string) => null as string | null);
const playwrightEnabled = vi.fn(() => false);

vi.mock('./residential-proxy.js', () => ({
  fetchHtmlViaResidentialProxy: (url: string) => fetchHtmlViaResidentialProxy(url),
  residentialProxyConfigured: () => residentialProxyConfigured(),
  normalizeResidentialProxyBase: (raw: string | null | undefined) => (raw ?? '').trim().replace(/[:/]+$/, ''),
}));

vi.mock('./playwright-fetch.js', () => ({
  fetchHtmlViaPlaywright: (url: string) => fetchHtmlViaPlaywright(url),
  playwrightEnabled: () => playwrightEnabled(),
}));

const { fetchPublicHtmlHardened } = await import('./hardened-fetch.js');

const challenge = '<title>Just a moment...</title>';
const recovered = `<html><h1>75192 Millennium Falcon</h1>${'x'.repeat(2000)}</html>`;
const lookup = async () => ['8.8.8.8'];

afterEach(() => {
  vi.unstubAllGlobals();
  fetchHtmlViaResidentialProxy.mockReset();
  fetchHtmlViaResidentialProxy.mockResolvedValue(null);
  residentialProxyConfigured.mockReset();
  residentialProxyConfigured.mockReturnValue(false);
  fetchHtmlViaPlaywright.mockReset();
  fetchHtmlViaPlaywright.mockResolvedValue(null);
  playwrightEnabled.mockReset();
  playwrightEnabled.mockReturnValue(false);
});

function stubChallengeFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(challenge, { status: 403, headers: { 'content-type': 'text/html' } })),
  );
}

describe('fetchPublicHtmlHardened escalate ladder', () => {
  it('recovers through the residential proxy before Playwright', async () => {
    stubChallengeFetch();
    residentialProxyConfigured.mockReturnValue(true);
    fetchHtmlViaResidentialProxy.mockResolvedValue(recovered);
    playwrightEnabled.mockReturnValue(true);

    const response = await fetchPublicHtmlHardened('https://pi-hit.example/set', { lookup });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Millennium Falcon');
    expect(fetchHtmlViaResidentialProxy).toHaveBeenCalledTimes(1);
    expect(fetchHtmlViaPlaywright).not.toHaveBeenCalled();
  });

  it('falls back to Playwright stealth when the proxy misses', async () => {
    stubChallengeFetch();
    residentialProxyConfigured.mockReturnValue(false);
    playwrightEnabled.mockReturnValue(true);
    fetchHtmlViaPlaywright.mockResolvedValue(recovered);

    const response = await fetchPublicHtmlHardened('https://pw-hit.example/set', { lookup });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Millennium Falcon');
    expect(fetchHtmlViaPlaywright).toHaveBeenCalledTimes(1);
  });

  it('does not escalate short timeouts used by caption fetches', async () => {
    stubChallengeFetch();
    playwrightEnabled.mockReturnValue(true);
    fetchHtmlViaPlaywright.mockImplementation(async () => {
      throw new Error('Playwright should not run');
    });

    const response = await fetchPublicHtmlHardened('https://short.example/watch', { lookup, timeoutMs: 8_000 });
    expect(response.status).toBe(403);
    expect(fetchHtmlViaPlaywright).not.toHaveBeenCalled();
    expect(fetchHtmlViaResidentialProxy).not.toHaveBeenCalled();
  });
});
