import { canonicalizeUrl, inferLinkType, normalizeRecipeUrl, type SavedLinkType } from '@kinexus/domain';

import { assertPublicHttpUrl, decodeEntities, fetchPublicHtml, type FetchPublicHtmlOptions } from './index.js';
import { polishSharePreview } from './social-title.js';
import { assertResolvedPublicHost, defaultHostnameLookup } from './ssrf.js';

export type LinkScrapeResult =
  | { source: 'oembed' | 'og'; link: ScrapedLinkDraft }
  | { source: 'blocked'; blocked: true };

export type ScrapedLinkDraft = {
  url: string;
  canonicalUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  linkType: SavedLinkType;
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function absUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function attrMap(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) {
    const key = match[1]?.toLowerCase();
    if (!key || key === 'meta' || key === 'link') continue;
    attrs[key] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function metaContent(html: string, keys: string[]): string | null {
  const want = new Set(keys.map((key) => key.toLowerCase()));
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attrMap(match[0]);
    const name = (attrs.property || attrs.name || '').toLowerCase();
    if (!want.has(name)) continue;
    const content = attrs.content?.trim();
    if (content) return decodeEntities(content);
  }
  return null;
}

function titleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeEntities(match[1].replace(/\s+/g, ' ').trim()) : null;
}

function faviconFromHtml(html: string, pageUrl: string): string | null {
  let href: string | null = null;
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attrMap(match[0]);
    const rel = (attrs.rel || '').toLowerCase();
    if (rel.includes('icon')) {
      href = attrs.href || null;
      if (rel.includes('apple-touch-icon') && href) break;
    }
  }
  if (!href) {
    try {
      return `${new URL(pageUrl).origin}/favicon.ico`;
    } catch {
      return null;
    }
  }
  return absUrl(href, pageUrl);
}

function oembedHrefFromHtml(html: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attrMap(match[0]);
    const type = (attrs.type || '').toLowerCase();
    if (type.includes('json+oembed') && attrs.href) return attrs.href;
  }
  return null;
}

function jsonLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse((match[1] ?? '').trim()) as unknown;
      const queue: unknown[] = [data];
      while (queue.length) {
        const item = queue.shift();
        if (!item) continue;
        if (Array.isArray(item)) {
          queue.push(...item);
          continue;
        }
        if (typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        nodes.push(rec);
        if (rec['@graph']) queue.push(rec['@graph']);
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return nodes;
}

function typeList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [value];
  return raw.filter((item): item is string => typeof item === 'string').map((item) => item.toLowerCase());
}

function imageFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return imageFromUnknown(value[0]);
  if (typeof value === 'object' && 'url' in value) return String((value as { url?: unknown }).url ?? '') || null;
  return null;
}

function textFromUnknown(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
}

function linkFromJsonLd(html: string): Partial<ScrapedLinkDraft> | null {
  const ranked = jsonLdNodes(html)
    .map((node) => {
      const types = typeList(node['@type']);
      const rank = types.some((type) => type.includes('recipe'))
        ? 5
        : types.some((type) => type.includes('product'))
          ? 4
          : types.some((type) => type.includes('video'))
            ? 3
            : types.some((type) => type.includes('article') || type.includes('blog'))
              ? 2
              : types.some((type) => type.includes('webpage') || type.includes('itempage'))
                ? 1
                : 0;
      return { node, types, rank };
    })
    .filter((item) => item.rank > 0)
    .sort((a, b) => b.rank - a.rank);
  const best = ranked[0];
  if (!best) return null;
  const { node, types } = best;
  const linkType: SavedLinkType | undefined = types.some((type) => type.includes('recipe'))
    ? 'recipe'
    : types.some((type) => type.includes('product'))
      ? 'product'
      : types.some((type) => type.includes('video'))
        ? 'video'
        : types.some((type) => type.includes('article') || type.includes('blog'))
          ? 'article'
          : undefined;
  return {
    title: textFromUnknown(node.headline) || textFromUnknown(node.name) || textFromUnknown(node.title),
    description: textFromUnknown(node.description),
    imageUrl: imageFromUnknown(node.image) || imageFromUnknown(node.thumbnailUrl),
    siteName: textFromUnknown(node.publisher) || textFromUnknown(node.author),
    linkType,
  };
}

