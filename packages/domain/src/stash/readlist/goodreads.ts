import { headerKey, parseCsv, serializeCsv } from '../../csv';
import type { BookFormat } from './books';
import { canonicalIsbn13, normalizeIsbn } from './books';
import type { ReadStatus } from './types';

export const GOODREADS_CSV_HEADERS = [
  'Book Id',
  'Title',
  'Author',
  'Additional Authors',
  'ISBN',
  'ISBN13',
  'My Rating',
  'Binding',
  'Number of Pages',
  'Date Read',
  'Date Added',
  'Exclusive Shelf',
  'Read Count',
] as const;

export type GoodreadsMatchTier = 'exact' | 'likely' | 'unsure' | 'none';

export type GoodreadsImportRow = {
  key: string;
  bookId: string | null;
  title: string;
  author: string | null;
  additionalAuthors: string | null;
  isbn10: string | null;
  isbn13: string | null;
  /** Raw Goodreads 0–5 rating (0 = unrated). */
  myRating: number;
  /** Kinexus 1–10 score, or null when unrated. */
  score: number | null;
  binding: string | null;
  format: BookFormat;
  pages: number | null;
  dateRead: string | null;
  dateAdded: string | null;
  exclusiveShelf: string;
  status: ReadStatus;
  readCount: number | null;
};

export type GoodreadsExportItem = {
  bookId?: string | null;
  title: string;
  author: string;
  additionalAuthors?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  /** Kinexus 1–10 score (or null). */
  score?: number | null;
  format?: BookFormat | null;
  binding?: string | null;
  pages?: number | null;
  dateRead?: string | null;
  dateAdded?: string | null;
  status: ReadStatus;
  readCount?: number | null;
};

function indexOf(headers: readonly string[], names: readonly string[]): number {
  const keys = new Set(names.map(headerKey));
  return headers.findIndex((header) => keys.has(headerKey(header)));
}

/** Strip Goodreads `="…"` / `=""…""` wrappers and normalise ISBN digits. */
export function stripGoodreadsIsbn(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let value = raw.trim();
  if (!value) return null;
  // ="978…" or =""978…""
  const wrapped = value.match(/^=\s*"+(.*?)"+\s*$/);
  if (wrapped) value = wrapped[1]!.trim();
  value = value.replace(/^"+|"+$/g, '').trim();
  if (!value || /^null$/i.test(value)) return null;
  return normalizeIsbn(value);
}

export function exclusiveShelfToStatus(shelf: string | null | undefined): ReadStatus {
  const key = (shelf ?? '').trim().toLowerCase();
  if (key === 'read') return 'finished';
  if (key === 'currently-reading') return 'reading';
  // to-read and any custom exclusive shelf → want_to_read
  return 'want_to_read';
}

export function statusToExclusiveShelf(status: ReadStatus): string {
  if (status === 'finished') return 'read';
  if (status === 'reading') return 'currently-reading';
  return 'to-read';
}

/** My Rating 1–5 → score ×2; 0 / empty → null. */
export function goodreadsRatingToScore(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return null;
  const score = Math.round(rating) * 2;
  if (score < 2 || score > 10) return null;
  return score;
}

/** score ÷2 rounded; null → 0. */
export function scoreToGoodreadsRating(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score) || score <= 0) return 0;
  return Math.round(score / 2);
}

export function bindingToFormat(binding: string | null | undefined): BookFormat {
  const raw = (binding ?? '').trim().toLowerCase();
  if (!raw) return 'print';
  if (/\b(audible|audiobook|audio\s*book|audio\s*cd|spoken\s*word|mp3)\b/.test(raw)) return 'audiobook';
  if (/\b(kindle|e-?book|ebook|epub|mobi|digital)\b/.test(raw)) return 'ebook';
  return 'print';
}

export function formatToBinding(format: BookFormat): string {
  if (format === 'audiobook') return 'Audiobook';
  if (format === 'ebook') return 'Kindle Edition';
  return 'Paperback';
}

function parseDate(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  // Goodreads often uses YYYY/MM/DD
  const slash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return `${slash[1]}-${slash[2]!.padStart(2, '0')}-${slash[3]!.padStart(2, '0')}`;
  }
  return null;
}

function parseIntCell(raw: string | null | undefined): number | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

export function looksLikeGoodreadsCsv(headers: readonly string[] | null | undefined): boolean {
  if (!headers || headers.length === 0) return false;
  const keys = headers.map(headerKey);
  const hasTitle = keys.includes('title');
  const hasShelf = keys.includes('exclusive shelf');
  const hasAuthor = keys.includes('author');
  const hasIsbn = keys.includes('isbn') || keys.includes('isbn13');
  return hasTitle && hasShelf && (hasAuthor || hasIsbn);
}

function rowDedupeKey(row: Pick<GoodreadsImportRow, 'bookId' | 'isbn13' | 'isbn10' | 'title' | 'author'>): string {
  if (row.bookId) return `id:${row.bookId}`;
  if (row.isbn13) return `isbn13:${row.isbn13}`;
  if (row.isbn10) return `isbn10:${row.isbn10}`;
  return `title:${(row.title ?? '').toLowerCase().trim()}|${(row.author ?? '').toLowerCase().trim()}`;
}

