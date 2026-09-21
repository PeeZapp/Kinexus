import { asQuotedAmount, convertQuotedMoney, convertSearchHit, parseQuotedPrice } from './collectibles';
import type { CollectibleKind, CollectibleSearchHit, CollectibleSource } from './types';

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

const BRICK_ORIGIN = 'https://www.brickeconomy.com';
const PRICE_ORIGIN = 'https://www.pricecharting.com';

function absoluteUrl(origin: string, href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, origin).href;
  } catch {
    return null;
  }
}

function firstMatch(html: string, pattern: RegExp, group = 1): string | null {
  const match = html.match(pattern);
  const value = match?.[group];
  return value ? decodeEntities(value).replace(/\s+/g, ' ').trim() : null;
}

function quoted(raw: string | null | undefined): { amount: number; currency: string } | null {
  return parseQuotedPrice(raw);
}

function hit(partial: Partial<CollectibleSearchHit> & Pick<CollectibleSearchHit, 'kind' | 'source' | 'catalogId' | 'name' | 'sourceUrl'>): CollectibleSearchHit {
  return {
    subtitle: null,
    imageUrl: null,
    valueNew: null,
    valueUsed: null,
    retailValue: null,
    ...partial,
    currency: partial.currency ?? 'USD',
  };
}

export function parseBrickEconomySearch(html: string): CollectibleSearchHit[] {
  const results: CollectibleSearchHit[] = [];
  const seen = new Set<string>();
  const rowRe =
    /<h4><a href="(\/set\/(\d+(?:-\d+)?)\/[^"]+)">([\s\S]*?)<\/a><\/h4>([\s\S]*?)(?:<td class="ctlsets-right[\s\S]*?<small class="text-muted[^"]*">Retail<\/small>\s*([^<]+)<\/div>)?/gi;
  for (const match of html.matchAll(rowRe)) {
    const path = match[1];
    const catalogId = match[2];
    const heading = decodeEntities((match[3] ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!path || !catalogId || seen.has(catalogId)) continue;
    seen.add(catalogId);
    const rest = match[4] ?? '';
    const theme = firstMatch(rest, /Theme\s*\/\s*Subtheme<\/small>\s*([\s\S]*?)<\/div>/i);
    const themeText = theme
      ? decodeEntities(theme.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ').trim()
      : null;
    const image = firstMatch(html.slice(Math.max(0, (match.index ?? 0) - 400), match.index), /src="(\/resources\/images\/sets\/[^"]+)"/i);
    const retail = quoted(
      match[5] ?? firstMatch(html.slice(match.index ?? 0), /<small class="text-muted[^"]*">Retail<\/small>\s*([^<]+)/i),
    );
    const name = heading.replace(new RegExp(`^${catalogId.replace(/-\d+$/, '')}\\s+`), '').trim() || heading;
    results.push(
      hit({
        kind: 'lego',
        source: 'brickeconomy',
        catalogId,
        name: heading || name,
        subtitle: themeText,
        imageUrl: absoluteUrl(BRICK_ORIGIN, image),
        sourceUrl: `${BRICK_ORIGIN}${path}`,
        currency: retail?.currency,
        retailValue: retail?.amount ?? null,
      }),
    );
    if (results.length >= 12) break;
  }
  return results;
}

