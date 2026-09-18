import {
  applyDiscogsStats,
  collectibleHitFromBrickEconomyApi,
  collectibleHitsFromDiscogsSearch,
  collectibleHitsFromPriceChartingApi,
  convertSearchHit,
  isBlockedCatalogPage,
  isCollectibleKind,
  looksLikeLegoSetNumber,
  brickOwlSetUrl,
  parseBrickEconomyMinifigSearch,
  parseBrickEconomySearch,
  parseBrickEconomySet,
  parseBricksetMinifigSearch,
  parseBricksetSearch,
  parseBricksetSet,
  parseBrickOwlProduct,
  mergeCollectibleHits,
  parseChrono24Search,
  parsePriceChartingProduct,
  parsePriceChartingSearch,
  parseStockXSearch,
  type CollectibleKind,
  type CollectibleSearchHit,
} from '@kinexus/domain';

import { fetchPublicHtml } from './index.js';

const BRICK_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DISCOGS_UA = 'KinexusCollectibles/1.0 +https://kinexus.app';

const PRICECHARTING_KINDS = new Set<CollectibleKind>([
  'trading_card',
  'video_game',
  'comic',
  'funko',
  'coin',
  'other',
]);

function brickKey(): string {
  return process.env.BRICKECONOMY_API_KEY?.trim() ?? '';
}

function priceChartingToken(): string {
  return process.env.PRICECHARTING_TOKEN?.trim() ?? '';
}

function discogsToken(): string {
  return process.env.DISCOGS_TOKEN?.trim() ?? '';
}

function requestedCurrency(raw: string | null | undefined): string {
  const code = raw?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : 'AUD';
}

async function htmlFrom(url: string): Promise<string | null> {
  try {
    const response = await fetchPublicHtml(url);
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 2_000_000);
    if (isBlockedCatalogPage(html)) return null;
    return html;
  } catch {
    return null;
  }
}

async function jsonFrom(url: string, headers: Record<string, string>): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function brickSetFromApi(setNumber: string, currency: string): Promise<CollectibleSearchHit | null> {
  const key = brickKey();
  if (!key) return null;
  const url = `https://www.brickeconomy.com/api/v1/set/${encodeURIComponent(setNumber)}?currency=${encodeURIComponent(currency)}`;
  const body = (await jsonFrom(url, {
    accept: 'application/json',
    'x-apikey': key,
    'User-Agent': BRICK_UA,
  })) as { data?: Record<string, unknown> } | null;
  if (!body?.data) return null;
  return collectibleHitFromBrickEconomyApi(body.data, currency);
}

async function priceChartingFromApi(query: string, kind: CollectibleKind, currency: string): Promise<CollectibleSearchHit[] | null> {
  const token = priceChartingToken();
  if (!token) return null;
  const url = `https://www.pricecharting.com/api/products?t=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}`;
  const body = (await jsonFrom(url, { Accept: 'application/json', 'User-Agent': BRICK_UA })) as { products?: unknown } | null;
  if (!body) return null;
  return collectibleHitsFromPriceChartingApi(body.products, kind, currency);
}

async function enrichLegoHits(hits: CollectibleSearchHit[], currency: string): Promise<CollectibleSearchHit[]> {
  const targets = hits.slice(0, 1);
  const detailed = await Promise.all(
    targets.map(async (item) => {
      const next = await lookupLego(item.catalogId, item.sourceUrl, currency, item);
      return next ?? convertSearchHit(item, currency);
    }),
  );
  return [...detailed, ...hits.slice(detailed.length)].map((item) => convertSearchHit(item, currency));
}

async function lookupLego(
  catalogId: string,
  sourceUrl: string | null | undefined,
  currency: string,
  fallback?: CollectibleSearchHit,
): Promise<CollectibleSearchHit | null> {
  const fromApi = await brickSetFromApi(catalogId, currency);
  if (fromApi) return fromApi;
  if (sourceUrl) {
    const html = await htmlFrom(sourceUrl);
    if (html) {
      const parsed =
        sourceUrl.includes('brickset.com') ? parseBricksetSet(html, fallback) : parseBrickEconomySet(html, fallback);
      if (parsed) {
        const base = convertSearchHit(parsed, currency);
        const withMarket = await withBrickOwlValue(base, currency);
        return withMarket;
      }
      if (fallback) return convertSearchHit(fallback, currency);
    }
  }
  const searchHtml = await htmlFrom(`https://www.brickeconomy.com/search?query=${encodeURIComponent(catalogId)}`);
  if (searchHtml) {
    const parsedSearch = parseBrickEconomySearch(searchHtml);
    const first = parsedSearchMatch(parsedSearch, catalogId);
    if (first?.sourceUrl) {
      const setHtml = await htmlFrom(first.sourceUrl);
      if (setHtml) {
        const parsed = parseBrickEconomySet(setHtml, first);
        return parsed ? convertSearchHit(parsed, currency) : convertSearchHit(first, currency);
      }
      return convertSearchHit(first, currency);
    }
  }
  const bricksetHtml = await htmlFrom(`https://brickset.com/sets/${encodeURIComponent(catalogId)}`);
  if (bricksetHtml) {
    const parsed = parseBricksetSet(bricksetHtml, fallback);
    if (parsed) {
      const base = convertSearchHit(parsed, currency);
      const withMarket = await withBrickOwlValue(base, currency);
      return withMarket;
    }
  }
  return fallback ? convertSearchHit(fallback, currency) : null;
}

