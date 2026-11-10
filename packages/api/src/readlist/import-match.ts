import {
  classifyGoodreadsMatchTier,
  titleAuthorMatchConfidence,
  type BookSearchHit,
  type GoodreadsImportRow,
  type GoodreadsMatchTier,
} from '@kinexus/domain';

import { getBookProvider } from '../books/compose.js';

export const READLIST_IMPORT_MATCH_BATCH_CAP = 50;

export type ReadlistImportMatchCandidate = {
  workId: string;
  title: string;
  authors: string[];
  firstPublishedYear: number | null;
  coverUrl: string | null;
  isbn13: string | null;
  confidence: number;
};

export type ReadlistImportMatchRowResult = {
  key: string;
  tier: GoodreadsMatchTier;
  matchedBy: 'isbn13' | 'isbn10' | 'title_author' | null;
  confidence: number;
  match: ReadlistImportMatchCandidate | null;
  candidates: ReadlistImportMatchCandidate[];
  /** Echo of import fields needed for commit without re-parsing. */
  import: {
    title: string;
    author: string | null;
    isbn10: string | null;
    isbn13: string | null;
    score: number | null;
    format: GoodreadsImportRow['format'];
    status: GoodreadsImportRow['status'];
    pages: number | null;
    dateRead: string | null;
    dateAdded: string | null;
  };
};

export type ReadlistImportMatchCounts = {
  total: number;
  exact: number;
  likely: number;
  unsure: number;
  none: number;
  /** exact + likely */
  matched: number;
};

function hitToCandidate(hit: BookSearchHit, confidence: number): ReadlistImportMatchCandidate {
  return {
    workId: hit.workId,
    title: hit.title,
    authors: hit.authors,
    firstPublishedYear: hit.firstPublishedYear,
    coverUrl: hit.coverUrl,
    isbn13: hit.ids.isbn13,
    confidence,
  };
}

function echoImport(row: GoodreadsImportRow): ReadlistImportMatchRowResult['import'] {
  return {
    title: row.title,
    author: row.author,
    isbn10: row.isbn10,
    isbn13: row.isbn13,
    score: row.score,
    format: row.format,
    status: row.status,
    pages: row.pages,
    dateRead: row.dateRead,
    dateAdded: row.dateAdded,
  };
}

async function matchOne(row: GoodreadsImportRow): Promise<ReadlistImportMatchRowResult> {
  const provider = getBookProvider();
  const base = {
    key: row.key,
    import: echoImport(row),
  };

  try {
    if (row.isbn13) {
      const hits = await provider.resolveBookUrl(row.isbn13).catch(() => []);
      if (hits[0]) {
        return {
          ...base,
          tier: 'exact',
          matchedBy: 'isbn13',
          confidence: 1,
          match: hitToCandidate(hits[0], 1),
          candidates: hits.slice(0, 5).map((hit) => hitToCandidate(hit, 1)),
        };
      }
    }

    if (row.isbn10) {
      const hits = await provider.resolveBookUrl(row.isbn10).catch(() => []);
      if (hits[0]) {
        return {
          ...base,
          tier: 'exact',
          matchedBy: 'isbn10',
          confidence: 1,
          match: hitToCandidate(hits[0], 1),
          candidates: hits.slice(0, 5).map((hit) => hitToCandidate(hit, 1)),
        };
      }
    }

    const query = [row.title, row.author].filter(Boolean).join(' ').trim();
    if (query.length >= 2) {
      const hits = await provider.searchBooks(query).catch(() => []);
      const ranked = hits
        .map((hit) => {
          const confidence = titleAuthorMatchConfidence(
            { title: row.title, author: row.author },
            { title: hit.title, authors: hit.authors },
          );
          return { hit, confidence };
        })
        .sort((a, b) => b.confidence - a.confidence);

      const best = ranked[0];
      if (!best) {
        return {
          ...base,
          tier: 'none',
          matchedBy: null,
          confidence: 0,
          match: null,
          candidates: [],
        };
      }

      const tier = classifyGoodreadsMatchTier({
        matchedBy: 'title_author',
        confidence: best.confidence,
      });
      return {
        ...base,
        tier,
        matchedBy: tier === 'none' ? null : 'title_author',
        confidence: best.confidence,
        match: tier === 'none' ? null : hitToCandidate(best.hit, best.confidence),
        candidates: ranked.slice(0, 5).map(({ hit, confidence }) => hitToCandidate(hit, confidence)),
      };
    }
  } catch {
    // fall through to none
  }

  return {
    ...base,
    tier: 'none',
    matchedBy: null,
    confidence: 0,
    match: null,
    candidates: [],
  };
}

export function summarizeMatchRows(rows: readonly ReadlistImportMatchRowResult[]): ReadlistImportMatchCounts {
  const counts: ReadlistImportMatchCounts = {
    total: rows.length,
    exact: 0,
    likely: 0,
    unsure: 0,
    none: 0,
    matched: 0,
  };
  for (const row of rows) {
    counts[row.tier] += 1;
  }
  counts.matched = counts.exact + counts.likely;
  return counts;
}

/**
 * Match Goodreads import rows against the book catalog.
 * Chunks of ~50. Uses #25a provider (rate limiter + cache). NO writes.
 */
export async function matchReadlistImportRows(
  rows: readonly GoodreadsImportRow[],
): Promise<{ counts: ReadlistImportMatchCounts; rows: ReadlistImportMatchRowResult[] }> {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw Object.assign(new Error('At least one row is required'), { status: 400 });
  }
  if (rows.length > READLIST_IMPORT_MATCH_BATCH_CAP) {
    throw Object.assign(new Error(`Match at most ${READLIST_IMPORT_MATCH_BATCH_CAP} rows per request`), {
      status: 400,
    });
  }

  const out: ReadlistImportMatchRowResult[] = [];
  for (const row of rows) {
    out.push(await matchOne(row));
  }
  return { counts: summarizeMatchRows(out), rows: out };
}
