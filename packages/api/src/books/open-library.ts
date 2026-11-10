import {
  canonicalIsbn13,
  detectBookFormat,
  emptyBookExternalIds,
  normalizeIsbn,
  type BookAuthor,
  type BookEdition,
  type BookSearchHit,
  type BookWork,
} from '@kinexus/domain';

import { getBookCache, type BookCacheStore } from './cache.js';
import { booksFetch, type BookFetch, type BookHttpDeps } from './http.js';
import { parseBookUrl } from './parse-url.js';
import type { BookProvider } from './provider.js';

const OL_BASE = 'https://openlibrary.org';
const OL_COVERS = 'https://covers.openlibrary.org';

type OlSearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
  isbn?: string[];
  cover_edition_key?: string;
};

type OlWorkPayload = {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
  subjects?: string[];
  authors?: Array<{ author?: { key?: string } }>;
  first_publish_date?: string;
};

type OlEditionPayload = {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  isbn_10?: string[];
  isbn_13?: string[];
  physical_format?: string;
  number_of_pages?: number;
  publishers?: string[];
  publish_date?: string;
  languages?: Array<{ key?: string }>;
  covers?: number[];
  works?: Array<{ key?: string }>;
  identifiers?: Record<string, string[]>;
};

export type OpenLibraryDeps = BookHttpDeps & {
  cache?: BookCacheStore;
};