function preferLaterRead(
  a: GoodreadsImportRow,
  b: GoodreadsImportRow,
): GoodreadsImportRow {
  const aDate = a.dateRead ?? '';
  const bDate = b.dateRead ?? '';
  if (bDate > aDate) {
    return {
      ...b,
      // Keep the higher rating / later added when merging re-reads
      score: b.score ?? a.score,
      myRating: b.myRating || a.myRating,
      dateAdded: b.dateAdded ?? a.dateAdded,
      readCount: Math.max(a.readCount ?? 0, b.readCount ?? 0) || null,
    };
  }
  return {
    ...a,
    score: a.score ?? b.score,
    myRating: a.myRating || b.myRating,
    dateAdded: a.dateAdded ?? b.dateAdded,
    dateRead: a.dateRead ?? b.dateRead,
    readCount: Math.max(a.readCount ?? 0, b.readCount ?? 0) || null,
  };
}

export function parseGoodreadsCsv(text: string): GoodreadsImportRow[] {
  const parsed = parseCsv(text);
  if (!looksLikeGoodreadsCsv(parsed.headers)) {
    throw new Error('Not a Goodreads export CSV');
  }
  const headers = parsed.headers ?? [];
  // My Review / Private Notes / Spoiler are never indexed — never imported.

  const bookIdIdx = indexOf(headers, ['Book Id']);
  const titleIdx = indexOf(headers, ['Title']);
  const authorIdx = indexOf(headers, ['Author']);
  const additionalIdx = indexOf(headers, ['Additional Authors']);
  const isbnIdx = indexOf(headers, ['ISBN']);
  const isbn13Idx = indexOf(headers, ['ISBN13', 'ISBN 13']);
  const ratingIdx = indexOf(headers, ['My Rating']);
  const bindingIdx = indexOf(headers, ['Binding']);
  const pagesIdx = indexOf(headers, ['Number of Pages']);
  const dateReadIdx = indexOf(headers, ['Date Read']);
  const dateAddedIdx = indexOf(headers, ['Date Added']);
  const shelfIdx = indexOf(headers, ['Exclusive Shelf']);
  const readCountIdx = indexOf(headers, ['Read Count']);

  const byKey = new Map<string, GoodreadsImportRow>();
  let seq = 0;

  for (const cells of parsed.rows) {
    const title = (titleIdx >= 0 ? cells[titleIdx] : '')?.trim() || '';
    if (!title) continue;

    const exclusiveShelf = (shelfIdx >= 0 ? cells[shelfIdx] : '')?.trim() || 'to-read';
    const myRatingRaw = ratingIdx >= 0 ? Number((cells[ratingIdx] ?? '').trim()) : 0;
    const myRating = Number.isFinite(myRatingRaw) && myRatingRaw > 0 ? Math.min(5, Math.round(myRatingRaw)) : 0;
    const isbn10 = isbnIdx >= 0 ? stripGoodreadsIsbn(cells[isbnIdx]) : null;
    const isbn13Raw = isbn13Idx >= 0 ? stripGoodreadsIsbn(cells[isbn13Idx]) : null;
    const isbn13 = canonicalIsbn13(isbn13Raw) ?? canonicalIsbn13(isbn10);
    const isbn10Norm =
      isbn10 && isbn10.length === 10 ? isbn10 : isbn10 && isbn10.length === 13 ? null : isbn10;
    const binding = bindingIdx >= 0 ? (cells[bindingIdx] ?? '').trim() || null : null;
    const bookId = bookIdIdx >= 0 ? (cells[bookIdIdx] ?? '').trim() || null : null;

    const row: GoodreadsImportRow = {
      key: String(seq++),
      bookId,
      title,
      author: authorIdx >= 0 ? (cells[authorIdx] ?? '').trim() || null : null,
      additionalAuthors: additionalIdx >= 0 ? (cells[additionalIdx] ?? '').trim() || null : null,
      isbn10: isbn10Norm,
      isbn13,
      myRating,
      score: goodreadsRatingToScore(myRating),
      binding,
      format: bindingToFormat(binding),
      pages: pagesIdx >= 0 ? parseIntCell(cells[pagesIdx]) : null,
      dateRead: dateReadIdx >= 0 ? parseDate(cells[dateReadIdx]) : null,
      dateAdded: dateAddedIdx >= 0 ? parseDate(cells[dateAddedIdx]) : null,
      exclusiveShelf,
      status: exclusiveShelfToStatus(exclusiveShelf),
      readCount: readCountIdx >= 0 ? parseIntCell(cells[readCountIdx]) : null,
    };

    const dedupe = rowDedupeKey(row);
    const existing = byKey.get(dedupe);
    if (!existing) {
      byKey.set(dedupe, row);
    } else {
      byKey.set(dedupe, preferLaterRead(existing, row));
    }
  }

  return [...byKey.values()].map((row, index) => ({ ...row, key: String(index) }));
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeName(value).split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

/**
 * Title+author confidence for catalog search hits.
 * Exact title + matching author → likely (≥0.85); weaker → unsure; else none.
 */
export function titleAuthorMatchConfidence(
  query: { title: string; author: string | null },
  candidate: { title: string; authors: readonly string[] },
): number {
  const qTitle = normalizeName(query.title);
  const cTitle = normalizeName(candidate.title);
  if (!qTitle || !cTitle) return 0;

  let titleScore = 0;
  if (qTitle === cTitle) titleScore = 1;
  else if (cTitle.startsWith(qTitle) || qTitle.startsWith(cTitle)) titleScore = 0.88;
  else {
    const overlap = jaccard(tokenSet(qTitle), tokenSet(cTitle));
    titleScore = overlap >= 0.7 ? 0.7 + (overlap - 0.7) * 0.5 : overlap * 0.65;
  }

  const qAuthor = normalizeName(query.author ?? '');
  let authorScore = 0.55;
  if (qAuthor) {
    const authors = candidate.authors.map(normalizeName).filter(Boolean);
    if (authors.some((name) => name === qAuthor || name.includes(qAuthor) || qAuthor.includes(name))) {
      authorScore = 1;
    } else if (authors.some((name) => jaccard(tokenSet(name), tokenSet(qAuthor)) >= 0.5)) {
      authorScore = 0.7;
    } else {
      authorScore = 0.15;
    }
  }

  return Math.round(Math.min(1, titleScore * 0.65 + authorScore * 0.35) * 1000) / 1000;
}

export function classifyGoodreadsMatchTier(input: {
  matchedBy: 'isbn13' | 'isbn10' | 'title_author' | null;
  confidence: number;
}): GoodreadsMatchTier {
  if (input.matchedBy === 'isbn13' || input.matchedBy === 'isbn10') return 'exact';
  if (input.matchedBy === 'title_author') {
    if (input.confidence >= 0.85) return 'likely';
    if (input.confidence >= 0.55) return 'unsure';
    return 'none';
  }
  return 'none';
}

/** Work-level dedupe key for commit (prefer catalog work id, else ISBN, else title+author). */
export function goodreadsWorkDedupeKey(row: {
  workId?: string | null;
  isbn13?: string | null;
  isbn10?: string | null;
  title: string;
  author?: string | null;
}): string {
  if (row.workId) return `work:${row.workId}`;
  if (row.isbn13) return `isbn13:${row.isbn13}`;
  if (row.isbn10) return `isbn10:${row.isbn10}`;
  return `title:${normalizeName(row.title)}|${normalizeName(row.author ?? '')}`;
}

function wrapIsbn(value: string | null | undefined): string {
  if (!value) return '=""';
  return `="${value}"`;
}

export function buildGoodreadsCsv(
  listName: string,
  items: readonly GoodreadsExportItem[],
): { fileName: string; mimeType: string; text: string } {
  const headers = [...GOODREADS_CSV_HEADERS];
  const rows = items.map((item) => {
    const rating = scoreToGoodreadsRating(item.score ?? null);
    const binding = item.binding ?? formatToBinding(item.format ?? 'print');
    return [
      item.bookId ?? '',
      item.title,
      item.author,
      item.additionalAuthors ?? '',
      wrapIsbn(item.isbn10 ?? null),
      wrapIsbn(item.isbn13 ?? null),
      String(rating),
      binding,
      item.pages != null ? String(item.pages) : '',
      item.dateRead ?? '',
      item.dateAdded ?? '',
      statusToExclusiveShelf(item.status),
      item.readCount != null ? String(item.readCount) : '',
    ];
  });

  const base = (listName.trim() || 'readlist').replace(/[^\w\-]+/g, '_').slice(0, 60);
  return {
    fileName: `${base}-goodreads.csv`,
    mimeType: 'text/csv',
    text: `${serializeCsv([headers, ...rows], ',')}\n`,
  };
}

export function buildGoodreadsExportJson(
  listName: string,
  listId: string | null,
  items: readonly GoodreadsExportItem[],
  exportedAt = new Date().toISOString(),
): { fileName: string; mimeType: string; text: string } {
  const base = (listName.trim() || 'readlist').replace(/[^\w\-]+/g, '_').slice(0, 60);
  const payload = {
    kinexusExport: 1,
    kind: 'readlist' as const,
    exportedAt,
    list: { name: listName, id: listId },
    items: items.map((item) => ({
      title: item.title,
      author: item.author,
      additionalAuthors: item.additionalAuthors ?? null,
      isbn10: item.isbn10 ?? null,
      isbn13: item.isbn13 ?? null,
      score: item.score ?? null,
      binding: item.binding ?? null,
      pages: item.pages ?? null,
      dateRead: item.dateRead ?? null,
      dateAdded: item.dateAdded ?? null,
      status: item.status,
      readCount: item.readCount ?? null,
      bookId: item.bookId ?? null,
    })),
  };
  return {
    fileName: `${base}.json`,
    mimeType: 'application/json',
    text: `${JSON.stringify(payload, null, 2)}\n`,
  };
}
