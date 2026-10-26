import { fetchViaResidentialProxy, residentialProxyConfigured } from '../scrape/residential-proxy.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

type Jar = { cookie: string; at: number };

const jars = new Map<string, Jar>();
const pending = new Map<string, Promise<string>>();

function cookieHeader(response: Response): string {
  const rows = response.headers.getSetCookie?.() ?? [];
  if (rows.length > 0) return rows.map((row) => row.split(';')[0]).join('; ');
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function sessionCookie(origin: string): Promise<string> {
  const cached = jars.get(origin);
  if (cached && Date.now() - cached.at < 15 * 60 * 1000) return cached.cookie;
  const existing = pending.get(origin);
  if (existing) return existing;
  const loading = (async () => {
    const home = await fetch(`${origin}/`, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      signal: AbortSignal.timeout(12_000),
    });
    const cookie = cookieHeader(home);
    await home.arrayBuffer();
    jars.set(origin, { cookie, at: Date.now() });
    return cookie;
  })().finally(() => pending.delete(origin));
  pending.set(origin, loading);
  return loading;
}

export function catalogueLooksBlocked(response: Response, body: string): boolean {
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('text/html')) return true;
  const start = body.trimStart().slice(0, 20).toLowerCase();
  return start.startsWith('<!doctype') || start.startsWith('<html');
}

/** Fetch a public catalogue URL, reusing the storefront cookie the site sets on its homepage. */
export async function catalogueFetch(origin: string, url: string, init: RequestInit = {}): Promise<Response> {
  const send = async (cookie: string) => {
    const headers = new Headers(init.headers);
    headers.set('user-agent', USER_AGENT);
    headers.set('accept', headers.get('accept') ?? 'application/json');
    if (cookie) headers.set('cookie', cookie);
    return fetch(url, { ...init, headers, signal: AbortSignal.timeout(12_000) });
  };

  let response = await send(await sessionCookie(origin));
  if (response.status === 403 || response.status === 401) {
    jars.delete(origin);
    response = await send(await sessionCookie(origin));
  }
  return response;
}

function forwardHeaders(init: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, key) => {
    headers[key] = value;
  });
  headers['user-agent'] = USER_AGENT;
  headers.accept = headers.accept ?? 'application/json';
  delete headers.cookie;
  return headers;
}

async function catalogueViaProxy(origin: string, url: string, init: RequestInit): Promise<Response | null> {
  if (!residentialProxyConfigured()) return null;
  return fetchViaResidentialProxy({
    url,
    method: init.method,
    headers: forwardHeaders(init),
    body: typeof init.body === 'string' ? init.body : '',
    cookieFrom: origin,
  });
}

function catalogueResult<T>(response: Response, body: string): T {
  if (!response.ok || catalogueLooksBlocked(response, body)) {
    throw new Error(`Catalogue did not return prices (${response.status})`);
  }
  return JSON.parse(body) as T;
}

export async function catalogueJson<T>(origin: string, url: string, init: RequestInit = {}): Promise<T> {
  if (process.env.VERCEL === '1' && residentialProxyConfigured()) {
    const proxied = await catalogueViaProxy(origin, url, init);
    if (!proxied) throw new Error('Catalogue did not return prices (502)');
    return catalogueResult(proxied, await proxied.text());
  }

  let response = await catalogueFetch(origin, url, init);
  let body = await response.text();
  if (catalogueLooksBlocked(response, body)) {
    jars.delete(origin);
    const proxied = await catalogueViaProxy(origin, url, init);
    if (proxied) {
      response = proxied;
      body = await proxied.text();
    }
  }
  return catalogueResult(response, body);
}
