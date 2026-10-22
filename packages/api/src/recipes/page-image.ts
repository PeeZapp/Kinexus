import { imageFromSchema } from './parse.js';

/** Recipe photo published on the page: schema.org image, then the social preview image. */
export function imageUrlFromRecipeHtml(html: string, pageUrl: string): string | undefined {
  const schema = absoluteHttpImage(jsonLdImage(html), pageUrl);
  const preview = absoluteHttpImage(openGraphImage(html), pageUrl);
  return [schema, preview].find((url) => url && !isGenericSiteImage(url));
}

/** Site marks and default project icons are not a photo of the dish. */
export function isGenericSiteImage(url: string): boolean {
  try {
    return /logo|favicon|wordmark|wikimedia-button/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function absoluteHttpImage(raw: string | undefined, base: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = decodeBasicEntities(raw).trim();
  if (!trimmed || trimmed.startsWith('data:')) return undefined;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (/\.svg$/i.test(url.pathname)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function jsonLdImage(html: string): string | undefined {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const raw = (match[1] ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!raw) continue;
    try {
      const image = imageFromLdTree(JSON.parse(raw) as unknown);
      if (image) return image;
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return undefined;
}

function imageFromLdTree(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const image = imageFromLdTree(item);
      if (image) return image;
    }
    return undefined;
  }
  const rec = node as Record<string, unknown>;
  if (isRecipeType(rec['@type'])) {
    const image = imageFromSchema(rec.image);
    if (image) return image;
  }
  const graph = rec['@graph'];
  if (graph) return imageFromLdTree(graph);
  return undefined;
}

function isRecipeType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((item) => typeof item === 'string' && item.toLowerCase().includes('recipe'));
}

function openGraphImage(html: string): string | undefined {
  for (const key of ['og:image', 'og:image:url', 'twitter:image']) {
    const content = metaContent(html, key);
    if (content) return content;
  }
  return undefined;
}

function metaContent(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prop = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'));
  const contentFirst = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  );
  const raw = prop?.[1] ?? contentFirst?.[1];
  return raw ? decodeBasicEntities(raw) : undefined;
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