function yearFrom(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function descriptionOf(value: string | { value?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  return value.value?.trim() || null;
}

function workIdFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const match = key.match(/(OL\d+W)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function editionIdFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const match = key.match(/(OL\d+M)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function authorIdFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const match = key.match(/(OL\d+A)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function coverUrlFromId(coverId: number | string | null | undefined, size: 'S' | 'M' | 'L' = 'L'): string | null {
  if (coverId == null || coverId === '') return null;
  return `${OL_COVERS}/b/id/${coverId}-${size}.jpg`;
}

function pickIsbn13(isbns: string[] | undefined): string | null {
  for (const raw of isbns ?? []) {
    const value = canonicalIsbn13(raw);
    if (value) return value;
  }
  return null;
}

function pickIsbn10(isbns: string[] | undefined): string | null {
  for (const raw of isbns ?? []) {
    const value = normalizeIsbn(raw);
    if (value?.length === 10) return value;
  }
  return null;
}

async function olGetJson<T>(path: string, deps: OpenLibraryDeps): Promise<T> {
  const url = path.startsWith('http') ? path : `${OL_BASE}${path}`;
  const response = await booksFetch('open_library', url, { headers: { Accept: 'application/json' } }, deps);
  if (!response.ok) throw new Error(`Open Library request failed (HTTP ${response.status})`);
  return (await response.json()) as T;
}

function hitFromDoc(doc: OlSearchDoc): BookSearchHit | null {
  const workId = workIdFromKey(doc.key);
  if (!workId || !doc.title?.trim()) return null;
  const isbn13 = pickIsbn13(doc.isbn);
  const isbn10 = pickIsbn10(doc.isbn);
  return {
    workId,
    title: doc.title.trim(),
    authors: (doc.author_name ?? []).map((name) => name.trim()).filter(Boolean),
    firstPublishedYear: Number.isFinite(doc.first_publish_year) ? Number(doc.first_publish_year) : null,
    coverUrl: coverUrlFromId(doc.cover_i ?? null),
    editionCount: Number.isFinite(doc.edition_count) ? Number(doc.edition_count) : 0,
    ids: {
      ...emptyBookExternalIds(),
      isbn10,
      isbn13,
      openLibraryWorkId: workId,
      openLibraryEditionId: editionIdFromKey(doc.cover_edition_key),
    },
  };
}

function editionFromPayload(payload: OlEditionPayload, fallbackWorkId: string | null = null): BookEdition | null {
  const editionId = editionIdFromKey(payload.key);
  const workId = workIdFromKey(payload.works?.[0]?.key) ?? fallbackWorkId;
  if (!editionId || !workId || !payload.title?.trim()) return null;
  const isbn13 = pickIsbn13(payload.isbn_13) ?? pickIsbn13(payload.isbn_10);
  const isbn10 = pickIsbn10(payload.isbn_10);
  const goodreads = payload.identifiers?.goodreads?.[0] ?? null;
  const asin = payload.identifiers?.amazon?.[0]?.toUpperCase() ?? null;
  const lang = payload.languages?.[0]?.key?.replace('/languages/', '') ?? null;
  return {
    id: editionId,
    workId,
    title: payload.title.trim(),
    format: detectBookFormat(payload.physical_format),
    pageCount: Number.isFinite(payload.number_of_pages) ? Number(payload.number_of_pages) : null,
    publishedYear: yearFrom(payload.publish_date),
    publisher: payload.publishers?.[0]?.trim() || null,
    language: lang,
    coverUrl: coverUrlFromId(payload.covers?.[0] ?? null),
    blurb: descriptionOf(payload.description),
    ids: {
      ...emptyBookExternalIds(),
      isbn10,
      isbn13,
      openLibraryWorkId: workId,
      openLibraryEditionId: editionId,
      goodreadsId: goodreads,
      asin,
    },
  };
}

export function createOpenLibraryProvider(deps: OpenLibraryDeps = {}): BookProvider {
  const cache = deps.cache ?? getBookCache();

  async function cached<T>(key: string, kind: 'search' | 'work' | 'edition' | 'cover', load: () => Promise<T>): Promise<T> {
    const hit = await cache.get<T>('open_library', key);
    if (hit != null) return hit;
    const value = await load();
    await cache.set('open_library', key, kind, value);
    return value;
  }

  async function listEditionsForWork(workId: string): Promise<BookEdition[]> {
    const id = workIdFromKey(workId) ?? workId.toUpperCase();
    return cached(`editions:${id}`, 'edition', async () => {
      const payload = await olGetJson<{ entries?: OlEditionPayload[] }>(
        `/works/${id}/editions.json?limit=50`,
        deps,
      );
      const editions: BookEdition[] = [];
      for (const row of payload.entries ?? []) {
        const edition = editionFromPayload(row, id);
        if (edition) editions.push(edition);
      }
      return editions;
    });
  }

  async function lookupWork(workId: string): Promise<BookWork | null> {
    const id = workIdFromKey(workId) ?? workId.toUpperCase();
    if (!/^OL\d+W$/i.test(id)) return null;
    return cached(`work:${id}`, 'work', async () => {
      const payload = await olGetJson<OlWorkPayload>(`/works/${id}.json`, deps);
      const title = payload.title?.trim();
      if (!title) return null;
      const editions = await listEditionsForWork(id);
      const authors: BookAuthor[] = [];
      for (const row of payload.authors ?? []) {
        const authorKey = row.author?.key;
        if (!authorKey) continue;
        const authorId = authorIdFromKey(authorKey);
        let name = authorId ?? 'Unknown';
        try {
          const authorUrl = authorKey.startsWith('http') ? authorKey : `${OL_BASE}${authorKey}.json`;
          const authorPayload = await olGetJson<{ name?: string }>(authorUrl, deps);
          if (authorPayload.name?.trim()) name = authorPayload.name.trim();
        } catch {
          // keep placeholder — never invent author metadata beyond the key
        }
        authors.push({ name, openLibraryAuthorId: authorId });
      }
      const workBlurb = descriptionOf(payload.description);
      const editionBlurb = editions.find((edition) => edition.blurb?.trim())?.blurb?.trim() || null;
      return {
        id,
        title,
        authors,
        firstPublishedYear: yearFrom(payload.first_publish_date) ?? editions[0]?.publishedYear ?? null,
        blurb: workBlurb || editionBlurb,
        coverUrl: coverUrlFromId(payload.covers?.[0] ?? null) ?? editions.find((e) => e.coverUrl)?.coverUrl ?? null,
        subjects: (payload.subjects ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 40),
        ids: {
          ...emptyBookExternalIds(),
          openLibraryWorkId: id,
          isbn13: editions.find((e) => e.ids.isbn13)?.ids.isbn13 ?? null,
          isbn10: editions.find((e) => e.ids.isbn10)?.ids.isbn10 ?? null,
        },
        editions,
      } satisfies BookWork;
    });
  }

  async function lookupEdition(editionId: string): Promise<BookEdition | null> {
    const id = editionIdFromKey(editionId) ?? editionId.toUpperCase();
    if (!/^OL\d+M$/i.test(id)) return null;
    return cached(`edition:${id}`, 'edition', async () => {
      const payload = await olGetJson<OlEditionPayload>(`/books/${id}.json`, deps);
      return editionFromPayload(payload);
    });
  }

  async function searchBooks(query: string): Promise<BookSearchHit[]> {
    const q = query.trim();
    if (!q) return [];
    return cached(`search:${q.toLowerCase()}`, 'search', async () => {
      const url = new URL(`${OL_BASE}/search.json`);
      url.searchParams.set('q', q);
      url.searchParams.set('limit', '20');
      const payload = await olGetJson<{ docs?: OlSearchDoc[] }>(url.toString(), deps);
      const hits: BookSearchHit[] = [];
      for (const doc of payload.docs ?? []) {
        const hit = hitFromDoc(doc);
        if (hit) hits.push(hit);
      }
      return hits;
    });
  }

  async function searchByIsbn(isbn: string): Promise<BookSearchHit[]> {
    const normalised = canonicalIsbn13(isbn) ?? normalizeIsbn(isbn);
    if (!normalised) return [];
    return cached(`isbn:${normalised}`, 'search', async () => {
      const url = new URL(`${OL_BASE}/search.json`);
      url.searchParams.set('isbn', normalised);
      url.searchParams.set('limit', '5');
      const payload = await olGetJson<{ docs?: OlSearchDoc[] }>(url.toString(), deps);
      const hits: BookSearchHit[] = [];
      for (const doc of payload.docs ?? []) {
        const hit = hitFromDoc(doc);
        if (hit) hits.push(hit);
      }
      return hits;
    });
  }

  async function resolveBookUrl(urlOrIsbn: string): Promise<BookSearchHit[]> {
    const parsed = parseBookUrl(urlOrIsbn);
    switch (parsed.kind) {
      case 'invalid':
        throw Object.assign(new Error(parsed.reason), { status: 400 });
      case 'isbn':
      case 'openLibraryIsbn':
        return searchByIsbn(parsed.isbn);
      case 'openLibraryWork': {
        const work = await lookupWork(parsed.workId);
        if (!work) return [];
        return [
          {
            workId: work.id,
            title: work.title,
            authors: work.authors.map((a) => a.name),
            firstPublishedYear: work.firstPublishedYear,
            coverUrl: work.coverUrl,
            editionCount: work.editions.length,
            ids: work.ids,
          },
        ];
      }
      case 'openLibraryEdition': {
        const edition = await lookupEdition(parsed.editionId);
        if (!edition) return [];
        const work = await lookupWork(edition.workId);
        if (work) {
          return [
            {
              workId: work.id,
              title: work.title,
              authors: work.authors.map((a) => a.name),
              firstPublishedYear: work.firstPublishedYear,
              coverUrl: work.coverUrl ?? edition.coverUrl,
              editionCount: work.editions.length,
              ids: { ...work.ids, ...edition.ids, openLibraryWorkId: work.id },
            },
          ];
        }
        return [
          {
            workId: edition.workId,
            title: edition.title,
            authors: [],
            firstPublishedYear: edition.publishedYear,
            coverUrl: edition.coverUrl,
            editionCount: 1,
            ids: edition.ids,
          },
        ];
      }
      case 'goodreads': {
        if (parsed.query) return searchBooks(parsed.query);
        if (parsed.goodreadsId) return searchBooks(`goodreads ${parsed.goodreadsId}`);
        return [];
      }
      case 'asin':
        return searchBooks(parsed.asin);
      case 'amazonSearch':
      case 'googleSearch':
        return searchBooks(parsed.query);
      case 'googleVolume':
        return searchBooks(parsed.volumeId);
      case 'hardcover':
        if (parsed.query) return searchBooks(parsed.query);
        if (parsed.hardcoverId) return searchBooks(parsed.hardcoverId);
        return [];
      default:
        return [];
    }
  }

  return {
    name: 'open_library',
    searchBooks,
    lookupWork,
    lookupEdition,
    listEditionsForWork,
    resolveBookUrl,
    getCoverUrl(input) {
      if (input.coverId != null && input.coverId !== '') {
        return coverUrlFromId(input.coverId, input.size ?? 'L');
      }
      const isbn = canonicalIsbn13(input.isbn) ?? normalizeIsbn(input.isbn);
      if (isbn) return `${OL_COVERS}/b/isbn/${isbn}-${input.size ?? 'L'}.jpg`;
      const editionId = editionIdFromKey(input.openLibraryEditionId ?? null);
      if (editionId) return `${OL_COVERS}/b/olid/${editionId}-${input.size ?? 'L'}.jpg`;
      return null;
    },
  };
}

export function openLibraryProvider(deps?: OpenLibraryDeps): BookProvider {
  return createOpenLibraryProvider(deps);
}

/** Exposed for fixture tests that need to inject fetch without going through compose. */
export type { BookFetch };
