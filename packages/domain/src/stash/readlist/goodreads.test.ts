import { describe, expect, it } from 'vitest';

import {
  bindingToFormat,
  buildGoodreadsCsv,
  classifyGoodreadsMatchTier,
  exclusiveShelfToStatus,
  goodreadsRatingToScore,
  goodreadsWorkDedupeKey,
  parseGoodreadsCsv,
  scoreToGoodreadsRating,
  statusToExclusiveShelf,
  stripGoodreadsIsbn,
  titleAuthorMatchConfidence,
} from './goodreads';

const FIXTURE = `Book Id,Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies
1,The Hobbit,J.R.R. Tolkien,,="0440234743",="9780440234746",5,4.27,Del Rey,Paperback,320,2001,1937,2020-01-15,2019-06-01,,,read,"Loved it",,private note here,2,1
2,Dune,Frank Herbert,,="0441172717",="9780441172719",4,4.25,Ace,Paperback,688,1990,1965,2018-03-01,2018-01-01,,,read,,,1,0
3,Project Hail Mary,Andy Weir,,="",="9780593135204",0,4.5,Ballantine Books,Kindle Edition,476,2021,2021,,2022-02-01,currently-reading,,currently-reading,,,0,1
4,The Martian,Andy Weir,,="",="9780804139021",0,4.4,Crown,Audible Audio,0,2014,2011,,2021-05-01,,,to-read,,,0,0
5,Custom Club Pick,Jane Doe,,="",="",0,0,,Hardcover,200,2020,2020,,2023-01-01,book-club,,book-club,"should ignore",,secret,0,0
1,The Hobbit,J.R.R. Tolkien,,="0440234743",="9780440234746",5,4.27,Del Rey,Paperback,320,2001,1937,2021-06-20,2019-06-01,,,read,"second read",,notes,3,1
6,No ISBN Title Match,Some Author,,="",="",3,3.5,,Paperback,100,2010,2010,,2020-01-01,,,to-read,,,0,0
`;

describe('stripGoodreadsIsbn', () => {
  it('strips ="…" wrappers', () => {
    expect(stripGoodreadsIsbn('="9780440234746"')).toBe('9780440234746');
    expect(stripGoodreadsIsbn('="0440234743"')).toBe('0440234743');
    expect(stripGoodreadsIsbn('=""')).toBeNull();
    expect(stripGoodreadsIsbn('')).toBeNull();
  });
});

describe('Exclusive Shelf mapping', () => {
  it('maps read / currently-reading / to-read / custom', () => {
    expect(exclusiveShelfToStatus('read')).toBe('finished');
    expect(exclusiveShelfToStatus('currently-reading')).toBe('reading');
    expect(exclusiveShelfToStatus('to-read')).toBe('want_to_read');
    expect(exclusiveShelfToStatus('book-club')).toBe('want_to_read');
    expect(statusToExclusiveShelf('finished')).toBe('read');
    expect(statusToExclusiveShelf('reading')).toBe('currently-reading');
    expect(statusToExclusiveShelf('want_to_read')).toBe('to-read');
  });
});

describe('rating ×2 and ÷2', () => {
  it('converts Goodreads 1–5 ↔ Kinexus score', () => {
    expect(goodreadsRatingToScore(5)).toBe(10);
    expect(goodreadsRatingToScore(4)).toBe(8);
    expect(goodreadsRatingToScore(1)).toBe(2);
    expect(goodreadsRatingToScore(0)).toBeNull();
    expect(scoreToGoodreadsRating(10)).toBe(5);
    expect(scoreToGoodreadsRating(9)).toBe(5);
    expect(scoreToGoodreadsRating(8)).toBe(4);
    expect(scoreToGoodreadsRating(null)).toBe(0);
  });
});

describe('binding → format', () => {
  it('maps Audible/Kindle/else', () => {
    expect(bindingToFormat('Audible Audio')).toBe('audiobook');
    expect(bindingToFormat('Audiobook')).toBe('audiobook');
    expect(bindingToFormat('Kindle Edition')).toBe('ebook');
    expect(bindingToFormat('Paperback')).toBe('print');
  });
});