async function withBrickOwlValue(hit: CollectibleSearchHit, currency: string): Promise<CollectibleSearchHit> {
  const html = await htmlFrom(brickOwlSetUrl(hit.catalogId, hit.name));
  if (!html) return hit;
  const owl = parseBrickOwlProduct(html, hit);
  return mergeCollectibleHits(hit, owl ? convertSearchHit(owl, currency) : null);
}

function parsedSearchMatch(hits: CollectibleSearchHit[], catalogId: string): CollectibleSearchHit | undefined {
  const wanted = catalogId.replace(/-1$/, '');
  return (
    hits.find((item) => item.catalogId === catalogId) ??
    hits.find((item) => item.catalogId.replace(/-1$/, '') === wanted) ??
    hits[0]
  );
}

async function searchLego(query: string, currency: string): Promise<CollectibleSearchHit[]> {
  const setNumber = looksLikeLegoSetNumber(query);
  if (setNumber) {
    const exact = await lookupLego(setNumber, null, currency);
    if (exact) return [exact];
  }
  const html = await htmlFrom(`https://www.brickeconomy.com/search?query=${encodeURIComponent(query)}`);
  if (html) {
    const hits = parseBrickEconomySearch(html);
    if (hits.length > 0) return enrichLegoHits(hits, currency);
  }
  const bricksetHtml = await htmlFrom(`https://brickset.com/sets?query=${encodeURIComponent(query)}`);
  if (!bricksetHtml) return [];
  const hits = parseBricksetSearch(bricksetHtml);
  if (hits.length === 0) return [];
  return enrichLegoHits(hits, currency);
}

async function searchMinifigs(query: string, currency: string): Promise<CollectibleSearchHit[]> {
  const html = await htmlFrom(`https://www.brickeconomy.com/search?query=${encodeURIComponent(query)}`);
  if (html) {
    const hits = parseBrickEconomyMinifigSearch(html);
    if (hits.length > 0) return hits.map((item) => convertSearchHit(item, currency));
  }
  const bricksetHtml = await htmlFrom(`https://brickset.com/minifigs?query=${encodeURIComponent(query)}`);
  if (!bricksetHtml) return [];
  return parseBricksetMinifigSearch(bricksetHtml).map((item) => convertSearchHit(item, currency));
}

async function searchCards(query: string, kind: CollectibleKind, currency: string): Promise<CollectibleSearchHit[]> {
  const fromApi = await priceChartingFromApi(query, kind, currency);
  if (fromApi && fromApi.length > 0) return fromApi;
  const html = await htmlFrom(`https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(query)}`);
  if (!html) return [];
  return parsePriceChartingSearch(html, kind).map((item) => convertSearchHit(item, currency));
}

async function lookupCard(
  catalogId: string,
  sourceUrl: string | null | undefined,
  kind: CollectibleKind,
  currency: string,
  fallback?: CollectibleSearchHit,
): Promise<CollectibleSearchHit | null> {
  const fromApi = await priceChartingFromApi(catalogId, kind, currency);
  const match = fromApi?.find((item) => item.catalogId === catalogId) ?? fromApi?.[0];
  if (match) return match;
  if (sourceUrl) {
    const html = await htmlFrom(sourceUrl);
    if (html) {
      const parsed = parsePriceChartingProduct(html, fallback);
      if (parsed) {
        const next = convertSearchHit(parsed, currency);
        return fallback ? mergeCollectibleHits(convertSearchHit(fallback, currency), next) : next;
      }
      if (fallback) return convertSearchHit(fallback, currency);
    }
  }
  const hits = await searchCards(catalogId, kind, currency);
  return hits.find((item) => item.catalogId === catalogId) ?? hits[0] ?? fallback ?? null;
}

