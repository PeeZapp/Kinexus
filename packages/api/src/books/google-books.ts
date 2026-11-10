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

const GB_BASE = 'https://www.googleapis.com/books/v1';

export function isGoogleBooksEnabled(): boolean {
  return (
    process.env.BOOKS_ENABLE_GOOGLE?.trim().toLowerCase() === 'true' &&
    Boolean(process.env.GOOGLE_BOOKS_API_KEY?.trim())
  );
}

export type GoogleBooksDeps = BookHttpDeps & {
  cache?: BookCacheStore;
  apiKey?: string;
};

type GbVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    publishedDate?: string;
    publisher?: string;
    language?: string;
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    printType?: string;
    categories?: string[];
  };
};

function yearFrom(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function idsFromVolume(volume: GbVolume) {
  const ids = emptyBookExternalIds();
  ids.googleVolumeId = volume.id ?? null;
  for (const row of volume.volumeInfo?.industryIdentifiers ?? []) {
    const value = row.identifier?.trim();
    if (!value) continue;
    if (row.type === 'ISBN_13') ids.isbn13 = canonicalIsbn13(value);
    if (row.type === 'ISBN_10') ids.isbn10 = normalizeIsbn(value);
  }
  if (!ids.isbn13 && ids.isbn10) ids.isbn13 = canonicalIsbn13(ids.isbn10);
  return ids;
}

function coverOf(volume: GbVolume): string | null {
  const links = volume.volumeInfo?.imageLinks;
  const url = links?.thumbnail ?? links?.smallThumbnail ?? null;
  return url ? url.replace('http://', 'https://') : null;
}

function editionFromVolume(volume: GbVolume): BookEdition | null {
  const id = volume.id;
  const title = volume.volumeInfo?.title?.trim();
  if (!id || !title) return null;
  const ids = idsFromVolume(volume);
  return {
    id,
    workId: id,
    title,
    format: detectBookFormat(volume.volumeInfo?.printType, title),
    pageCount: Number.isFinite(volume.volumeInfo?.pageCount) ? Number(volume.volumeInfo?.pageCount) : null,
    publishedYear: yearFrom(volume.volumeInfo?.publishedDate),
    publisher: volume.volumeInfo?.publisher?.trim() || null,
    language: volume.volumeInfo?.language ?? null,
    coverUrl: coverOf(volume),
    blurb: volume.volumeInfo?.description?.trim() || null,
    ids,
  };
}

function workFromVolume(volume: GbVolume): BookWork | null {
  const edition = editionFromVolume(volume);
  if (!edition || !volume.id) return null;
  return {
    id: volume.id,
    title: edition.title,
    authors: (volume.volumeInfo?.authors ?? []).map((name) => ({
      name,
      openLibraryAuthorId: null,
    })),
    firstPublishedYear: edition.publishedYear,
    blurb: edition.blurb,
    coverUrl: edition.coverUrl,
    subjects: (volume.volumeInfo?.categories ?? []).slice(0, 20),
    ids: edition.ids,
    editions: [edition],
  };
}

function hitFromVolume(volume: GbVolume): BookSearchHit | null {
  const work = workFromVolume(volume);
  if (!work) return null;
  return {
    workId: work.id,
    title: work.title,
    authors: work.authors.map((a) => a.name),
    firstPublishedYear: work.firstPublishedYear,
    coverUrl: work.coverUrl,
    editionCount: 1,
    ids: work.ids,
  };
}

export function createGoogleBooksProvider(deps: GoogleBooksDeps = {}): BookProvider | null {
  const apiKey = deps.apiKey ?? process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (!apiKey) return null;
  if (deps.apiKey == null && !isGoogleBooksEnabled()) return null;

  const cache = deps.cache ?? getBookCache();

  async function gbGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${GB_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    url.searchParams.set('key', apiKey);
    const response = await booksFetch('google_books', url.toString(), { headers: { Accept: 'application/json' } }, deps);
    if (!response.ok) throw new Error(`Google Books request failed (HTTP ${response.status})`);
    return (await response.json()) as T;
  }

  async function cached<T>(key: string, kind: 'search' | 'work' | 'edition', load: () => Promise<T>): Promise<T> {
    const hit = await cache.get<T>('google_books', key);
    if (hit != null) return hit;
    const value = await load();
    await cache.set('google_books', key, kind, value);
    return value;
  }

  async function searchBooks(query: string): Promise<BookSearchHit[]> {
    const q = query.trim();
    if (!q) return [];
    return cached(`search:${q.toLowerCase()}`, 'search', async () => {
      const payload = await gbGet<{ items?: GbVolume[] }>('/volumes', { q, maxResults: '20' });
      const hits: BookSearchHit[] = [];
      for (const item of payload.items ?? []) {
        const hit = hitFromVolume(item);
        if (hit) hits.push(hit);
      }
      return hits;
    });
  }

  async function lookupWork(workId: string): Promise<BookWork | null> {
    const id = workId.trim();
    if (!id) return null;
    return cached(`work:${id}`, 'work', async () => {
      const volume = await gbGet<GbVolume>(`/volumes/${encodeURIComponent(id)}`, {});
      return workFromVolume(volume);
    });
  }

  return {
    name: 'google_books',
    searchBooks,
    lookupWork,
    async lookupEdition(editionId) {
      const work = await lookupWork(editionId);
      return work?.editions[0] ?? null;
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

export function googleBooksProvider(deps?: GoogleBooksDeps): BookProvider | null {
  return createGoogleBooksProvider(deps);
}
