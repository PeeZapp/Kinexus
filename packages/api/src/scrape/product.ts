import { assertPublicHttpUrl, decodeEntities, fetchPublicHtml } from './index.js';

function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : null;
  const cleaned = String(raw).replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '');
  const normalized =
    cleaned.includes(',') && !cleaned.includes('.') ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

export type ProductScrapeResult =
  | { source: 'json-ld' | 'og'; product: ScrapedProductDraft }
  | { source: 'blocked'; blocked: true };

export type ScrapedProductDraft = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  storeName: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  sku: string | null;
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

function jsonLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const scriptMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
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
  if (typeof value === 'object' && value && 'url' in value) return String((value as { url?: string }).url ?? '') || null;
  return null;
}

function priceFromUnknown(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'string') return parsePrice(value);
  if (typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  return priceFromUnknown(rec.price ?? rec.value ?? rec.amount ?? rec.lowPrice ?? rec.minPrice);
}

function priceFromOffers(offers: unknown): { current: number | null; original: number | null } {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of list) {
    if (!offer || typeof offer !== 'object') continue;
    const rec = offer as Record<string, unknown>;
    const current = priceFromUnknown(rec.price ?? rec.lowPrice ?? rec.priceSpecification);
    const original = priceFromUnknown(rec.highPrice ?? rec.priceSpecification);
    if (current != null) return { current, original: original != null && original > current ? original : null };
  }
  return { current: null, original: null };
}

function priceFromItemprop(html: string): number | null {
  return (
    parsePrice(html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)/i)?.[1]) ??
    parsePrice(html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i)?.[1]) ??
    parsePrice(html.match(/itemprop=["']price["'][^>]*>\s*([^<]+)/i)?.[1])
  );
}

function priceFromEmbeddedJson(html: string): number | null {
  return (
    parsePrice(html.match(/"price"\s*:\s*\{\s*"amount"\s*:\s*"([^"]+)"/i)?.[1]) ??
    parsePrice(html.match(/"priceAmount"\s*:\s*"?([\d.]+)/i)?.[1])
  );
}

function coalesceProduct(...parts: Array<ScrapedProductDraft | null | undefined>): ScrapedProductDraft {
  const merged: ScrapedProductDraft = {
    title: null,
    description: null,
    imageUrl: null,
    storeName: null,
    currentPrice: null,
    originalPrice: null,
    sku: null,
  };
  for (const part of parts) {
    if (!part) continue;
    merged.title = merged.title || part.title;
    merged.description = merged.description || part.description;
    merged.imageUrl = merged.imageUrl || part.imageUrl;
    merged.storeName = merged.storeName || (typeof part.storeName === 'string' ? part.storeName : null);
    merged.currentPrice = merged.currentPrice ?? part.currentPrice;
    merged.originalPrice = merged.originalPrice ?? part.originalPrice;
    merged.sku = merged.sku || part.sku;
  }
  return merged;
}

function productFromJsonLd(html: string): ScrapedProductDraft | null {
  for (const node of jsonLdNodes(html)) {
    const types = typeList(node['@type']);
    if (!types.some((type) => type.includes('product'))) continue;
    const offers = priceFromOffers(node.offers);
    return {
      title: typeof node.name === 'string' ? node.name : null,
      description: typeof node.description === 'string' ? node.description : null,
      imageUrl: imageFromUnknown(node.image),
      storeName:
        typeof node.brand === 'string'
          ? node.brand
          : node.brand && typeof node.brand === 'object' && typeof (node.brand as { name?: unknown }).name === 'string'
            ? String((node.brand as { name: string }).name)
            : null,
      currentPrice: offers.current,
      originalPrice: offers.original,
      sku: typeof node.sku === 'string' ? node.sku : typeof node.mpn === 'string' ? node.mpn : null,
    };
  }
  return null;
}

function productFromOg(html: string, pageUrl: string): ScrapedProductDraft {
  let storeName = metaContent(html, ['og:site_name']);
  if (!storeName) {
    try {
      storeName = new URL(pageUrl).hostname.replace(/^www\./, '');
    } catch {
      storeName = null;
    }
  }
  const current = parsePrice(metaContent(html, ['product:price:amount', 'og:price:amount', 'twitter:data1']) ?? '');
  const original = parsePrice(metaContent(html, ['product:original_price:amount', 'og:original_price']) ?? '');
  return {
    title: metaContent(html, ['og:title', 'twitter:title']) ?? titleTag(html),
    description: metaContent(html, ['og:description', 'twitter:description', 'description']),
    imageUrl: metaContent(html, ['og:image', 'twitter:image']),
    storeName,
    currentPrice: current,
    originalPrice: original && current != null && original > current ? original : null,
    sku: metaContent(html, ['product:retailer_item_id', 'product:sku']),
  };
}

export async function scrapeProductUrl(url: string): Promise<ProductScrapeResult> {
  const parsed = assertPublicHttpUrl(url);
  const response = await fetchPublicHtml(parsed.href);
  if ([401, 402, 403, 429].includes(response.status)) {
    return { blocked: true, source: 'blocked' };
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Could not fetch that URL (HTTP ${response.status})`), { status: 422 });
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    throw Object.assign(new Error('URL does not appear to be a webpage'), { status: 422 });
  }
  const html = (await response.text()).slice(0, 2_000_000);
  const jsonLd = productFromJsonLd(html);
  const og = productFromOg(html, parsed.href);
  const product = coalesceProduct(jsonLd, og, {
    title: null,
    description: null,
    imageUrl: null,
    storeName: null,
    currentPrice: priceFromItemprop(html) ?? priceFromEmbeddedJson(html),
    originalPrice: null,
    sku: null,
  });
  if (!product.title) return { source: 'og', product: og };
  return { source: jsonLd?.title ? 'json-ld' : 'og', product };
}