export function parseBrickEconomySet(html: string, fallback?: CollectibleSearchHit): CollectibleSearchHit | null {
  const path =
    firstMatch(html, /(?:property|name)=["']og:url["'][^>]+content=["']([^"']+\/set\/[^"']+)["']/i) ??
    firstMatch(html, /content=["']([^"']+\/set\/[^"']+)["'][^>]*(?:property|name)=["']og:url["']/i) ??
    firstMatch(html, /(\/set\/\d+(?:-\d+)?\/[a-z0-9-]+)/i);
  const catalogFromPage =
    firstMatch(html, /Set number<\/div><div class="col-xs-7">([^<]+)<\/div>/i) ??
    firstMatch(path ?? '', /\/set\/(\d+(?:-\d+)?)/i);
  const onSetPage = Boolean(
    catalogFromPage ||
      firstMatch(html, /<h1 class="setheader">/i) ||
      firstMatch(html, /id="ContentPlaceHolder1_PanelSetPricing"/i),
  );
  if (!onSetPage) return null;
  const catalogId = catalogFromPage ?? fallback?.catalogId;
  if (!catalogId) return null;
  const heading = firstMatch(html, /<h1 class="setheader">([^<]+)<\/h1>/i) ?? fallback?.name ?? catalogId;
  const name = firstMatch(html, /Name<\/div><div class="col-xs-7">([^<]+)<\/div>/i);
  const theme = firstMatch(html, /Theme<\/div><div class="col-xs-7">([\s\S]*?)<\/div>/i);
  const image =
    firstMatch(html, /og:image["'][^>]+content=["']([^"']+)["']/i) ??
    firstMatch(html, /src="(\/resources\/images\/sets\/[^"]+_large[^"]*)"/i);
  const panel = html.match(/id="ContentPlaceHolder1_PanelSetPricing"[\s\S]*?(?=<div id="ContentPlaceHolder1_PanelSetBuying"|<div id="ContentPlaceHolder1_PanelSetPredictions")/)?.[0] ?? html;
  const retail = quoted(firstMatch(panel, /Retail price<\/div><div class="col-xs-7[^"]*">(?:<[^>]+>)?([^<]+)/i));
  const market = quoted(firstMatch(panel, /Market price[\s\S]*?<div class="col-xs-7">([^<]+)/i));
  const newSection = panel.split(/New\/Sealed/i)[1]?.split(/Used/i)[0] ?? '';
  const usedSection = panel.split(/icon-used-med[\s\S]*?Used/i)[1] ?? panel.split(/>Used<\/span>/i)[1] ?? '';
  const valueNew =
    quoted(firstMatch(newSection, />Value<\/div><div class="col-xs-7">(?:<b>)?([^<]+)/i)) ?? market ?? retail;
  const valueUsed = quoted(firstMatch(usedSection, />Value<\/div><div class="col-xs-7">(?:<b>)?([^<]+)/i));
  const currency = valueNew?.currency ?? valueUsed?.currency ?? retail?.currency ?? fallback?.currency ?? 'USD';
  return hit({
    kind: 'lego',
    source: 'brickeconomy',
    catalogId,
    name: heading,
    subtitle: theme ? decodeEntities(theme.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : name,
    imageUrl: absoluteUrl(BRICK_ORIGIN, image) ?? fallback?.imageUrl ?? null,
    sourceUrl: absoluteUrl(BRICK_ORIGIN, path) ?? fallback?.sourceUrl ?? `${BRICK_ORIGIN}/set/${catalogId}`,
    currency,
    valueNew: valueNew?.amount ?? null,
    valueUsed: valueUsed?.amount ?? null,
    retailValue: retail?.amount ?? null,
  });
}

export function parsePriceChartingSearch(html: string, kind: CollectibleKind = 'trading_card'): CollectibleSearchHit[] {
  const results: CollectibleSearchHit[] = [];
  const seen = new Set<string>();
  const rowRe = /<tr[^>]*id="product-(\d+)"[\s\S]*?<\/tr>/gi;
  for (const match of html.matchAll(rowRe)) {
    const catalogId = match[1];
    const row = match[0];
    if (!catalogId || seen.has(catalogId)) continue;
    seen.add(catalogId);
    const href = firstMatch(row, /href="(https?:\/\/www\.pricecharting\.com\/game\/[^"]+)"/i);
    const name = firstMatch(row, /<td class="title">[\s\S]*?<a[^>]*>\s*([^<]+)/i);
    const subtitle = firstMatch(row, /class="console-in-title"[\s\S]*?<a[^>]*>\s*([^<]+)/i);
    const image = firstMatch(row, /<img class="photo"[^>]+src="([^"]+)"/i);
    const used = quoted(firstMatch(row, /class="price numeric used_price"[\s\S]*?class="js-price">([^<]*)/i));
    const neu = quoted(firstMatch(row, /class="price numeric new_price"[\s\S]*?class="js-price">([^<]*)/i));
    if (!name) continue;
    results.push(
      hit({
        kind,
        source: 'pricecharting',
        catalogId,
        name,
        subtitle,
        imageUrl: image,
        sourceUrl: href ?? `${PRICE_ORIGIN}/`,
        currency: used?.currency ?? neu?.currency,
        valueUsed: used?.amount ?? null,
        valueNew: neu?.amount ?? null,
      }),
    );
    if (results.length >= 12) break;
  }
  return results;
}

export function parsePriceChartingProduct(html: string, fallback?: CollectibleSearchHit): CollectibleSearchHit | null {
  const catalogId =
    firstMatch(html, /data-product(?:-id)?="(\d+)"/i) ??
    firstMatch(html, /product=(\d+)/i) ??
    firstMatch(html, /product-id["']?\s*[:=]\s*["']?(\d+)/i) ??
    fallback?.catalogId;
  const name =
    firstMatch(html, /<h1[^>]*class="[^"]*product_name[^"]*"[^>]*>([^<]+)/i) ??
    firstMatch(html, /(?:property|name)=["']og:title["'][^>]+content=["']([^"|]+)["']/i) ??
    firstMatch(html, /content=["']([^"|]+)["'][^>]*(?:property|name)=["']og:title["']/i) ??
    firstMatch(html, /<h1[^>]*>([^<]+)/i) ??
    fallback?.name;
  if (!catalogId || !name) return null;
  const used = quoted(
    firstMatch(html, /id="used_price"[\s\S]*?class="[^"]*js-price[^"]*">\s*([^<]+)/i) ??
      firstMatch(html, /id="used_price"[\s\S]*?class="(?:price )?js-price[^"]*">([^<]*)/i),
  );
  const neu = quoted(
    firstMatch(html, /id="new_price"[\s\S]*?class="[^"]*js-price[^"]*">\s*([^<]+)/i) ??
      firstMatch(html, /id="new_price"[\s\S]*?class="(?:price )?js-price[^"]*">([^<]*)/i),
  );
  const href =
    firstMatch(html, /(?:property|name)=["']og:url["'][^>]+content=["']([^"']+)["']/i) ??
    firstMatch(html, /content=["']([^"']+)["'][^>]*(?:property|name)=["']og:url["']/i) ??
    firstMatch(html, /canonical["'][^>]+href=["']([^"']+)["']/i);
  const image = firstMatch(html, /og:image["'][^>]+content=["']([^"']+)["']/i);
  const subtitle = firstMatch(html, /class="console[^"]*"[\s\S]*?<a[^>]*>\s*([^<]+)/i);
  return hit({
    kind: fallback?.kind ?? 'trading_card',
    source: 'pricecharting',
    catalogId,
    name: name.replace(/\s+Prices$/i, '').trim(),
    subtitle: subtitle ?? fallback?.subtitle ?? null,
    imageUrl: image ?? fallback?.imageUrl ?? null,
    sourceUrl: href ?? fallback?.sourceUrl ?? `${PRICE_ORIGIN}/`,
    currency: used?.currency ?? neu?.currency ?? fallback?.currency,
    valueUsed: used?.amount ?? fallback?.valueUsed ?? null,
    valueNew: neu?.amount ?? fallback?.valueNew ?? null,
    retailValue: fallback?.retailValue ?? null,
  });
}

export function collectibleHitFromBrickEconomyApi(data: Record<string, unknown>, currency: string): CollectibleSearchHit | null {
  const catalogId = String(data.set_number ?? '').trim();
  const name = String(data.name ?? '').trim();
  if (!catalogId || !name) return null;
  const quotedCurrency = String(data.currency ?? currency ?? 'USD').toUpperCase();
  const theme = [data.theme, data.subtheme].filter((part) => typeof part === 'string' && part.trim()).join(' / ') || null;
  const slug = `${catalogId}/${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+$/g, '');
  const retailByCurrency: Record<string, unknown> = {
    USD: data.retail_price_us,
    GBP: data.retail_price_uk,
    CAD: data.retail_price_ca,
    EUR: data.retail_price_eu,
    AUD: data.retail_price_au,
  };
  const localRetail = asQuotedAmount(retailByCurrency[quotedCurrency] ?? retailByCurrency[currency]);
  const usRetail = asQuotedAmount(data.retail_price_us);
  const hitValue = hit({
    kind: 'lego',
    source: 'brickeconomy',
    catalogId,
    name: `${catalogId.replace(/-\d+$/, '')} ${name}`.trim(),
    subtitle: theme,
    sourceUrl: `${BRICK_ORIGIN}/set/${slug}`,
    currency: quotedCurrency,
    valueNew: asQuotedAmount(data.current_value_new),
    valueUsed: asQuotedAmount(data.current_value_used),
    retailValue: localRetail ?? (usRetail != null && quotedCurrency !== 'USD' ? convertQuotedMoney(usRetail, 'USD', quotedCurrency) : usRetail),
  });
  return convertSearchHit(hitValue, currency);
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value) / 100;
}

export function collectibleHitsFromPriceChartingApi(
  products: unknown,
  kind: CollectibleKind,
  currency: string,
): CollectibleSearchHit[] {
  if (!Array.isArray(products)) return [];
  const results: CollectibleSearchHit[] = [];
  for (const item of products) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const catalogId = String(rec.id ?? '').trim();
    const name = String(rec['product-name'] ?? rec['product_name'] ?? '').trim();
    if (!catalogId || !name) continue;
    const consoleName = String(rec['console-name'] ?? rec['console_name'] ?? '').trim() || null;
    const slugConsole = (consoleName ?? 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slugName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '');
    results.push(
      convertSearchHit(
        hit({
          kind,
          source: 'pricecharting' as CollectibleSource,
          catalogId,
          name,
          subtitle: consoleName,
          sourceUrl: `${PRICE_ORIGIN}/game/${slugConsole}/${slugName}`,
          currency: 'USD',
          valueUsed: cents(rec['loose-price'] ?? rec['loose_price']),
          valueNew: cents(rec['new-price'] ?? rec['new_price']),
        }),
        currency,
      ),
    );
    if (results.length >= 12) break;
  }
  return results;
}

export function isBlockedCatalogPage(html: string): boolean {
  return /just a moment|cf-browser-verification|attention required|enable javascript and cookies to continue/i.test(html);
}

export function parseBrickEconomyMinifigSearch(html: string): CollectibleSearchHit[] {
  const results: CollectibleSearchHit[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/href="(\/minifig\/([^/"]+)\/[^"]+)"/gi)) {
    const path = match[1];
    const catalogId = decodeEntities(match[2] ?? '').trim();
    if (!path || !catalogId || seen.has(catalogId)) continue;
    seen.add(catalogId);
    const chunk = html.slice(match.index ?? 0, (match.index ?? 0) + 1800);
    const name =
      firstMatch(chunk, /setminifigpanel-name">([^<]+)/i) ??
      firstMatch(chunk, /title="(?:LEGO\s+)?([^"]+)"/i) ??
      catalogId;
    const image = firstMatch(chunk, /src="(\/resources\/images\/minifigs\/[^"]+)"/i);
    const value = quoted(firstMatch(chunk, /Value<\/small>\s*([^<]+)/i));
    results.push(
      hit({
        kind: 'minifig',
        source: 'brickeconomy',
        catalogId,
        name,
        subtitle: catalogId,
        imageUrl: absoluteUrl(BRICK_ORIGIN, image),
        sourceUrl: `${BRICK_ORIGIN}${path}`,
        currency: value?.currency,
        valueNew: value?.amount ?? null,
        valueUsed: value?.amount ?? null,
      }),
    );
    if (results.length >= 12) break;
  }
  return results;
}

export function collectibleHitsFromDiscogsSearch(results: unknown, currency: string): CollectibleSearchHit[] {
  if (!Array.isArray(results)) return [];
  const hits: CollectibleSearchHit[] = [];
  for (const item of results) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const catalogId = String(rec.id ?? '').trim();
    const name = String(rec.title ?? '').trim();
    if (!catalogId || !name) continue;
    const year = rec.year != null && String(rec.year).trim() ? String(rec.year) : null;
    const format = Array.isArray(rec.format) ? rec.format.filter((part) => typeof part === 'string').join(' / ') : null;
    const uri = typeof rec.uri === 'string' ? rec.uri : '';
    const image = typeof rec.cover_image === 'string' ? rec.cover_image : typeof rec.thumb === 'string' ? rec.thumb : null;
    hits.push(
      convertSearchHit(
        hit({
          kind: 'vinyl',
          source: 'discogs',
          catalogId,
          name,
          subtitle: [year, format].filter(Boolean).join(' · ') || null,
          imageUrl: image && !image.includes('spacer.gif') ? image : null,
          sourceUrl: uri ? `https://www.discogs.com${uri}` : `https://www.discogs.com/release/${catalogId}`,
          currency,
        }),
        currency,
      ),
    );
    if (hits.length >= 8) break;
  }
  return hits;
}

export function applyDiscogsStats(
  item: CollectibleSearchHit,
  stats: unknown,
  currency: string,
): CollectibleSearchHit {
  if (!stats || typeof stats !== 'object') return convertSearchHit(item, currency);
  const rec = stats as Record<string, unknown>;
  const lowest = rec.lowest_price;
  const amount =
    lowest && typeof lowest === 'object'
      ? typeof (lowest as { value?: unknown }).value === 'number'
        ? (lowest as { value: number }).value
        : null
      : typeof rec.lowest_price === 'number'
        ? rec.lowest_price
        : null;
  const fromCurrency =
    lowest && typeof lowest === 'object' && typeof (lowest as { currency?: unknown }).currency === 'string'
      ? (lowest as { currency: string }).currency
      : 'USD';
  if (amount == null || amount <= 0) return convertSearchHit(item, currency);
  return convertSearchHit(
    {
      ...item,
      currency: fromCurrency,
      valueNew: amount,
      valueUsed: amount,
    },
    currency,
  );
}

export function parseStockXSearch(html: string): CollectibleSearchHit[] {
  if (isBlockedCatalogPage(html)) return [];
  const results: CollectibleSearchHit[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/"url"\s*:\s*"(https:\/\/stockx\.com\/[^"]+)"[\s\S]{0,400}?"name"\s*:\s*"([^"]+)"/gi)) {
    const sourceUrl = match[1];
    const name = decodeEntities(match[2] ?? '').trim();
    if (!sourceUrl || !name) continue;
    const slug = sourceUrl.replace(/^https:\/\/stockx\.com\//i, '').replace(/\/$/, '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    results.push(
      hit({
        kind: 'sneaker',
        source: 'stockx',
        catalogId: slug,
        name,
        sourceUrl,
        currency: 'USD',
      }),
    );
    if (results.length >= 8) break;
  }
  return results;
}

export function parseChrono24Search(html: string): CollectibleSearchHit[] {
  if (isBlockedCatalogPage(html)) return [];
  const results: CollectibleSearchHit[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/href="(https:\/\/www\.chrono24\.[^"]+\/[^"]+-id(\d+)\.html[^"]*)"/gi)) {
    const sourceUrl = match[1]?.split('?')[0];
    const catalogId = match[2];
    if (!sourceUrl || !catalogId || seen.has(catalogId)) continue;
    seen.add(catalogId);
    const chunk = html.slice(Math.max(0, (match.index ?? 0) - 200), (match.index ?? 0) + 900);
    const name =
      firstMatch(chunk, /(?:title|alt)="([^"]{8,120})"/i) ??
      firstMatch(chunk, /<h3[^>]*>\s*([^<]+)/i) ??
      `Watch ${catalogId}`;
    const price = quoted(firstMatch(chunk, /(?:price|Price)[^<]{0,40}([£€$A]?\s?[\d,.]+)/i));
    results.push(
      hit({
        kind: 'watch',
        source: 'chrono24',
        catalogId,
        name,
        sourceUrl,
        currency: price?.currency,
        valueUsed: price?.amount ?? null,
        valueNew: price?.amount ?? null,
      }),
    );
    if (results.length >= 8) break;
  }
  return results;
}

function parseRrpList(raw: string | null | undefined): { amount: number; currency: string } | null {
  if (!raw) return null;
  const text = decodeEntities(raw.replace(/<[^>]+>/g, ' '));
  return quoted(text.match(/\$[\d,.]+/)?.[0]) ?? quoted(text.match(/£[\d,.]+/)?.[0]) ?? quoted(text.match(/€[\d,.]+/)?.[0]) ?? quoted(text);
}

const BRICKSET_ORIGIN = 'https://brickset.com';

export function parseBricksetSearch(html: string): CollectibleSearchHit[] {
  const results: CollectibleSearchHit[] = [];
  const seen = new Set<string>();
  const rowRe = /href="(\/sets\/(\d+(?:-\d+)?)\/[^"]+)"><span>(\d+):?\s*<\/span>\s*([^<]+)/gi;
  for (const match of html.matchAll(rowRe)) {
    const path = match[1];
    const catalogId = match[2];
    const name = decodeEntities((match[4] ?? '').trim());
    if (!path || !catalogId || !name || seen.has(catalogId)) continue;
    seen.add(catalogId);
    const start = match.index ?? 0;
    const chunk = html.slice(start, start + 3600);
    const before = html.slice(Math.max(0, start - 1800), start);
    const themeHref = firstMatch(chunk, /href="\/sets\/theme-([^"]+)"/i);
    const theme = themeHref ? decodeEntities(themeHref.replace(/-/g, ' ')) : null;
    const rrp = parseRrpList(firstMatch(chunk, /<dt>RRP<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i));
    const image =
      firstMatch(before, /(https:\/\/images\.brickset\.com\/sets\/[^"']+\.jpg)/i) ??
      `https://images.brickset.com/sets/small/${catalogId}.jpg`;
    results.push(
      hit({
        kind: 'lego',
        source: 'brickset',
        catalogId,
        name: `${catalogId.replace(/-\d+$/, '')} ${name}`.trim(),
        subtitle: theme,
        imageUrl: image,
        sourceUrl: `${BRICKSET_ORIGIN}${path}`,
        currency: rrp?.currency,
        retailValue: rrp?.amount ?? null,
        valueNew: rrp?.amount ?? null,
      }),
    );
    if (results.length >= 12) break;
  }
  return results;
}

export function parseBricksetSet(html: string, fallback?: CollectibleSearchHit): CollectibleSearchHit | null {
  const catalogId =
    firstMatch(html, /og:url["'][^>]+content=["'][^"']*\/sets\/(\d+(?:-\d+)?)/i) ??
    firstMatch(html, /\/sets\/(\d+(?:-\d+)?)/i) ??
    fallback?.catalogId;
  const heading = firstMatch(html, /<h1>([^<]+)<\/h1>/i) ?? fallback?.name;
  if (!catalogId || !heading) return null;
  const theme = firstMatch(html, /<dt>Theme<\/dt>\s*<dd>[\s\S]*?>([^<]+)<\/a>/i);
  const subtheme = firstMatch(html, /<dt>Subtheme<\/dt>\s*<dd>[\s\S]*?>([^<]+)<\/a>/i);
  const rrp = parseRrpList(firstMatch(html, /<dt>RRP<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i));
  const image =
    firstMatch(html, /og:image["'][^>]+content=["']([^"']+)/i) ??
    firstMatch(html, /(https:\/\/images\.brickset\.com\/sets\/images\/[^"']+)/i) ??
    fallback?.imageUrl;
  const path = firstMatch(html, /og:url["'][^>]+content=["']([^"']+\/sets\/[^"']+)/i);
  return hit({
    kind: 'lego',
    source: 'brickset',
    catalogId,
    name: heading,
    subtitle: [theme, subtheme].filter(Boolean).join(' / ') || fallback?.subtitle || null,
    imageUrl: image ?? `https://images.brickset.com/sets/images/${catalogId}.jpg`,
    sourceUrl: path ?? fallback?.sourceUrl ?? `${BRICKSET_ORIGIN}/sets/${catalogId}`,
    currency: rrp?.currency ?? fallback?.currency,
    retailValue: rrp?.amount ?? fallback?.retailValue ?? null,
    valueNew: rrp?.amount ?? fallback?.valueNew ?? null,
    valueUsed: fallback?.valueUsed ?? null,
  });
}

export function parseBricksetMinifigSearch(html: string): CollectibleSearchHit[] {
  const results: CollectibleSearchHit[] = [];
  const seen = new Set<string>();
  const rowRe = /href="(\/minifigs\/([^/"]+)\/[^"]+)"><span>([^<]+)<\/span>\s*([^<]+)/gi;
  for (const match of html.matchAll(rowRe)) {
    const path = match[1];
    const catalogId = decodeEntities(match[2] ?? '').trim();
    const name = decodeEntities((match[4] ?? '').trim());
    if (!path || !catalogId || !name || seen.has(catalogId)) continue;
    seen.add(catalogId);
    const start = match.index ?? 0;
    const chunk = html.slice(start, start + 2200);
    const before = html.slice(Math.max(0, start - 1200), start);
    const valueNew = quoted(firstMatch(chunk, /<dt>Value new<\/dt>\s*<dd>[\s\S]*?(~?\$[\d,.]+)/i));
    const valueUsed = quoted(firstMatch(chunk, /<dt>Value used<\/dt>\s*<dd>[\s\S]*?(~?\$[\d,.]+)/i));
    const image = firstMatch(before, /(https:\/\/images\.brickset\.com\/minifigs\/[^"']+\.jpg)/i);
    results.push(
      hit({
        kind: 'minifig',
        source: 'brickset',
        catalogId,
        name,
        subtitle: catalogId,
        imageUrl: image,
        sourceUrl: `${BRICKSET_ORIGIN}${path}`,
        currency: valueNew?.currency ?? valueUsed?.currency,
        valueNew: valueNew?.amount ?? null,
        valueUsed: valueUsed?.amount ?? null,
      }),
    );
    if (results.length >= 12) break;
  }
  return results;
}

function jsonLdObjects(html: string): Record<string, unknown>[] {
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

function offerPrice(offers: unknown): { amount: number; currency: string; used: boolean } | null {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of list) {
    if (!offer || typeof offer !== 'object') continue;
    const rec = offer as Record<string, unknown>;
    const spec =
      rec.priceSpecification && typeof rec.priceSpecification === 'object'
        ? (rec.priceSpecification as Record<string, unknown>)
        : null;
    const amountRaw = rec.price ?? rec.lowPrice ?? spec?.price;
    const parsed = quoted(amountRaw == null ? null : String(amountRaw));
    if (!parsed) continue;
    const currency = String(rec.priceCurrency ?? spec?.priceCurrency ?? parsed.currency ?? 'USD').toUpperCase();
    const condition = String(rec.itemCondition ?? '');
    return { amount: parsed.amount, currency, used: /used/i.test(condition) };
  }
  return null;
}

function listingPrice(html: string, condition: RegExp): { amount: number; currency: string } | null {
  let best: { amount: number; currency: string } | null = null;
  for (const match of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const row = match[0];
    if (!condition.test(row)) continue;
    const price = quoted(firstMatch(row, /<span class=['"]price['"]>([^<]+)/i));
    if (!price) continue;
    if (!best || price.amount < best.amount) best = price;
  }
  return best;
}

export function parseBrickOwlProduct(html: string, fallback?: CollectibleSearchHit): CollectibleSearchHit | null {
  const valueNew = listingPrice(html, /New<br\s*\/?>\(Sealed\)/i);
  const valueUsed = listingPrice(html, /Used<br\s*\/?>\(Complete\)/i);
  for (const node of jsonLdObjects(html)) {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (!types.some((type) => typeof type === 'string' && type.toLowerCase().includes('product'))) continue;
    const name = typeof node.name === 'string' ? decodeEntities(node.name) : fallback?.name;
    const offer = offerPrice(node.offers);
    const catalogId =
      fallback?.catalogId ??
      (Array.isArray(node.mpn) ? String(node.mpn[0] ?? '') : typeof node.mpn === 'string' ? node.mpn : '');
    if (!name || !catalogId) continue;
    const image = typeof node.image === 'string' ? node.image : fallback?.imageUrl ?? null;
    const offerUrl = node.offers && typeof node.offers === 'object' && !Array.isArray(node.offers) && typeof (node.offers as { url?: unknown }).url === 'string'
      ? (node.offers as { url: string }).url
      : null;
    const usedOffer = offer?.used ? offer : null;
    const newOffer = offer && !offer.used ? offer : null;
    const currency =
      valueNew?.currency ??
      valueUsed?.currency ??
      offer?.currency ??
      fallback?.currency;
    return hit({
      kind: fallback?.kind ?? 'lego',
      source: fallback?.source ?? 'brickset',
      catalogId,
      name,
      subtitle: typeof node.category === 'string' ? node.category : fallback?.subtitle ?? null,
      imageUrl: image,
      sourceUrl: fallback?.sourceUrl ?? offerUrl ?? '',
      currency,
      valueUsed: valueUsed?.amount ?? usedOffer?.amount ?? fallback?.valueUsed ?? null,
      valueNew: valueNew?.amount ?? newOffer?.amount ?? fallback?.valueNew ?? null,
      retailValue: fallback?.retailValue ?? null,
    });
  }
  if (!fallback || (!valueNew && !valueUsed)) return null;
  return hit({
    ...fallback,
    currency: valueNew?.currency ?? valueUsed?.currency ?? fallback.currency,
    valueNew: valueNew?.amount ?? fallback.valueNew ?? null,
    valueUsed: valueUsed?.amount ?? fallback.valueUsed ?? null,
  });
}

export function mergeCollectibleHits(base: CollectibleSearchHit, extra: CollectibleSearchHit | null | undefined): CollectibleSearchHit {
  if (!extra) return base;
  const converted = convertSearchHit(extra, base.currency);
  return {
    ...base,
    name: extra.name || base.name,
    subtitle: extra.subtitle ?? base.subtitle,
    imageUrl: extra.imageUrl ?? base.imageUrl,
    valueNew: converted.valueNew ?? base.valueNew,
    valueUsed: converted.valueUsed ?? base.valueUsed,
    retailValue: converted.retailValue ?? base.retailValue,
    currency: base.currency,
  };
}
