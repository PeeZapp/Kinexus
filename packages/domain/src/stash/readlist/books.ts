export const BOOK_FORMATS = ['print', 'ebook', 'audiobook'] as const;

export type BookFormat = (typeof BOOK_FORMATS)[number];

export type BookExternalIds = {
  isbn10: string | null;
  isbn13: string | null;
  openLibraryWorkId: string | null;
  openLibraryEditionId: string | null;
  hardcoverId: string | null;
  googleVolumeId: string | null;
  goodreadsId: string | null;
  asin: string | null;
};

export type BookAuthor = {
  name: string;
  openLibraryAuthorId: string | null;
};

export type BookEdition = {
  id: string;
  workId: string;
  title: string;
  format: BookFormat;
  pageCount: number | null;
  publishedYear: number | null;
  publisher: string | null;
  language: string | null;
  coverUrl: string | null;
  blurb: string | null;
  ids: BookExternalIds;
};

export type BookWork = {
  id: string;
  title: string;
  authors: BookAuthor[];
  firstPublishedYear: number | null;
  blurb: string | null;
  coverUrl: string | null;
  subjects: string[];
  ids: BookExternalIds;
  editions: BookEdition[];
};

export type BookSearchHit = {
  workId: string;
  title: string;
  authors: string[];
  firstPublishedYear: number | null;
  coverUrl: string | null;
  editionCount: number;
  ids: BookExternalIds;
};

const FORMAT_SET = new Set<string>(BOOK_FORMATS);

export function emptyBookExternalIds(): BookExternalIds {
  return {
    isbn10: null,
    isbn13: null,
    openLibraryWorkId: null,
    openLibraryEditionId: null,
    hardcoverId: null,
    googleVolumeId: null,
    goodreadsId: null,
    asin: null,
  };
}

export function isBookFormat(value: string): value is BookFormat {
  return FORMAT_SET.has(value);
}

/** Strip separators; uppercase X check digit for ISBN-10. */
export function normalizeIsbn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length === 10 || cleaned.length === 13) return cleaned;
  return null;
}

export function isValidIsbn10(raw: string | null | undefined): boolean {
  const isbn = normalizeIsbn(raw);
  if (!isbn || isbn.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    const digit = Number(isbn[i]);
    if (!Number.isInteger(digit)) return false;
    sum += digit * (10 - i);
  }
  const check = isbn[9] === 'X' ? 10 : Number(isbn[9]);
  if (!Number.isInteger(check) && isbn[9] !== 'X') return false;
  return (sum + check) % 11 === 0;
}

