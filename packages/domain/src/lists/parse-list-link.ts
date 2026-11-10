import { normalizeImdbId } from './match-confidence';
import { emptyImportRow, type ImportPlan, type ImportRow } from './types';

export const LIST_LINK_PUBLIC_ERROR = "That list isn't public or couldn't be read";
export const LIST_LINK_MAX_PAGES = 5;

export type ListLinkSource = 'imdb' | 'letterboxd';

export type ListLinkItem = {
  title: string;
  year: number | null;
  imdbId: string | null;
};

export type ParsedListLinkPage = {
  source: ListLinkSource;
  listName: string | null;
  items: ListLinkItem[];
  nextPageUrl: string | null;
  privateOrBlocked: boolean;
};

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    });
}

function stripTags(raw: string): string {
  return decodeEntities(raw.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function yearFromText(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(19|20)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  return year >= 1888 && year <= 2100 ? year : null;
}

function metaAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(re);
  if (!match) return null;
  return decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim() || null;
}

function metaContent(html: string, keys: readonly string[]): string | null {
  const want = new Set(keys.map((key) => key.toLowerCase()));
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = (metaAttr(tag, 'property') ?? metaAttr(tag, 'name') ?? '').toLowerCase();
    if (!want.has(name)) continue;
    const value = metaAttr(tag, 'content');
    if (value) return value;
  }
  return null;
}

function titleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? stripTags(match[1]) : null;
}

function h1Text(html: string): string | null {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match?.[1] ? stripTags(match[1]) : null;
}

function looksPrivateOrBlocked(html: string): boolean {
  const lower = html.toLowerCase();
  if (lower.includes('this list is private')) return true;
  if (lower.includes('list is private')) return true;
  if (lower.includes('private list')) return true;
  if (lower.includes('sign in to view')) return true;
  if (lower.includes('you must be signed in')) return true;
  if (lower.includes('content is not available')) return true;
  if (lower.includes('page not found') && lower.includes('404')) return true;
  return false;
}

function cleanListName(raw: string | null, source: ListLinkSource): string | null {
  if (!raw) return null;
  let name = raw.trim();
  if (source === 'imdb') {
    name = name.replace(/\s*[-–|].*imdb.*$/i, '').replace(/\s*list\s*-?\s*imdb.*$/i, '').trim();
  }
  if (source === 'letterboxd') {
    name = name
      .replace(/\s*[-–|•].*letterboxd.*$/i, '')
      .replace(/\s*,\s*a\s+list\s+of\s+films?\s+by\s+.+$/i, '')
      .replace(/\s+watchlist\s*$/i, ' Watchlist')
      .trim();
  }
  return name || null;
}

/**
 * True when the URL is an IMDb public list or Letterboxd public list/watchlist
 * that link-import can scrape (single-title pages stay on add-title).
 */
export function isWatchlistListImportUrl(raw: string): boolean {
  return classifyWatchlistListImportUrl(raw) != null;
}

export function classifyWatchlistListImportUrl(raw: string): {
  source: ListLinkSource;
  canonicalUrl: string;
} | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const path = url.pathname;

  if (host === 'imdb.com' || host.endsWith('.imdb.com')) {
    const list = path.match(/\/list\/(ls\d+)/i);
    if (!list?.[1]) return null;
    const page = url.searchParams.get('page');
    const canonical = new URL(`https://www.imdb.com/list/${list[1].toLowerCase()}/`);
    if (page && /^\d+$/.test(page) && Number(page) > 1) {
      canonical.searchParams.set('page', page);
    }
    return { source: 'imdb', canonicalUrl: canonical.href };
  }

  if (host === 'letterboxd.com' || host.endsWith('.letterboxd.com')) {
    const list = path.match(/^\/([^/]+)\/list\/([^/]+)\/?/i);
    if (list?.[1] && list[2] && list[1].toLowerCase() !== 'film') {
      const pageMatch = path.match(/\/page\/(\d+)\/?$/i);
      const base = `https://letterboxd.com/${list[1]}/list/${list[2]}/`;
      const canonical = pageMatch?.[1] && Number(pageMatch[1]) > 1 ? `${base}page/${pageMatch[1]}/` : base;
      return { source: 'letterboxd', canonicalUrl: canonical };
    }
    const watchlist = path.match(/^\/([^/]+)\/watchlist\/?/i);
    if (watchlist?.[1] && watchlist[1].toLowerCase() !== 'film') {
      const pageMatch = path.match(/\/page\/(\d+)\/?$/i);
      const base = `https://letterboxd.com/${watchlist[1]}/watchlist/`;
      const canonical = pageMatch?.[1] && Number(pageMatch[1]) > 1 ? `${base}page/${pageMatch[1]}/` : base;
      return { source: 'letterboxd', canonicalUrl: canonical };
    }
  }

  return null;
}

