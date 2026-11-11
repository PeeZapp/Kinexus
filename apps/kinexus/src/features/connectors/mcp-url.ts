export function resolvePublicWebOrigin(origins: {
  pageOrigin?: string;
  webUrl?: string;
  apiUrl?: string;
}): string {
  const page = (origins.pageOrigin ?? '').replace(/\/$/, '');
  const configured = (origins.webUrl ?? '').replace(/\/$/, '');
  const api = (origins.apiUrl ?? '').replace(/\/$/, '');
  const origin =
    [page, configured].find((value) => value && isPublicHttps(value)) || api || page || configured || 'http://localhost:5301';
  return origin.replace(/\/$/, '');
}

export function buildAiChatMcpUrl(origins: {
  pageOrigin?: string;
  webUrl?: string;
  apiUrl?: string;
}): string {
  return `${resolvePublicWebOrigin(origins)}/ai/mcp`;
}

function isPublicHttps(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && !host.endsWith('.local');
  } catch {
    return false;
  }
}

function pageOrigin(): string {
  return typeof window !== 'undefined' && typeof window.location?.origin === 'string' ? window.location.origin : '';
}

/** Public site origin (same rules as the MCP URL, without the path). */
export function publicWebOrigin(): string {
  return resolvePublicWebOrigin({
    pageOrigin: pageOrigin(),
    webUrl: process.env.EXPO_PUBLIC_WEB_URL,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  });
}

/** Public AI-chat MCP resource URL copied into ChatGPT / Claude / Perplexity. */
export function aiChatMcpUrl(): string {
  return buildAiChatMcpUrl({
    pageOrigin: pageOrigin(),
    webUrl: process.env.EXPO_PUBLIC_WEB_URL,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  });
}
