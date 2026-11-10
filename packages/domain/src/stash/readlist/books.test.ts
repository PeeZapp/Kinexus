import { describe, expect, it } from 'vitest';

import {
  bookMergeKey,
  canonicalIsbn13,
  detectBookFormat,
  emptyBookExternalIds,
  isValidIsbn,
  isbn10ToIsbn13,
  mergeBookWorks,
  normalizeIsbn,
  type BookEdition,
  type BookWork,
} from './books';

function edition(partial: Partial<BookEdition> & Pick<BookEdition, 'id' | 'workId' | 'title'>): BookEdition {
  const { ids: idOverrides, ...rest } = partial;
  return {
    format: 'print',
    pageCount: null,
    publishedYear: null,
    publisher: null,
    language: null,
    coverUrl: null,
    blurb: null,
    ...rest,
    ids: { ...emptyBookExternalIds(), ...idOverrides },
  };
}

function work(partial: Partial<BookWork> & Pick<BookWork, 'id' | 'title'>): BookWork {
  const { ids: idOverrides, ...rest } = partial;
  return {
    authors: [],
    firstPublishedYear: null,
    blurb: null,
    coverUrl: null,
    subjects: [],
    editions: [],
    ...rest,
    ids: { ...emptyBookExternalIds(), ...idOverrides },
  };
}

describe('ISBN helpers', () => {
  it('normalises and validates ISBN-10/13', () => {
    expect(normalizeIsbn('0-306-40615-2')).toBe('0306406152');
    expect(isValidIsbn('0-306-40615-2')).toBe(true);
    expect(isbn10ToIsbn13('0306406152')).toBe('9780306406157');
    expect(canonicalIsbn13('0306406152')).toBe('9780306406157');
    expect(isValidIsbn('9780306406157')).toBe(true);
    expect(isValidIsbn('123')).toBe(false);
  });
});

describe('detectBookFormat', () => {
  it('detects audiobook and ebook; defaults to print', () => {
    expect(detectBookFormat('Audiobook CD')).toBe('audiobook');
    expect(detectBookFormat('Kindle Edition')).toBe('ebook');
    expect(detectBookFormat('Hardcover')).toBe('print');
    expect(detectBookFormat(null, undefined)).toBe('print');
  });
});

describe('merge priority', () => {
  it('matches ISBN13 before Open Library work id', () => {
    const a = { ...emptyBookExternalIds(), isbn13: '9780306406157', openLibraryWorkId: 'OL1W' };
    const b = { ...emptyBookExternalIds(), isbn13: '9780306406157', hardcoverId: '99' };
    expect(bookMergeKey(a, b)).toEqual({ kind: 'isbn13', value: '9780306406157' });
  });

  it('Open Library wins structure and covers; filler only supplies missing blurb/pages', () => {
    const primary = work({
      id: 'OL1W',
      title: 'Primary',
      blurb: null,
      coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
      ids: { ...emptyBookExternalIds(), openLibraryWorkId: 'OL1W', isbn13: '9780306406157' },
      editions: [
        edition({
          id: 'OL1M',
          workId: 'OL1W',
          title: 'Primary print',
          format: 'print',
          pageCount: null,
          blurb: null,
          coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
          ids: {
            ...emptyBookExternalIds(),
            isbn13: '9780306406157',
            openLibraryEditionId: 'OL1M',
            openLibraryWorkId: 'OL1W',
          },
        }),
      ],
    });
    const filler = work({
      id: 'g-1',
      title: 'Filler',
      blurb: 'A short blurb',
      coverUrl: 'https://example.com/other.jpg',
      ids: { ...emptyBookExternalIds(), googleVolumeId: 'g-1', isbn13: '9780306406157' },
      editions: [
        edition({
          id: 'g-1',
          workId: 'g-1',
          title: 'Filler print',
          format: 'print',
          pageCount: 320,
          blurb: 'Edition blurb',
          coverUrl: 'https://example.com/other.jpg',
          ids: { ...emptyBookExternalIds(), googleVolumeId: 'g-1', isbn13: '9780306406157' },
        }),
        edition({
          id: 'invented',
          workId: 'g-1',
          title: 'Should not appear',
          format: 'ebook',
          ids: { ...emptyBookExternalIds(), googleVolumeId: 'invented' },
        }),
      ],
    });

    const merged = mergeBookWorks(primary, filler);
    expect(merged.id).toBe('OL1W');
    expect(merged.coverUrl).toBe('https://covers.openlibrary.org/b/id/1-L.jpg');
    expect(merged.blurb).toBe('A short blurb');
    expect(merged.editions).toHaveLength(1);
    expect(merged.editions[0]?.pageCount).toBe(320);
    expect(merged.editions[0]?.blurb).toBe('Edition blurb');
    expect(merged.editions[0]?.coverUrl).toBe('https://covers.openlibrary.org/b/id/1-L.jpg');
  });
});
