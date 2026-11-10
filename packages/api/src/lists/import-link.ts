import {
  LIST_LINK_MAX_PAGES,
  LIST_LINK_PUBLIC_ERROR,
  classifyWatchlistListImportUrl,
  mergeListLinkItems,
  parseListLinkHtml,
  type ListLinkItem,
  type ListLinkSource,
  type ParsedListLinkPage,
} from '@kinexus/domain';

import { fetchPublicHtml } from '../scrape/index.js';
import { SsrfError, type HostnameLookup } from '../scrape/ssrf.js';

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

async function fetchListPageHtml(
  url: string,
  options: ListImportLinkFetchOptions = {},
): Promise<{ status: number; html: string }> {
  const response = await fetchPublicHtml(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    escalate: false,
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
 * Returns title rows only — never stores the scraped HTML.
 */
export async function importWatchlistFromListLink(
  rawUrl: string,
  options: ListImportLinkFetchOptions = {},
): Promise<ListImportLinkResult> {
  const classified = classifyWatchlistListImportUrl(rawUrl);
  if (!classified) {
    throw Object.assign(new Error('Paste an IMDb or Letterboxd list link'), { status: 400 });
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
