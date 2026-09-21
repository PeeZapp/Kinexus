import { decodeEntities, fetchPublicHtml, assertPublicHttpUrl, type FetchPublicHtmlOptions } from '../../scrape/index.js';
import { assertResolvedPublicHost, defaultHostnameLookup } from '../../scrape/ssrf.js';

export type VideoMetadata = {
  title: string;
  description?: string;
  authorName?: string;
  thumbnailUrl?: string;
  captions?: string;
  siteName?: string;
  hasCaptions?: boolean;
  /** Public comments / extra caption text (Facebook). */
  extraText?: string;
  /** Off-platform recipe URLs found in comments or the caption. */
  linkedUrls?: string[];
};

const OEMBED_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'www.tiktok.com', 'tiktok.com']);

export type OembedPayload = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

export async function fetchOembedJson(
  endpoint: string,
  options: FetchPublicHtmlOptions = {},
): Promise<OembedPayload | null> {
  try {
    const parsed = new URL(endpoint);
    if (!OEMBED_HOSTS.has(parsed.hostname)) return null;
    let last: OembedPayload | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      last = await fetchOembedOnce(endpoint, options);
      if (last?.title) return last;
      if (attempt < 2) await sleep(300 * (attempt + 1));
    }
    return last;
  } catch {
    return null;
  }
}

async function fetchOembedOnce(
  endpoint: string,
  options: FetchPublicHtmlOptions,
): Promise<OembedPayload | null> {
  const parsed = assertPublicHttpUrl(endpoint);
  await assertResolvedPublicHost(parsed.hostname, options.lookup ?? defaultHostnameLookup);
  const doFetch = options.fetch ?? fetch;
  const response = await doFetch(endpoint, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      ...options.headers,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
  });
  if (!response.ok) {
    console.info('[recipe-import:oembed]', { host: parsed.hostname, status: response.status, json: false });
    return null;
  }
  const text = await response.text();
  try {
    return JSON.parse(text) as OembedPayload;
  } catch {
    console.info('[recipe-import:oembed]', {
      host: parsed.hostname,
      status: response.status,
      json: false,
      chars: text.length,
      kind: /wafchallengeid|slardar/i.test(text) ? 'waf' : 'html',
    });
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchOgTags(url: string, options: FetchPublicHtmlOptions = {}) {
  try {
    const response = await fetchPublicHtml(url, options);
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 1_500_000);
    return {
      html,
      title: meta(html, ['og:title', 'twitter:title']) ?? titleTag(html),
      description: meta(html, ['og:description', 'twitter:description', 'description']),
      image: meta(html, ['og:image', 'twitter:image']),
      siteName: meta(html, ['og:site_name']),
    };
  } catch {
    return null;
  }
}

export function extractJsonObject(source: string, marker: string): Record<string, unknown> | null {
  const key = source.indexOf(marker);
  if (key < 0) return null;
  const start = source.indexOf('{', key + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  const limit = Math.min(source.length, start + 2_000_000);
  for (let i = start; i < limit; i += 1) {
    const c = source[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function meta(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const prop = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escapeReg(key)}["'][^>]+content=["']([^"']+)["']`, 'i'));
    const contentFirst = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeReg(key)}["']`, 'i'),
    );
    const raw = prop?.[1] ?? contentFirst?.[1];
    if (raw) return decodeEntities(raw);
  }
  return undefined;
}

function titleTag(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeEntities(match[1].replace(/\s+/g, ' ').trim()) : undefined;
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
