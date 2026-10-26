import { isBotProtectedPage, recoveredHtmlLooksUsable } from './bot-page.js';

export function normalizeResidentialProxyBase(raw: string | null | undefined): string {
  if (raw == null) return '';
  return raw.trim().replace(/[:/]+$/, '');
}

export function residentialProxyConfigured(): boolean {
  return Boolean(normalizeResidentialProxyBase(process.env.RESIDENTIAL_PROXY_URL) && process.env.RESIDENTIAL_PROXY_KEY?.trim());
}

export type ResidentialForward = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  cookieFrom?: string;
};

/** Forward a catalogue call through the home proxy. The Pi attaches the shop cookie itself. */
export async function fetchViaResidentialProxy(input: ResidentialForward, timeoutMs = 9_000): Promise<Response | null> {
  const proxyUrl = normalizeResidentialProxyBase(process.env.RESIDENTIAL_PROXY_URL);
  const proxyKey = process.env.RESIDENTIAL_PROXY_KEY?.trim();
  if (!proxyUrl || !proxyKey) return null;
  try {
    const response = await fetch(`${proxyUrl}/fetch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${proxyKey}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        url: input.url,
        method: input.method === 'POST' ? 'POST' : 'GET',
        headers: input.headers ?? {},
        body: input.body ?? '',
        cookieFrom: input.cookieFrom ?? '',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { status?: unknown; contentType?: unknown; body?: unknown };
    const status = typeof data.status === 'number' ? data.status : 502;
    const contentType = typeof data.contentType === 'string' ? data.contentType : 'text/plain';
    const body = typeof data.body === 'string' ? data.body : '';
    return new Response(body, { status, headers: { 'content-type': contentType } });
  } catch {
    return null;
  }
}

export async function fetchHtmlViaResidentialProxy(url: string, timeoutMs = 35_000): Promise<string | null> {
  const proxyUrl = normalizeResidentialProxyBase(process.env.RESIDENTIAL_PROXY_URL);
  const proxyKey = process.env.RESIDENTIAL_PROXY_KEY?.trim();
  if (!proxyUrl || !proxyKey) return null;
  const endpoint = `${proxyUrl}/fetch?url=${encodeURIComponent(url)}`;
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${proxyKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const html = await response.text();
    if (!recoveredHtmlLooksUsable(html)) return null;
    if (isBotProtectedPage(html) && html.length < 8_000) return null;
    return html;
  } catch {
    return null;
  }
}
