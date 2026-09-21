import { isBotProtectedPage, recoveredHtmlLooksUsable } from './bot-page.js';
import { fetchHtmlViaPlaywright, playwrightEnabled } from './playwright-fetch.js';
import { fetchHtmlViaResidentialProxy, residentialProxyConfigured } from './residential-proxy.js';
import { assertPublicHttpUrl, assertResolvedPublicHost, defaultHostnameLookup, type HostnameLookup } from './ssrf.js';

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9,en-US;q=0.8',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

const failedHosts = new Map<string, number>();
const FAIL_TTL_MS = 5 * 60_000;

type ImpitLike = {
  fetch: (url: string, init?: RequestInit) => Promise<{ status: number; headers: Headers; text: () => Promise<string> }>;
};

let impitClient: ImpitLike | null | undefined;

export type HardenedFetchOptions = {
  lookup?: HostnameLookup;
  fetch?: typeof fetch;
  timeoutMs?: number;
  headers?: Record<string, string>;
  escalate?: boolean;
};

function htmlResponse(html: string, status: number, headers?: Headers): Response {
  const next = new Headers(headers);
  if (!next.has('content-type')) next.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status, headers: next });
}

function hostKey(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

function recentlyFailed(url: string): boolean {
  const until = failedHosts.get(hostKey(url));
  return Boolean(until && until > Date.now());
}

function markFailed(url: string): void {
  failedHosts.set(hostKey(url), Date.now() + FAIL_TTL_MS);
}

function markRecovered(url: string): void {
  failedHosts.delete(hostKey(url));
}

async function getImpit(): Promise<ImpitLike | null> {
  if (process.env.VITEST) return null;
  if (impitClient !== undefined) return impitClient;
  try {
    const mod = await import('impit');
    impitClient = new mod.Impit({ browser: 'chrome' }) as unknown as ImpitLike;
    return impitClient;
  } catch {
    impitClient = null;
    return null;
  }
}

function acceptLanguageFor(url: string): string {
  try {
    if (new URL(url).hostname.toLowerCase().endsWith('.com.au')) return 'en-AU,en;q=0.9,en-US;q=0.8';
  } catch {
    // ignore
  }
  return FETCH_HEADERS['Accept-Language'] ?? 'en-AU,en;q=0.9';
}

async function fetchOnce(
  url: string,
  doFetch: typeof fetch,
  timeoutMs: number,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers = {
    ...FETCH_HEADERS,
    'Accept-Language': acceptLanguageFor(url),
    Referer: `${new URL(url).origin}/`,
    ...extraHeaders,
  };
  const impit = doFetch === fetch ? await getImpit() : null;
  if (impit) {
    try {
      const response = await impit.fetch(url, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.text();
      return new Response(body, { status: response.status, headers: response.headers });
    } catch {
      // fall through to node fetch
    }
  }
  return doFetch(url, {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function fetchPublicHtmlDirect(url: string, options: HardenedFetchOptions = {}): Promise<Response> {
  const lookup = options.lookup ?? defaultHostnameLookup;
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    const parsed = assertPublicHttpUrl(current);
    await assertResolvedPublicHost(parsed.hostname, lookup);
    const response = await fetchOnce(current, doFetch, timeoutMs, options.headers);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Could not fetch that URL (HTTP ${response.status})`);
      current = new URL(location, current).href;
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
}

function shouldEscalate(options: HardenedFetchOptions): boolean {
  if (options.fetch) return false;
  if (options.escalate === false) return false;
  if (options.timeoutMs != null && options.timeoutMs < 10_000) return false;
  return true;
}

export function scrapeTransportStatus(): { residentialProxy: boolean; playwright: boolean } {
  return {
    residentialProxy: residentialProxyConfigured(),
    playwright: playwrightEnabled(),
  };
}

export async function fetchPublicHtmlHardened(url: string, options: HardenedFetchOptions = {}): Promise<Response> {
  const direct = await fetchPublicHtmlDirect(url, options);
  const html = await direct.text();
  const original = htmlResponse(html, direct.status, direct.headers);
  if (!shouldEscalate(options) || recentlyFailed(url)) return original;
  if (!isBotProtectedPage(html, direct.status) && direct.ok) return original;

  if (residentialProxyConfigured()) {
    const viaPi = await fetchHtmlViaResidentialProxy(url);
    if (viaPi && recoveredHtmlLooksUsable(viaPi)) {
      markRecovered(url);
      return htmlResponse(viaPi, 200);
    }
  }

  if (playwrightEnabled()) {
    const viaPw = await fetchHtmlViaPlaywright(url);
    if (viaPw && recoveredHtmlLooksUsable(viaPw)) {
      markRecovered(url);
      return htmlResponse(viaPw, 200);
    }
  }

  markFailed(url);
  return original;
}
