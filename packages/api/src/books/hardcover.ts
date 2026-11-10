import {
  canonicalIsbn13,
  detectBookFormat,
  emptyBookExternalIds,
  normalizeIsbn,
  type BookEdition,
  type BookSearchHit,
  type BookWork,
} from '@kinexus/domain';

import { getBookCache, type BookCacheStore } from './cache.js';
import { booksFetch, type BookHttpDeps } from './http.js';
import type { BookProvider } from './provider.js';

const HARDCOVER_URL = 'https://api.hardcover.app/v1/graphql';

export function isHardcoverEnabled(): boolean {
  return Boolean(process.env.HARDCOVER_API_TOKEN?.trim());
}

export type HardcoverDeps = BookHttpDeps & {
  cache?: BookCacheStore;
  token?: string;
};

type HcBook = {
  id?: number | string;
  title?: string;
  description?: string | null;
  pages?: number | null;
  release_year?: number | null;
  image?: { url?: string | null } | null;
  contributions?: Array<{ author?: { name?: string | null } | null } | null> | null;
  editions?: Array<{
    id?: number | string;
    title?: string | null;
    pages?: number | null;
    audio_seconds?: number | null;
    edition_format?: string | null;
    isbn_10?: string | null;
    isbn_13?: string | null;
    asin?: string | null;
  } | null> | null;
};

async function hardcoverGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
  deps: HardcoverDeps,
): Promise<T> {
  const token = deps.token ?? process.env.HARDCOVER_API_TOKEN?.trim();
  if (!token) throw new Error('Hardcover is not configured');
  const response = await booksFetch(
    'hardcover',
    HARDCOVER_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    },
    deps,
  );
  if (!response.ok) throw new Error(`Hardcover request failed (HTTP ${response.status})`);
  const payload = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? 'Hardcover GraphQL error');
  }
  if (!payload.data) throw new Error('Hardcover returned no data');
  return payload.data;
}

function authorsOf(book: HcBook): string[] {
  return (book.contributions ?? [])
    .map((row) => row?.author?.name?.trim())
    .filter((name): name is string => Boolean(name));
}

function editionFromHc(book: HcBook, row: NonNullable<NonNullable<HcBook['editions']>[number]>, workId: string): BookEdition {
  const id = String(row.id ?? '');
  const isbn13 = canonicalIsbn13(row.isbn_13) ?? canonicalIsbn13(row.isbn_10);
  const isbn10 = normalizeIsbn(row.isbn_10);
  const format = detectBookFormat(row.edition_format, row.audio_seconds ? 'audiobook' : null);
  return {
    id: id || `hc-ed-${workId}`,
    workId,
    title: (row.title ?? book.title ?? 'Untitled').trim(),
    format,
    pageCount: Number.isFinite(row.pages) ? Number(row.pages) : null,
    publishedYear: null,
    publisher: null,
    language: null,
    coverUrl: book.image?.url ?? null,
    blurb: null,
    ids: {
      ...emptyBookExternalIds(),
      isbn10: isbn10?.length === 10 ? isbn10 : null,
      isbn13,
      hardcoverId: workId,
      asin: row.asin?.toUpperCase() ?? null,
    },
  };
}

function workFromHc(book: HcBook): BookWork | null {
  if (book.id == null || !book.title?.trim()) return null;
  const workId = String(book.id);
  const editions = (book.editions ?? [])
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => editionFromHc(book, row, workId));
  return {
    id: workId,
    title: book.title.trim(),
    authors: authorsOf(book).map((name) => ({ name, openLibraryAuthorId: null })),
    firstPublishedYear: Number.isFinite(book.release_year) ? Number(book.release_year) : null,
    blurb: book.description?.trim() || null,
    coverUrl: book.image?.url ?? null,
    subjects: [],
    ids: {
      ...emptyBookExternalIds(),
      hardcoverId: workId,
      isbn13: editions.find((e) => e.ids.isbn13)?.ids.isbn13 ?? null,
      isbn10: editions.find((e) => e.ids.isbn10)?.ids.isbn10 ?? null,
      asin: editions.find((e) => e.ids.asin)?.ids.asin ?? null,
    },
    editions,
  };
}

function hitFromHc(book: HcBook): BookSearchHit | null {
  const work = workFromHc(book);
  if (!work) return null;
  return {
    workId: work.id,
    title: work.title,
    authors: work.authors.map((a) => a.name),
    firstPublishedYear: work.firstPublishedYear,
    coverUrl: work.coverUrl,
    editionCount: Math.max(work.editions.length, 1),
    ids: work.ids,
  };
}

const SEARCH_QUERY = `
  query SearchBooks($query: String!) {
    search(query: $query, query_type: Book, per_page: 10) {
      results
    }
  }
`;

const BOOK_QUERY = `
  query BookById($id: Int!) {
    books(where: { id: { _eq: $id } }, limit: 1) {
      id
      title
      description
      pages
      release_year
      image { url }
      contributions { author { name } }
      editions {
        id
        title
        pages
        audio_seconds
        edition_format
        isbn_10
        isbn_13
        asin
      }
    }
  }
`;

export function createHardcoverProvider(deps: HardcoverDeps = {}): BookProvider | null {
  if (!(deps.token ?? process.env.HARDCOVER_API_TOKEN?.trim())) return null;
  const cache = deps.cache ?? getBookCache();

  async function cached<T>(key: string, kind: 'search' | 'work' | 'edition', load: () => Promise<T>): Promise<T> {
    const hit = await cache.get<T>('hardcover', key);
    if (hit != null) return hit;
    const value = await load();
    await cache.set('hardcover', key, kind, value);
    return value;
  }

  async function searchBooks(query: string): Promise<BookSearchHit[]> {
    const q = query.trim();
    if (!q) return [];
    return cached(`search:${q.toLowerCase()}`, 'search', async () => {
      const data = await hardcoverGraphql<{ search?: { results?: unknown } }>(SEARCH_QUERY, { query: q }, deps);
      const results = data.search?.results;
      const books: HcBook[] = Array.isArray(results)
        ? (results as HcBook[])
        : Array.isArray((results as { hits?: unknown })?.hits)
          ? ((results as { hits: HcBook[] }).hits ?? [])
          : [];
      const hits: BookSearchHit[] = [];
      for (const book of books) {
        const hit = hitFromHc(book);
        if (hit) hits.push(hit);
      }
      return hits;
    });
  }

  async function lookupWork(workId: string): Promise<BookWork | null> {
    const id = Number(workId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return cached(`work:${id}`, 'work', async () => {
      const data = await hardcoverGraphql<{ books?: HcBook[] }>(BOOK_QUERY, { id }, deps);
      const book = data.books?.[0];
      return book ? workFromHc(book) : null;
    });
  }

  return {
    name: 'hardcover',
    searchBooks,
    lookupWork,
    async lookupEdition() {
      return null;
    },
    async listEditionsForWork(workId) {
      const work = await lookupWork(workId);
      return work?.editions ?? [];
    },
    async resolveBookUrl() {
      return [];
    },
    getCoverUrl() {
      return null;
    },
  };
}

export function hardcoverProvider(deps?: HardcoverDeps): BookProvider | null {
  return createHardcoverProvider(deps);
}