function typeFromOg(ogType: string | null, fallback: SavedLinkType): SavedLinkType {
  const value = (ogType ?? '').toLowerCase();
  if (value.startsWith('video')) return 'video';
  if (value.includes('article') || value.includes('blog')) return 'article';
  if (value.includes('product')) return 'product';
  if (value.includes('place') || value.includes('business')) return 'place';
  if (value.includes('recipe')) return 'recipe';
  return fallback;
}

function mergeLink(base: ScrapedLinkDraft, ...parts: Array<Partial<ScrapedLinkDraft> | null | undefined>): ScrapedLinkDraft {
  const next = { ...base };
  for (const part of parts) {
    if (!part) continue;
    next.title = next.title || part.title || null;
    next.description = next.description || part.description || null;
    next.imageUrl = next.imageUrl || part.imageUrl || null;
    next.siteName = next.siteName || part.siteName || null;
    next.faviconUrl = next.faviconUrl || part.faviconUrl || null;
    if (part.linkType && next.linkType === 'other') next.linkType = part.linkType;
  }
  return next;
}

function platformOembedUrl(pageUrl: string): string | null {
  try {
    const parsed = new URL(pageUrl);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const encoded = encodeURIComponent(pageUrl);
    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
      return `https://www.youtube.com/oembed?format=json&url=${encoded}`;
    }
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      return `https://www.tiktok.com/oembed?url=${encoded}`;
    }
    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
      return `https://vimeo.com/api/oembed.json?url=${encoded}`;
    }
    return null;
  } catch {
    return null;
  }
}

type OembedPayload = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  provider_name?: string;
};