function nextImdbPageUrl(pageUrl: string, html: string): string | null {
  let current: URL;
  try {
    current = new URL(pageUrl);
  } catch {
    return null;
  }
  const currentPage = Number(current.searchParams.get('page') || '1');
  if (!Number.isFinite(currentPage) || currentPage < 1) return null;
  const next = currentPage + 1;
  const re = new RegExp(`[?&]page=${next}(?:\\D|$)`, 'i');
  if (!re.test(html) && !html.toLowerCase().includes(`page=${next}`)) return null;
  const nextUrl = new URL(current.href);
  nextUrl.searchParams.set('page', String(next));
  return nextUrl.href;
}

function nextLetterboxdPageUrl(pageUrl: string, html: string): string | null {
  let current: URL;
  try {
    current = new URL(pageUrl);
  } catch {
    return null;
  }
  const pageMatch = current.pathname.match(/\/page\/(\d+)\/?$/i);
  const currentPage = pageMatch ? Number(pageMatch[1]) : 1;
  if (!Number.isFinite(currentPage) || currentPage < 1) return null;
  const next = currentPage + 1;
  const nextPath = current.pathname.replace(/\/page\/\d+\/?$/i, '/').replace(/\/?$/, `/page/${next}/`);
  const hint = `page/${next}`;
  if (!html.toLowerCase().includes(hint)) return null;
  return `${current.origin}${nextPath}`;
}

