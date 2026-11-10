import {
  LIST_LINK_MAX_PAGES,
  LIST_LINK_PUBLIC_ERROR,
  classifyWatchlistListImportUrl,
  isLetterboxdShortListHost,
  mergeListLinkItems,
  parseListLinkHtml,
  type ListLinkItem,
  type ListLinkSource,
  type ParsedListLinkPage,
} from '@kinexus/domain';

import { fetchPublicHtml } from '../scrape/index.js';
import { assertPublicHttpUrl, assertResolvedPublicHost, SsrfError, type HostnameLookup } from '../scrape/ssrf.js';

const HTML_CAP = 2_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const POLITE_UA =
  'Mozilla/5.0 (compatible; KinexusListImport/1.0; +https://kinexus.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export type ListImportLinkFetchOptions = {
  fetch?: typeof fetch;
  lookup?: HostnameLookup;
  maxPages?: number;
};

export type ListImportLinkResult = {
  source: ListLinkSource;
  suggestedName: string;
  url: string;
  pageCount: number;
  rows: Array<{
    key: string;
    title: string;
    year: number | null;
    imdbId: string | null;
  }>;
};

function publicError(status = 422): never {
  throw Object.assign(new Error(LIST_LINK_PUBLIC_ERROR), { status });
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Follow boxd.it redirects until we land on letterboxd.com (or exhaust hops).
 * Stops before fetching the Letterboxd HTML so Cloudflare challenges don't block resolve.
 */
async function resolveShortLetterboxdUrl(
  url: string,
  options: ListImportLinkFetchOptions = {},
): Promise<string> {
  const doFetch = options.fetch ?? fetch;
  const lookup = options.lookup;
  let current = url;
  for (let hop = 0; hop < 5; hop += 1) {
    const parsed = assertPublicHttpUrl(current);
    await assertResolvedPublicHost(parsed.hostname, lookup);
    const response = await doFetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': POLITE_UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return current;
    const location = response.headers.get('location');
    if (!location) return current;
    current = new URL(location, current).href;
    const host = hostOf(current);
    if (host && !isLetterboxdShortListHost(host)) return current;
  }
  return current;
}

async function fetchListPageHtml(
  url: string,
  options: ListImportLinkFetchOptions = {},
): Promise<{ status: number; html: string }> {
  const response = await fetchPublicHtml(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    // Letterboxd often serves a Cloudflare challenge; allow proxy/playwright recovery.
    // Injected fetch (tests) forces the direct path and skips escalate anyway.
    escalate: true,
    headers: { 'User-Agent': POLITE_UA },
    fetch: options.fetch,
    lookup: options.lookup,
  });
  const html = (await response.text()).slice(0, HTML_CAP);
  return { status: response.status, html };
}

function rowsFromItems(items: readonly ListLinkItem[]) {
  return items.map((item, index) => ({
    key: String(index),
    title: item.title,
    year: item.year,
    imdbId: item.imdbId,
  }));
}

/**
 * SSRF-safe fetch of a public IMDb/Letterboxd list (max 5 pages).
 * Resolves boxd.it short links, then scrapes title rows only — never stores HTML.
 */
export async function importWatchlistFromListLink(
  rawUrl: string,
  options: ListImportLinkFetchOptions = {},
): Promise<ListImportLinkResult> {
  let classified = classifyWatchlistListImportUrl(rawUrl);
  if (!classified) {
    throw Object.assign(new Error('Paste an IMDb list/chart or Letterboxd list link'), { status: 400 });
  }

  const shortHost = hostOf(classified.canonicalUrl);
  if (shortHost && isLetterboxdShortListHost(shortHost)) {
    let resolvedUrl: string;
    try {
      resolvedUrl = await resolveShortLetterboxdUrl(classified.canonicalUrl, options);
    } catch (err) {
      if (err instanceof SsrfError) throw err;
      publicError(422);
    }
    const resolved = classifyWatchlistListImportUrl(resolvedUrl);
    const resolvedHost = resolved ? hostOf(resolved.canonicalUrl) : null;
    if (!resolved || (resolvedHost && isLetterboxdShortListHost(resolvedHost))) {
      throw Object.assign(new Error('Paste an IMDb list/chart or Letterboxd list link'), { status: 400 });
    }
    classified = resolved;
  }

  const maxPages = Math.min(Math.max(options.maxPages ?? LIST_LINK_MAX_PAGES, 1), LIST_LINK_MAX_PAGES);
  const pages: ParsedListLinkPage[] = [];
  let nextUrl: string | null = classified.canonicalUrl;
  const seen = new Set<string>();

  try {
    for (let page = 0; page < maxPages && nextUrl; page += 1) {
      if (seen.has(nextUrl)) break;
      seen.add(nextUrl);
      const { status, html } = await fetchListPageHtml(nextUrl, options);
      if ([401, 402, 403, 404, 410, 429].includes(status)) publicError(422);
      if (status < 200 || status >= 300) publicError(422);
      const parsed = parseListLinkHtml(html, nextUrl, classified.source);
      if (parsed.privateOrBlocked) publicError(422);
      pages.push(parsed);
      nextUrl = parsed.nextPageUrl;
    }
  } catch (err) {
    if (err instanceof SsrfError) throw err;
    if (err && typeof err === 'object' && 'status' in err) throw err;
    publicError(422);
  }

  const merged = mergeListLinkItems(pages);
  if (merged.items.length === 0) publicError(422);

  return {
    source: merged.source,
    suggestedName:
      merged.listName?.trim() || (merged.source === 'imdb' ? 'IMDb list' : 'Letterboxd list'),
    url: classified.canonicalUrl,
    pageCount: pages.length,
    rows: rowsFromItems(merged.items),
  };
}

export async function handleListsImportLink(
  body: { url?: unknown },
  options?: ListImportLinkFetchOptions,
): Promise<{ status: number; body: ListImportLinkResult | { error: string } }> {
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return { status: 400, body: { error: 'A list URL is required' } };
  try {
    const result = await importWatchlistFromListLink(url, options);
    return { status: 200, body: result };
  } catch (err) {
    if (err instanceof SsrfError) {
      return { status: 400, body: { error: err.message || 'That URL is not allowed' } };
    }
    const message = err instanceof Error ? err.message : LIST_LINK_PUBLIC_ERROR;
    const status =
      typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 422;
    return { status, body: { error: message } };
  }
}