async function fetchOembedJson(endpoint: string, options: FetchPublicHtmlOptions): Promise<OembedPayload | null> {
  try {
    const parsed = assertPublicHttpUrl(endpoint);
    await assertResolvedPublicHost(parsed.hostname, options.lookup ?? defaultHostnameLookup);
    const doFetch = options.fetch ?? fetch;
    const response = await doFetch(parsed.href, {
      headers: {
        Accept: 'application/json',
        'User-Agent': BROWSER_UA,
        ...options.headers,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as OembedPayload;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function draftFromOembed(pageUrl: string, canonicalUrl: string, data: OembedPayload, siteFallback: string | null): ScrapedLinkDraft {
  return {
    url: pageUrl,
    canonicalUrl,
    title: data.title?.trim() || data.author_name?.trim() || null,
    description: data.author_name?.trim() || null,
    imageUrl: data.thumbnail_url ?? null,
    siteName: data.provider_name?.trim() || siteFallback,
    faviconUrl: null,
    linkType: inferLinkType(canonicalUrl),
  };
}

function hostSiteName(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function emptyDraft(pageUrl: string, canonicalUrl: string): ScrapedLinkDraft {
  return {
    url: pageUrl,
    canonicalUrl,
    title: null,
    description: null,
    imageUrl: null,
    siteName: null,
    faviconUrl: null,
    linkType: inferLinkType(canonicalUrl),
  };
}

function canonicalPageUrl(raw: string): { href: string; canonicalUrl: string } {
  const parsed = assertPublicHttpUrl(raw);
  try {
    const normalized = normalizeRecipeUrl(parsed.href);
    return { href: parsed.href, canonicalUrl: normalized.canonicalUrl };
  } catch {
    return { href: parsed.href, canonicalUrl: canonicalizeUrl(parsed.href) };
  }
}

function usableTitle(raw: string | null | undefined): string | null {
  const title = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (title.length < 3) return null;
  if (/^[-–—|•.]+\s+\S+(\s+\S+)?$/u.test(title)) return null;
  if (/^(youtube|instagram|tiktok|facebook|twitter|x)$/i.test(title)) return null;
  return title;
}

function applyHtml(draft: ScrapedLinkDraft, html: string, href: string, canonicalUrl: string): ScrapedLinkDraft {
  const jsonLd = linkFromJsonLd(html);
  if (jsonLd?.title) jsonLd.title = usableTitle(jsonLd.title);
  if (jsonLd?.imageUrl) jsonLd.imageUrl = absUrl(jsonLd.imageUrl, href);
  const ogType = metaContent(html, ['og:type']);
  const og: Partial<ScrapedLinkDraft> = {
    title: usableTitle(metaContent(html, ['og:title', 'twitter:title'])),
    description: metaContent(html, ['og:description', 'twitter:description', 'description']),
    imageUrl: absUrl(metaContent(html, ['og:image', 'og:image:url', 'twitter:image']), href),
    siteName: metaContent(html, ['og:site_name']),
    faviconUrl: faviconFromHtml(html, href),
    linkType: typeFromOg(ogType, inferLinkType(canonicalUrl)),
  };
  const next = mergeLink(draft, og, jsonLd, {
    title: usableTitle(titleTag(html)),
    faviconUrl: faviconFromHtml(html, href),
  });
  if (next.imageUrl) next.imageUrl = absUrl(next.imageUrl, href);
  if (!next.faviconUrl) next.faviconUrl = faviconFromHtml(html, href);
  if (!next.siteName) next.siteName = hostSiteName(canonicalUrl);
  return next;
}

function isCompleteDraft(draft: ScrapedLinkDraft): boolean {
  return Boolean(usableTitle(draft.title) && draft.imageUrl);
}

function wantsRenderedRecovery(canonicalUrl: string, draft: ScrapedLinkDraft): boolean {
  if (isCompleteDraft(draft)) return false;
  try {
    const host = new URL(canonicalUrl).hostname.replace(/^www\./i, '').toLowerCase();
    return (
      host === 'youtu.be' ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.watch' ||
      host === 'fb.com'
    );
  } catch {
    return false;
  }
}

async function recoverRenderedHtml(url: string): Promise<string | null> {
  const { fetchHtmlViaResidentialProxy, residentialProxyConfigured } = await import('./residential-proxy.js');
  const { fetchHtmlViaPlaywright, playwrightEnabled } = await import('./playwright-fetch.js');
  if (residentialProxyConfigured()) {
    const html = await fetchHtmlViaResidentialProxy(url);
    if (html) return html;
  }
  if (playwrightEnabled()) {
    const html = await fetchHtmlViaPlaywright(url);
    if (html) return html;
  }
  return null;
}

export async function scrapeLinkUrl(url: string, options: FetchPublicHtmlOptions = {}): Promise<LinkScrapeResult> {
  const { href, canonicalUrl } = canonicalPageUrl(url);
  let draft = emptyDraft(href, canonicalUrl);
  let usedOembed = false;

  const platformOembed = platformOembedUrl(canonicalUrl);
  if (platformOembed) {
    const data = await fetchOembedJson(platformOembed, options);
    if (data?.title || data?.thumbnail_url) {
      draft = mergeLink(draft, draftFromOembed(href, canonicalUrl, data, draft.siteName));
      if (!draft.siteName) draft.siteName = hostSiteName(canonicalUrl);
      usedOembed = Boolean(draft.title || draft.imageUrl);
      if (isCompleteDraft(draft)) return { source: 'oembed', link: finishDraft(draft, canonicalUrl) };
    }
  }

  const response = await fetchPublicHtml(href, options);
  let html = '';
  const blockedStatus = [401, 402, 403, 429].includes(response.status);
  if (response.ok) {
    html = (await response.text()).slice(0, 1_500_000);
  }

  const discovered = html ? oembedHrefFromHtml(html) : null;
  if (discovered) {
    const data = await fetchOembedJson(new URL(discovered, href).href, options);
    if (data?.title || data?.thumbnail_url) {
      draft = mergeLink(draft, draftFromOembed(href, canonicalUrl, data, draft.siteName));
      usedOembed = true;
    }
  }
  if (html) draft = applyHtml(draft, html, href, canonicalUrl);

  if (!options.fetch && wantsRenderedRecovery(canonicalUrl, draft)) {
    const recovered = await recoverRenderedHtml(canonicalUrl);
    if (recovered) draft = applyHtml(draft, recovered.slice(0, 1_500_000), canonicalUrl, canonicalUrl);
  }

  draft = finishDraft(draft, canonicalUrl);
  if (isCompleteDraft(draft) || draft.title || draft.imageUrl) {
    return { source: usedOembed ? 'oembed' : 'og', link: draft };
  }
  if (blockedStatus) return { blocked: true, source: 'blocked' };
  if (!response.ok) {
    throw Object.assign(new Error(`Could not fetch that URL (HTTP ${response.status})`), { status: 422 });
  }
  return { source: 'og', link: draft };
}

function finishDraft(draft: ScrapedLinkDraft, canonicalUrl: string): ScrapedLinkDraft {
  const next = polishSharePreview(draft, canonicalUrl);
  if (!next.siteName) next.siteName = hostSiteName(canonicalUrl);
  return next;
}