export function isValidIsbn13(raw: string | null | undefined): boolean {
  const isbn = normalizeIsbn(raw);
  if (!isbn || isbn.length !== 13 || !/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(isbn[i]);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}

export function isValidIsbn(raw: string | null | undefined): boolean {
  const isbn = normalizeIsbn(raw);
  if (!isbn) return false;
  return isbn.length === 10 ? isValidIsbn10(isbn) : isValidIsbn13(isbn);
}

export function isbn10ToIsbn13(raw: string | null | undefined): string | null {
  const isbn10 = normalizeIsbn(raw);
  if (!isbn10 || !isValidIsbn10(isbn10)) return null;
  const body = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${body}${check}`;
}

/** Prefer ISBN-13; convert valid ISBN-10 when needed. */
export function canonicalIsbn13(raw: string | null | undefined): string | null {
  const isbn = normalizeIsbn(raw);
  if (!isbn) return null;
  if (isbn.length === 13) return isValidIsbn13(isbn) ? isbn : null;
  return isbn10ToIsbn13(isbn);
}

const AUDIO_RE = /\b(audio\s*book|audiobook|audio\s*cd|spoken\s*word|mp3|cd\s*audio)\b/i;
const EBOOK_RE = /\b(e-?book|kindle|epub|mobi|digital|electronic)\b/i;

/** Infer edition format from free-text physical format / type labels. Never invents. */
export function detectBookFormat(...hints: Array<string | null | undefined>): BookFormat {
  const joined = hints.filter(Boolean).join(' ');
  if (!joined) return 'print';
  if (AUDIO_RE.test(joined)) return 'audiobook';
  if (EBOOK_RE.test(joined)) return 'ebook';
  return 'print';
}

export type BookMergeKey =
  | { kind: 'isbn13'; value: string }
  | { kind: 'openLibraryWorkId'; value: string }
  | { kind: 'hardcoverId'; value: string }
  | { kind: 'googleVolumeId'; value: string };

const MERGE_RANK: Record<BookMergeKey['kind'], number> = {
  isbn13: 0,
  openLibraryWorkId: 1,
  hardcoverId: 2,
  googleVolumeId: 3,
};

/** Highest-priority shared identity between two id bags, or null if none. */
export function bookMergeKey(
  a: Pick<BookExternalIds, 'isbn13' | 'openLibraryWorkId' | 'hardcoverId' | 'googleVolumeId'>,
  b: Pick<BookExternalIds, 'isbn13' | 'openLibraryWorkId' | 'hardcoverId' | 'googleVolumeId'>,
): BookMergeKey | null {
  const aIsbn = canonicalIsbn13(a.isbn13);
  const bIsbn = canonicalIsbn13(b.isbn13);
  if (aIsbn && bIsbn && aIsbn === bIsbn) return { kind: 'isbn13', value: aIsbn };
  if (a.openLibraryWorkId && a.openLibraryWorkId === b.openLibraryWorkId) {
    return { kind: 'openLibraryWorkId', value: a.openLibraryWorkId };
  }
  if (a.hardcoverId && a.hardcoverId === b.hardcoverId) {
    return { kind: 'hardcoverId', value: a.hardcoverId };
  }
  if (a.googleVolumeId && a.googleVolumeId === b.googleVolumeId) {
    return { kind: 'googleVolumeId', value: a.googleVolumeId };
  }
  return null;
}

export function mergeBookExternalIds(primary: BookExternalIds, filler: BookExternalIds): BookExternalIds {
  return {
    isbn10: primary.isbn10 ?? filler.isbn10,
    isbn13: canonicalIsbn13(primary.isbn13) ?? canonicalIsbn13(filler.isbn13) ?? primary.isbn13 ?? filler.isbn13,
    openLibraryWorkId: primary.openLibraryWorkId ?? filler.openLibraryWorkId,
    openLibraryEditionId: primary.openLibraryEditionId ?? filler.openLibraryEditionId,
    hardcoverId: primary.hardcoverId ?? filler.hardcoverId,
    googleVolumeId: primary.googleVolumeId ?? filler.googleVolumeId,
    goodreadsId: primary.goodreadsId ?? filler.goodreadsId,
    asin: primary.asin ?? filler.asin,
  };
}

/**
 * Merge editions by identity priority. `primary` wins for structure + covers;
 * `filler` only supplies missing blurb / pageCount (and missing ids).
 */
export function mergeBookEditions(primary: BookEdition, filler: BookEdition): BookEdition {
  return {
    id: primary.id || filler.id,
    workId: primary.workId || filler.workId,
    title: primary.title || filler.title,
    format: primary.format,
    pageCount: primary.pageCount ?? filler.pageCount,
    publishedYear: primary.publishedYear ?? filler.publishedYear,
    publisher: primary.publisher ?? filler.publisher,
    language: primary.language ?? filler.language,
    coverUrl: primary.coverUrl ?? filler.coverUrl,
    blurb: primary.blurb?.trim() ? primary.blurb : filler.blurb,
    ids: mergeBookExternalIds(primary.ids, filler.ids),
  };
}

/**
 * Merge works. Open Library (primary) owns structure, editions list, and covers;
 * filler only fills missing blurb and edition page counts / blurbs via matching.
 * Never invents editions — only keeps primary editions, enriched where matched.
 */
export function mergeBookWorks(primary: BookWork, filler: BookWork): BookWork {
  const editions = primary.editions.map((edition) => {
    const match = filler.editions.find((candidate) => bookMergeKey(edition.ids, candidate.ids));
    return match ? mergeBookEditions(edition, match) : edition;
  });
  return {
    id: primary.id || filler.id,
    title: primary.title || filler.title,
    authors: primary.authors.length > 0 ? primary.authors : filler.authors,
    firstPublishedYear: primary.firstPublishedYear ?? filler.firstPublishedYear,
    blurb: primary.blurb?.trim() ? primary.blurb : filler.blurb,
    coverUrl: primary.coverUrl ?? filler.coverUrl,
    subjects: primary.subjects.length > 0 ? primary.subjects : filler.subjects,
    ids: mergeBookExternalIds(primary.ids, filler.ids),
    editions,
  };
}

export function preferBookWork(a: BookWork, b: BookWork): BookWork {
  const key = bookMergeKey(a.ids, b.ids);
  if (!key) return a;
  const aHasOl = Boolean(a.ids.openLibraryWorkId);
  const bHasOl = Boolean(b.ids.openLibraryWorkId);
  if (aHasOl && !bHasOl) return mergeBookWorks(a, b);
  if (bHasOl && !aHasOl) return mergeBookWorks(b, a);
  // Same source class: keep the one that already carries editions if the other is empty.
  if (a.editions.length >= b.editions.length) return mergeBookWorks(a, b);
  return mergeBookWorks(b, a);
}

export function bookMergeRank(kind: BookMergeKey['kind']): number {
  return MERGE_RANK[kind];
}
