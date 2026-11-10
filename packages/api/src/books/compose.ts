import { bookMergeKey, mergeBookWorks, type BookSearchHit, type BookWork } from '@kinexus/domain';

import { getBookCache, type BookCacheStore } from './cache.js';
import { createGoogleBooksProvider, isGoogleBooksEnabled } from './google-books.js';
import { createHardcoverProvider, isHardcoverEnabled } from './hardcover.js';
import { type BookHttpDeps } from './http.js';
import { createOpenLibraryProvider } from './open-library.js';
import { parseBookUrl } from './parse-url.js';
import type { BookProvider } from './provider.js';

export type GetBookProviderDeps = BookHttpDeps & {
  cache?: BookCacheStore;
  enableHardcover?: boolean;
  enableGoogle?: boolean;
};

function hitFromWork(work: BookWork): BookSearchHit {
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

async function fillMissingFrom(
  primary: BookWork,
  fillers: Array<BookProvider | null>,
): Promise<BookWork> {
  let merged = primary;
  for (const filler of fillers) {
    if (!filler) continue;
    // Prefer ISBN match into filler catalogs; never invent editions.
    const isbn = merged.ids.isbn13;
    let candidate: BookWork | null = null;
    if (isbn) {
      const hits = await filler.searchBooks(`isbn:${isbn}`).catch(() => []);
      const hit = hits.find((row) => bookMergeKey(merged.ids, row.ids));
      if (hit) candidate = await filler.lookupWork(hit.workId).catch(() => null);
    }
    if (!candidate && merged.ids.hardcoverId && filler.name === 'hardcover') {
      candidate = await filler.lookupWork(merged.ids.hardcoverId).catch(() => null);
    }
    if (!candidate && merged.ids.googleVolumeId && filler.name === 'google_books') {
      candidate = await filler.lookupWork(merged.ids.googleVolumeId).catch(() => null);
    }
    if (candidate && bookMergeKey(merged.ids, candidate.ids)) {
      merged = mergeBookWorks(merged, candidate);
    }
  }
  return merged;
}

export function getBookProvider(deps: GetBookProviderDeps = {}): BookProvider {
  const cache = deps.cache ?? getBookCache();
  const shared = { fetchImpl: deps.fetchImpl, cache };
  const openLibrary = createOpenLibraryProvider(shared);
  const hardcover =
    (deps.enableHardcover ?? isHardcoverEnabled())
      ? createHardcoverProvider(shared)
      : null;
  const google =
    (deps.enableGoogle ?? isGoogleBooksEnabled())
      ? createGoogleBooksProvider(shared)
      : null;

  return {
    name: 'composed',
    async searchBooks(query) {
      const hits = await openLibrary.searchBooks(query);
      return hits
        .map((hit) => ({
          ...hit,
          editionCount: Math.max(hit.editionCount, hit.ids.openLibraryEditionId ? 1 : 0),
        }))
        .filter((hit) => hit.editionCount >= 1);
    },
    async lookupWork(workId) {
      const primary = await openLibrary.lookupWork(workId);
      if (!primary) return null;
      // Never fabricate editions — if OL returned none, leave empty.
      return fillMissingFrom(primary, [hardcover, google]);
    },
    lookupEdition(editionId) {
      return openLibrary.lookupEdition(editionId);
    },
    listEditionsForWork(workId) {
      return openLibrary.listEditionsForWork(workId);
    },
    async resolveBookUrl(urlOrIsbn) {
      const parsed = parseBookUrl(urlOrIsbn);
      if (parsed.kind === 'invalid') {
        throw Object.assign(new Error(parsed.reason), { status: 400 });
      }

      if (parsed.kind === 'googleVolume' && google) {
        const work = await google.lookupWork(parsed.volumeId);
        if (work) {
          // Try to land on the Open Library work via ISBN when possible.
          if (work.ids.isbn13) {
            const olHits = await openLibrary.resolveBookUrl(work.ids.isbn13);
            if (olHits.length > 0) return olHits;
          }
          return [hitFromWork(work)];
        }
      }

      if (parsed.kind === 'hardcover' && hardcover) {
        if (parsed.hardcoverId) {
          const work = await hardcover.lookupWork(parsed.hardcoverId);
          if (work) {
            if (work.ids.isbn13) {
              const olHits = await openLibrary.resolveBookUrl(work.ids.isbn13);
              if (olHits.length > 0) return olHits;
            }
            return [hitFromWork(work)];
          }
        }
      }

      return openLibrary.resolveBookUrl(urlOrIsbn);
    },
    getCoverUrl(input) {
      return openLibrary.getCoverUrl(input);
    },
  };
}

export { openLibraryProvider } from './open-library.js';
export { hardcoverProvider, isHardcoverEnabled } from './hardcover.js';
export { googleBooksProvider, isGoogleBooksEnabled } from './google-books.js';
