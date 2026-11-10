import { canonicalIsbn13, isValidIsbn, normalizeIsbn } from '@kinexus/domain';

export type ParsedBookRef =
  | { kind: 'openLibraryWork'; workId: string }
  | { kind: 'openLibraryEdition'; editionId: string }
  | { kind: 'openLibraryIsbn'; isbn: string }
  | { kind: 'goodreads'; goodreadsId: string | null; query: string | null }
  | { kind: 'asin'; asin: string }
  | { kind: 'amazonSearch'; query: string }
  | { kind: 'googleVolume'; volumeId: string }
  | { kind: 'googleSearch'; query: string }
  | { kind: 'hardcover'; hardcoverId: string | null; query: string | null }
  | { kind: 'isbn'; isbn: string }
  | { kind: 'invalid'; reason: string };

function slugToQuery(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function amazonAsin(path: string): string | null {
  const match =
    path.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:\/|$|\?)/i) ??
    path.match(/\/ASIN\/([A-Z0-9]{10})(?:\/|$|\?)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

/** Parse a book URL or bare ISBN into a resolution hint. */
export function parseBookUrl(raw: string): ParsedBookRef {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'invalid', reason: 'Paste a book link or ISBN' };

  if (!/^https?:\/\//i.test(trimmed)) {
    const isbn = normalizeIsbn(trimmed);
    if (isbn && isValidIsbn(isbn)) {
      return { kind: 'isbn', isbn: canonicalIsbn13(isbn) ?? isbn };
    }
    return { kind: 'invalid', reason: 'Paste a full http(s) link or a valid ISBN' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'invalid', reason: 'Paste a full http(s) link or a valid ISBN' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'invalid', reason: 'Paste a full http(s) link or a valid ISBN' };
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const path = url.pathname;

  if (host === 'openlibrary.org' || host.endsWith('.openlibrary.org')) {
    const work = path.match(/\/works\/(OL\d+W)/i);
    if (work?.[1]) return { kind: 'openLibraryWork', workId: work[1].toUpperCase() };
    const edition = path.match(/\/books\/(OL\d+M)/i);
    if (edition?.[1]) return { kind: 'openLibraryEdition', editionId: edition[1].toUpperCase() };
    const isbnPath = path.match(/\/isbn\/([0-9Xx-]{10,17})/i);
    if (isbnPath?.[1]) {
      const isbn = normalizeIsbn(isbnPath[1]);
      if (isbn && isValidIsbn(isbn)) return { kind: 'openLibraryIsbn', isbn: canonicalIsbn13(isbn) ?? isbn };
    }
    return { kind: 'invalid', reason: 'That Open Library link is not a work or edition page' };
  }

  if (host === 'goodreads.com' || host.endsWith('.goodreads.com')) {
    const idMatch = path.match(/\/book\/show\/(\d+)/);
    const slug = path.match(/\/book\/show\/\d+(?:[.-]([^/]+))?/);
    const titleSlug = slug?.[1] ? slugToQuery(slug[1]) : null;
    return {
      kind: 'goodreads',
      goodreadsId: idMatch?.[1] ?? null,
      query: titleSlug,
    };
  }

  if (host === 'amazon.com' || /^amazon\.[a-z.]+$/i.test(host) || host.endsWith('.amazon.com')) {
    const asin = amazonAsin(path);
    if (asin) return { kind: 'asin', asin };
    const q = url.searchParams.get('k') ?? url.searchParams.get('field-keywords');
    if (q?.trim()) return { kind: 'amazonSearch', query: q.trim() };
    const crumbs = path.split('/').filter(Boolean);
    const titleGuess = crumbs.find((part) => part.length > 3 && !/^(dp|gp|product|ASIN)$/i.test(part));
    if (titleGuess) return { kind: 'amazonSearch', query: slugToQuery(titleGuess) };
    return { kind: 'invalid', reason: 'That Amazon link has no ASIN or title' };
  }

  if (host === 'books.google.com' || host.startsWith('books.google.') || host.endsWith('.books.google.com')) {
    const id = url.searchParams.get('id')?.trim();
    if (id) return { kind: 'googleVolume', volumeId: id };
    const q = url.searchParams.get('q')?.trim();
    if (q) return { kind: 'googleSearch', query: q };
    return { kind: 'invalid', reason: 'That Google Books link has no volume id' };
  }

  if (host === 'hardcover.app' || host.endsWith('.hardcover.app')) {
    const book = path.match(/\/books\/([^/]+)/);
    if (book?.[1]) {
      const slug = book[1];
      if (/^\d+$/.test(slug)) return { kind: 'hardcover', hardcoverId: slug, query: null };
      return { kind: 'hardcover', hardcoverId: null, query: slugToQuery(slug) };
    }
    return { kind: 'invalid', reason: 'That Hardcover link is not a book page' };
  }

  return { kind: 'invalid', reason: 'Unsupported book link' };
}
