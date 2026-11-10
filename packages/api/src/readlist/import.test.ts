import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseGoodreadsCsv,
  type GoodreadsImportRow,
} from '@kinexus/domain';

const resolveBookUrl = vi.fn();
const searchBooks = vi.fn();
const lookupWork = vi.fn();
const rpc = vi.fn();
const from = vi.fn();

vi.mock('../books/compose.js', () => ({
  getBookProvider: () => ({ resolveBookUrl, searchBooks, lookupWork }),
}));

vi.mock('../auth.js', () => ({
  readBearerToken: () => 'token',
  createUserClient: () => ({ rpc, from }),
}));

import { commitReadlistImport, parseCommitRows } from './import-commit.js';
import { matchReadlistImportRows, READLIST_IMPORT_MATCH_BATCH_CAP } from './import-match.js';
import { handleReadlistImportCommit, handleReadlistImportMatch } from './handlers.js';
import { createUserClient } from '../auth.js';

const FIXTURE = `Book Id,Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Binding,Number of Pages,Date Read,Date Added,Exclusive Shelf,My Review,Private Notes,Read Count
1,The Hobbit,J.R.R. Tolkien,,="0440234743",="9780440234746",5,Paperback,320,2021-06-20,2019-06-01,read,"Loved it",secret,2
2,Dune,Frank Herbert,,="0441172717",="9780441172719",4,Paperback,688,2018-03-01,2018-01-01,read,,,1
3,Project Hail Mary,Andy Weir,,="",="9780593135204",0,Kindle Edition,476,,2022-02-01,currently-reading,,,0
4,The Martian,Andy Weir,,="",="9780804139021",0,Audible Audio,0,,2021-05-01,to-read,,,0
5,Custom Club Pick,Jane Doe,,="",="",0,Hardcover,200,,2023-01-01,book-club,"ignore",secret,0
`;

function hit(workId: string, title: string, authors: string[], isbn13?: string) {
  return {
    workId,
    title,
    authors,
    firstPublishedYear: null,
    coverUrl: null,
    editionCount: 1,
    ids: {
      isbn10: null,
      isbn13: isbn13 ?? null,
      openLibraryWorkId: workId,
      openLibraryEditionId: null,
      hardcoverId: null,
      googleVolumeId: null,
      goodreadsId: null,
      asin: null,
    },
  };
}