function parseImdbListItems(html: string): ListLinkItem[] {
  const byId = new Map<string, ListLinkItem>();

  // Classic lister markup: data-tconst + title + year nearby.
  for (const block of html.matchAll(
    /data-tconst\s*=\s*"(tt\d+)"[\s\S]{0,1200}?(?:<\/h3>|<\/div>)/gi,
  )) {
    const imdbId = normalizeImdbId(block[1]);
    if (!imdbId || byId.has(imdbId)) continue;
    const chunk = block[0];
    const title =
      stripTags(chunk.match(/<a\b[^>]*href="\/title\/tt\d+\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '') ||
      imdbId;
    const year =
      yearFromText(chunk.match(/lister-item-year[^>]*>\s*\(?((?:19|20)\d{2})/i)?.[1]) ??
      yearFromText(chunk);
    byId.set(imdbId, { imdbId, title, year });
  }

  // Newer ipc list cards / any title anchors.
  for (const match of html.matchAll(/href="(\/title\/(tt\d+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const imdbId = normalizeImdbId(match[2]);
    if (!imdbId || byId.has(imdbId)) continue;
    const title = stripTags(match[3] ?? '');
    if (!title || title.length > 200) continue;
    // Skip nav chrome like "IMDbPro"
    if (/^(imdbpro|share|edit|ref)$/i.test(title)) continue;
    const after = html.slice(match.index ?? 0, (match.index ?? 0) + 400);
    const year = yearFromText(after.match(/\b((?:19|20)\d{2})\b/)?.[1]) ?? null;
    byId.set(imdbId, { imdbId, title, year });
  }

  // Bare data-tconst without nearby title block.
  for (const match of html.matchAll(/data-tconst\s*=\s*"(tt\d+)"/gi)) {
    const imdbId = normalizeImdbId(match[1]);
    if (!imdbId || byId.has(imdbId)) continue;
    byId.set(imdbId, { imdbId, title: imdbId, year: null });
  }

  return [...byId.values()];
}

export function parseImdbListHtml(html: string, pageUrl: string): ParsedListLinkPage {
  const privateOrBlocked = looksPrivateOrBlocked(html);
  const listName = cleanListName(h1Text(html) ?? metaContent(html, ['og:title']) ?? titleTag(html), 'imdb');
  const items = privateOrBlocked ? [] : parseImdbListItems(html);
  return {
    source: 'imdb',
    listName,
    items,
    nextPageUrl: items.length > 0 ? nextImdbPageUrl(pageUrl, html) : null,
    privateOrBlocked,
  };
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(re);
  if (!match) return null;
  const value = match[1] ?? match[2] ?? match[3] ?? '';
  return decodeEntities(value).trim() || null;
}

function parseLetterboxdListItems(html: string): ListLinkItem[] {
  const items: ListLinkItem[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<[^>]+(?:data-film-name|data-item-name|data-item-full-display-name)=[^>]+>/gi)) {
    const tag = match[0];
    const title =
      attr(tag, 'data-film-name') ??
      attr(tag, 'data-item-name') ??
      attr(tag, 'data-item-full-display-name');
    if (!title) continue;
    const year =
      yearFromText(attr(tag, 'data-film-release-year')) ??
      yearFromText(attr(tag, 'data-item-full-display-name')) ??
      null;
    const key = `${title.toLowerCase()}|${year ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title: title.replace(/\s*\((?:19|20)\d{2}\)\s*$/, '').trim() || title, year, imdbId: null });
  }

  // Fallback: poster frames with /film/slug/ and year in nearby text.
  if (items.length === 0) {
    for (const match of html.matchAll(
      /href="(\/film\/[^"/]+\/)"[^>]*(?:title|aria-label|data-original-title)=["']([^"']+)["']/gi,
    )) {
      const rawTitle = decodeEntities(match[2] ?? '').trim();
      if (!rawTitle) continue;
      const year = yearFromText(rawTitle);
      const title = rawTitle.replace(/\s*\((?:19|20)\d{2}\)\s*$/, '').trim() || rawTitle;
      const key = `${title.toLowerCase()}|${year ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ title, year, imdbId: null });
    }
  }

  return items;
}

export function parseLetterboxdListHtml(html: string, pageUrl: string): ParsedListLinkPage {
  const privateOrBlocked = looksPrivateOrBlocked(html);
  const listName = cleanListName(
    h1Text(html) ?? metaContent(html, ['og:title']) ?? titleTag(html),
    'letterboxd',
  );
  const items = privateOrBlocked ? [] : parseLetterboxdListItems(html);
  return {
    source: 'letterboxd',
    listName,
    items,
    nextPageUrl: items.length > 0 ? nextLetterboxdPageUrl(pageUrl, html) : null,
    privateOrBlocked,
  };
}

export function parseListLinkHtml(
  html: string,
  pageUrl: string,
  source: ListLinkSource,
): ParsedListLinkPage {
  return source === 'imdb' ? parseImdbListHtml(html, pageUrl) : parseLetterboxdListHtml(html, pageUrl);
}

export function mergeListLinkItems(pages: readonly ParsedListLinkPage[]): {
  source: ListLinkSource;
  listName: string | null;
  items: ListLinkItem[];
} {
  if (pages.length === 0) {
    return { source: 'imdb', listName: null, items: [] };
  }
  const source = pages[0]!.source;
  const listName = pages.map((page) => page.listName).find((name) => name?.trim()) ?? null;
  const seen = new Set<string>();
  const items: ListLinkItem[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      const key = item.imdbId
        ? `imdb:${item.imdbId}`
        : `title:${item.title.toLowerCase()}|${item.year ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return { source, listName, items };
}

export function listLinkItemsToImportRows(items: readonly ListLinkItem[]): ImportRow[] {
  return items.map((item) =>
    emptyImportRow({
      title: item.title || item.imdbId || 'Untitled',
      year: item.year,
      imdbId: item.imdbId,
      mediaType: null,
      itemStatus: 'want',
      status: item.title || item.imdbId ? 'needsMatch' : 'invalid',
      note: item.title || item.imdbId ? 'Needs TMDB match' : null,
    }),
  );
}

export function buildImportPlanFromListLink(input: {
  source: ListLinkSource;
  listName: string | null;
  items: readonly ListLinkItem[];
  pageUrl?: string | null;
}): ImportPlan {
  const suggestedName =
    input.listName?.trim() ||
    (input.source === 'imdb' ? 'IMDb list' : 'Letterboxd list');
  return {
    format: input.source === 'imdb' ? 'imdb-csv' : 'letterboxd-csv',
    kind: 'watchlist',
    suggestedName,
    headers: null,
    mapping: {},
    rows: listLinkItemsToImportRows(input.items),
    weightUnit: null,
    matrix: null,
    workoutSessions: null,
    workoutRoutines: null,
    sourceWeightUnit: null,
    supportsHistory: false,
    importHistory: false,
    customExercisesSupported: false,
  };
}
