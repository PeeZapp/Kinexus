import { assertPublicHttpUrl, decodeEntities, fetchPublicHtml } from './index.js';

export type SavedLinkType = 'recipe' | 'video' | 'article' | 'tool' | 'place' | 'product' | 'other';

function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    const host = url.hostname.toLowerCase();
    if (host.includes('youtube.com')) {
      const video = url.searchParams.get('v');
      if (video) return `https://www.youtube.com/watch?v=${video}`;
    }
    if (host.startsWith('www.')) url.hostname = host.slice(4);
    return url.href;
  } catch {
    return raw.trim();
  }
}

function inferLinkType(rawUrl: string): SavedLinkType {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (host.includes('youtube.com') || host === 'youtu.be' || host.includes('vimeo.com') || host.includes('tiktok.com')) {
      return 'video';
    }
    if (host.includes('maps.google') || host.includes('tripadvisor') || path.includes('/place')) return 'place';
    if (host.includes('github.com') || host.includes('npmjs.com') || path.includes('/docs')) return 'tool';
    if (path.includes('recipe') || host.includes('allrecipes') || host.includes('nytcooking')) return 'recipe';
    if (host.includes('amazon.') || host.includes('ebay.') || path.includes('/product') || path.includes('/dp/')) {
      return 'product';
    }
    if (path.includes('/blog') || path.includes('/article') || path.includes('/news')) return 'article';
  } catch {
    return 'other';
  }
  return 'other';
}

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

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const prop = html.match(
      new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    );
    const contentFirst = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
    );
    const raw = prop?.[1] ?? contentFirst?.[1];
    if (raw) return decodeEntities(raw);
  }
  return null;
}

function titleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeEntities(match[1].replace(/\s+/g, ' ').trim()) : null;
}

function faviconFromHtml(html: string, pageUrl: string): string | null {
  const match = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i);
  const href = match?.[1];
  if (!href) {
    try {
      return `${new URL(pageUrl).origin}/favicon.ico`;
    } catch {
      return null;
    }
  }
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return href;
  }
}

function isYouTube(url: URL): boolean {
  return url.hostname.includes('youtube.com') || url.hostname === 'youtu.be';
}

async function youtubeOembed(url: string): Promise<ScrapedLinkDraft | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      url,
      canonicalUrl: canonicalizeUrl(url),
      title: data.title ?? null,
      description: data.author_name ?? null,
      imageUrl: data.thumbnail_url ?? null,
      siteName: 'YouTube',
      faviconUrl: 'https://www.youtube.com/favicon.ico',
      linkType: 'video',
    };
  } catch {
    return null;
  }
}

export async function scrapeLinkUrl(url: string): Promise<LinkScrapeResult> {
  const parsed = assertPublicHttpUrl(url);
  if (isYouTube(parsed)) {
    const oembed = await youtubeOembed(parsed.href);
    if (oembed) return { source: 'oembed', link: oembed };
  }

  const response = await fetchPublicHtml(parsed.href);
  if ([401, 402, 403, 429].includes(response.status)) {
    return { blocked: true, source: 'blocked' };
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Could not fetch that URL (HTTP ${response.status})`), { status: 422 });
  }
  const html = (await response.text()).slice(0, 1_500_000);
  let siteName = metaContent(html, ['og:site_name']);
  if (!siteName) {
    try {
      siteName = parsed.hostname.replace(/^www\./, '');
    } catch {
      siteName = null;
    }
  }
  return {
    source: 'og',
    link: {
      url: parsed.href,
      canonicalUrl: canonicalizeUrl(parsed.href),
      title: metaContent(html, ['og:title', 'twitter:title']) ?? titleTag(html),
      description: metaContent(html, ['og:description', 'twitter:description', 'description']),
      imageUrl: metaContent(html, ['og:image', 'twitter:image']),
      siteName,
      faviconUrl: faviconFromHtml(html, parsed.href),
      linkType: inferLinkType(parsed.href),
    },
  };
}