describe('readlist Goodreads import match/commit', () => {
  beforeEach(() => {
    resolveBookUrl.mockReset();
    searchBooks.mockReset();
    lookupWork.mockReset();
    rpc.mockReset();
    from.mockReset();
  });

  it('parses fixture ISBN wrappers / audiobook / re-read / custom shelf', () => {
    const rows = parseGoodreadsCsv(FIXTURE);
    expect(rows.find((row) => row.title === 'The Hobbit')?.isbn13).toBe('9780440234746');
    expect(rows.find((row) => row.title === 'The Martian')?.format).toBe('audiobook');
    expect(rows.find((row) => row.title === 'Custom Club Pick')?.status).toBe('want_to_read');
    expect(JSON.stringify(rows)).not.toMatch(/Loved it|secret|ignore/i);
  });

  it('matches ≥95% of ISBN13 rows as exact without writing', async () => {
    const parsed = parseGoodreadsCsv(FIXTURE);
    const withIsbn = parsed.filter((row) => row.isbn13);
    resolveBookUrl.mockImplementation(async (isbn: string) => {
      const row = withIsbn.find((item) => item.isbn13 === isbn || item.isbn10 === isbn);
      if (!row) return [];
      return [hit(`OL-${row.isbn13}`, row.title, [row.author ?? ''], row.isbn13 ?? undefined)];
    });
    searchBooks.mockResolvedValue([]);

    const result = await matchReadlistImportRows(withIsbn);
    const exactRate = result.counts.exact / result.counts.total;
    expect(exactRate).toBeGreaterThanOrEqual(0.95);
    expect(result.counts.matched).toBe(result.counts.exact);
    expect(rpc).not.toHaveBeenCalled();
    expect(lookupWork).not.toHaveBeenCalled();
  });

  it('does not write on match handler', async () => {
    resolveBookUrl.mockResolvedValue([hit('OL1W', 'The Hobbit', ['J.R.R. Tolkien'], '9780440234746')]);
    const rows: GoodreadsImportRow[] = parseGoodreadsCsv(FIXTURE).slice(0, 1);
    const result = await handleReadlistImportMatch('user-1', { rows });
    expect(result.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('enforces match batch cap', async () => {
    await expect(
      matchReadlistImportRows(
        Array.from({ length: READLIST_IMPORT_MATCH_BATCH_CAP + 1 }, (_, i) => ({
          key: String(i),
          bookId: null,
          title: `Book ${i}`,
          author: null,
          additionalAuthors: null,
          isbn10: null,
          isbn13: null,
          myRating: 0,
          score: null,
          binding: null,
          format: 'print' as const,
          pages: null,
          dateRead: null,
          dateAdded: null,
          exclusiveShelf: 'to-read',
          status: 'want_to_read' as const,
          readCount: null,
        })),
      ),
    ).rejects.toThrow(/at most/i);
  });

  it('commit writes exact+likely, returns checkThese, dedupes by work', async () => {
    const chain = (result: unknown) => {
      const api: Record<string, unknown> = {};
      api.select = () => api;
      api.eq = () => api;
      api.in = () => api;
      api.limit = () => api;
      api.maybeSingle = async () => result;
      return api;
    };
    from.mockImplementation((table: string) => {
      if (table === 'readlist_works') return chain({ data: null, error: null });
      if (table === 'readlist_editions') return chain({ data: { id: 'ed-1' }, error: null });
      return chain({ data: null, error: null });
    });

    lookupWork.mockResolvedValue({
      id: 'OL1W',
      title: 'The Hobbit',
      authors: [{ name: 'J.R.R. Tolkien', openLibraryAuthorId: null }],
      firstPublishedYear: 1937,
      blurb: null,
      coverUrl: null,
      subjects: [],
      ids: {
        isbn10: '0440234743',
        isbn13: '9780440234746',
        openLibraryWorkId: 'OL1W',
        openLibraryEditionId: null,
        hardcoverId: null,
        googleVolumeId: null,
        goodreadsId: null,
        asin: null,
      },
      editions: [
        {
          id: 'OL-ed',
          workId: 'OL1W',
          title: 'The Hobbit',
          format: 'print',
          pageCount: 320,
          publishedYear: 2001,
          publisher: null,
          language: null,
          coverUrl: null,
          blurb: null,
          ids: {
            isbn10: '0440234743',
            isbn13: '9780440234746',
            openLibraryWorkId: 'OL1W',
            openLibraryEditionId: 'OL-ed',
            hardcoverId: null,
            googleVolumeId: null,
            goodreadsId: null,
            asin: null,
          },
        },
      ],
    });

    rpc.mockImplementation(async (name: string) => {
      if (name === 'upsert_readlist_work') return { data: 'work-uuid', error: null };
      if (name === 'add_readlist_item') return { data: 'item-uuid', error: null };
      if (name === 'upsert_readlist_review') return { data: 'review-uuid', error: null };
      return { data: null, error: null };
    });

    const client = createUserClient('token');
    const result = await commitReadlistImport({
      client,
      listId: 'list-1',
      rows: [
        {
          key: '0',
          tier: 'exact',
          workId: 'OL1W',
          title: 'The Hobbit',
          author: 'J.R.R. Tolkien',
          isbn10: '0440234743',
          isbn13: '9780440234746',
          score: 10,
          format: 'print',
          status: 'finished',
        },
        {
          key: '1',
          tier: 'exact',
          workId: 'OL1W',
          title: 'The Hobbit',
          author: 'J.R.R. Tolkien',
          isbn10: '0440234743',
          isbn13: '9780440234746',
          score: 10,
          format: 'print',
          status: 'finished',
        },
        {
          key: '2',
          tier: 'unsure',
          workId: null,
          title: 'Custom Club Pick',
          author: 'Jane Doe',
          isbn10: null,
          isbn13: null,
          score: null,
          format: 'print',
          status: 'want_to_read',
        },
        {
          key: '3',
          tier: 'none',
          workId: null,
          title: 'Missing',
          author: null,
          isbn10: null,
          isbn13: null,
          score: null,
          format: 'print',
          status: 'want_to_read',
        },
      ],
    });

    expect(result.progress.imported).toBe(1);
    expect(result.progress.skippedDuplicate).toBe(1);
    expect(result.checkThese).toHaveLength(2);
    expect(rpc.mock.calls.some((call) => call[0] === 'add_readlist_item')).toBe(true);
    expect(rpc.mock.calls.some((call) => call[0] === 'upsert_readlist_review')).toBe(true);
  });

  it('commit handler requires listId and rows', async () => {
    const request = new Request('http://localhost/readlist/import/commit', {
      headers: { Authorization: 'Bearer token' },
    });
    const empty = await handleReadlistImportCommit('user-1', { listId: 'list-1', rows: [] }, request);
    expect(empty.status).toBe(400);
    expect(parseCommitRows([{ key: '1', title: 'A', tier: 'exact', status: 'want_to_read', format: 'print' }])).toHaveLength(
      1,
    );
  });
});