async function searchVinyl(query: string, currency: string): Promise<CollectibleSearchHit[]> {
  const token = discogsToken();
  const params = new URLSearchParams({ q: query, type: 'release', per_page: '8' });
  if (token) params.set('token', token);
  const body = (await jsonFrom(`https://api.discogs.com/database/search?${params.toString()}`, {
    Accept: 'application/json',
    'User-Agent': DISCOGS_UA,
  })) as { results?: unknown } | null;
  const hits = collectibleHitsFromDiscogsSearch(body?.results, currency);
  if (hits.length === 0) return [];
  const priced = await Promise.all(
    hits.slice(0, 4).map(async (item) => {
      const stats = await jsonFrom(`https://api.discogs.com/marketplace/stats/${encodeURIComponent(item.catalogId)}`, {
        Accept: 'application/json',
        'User-Agent': DISCOGS_UA,
      });
      return applyDiscogsStats(item, stats, currency);
    }),
  );
  return [...priced, ...hits.slice(priced.length)];
}

async function lookupVinyl(catalogId: string, currency: string, fallback?: CollectibleSearchHit): Promise<CollectibleSearchHit | null> {
  const seed =
    fallback ??
    collectibleHitsFromDiscogsSearch(
      [{ id: Number(catalogId) || catalogId, title: catalogId, uri: `/release/${catalogId}` }],
      currency,
    )[0];
  if (!seed) return null;
  const stats = await jsonFrom(`https://api.discogs.com/marketplace/stats/${encodeURIComponent(catalogId)}`, {
    Accept: 'application/json',
    'User-Agent': DISCOGS_UA,
  });
  return applyDiscogsStats(seed, stats, currency);
}

async function searchSneakers(query: string, currency: string): Promise<CollectibleSearchHit[]> {
  const html = await htmlFrom(`https://stockx.com/search?s=${encodeURIComponent(query)}`);
  if (!html) return [];
  return parseStockXSearch(html).map((item) => convertSearchHit(item, currency));
}

async function searchWatches(query: string, currency: string): Promise<CollectibleSearchHit[]> {
  const html = await htmlFrom(`https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(query)}`);
  if (!html) return [];
  return parseChrono24Search(html).map((item) => convertSearchHit(item, currency));
}

async function lookupFromSearch(
  kind: CollectibleKind,
  catalogId: string,
  currency: string,
  sourceUrl?: string | null,
): Promise<CollectibleSearchHit | null> {
  if (sourceUrl) {
    const html = await htmlFrom(sourceUrl);
    if (html) {
      if (kind === 'sneaker') {
        const hits = parseStockXSearch(html).map((item) => convertSearchHit(item, currency));
        return hits.find((item) => item.catalogId === catalogId) ?? hits[0] ?? null;
      }
      if (kind === 'watch') {
        const hits = parseChrono24Search(html).map((item) => convertSearchHit(item, currency));
        return hits.find((item) => item.catalogId === catalogId) ?? hits[0] ?? null;
      }
      if (kind === 'minifig') {
        const parsed = sourceUrl.includes('brickset.com')
          ? parseBricksetMinifigSearch(html)
          : parseBrickEconomyMinifigSearch(html);
        const hits = parsed.map((item) => convertSearchHit(item, currency));
        return hits.find((item) => item.catalogId === catalogId) ?? hits[0] ?? null;
      }
    }
  }
  const hits = await searchCollectibles(kind, catalogId, currency);
  return hits.find((item) => item.catalogId === catalogId) ?? hits[0] ?? null;
}

export async function searchCollectibles(kind: CollectibleKind, query: string, currency: string): Promise<CollectibleSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) throw Object.assign(new Error('Type a bit more to search'), { status: 400 });
  const target = requestedCurrency(currency);
  if (kind === 'lego') return searchLego(q, target);
  if (kind === 'minifig') return searchMinifigs(q, target);
  if (kind === 'vinyl') return searchVinyl(q, target);
  if (kind === 'sneaker') return searchSneakers(q, target);
  if (kind === 'watch') return searchWatches(q, target);
  if (PRICECHARTING_KINDS.has(kind)) return searchCards(q, kind, target);
  return searchCards(q, 'other', target);
}

export async function lookupCollectible(input: {
  kind: CollectibleKind;
  catalogId: string;
  sourceUrl?: string | null;
  currency?: string;
}): Promise<CollectibleSearchHit | null> {
  const currency = requestedCurrency(input.currency);
  const catalogId = input.catalogId.trim();
  if (!catalogId) throw Object.assign(new Error('A catalog id is required'), { status: 400 });
  if (input.kind === 'lego') return lookupLego(catalogId, input.sourceUrl, currency);
  if (input.kind === 'vinyl') return lookupVinyl(catalogId, currency);
  if (PRICECHARTING_KINDS.has(input.kind)) return lookupCard(catalogId, input.sourceUrl, input.kind, currency);
  return lookupFromSearch(input.kind, catalogId, currency, input.sourceUrl);
}

export function parseCollectibleKind(value: unknown): CollectibleKind {
  const kind = typeof value === 'string' ? value : '';
  if (isCollectibleKind(kind)) return kind;
  throw Object.assign(new Error('Choose a collectible type'), { status: 400 });
}
