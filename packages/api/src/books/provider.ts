import type { BookEdition, BookSearchHit, BookWork } from '@kinexus/domain';

export type BookProviderName = 'open_library' | 'hardcover' | 'google_books';

export type BookProvider = {
  readonly name: BookProviderName | 'composed';
  searchBooks(query: string): Promise<BookSearchHit[]>;
  lookupWork(workId: string): Promise<BookWork | null>;
  lookupEdition(editionId: string): Promise<BookEdition | null>;
  listEditionsForWork(workId: string): Promise<BookEdition[]>;
  resolveBookUrl(urlOrIsbn: string): Promise<BookSearchHit[]>;
  getCoverUrl(input: {
    coverId?: number | string | null;
    isbn?: string | null;
    openLibraryEditionId?: string | null;
    size?: 'S' | 'M' | 'L';
  }): string | null;
};

export type BookCacheKind = 'search' | 'work' | 'edition' | 'cover' | 'collection';

export const BOOK_CACHE_TTL_MS: Record<BookCacheKind, number> = {
  search: 24 * 60 * 60 * 1000,
  work: 7 * 24 * 60 * 60 * 1000,
  edition: 7 * 24 * 60 * 60 * 1000,
  cover: 30 * 24 * 60 * 60 * 1000,
  collection: 7 * 24 * 60 * 60 * 1000,
};