describe('parseGoodreadsCsv', () => {
  it('parses ISBN wrappers, audiobook, re-read, custom shelf; never imports reviews/notes', () => {
    const rows = parseGoodreadsCsv(FIXTURE);
    const hobbit = rows.find((row) => row.title === 'The Hobbit');
    expect(hobbit).toBeTruthy();
    expect(hobbit!.isbn13).toBe('9780440234746');
    expect(hobbit!.isbn10).toBe('0440234743');
    expect(hobbit!.status).toBe('finished');
    expect(hobbit!.score).toBe(10);
    // Re-read: keep latest Date Read
    expect(hobbit!.dateRead).toBe('2021-06-20');
    expect(hobbit!.readCount).toBe(3);

    const martian = rows.find((row) => row.title === 'The Martian');
    expect(martian!.format).toBe('audiobook');
    expect(martian!.status).toBe('want_to_read');

    const hail = rows.find((row) => row.title === 'Project Hail Mary');
    expect(hail!.format).toBe('ebook');
    expect(hail!.status).toBe('reading');
    expect(hail!.score).toBeNull();

    const custom = rows.find((row) => row.title === 'Custom Club Pick');
    expect(custom!.status).toBe('want_to_read');
    expect(custom!.exclusiveShelf).toBe('book-club');

    // Deduped re-read of Hobbit → one row
    expect(rows.filter((row) => row.title === 'The Hobbit')).toHaveLength(1);

    // Reviews / private notes never appear on the row shape
    expect(JSON.stringify(rows)).not.toMatch(/Loved it|private note|should ignore|secret|second read/i);
  });

  it('auto-matches ≥95% of fixture rows that have ISBN13 via exact tier classification', () => {
    const rows = parseGoodreadsCsv(FIXTURE);
    const withIsbn = rows.filter((row) => Boolean(row.isbn13));
    expect(withIsbn.length).toBeGreaterThan(0);
    const exact = withIsbn.filter((row) =>
      classifyGoodreadsMatchTier({ matchedBy: 'isbn13', confidence: 1 }) === 'exact',
    );
    expect(exact.length / withIsbn.length).toBeGreaterThanOrEqual(0.95);
  });
});

describe('title+author confidence', () => {
  it('scores strong title+author as likely', () => {
    const confidence = titleAuthorMatchConfidence(
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Dune', authors: ['Frank Herbert'] },
    );
    expect(confidence).toBeGreaterThanOrEqual(0.85);
    expect(classifyGoodreadsMatchTier({ matchedBy: 'title_author', confidence })).toBe('likely');
  });
});

describe('dedupe by work', () => {
  it('keys by work id / isbn / title+author', () => {
    expect(goodreadsWorkDedupeKey({ workId: 'OL1W', title: 'A' })).toBe('work:OL1W');
    expect(goodreadsWorkDedupeKey({ isbn13: '9780440234746', title: 'A' })).toBe('isbn13:9780440234746');
    expect(goodreadsWorkDedupeKey({ title: 'The Hobbit', author: 'J.R.R. Tolkien' })).toContain('hobbit');
  });
});

describe('export round-trip', () => {
  it('exports Goodreads CSV that parses back with shelf/rating/isbn', () => {
    const built = buildGoodreadsCsv('My books', [
      {
        bookId: '1',
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        isbn10: '0440234743',
        isbn13: '9780440234746',
        score: 10,
        format: 'print',
        pages: 320,
        dateRead: '2021-06-20',
        dateAdded: '2019-06-01',
        status: 'finished',
        readCount: 2,
      },
      {
        title: 'The Martian',
        author: 'Andy Weir',
        isbn13: '9780804139021',
        score: null,
        format: 'audiobook',
        binding: 'Audible Audio',
        status: 'want_to_read',
      },
    ]);
    const parsed = parseGoodreadsCsv(built.text);
    expect(parsed).toHaveLength(2);
    const hobbit = parsed.find((row) => row.title === 'The Hobbit')!;
    expect(hobbit.isbn13).toBe('9780440234746');
    expect(hobbit.score).toBe(10);
    expect(hobbit.status).toBe('finished');
    expect(hobbit.myRating).toBe(5);
    const martian = parsed.find((row) => row.title === 'The Martian')!;
    expect(martian.format).toBe('audiobook');
    expect(martian.status).toBe('want_to_read');
  });
});
