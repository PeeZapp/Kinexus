import { isBotProtectedPage, recoveredHtmlLooksUsable } from './bot-page.js';

export function normalizeResidentialProxyBase(raw: string | null | undefined): string {
  if (raw == null) return '';
  return raw.trim().replace(/[:/]+$/, '');
}

export function residentialProxyConfigured(): boolean {
  return Boolean(normalizeResidentialProxyBase(process.env.RESIDENTIAL_PROXY_URL) && process.env.RESIDENTIAL_PROXY_KEY?.trim());
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
