import { decodeEntities, fetchPublicHtml, type FetchPublicHtmlOptions } from '../../scrape/index.js';
import { parseFacebookCrawlerHtml } from './facebook-comments.js';
import { fetchOgTags, type VideoMetadata } from './shared.js';

const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const FACEBOOK_MOBILE_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'mbasic.facebook.com',
  'web.facebook.com',
  'touch.facebook.com',
]);

export async function fetchFacebookMetadata(
  canonicalUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<VideoMetadata | null> {
  const doFetch = options.fetch ?? fetch;
  const page = await fetchOgTags(rewriteFacebookWatchHost(canonicalUrl), {
    ...options,
    fetch: wrapFacebookFetch(doFetch),
    headers: {
      'User-Agent': IPHONE_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...options.headers,
    },
  });
  if (!page) return null;

  const fromHtml = captionFromFacebookHtml(page.html);
  const caption = pickLonger(fromHtml.caption, page.description, page.title);
  if (isFacebookLoginWall(page.title, caption, page.html)) return null;
  if (!caption || caption.replace(/\s+/g, ' ').trim().length < 12) return null;

  const authorName = fromHtml.authorName;
  const title = recipeTitleFromCaption(caption) || stripFacebookChrome(page.title) || 'Facebook video';
  const crawler = await fetchFacebookCrawlerExtract(canonicalUrl, title, options);
  const description = pickLonger(crawler.extraText, caption) ?? caption;
  return {
    title,
    description,
    authorName,
    thumbnailUrl: page.image,
    captions: caption,
    extraText: crawler.extraText,
    linkedUrls: crawler.linkedUrls,
    siteName: page.siteName ?? 'Facebook',
    hasCaptions: Boolean((crawler.extraText ?? caption).length > 40 || crawler.linkedUrls.length),
  };
}

async function fetchFacebookCrawlerExtract(
  canonicalUrl: string,
  title: string,
  options: FetchPublicHtmlOptions,
): Promise<{ extraText?: string; linkedUrls: string[] }> {
  try {
    const response = await fetchPublicHtml(toWwwFacebookUrl(canonicalUrl), {
      ...options,
      headers: {
        ...options.headers,
        'User-Agent': CRAWLER_UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!response.ok) return { linkedUrls: [] };
    const html = (await response.text()).slice(0, 1_500_000);
    const parsed = parseFacebookCrawlerHtml(html, title);
    return { extraText: parsed.extraText, linkedUrls: parsed.linkedUrls };
  } catch {
    return { linkedUrls: [] };
  }
}

function toWwwFacebookUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (FACEBOOK_MOBILE_HOSTS.has(host)) url.hostname = 'www.facebook.com';
    return url.href;
  } catch {
    return raw;
  }
}

export function rewriteFacebookWatchHost(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!FACEBOOK_MOBILE_HOSTS.has(host) || host === 'm.facebook.com') return raw;
    url.hostname = 'm.facebook.com';
    return url.href;
  } catch {
    return raw;
  }
}

function wrapFacebookFetch(doFetch: typeof fetch): typeof fetch {
  return (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return doFetch(rewriteFacebookWatchHost(raw), init);
  };
}

function captionFromFacebookHtml(html: string): { caption?: string; authorName?: string } {
  const oembedTitle =
    attrFromTag(html, 'link', 'type', 'application/json+oembed', 'title') ??
    attrFromTag(html, 'link', 'rel', 'alternate', 'title');
  if (!oembedTitle) return {};
  return splitFacebookOembedTitle(oembedTitle);
}

function splitFacebookOembedTitle(raw: string): { caption?: string; authorName?: string } {
  const decoded = decodeEntities(raw).replace(/\u00a0/g, ' ').trim();
  if (!decoded) return {};
  const withoutSite = decoded.replace(/\s+\|\s+Facebook\s*$/i, '').trim();
  const parts = withoutSite.split(/\s+\|\s+/);
  if (parts.length >= 2) {
    const authorName = parts.pop()?.trim();
    const caption = parts.join(' | ').trim();
    return { caption: caption || undefined, authorName: authorName || undefined };
  }
  return { caption: withoutSite || undefined };
}

function recipeTitleFromCaption(caption: string): string | undefined {
  const line = caption.split(/\n+/)[0]?.replace(/\s+/g, ' ').trim();
  if (!line || isFacebookLoginWall(line, line)) return undefined;
  if (line.length <= 110) return line;
  const sentence = line.match(/^(.+?[.!?])(\s|$)/);
  const candidate = (sentence?.[1] ?? line).trim();
  return candidate.length > 110 ? `${candidate.slice(0, 107).trim()}…` : candidate;
}

function stripFacebookChrome(title?: string): string | undefined {
  if (!title) return undefined;
  const cleaned = title.replace(/\s+\|\s+Facebook\s*$/i, '').trim();
  if (!cleaned || isFacebookLoginWall(cleaned, cleaned)) return undefined;
  return cleaned;
}

function isFacebookLoginWall(title?: string, description?: string, html?: string): boolean {
  const blob = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  if (/log in to facebook/.test(blob)) return true;
  if (/^error$/i.test((title ?? '').trim())) return true;
  if (html && /<title>\s*Error\s*<\/title>/i.test(html) && html.length < 4_000) return true;
  return false;
}

function pickLonger(...values: Array<string | undefined>): string | undefined {
  let best: string | undefined;
  for (const value of values) {
    const next = value?.replace(/\u00a0/g, ' ').trim();
    if (!next) continue;
    if (!best || next.length > best.length) best = next;
  }
  return best;
}

function attrFromTag(html: string, tag: string, keyName: string, keyValue: string, attr: string): string | undefined {
  const open = html.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) ?? [];
  for (const raw of open) {
    if (!new RegExp(`(?:^|\\s)${escapeReg(keyName)}=["']${escapeReg(keyValue)}["']`, 'i').test(raw)) continue;
    const quoted = raw.match(new RegExp(`(?:^|\\s)${escapeReg(attr)}=["']([\\s\\S]*?)["']`, 'i'));
    if (quoted?.[1]?.trim()) return decodeEntities(quoted[1]);
  }
  return undefined;
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
