import {
  emptyBookExternalIds,
  readlistCollectionById,
  readlistCollectionSourceKey,
  READLIST_COLLECTIONS,
  type BookSearchHit,
  type ReadlistCollection,
} from '@kinexus/domain';

import { getBookCache, type BookCacheStore } from './cache.js';
import { booksFetch, type BookHttpDeps } from './http.js';

const OL_BASE = 'https://openlibrary.org';
const OL_COVERS = 'https://covers.openlibrary.org';
const COLLECTION_LIMIT = 30;
const PREVIEW_COVERS = 4;

export type ReadlistCollectionSummary = {
  id: string;
  title: string;
  category: string;
  coverPreviews: string[];
};

export type ReadlistCollectionDetail = {
  id: string;
  title: string;
  category: string;
  works: BookSearchHit[];
};

type OlSubjectWork = {
  key?: string;
  title?: string;
  authors?: Array<{ name?: string }>;
  cover_id?: number;
  first_publish_year?: number;
  edition_count?: number;
};

type CollectionFetchDeps = BookHttpDeps & {
  cache?: BookCacheStore;
};

function workIdFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const match = key.match(/(OL\d+W)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function coverUrlFromId(coverId: number | null | undefined): string | null {
  if (coverId == null) return null;
  return `${OL_COVERS}/b/id/${coverId}-M.jpg`;
}

function hitFromSubjectWork(row: OlSubjectWork): BookSearchHit | null {
  const workId = workIdFromKey(row.key);
  const title = row.title?.trim();
  const authors = (row.authors ?? [])
    .map((author) => author.name?.trim())
    .filter((name): name is string => Boolean(name));
  if (!workId || !title || authors.length === 0) return null;
  return {
    workId,
    title,
    authors,
    firstPublishedYear: Number.isFinite(row.first_publish_year) ? Number(row.first_publish_year) : null,
    coverUrl: coverUrlFromId(row.cover_id ?? null),
    editionCount: Number.isFinite(row.edition_count) ? Number(row.edition_count) : 1,
    ids: {
      ...emptyBookExternalIds(),
      openLibraryWorkId: workId,
    },
  };
}

function filterResolvedHits(hits: readonly BookSearchHit[]): BookSearchHit[] {
  const out: BookSearchHit[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (!hit.title?.trim()) continue;
    if (!hit.authors.some((author) => author.trim())) continue;
    if (seen.has(hit.workId)) continue;
    seen.add(hit.workId);
    out.push(hit);
    if (out.length >= COLLECTION_LIMIT) break;
  }
  return out;
}

async function fetchSubjectWorks(
  subject: string,
  deps: CollectionFetchDeps,
): Promise<BookSearchHit[]> {
  const slug = subject.trim().toLowerCase().replace(/\s+/g, '_');
  const url = `${OL_BASE}/subjects/${encodeURIComponent(slug)}.json?limit=${COLLECTION_LIMIT}`;
  const response = await booksFetch('open_library', url, { headers: { Accept: 'application/json' } }, deps);
  if (!response.ok) throw new Error(`Open Library subject failed (HTTP ${response.status})`);
  const payload = (await response.json()) as { works?: OlSubjectWork[] };
  const hits: BookSearchHit[] = [];
  for (const row of payload.works ?? []) {
    const hit = hitFromSubjectWork(row);
    if (hit) hits.push(hit);
  }
  return filterResolvedHits(hits);
}

async function fetchSearchWorks(
  query: string,
  sort: string | undefined,
  deps: CollectionFetchDeps,
): Promise<BookSearchHit[]> {
  const url = new URL(`${OL_BASE}/search.json`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(COLLECTION_LIMIT));
  if (sort) url.searchParams.set('sort', sort);
  const response = await booksFetch(
    'open_library',
    url.toString(),
    { headers: { Accept: 'application/json' } },
    deps,
  );
  if (!response.ok) throw new Error(`Open Library search failed (HTTP ${response.status})`);
  const payload = (await response.json()) as {
    docs?: Array<{
      key?: string;
      title?: string;
      author_name?: string[];
      first_publish_year?: number;
      cover_i?: number;
      edition_count?: number;
    }>;
  };
  const fromDocs: BookSearchHit[] = [];
  for (const doc of payload.docs ?? []) {
    const workId = workIdFromKey(doc.key);
    const title = doc.title?.trim();
    const authors = (doc.author_name ?? []).map((name) => name.trim()).filter(Boolean);
    if (!workId || !title || authors.length === 0) continue;
    fromDocs.push({
      workId,
      title,
      authors,
      firstPublishedYear: Number.isFinite(doc.first_publish_year) ? Number(doc.first_publish_year) : null,
      coverUrl: coverUrlFromId(doc.cover_i ?? null),
      editionCount: Number.isFinite(doc.edition_count) ? Number(doc.edition_count) : 0,
      ids: {
        ...emptyBookExternalIds(),
        openLibraryWorkId: workId,
      },
    });
  }
  return filterResolvedHits(fromDocs);
}
export async function loadCollectionWorks(
  collection: ReadlistCollection,
  deps: CollectionFetchDeps = {},
): Promise<BookSearchHit[]> {
  const cache = deps.cache ?? getBookCache();
  const cacheKey = `collection:${collection.id}:${readlistCollectionSourceKey(collection)}`;
  const cached = await cache.get<BookSearchHit[]>('open_library', cacheKey);
  if (cached) return filterResolvedHits(cached);

  const works =
    collection.source.kind === 'subject'
      ? await fetchSubjectWorks(collection.source.subject, { ...deps, cache })
      : await fetchSearchWorks(collection.source.query, collection.source.sort, { ...deps, cache });

  await cache.set('open_library', cacheKey, 'collection', works);
  return works;
}

export async function listReadlistCollections(
  deps: CollectionFetchDeps = {},
): Promise<ReadlistCollectionSummary[]> {
  return Promise.all(
    READLIST_COLLECTIONS.map(async (collection) => {
      const works = await loadCollectionWorks(collection, deps);
      const coverPreviews = works
        .map((work) => work.coverUrl)
        .filter((url): url is string => Boolean(url))
        .slice(0, PREVIEW_COVERS);
      return {
        id: collection.id,
        title: collection.title,
        category: collection.category,
        coverPreviews,
      };
    }),
  );
}

export async function getReadlistCollection(
  id: string,
  deps: CollectionFetchDeps = {},
): Promise<ReadlistCollectionDetail | null> {
  const collection = readlistCollectionById(id);
  if (!collection) return null;
  const works = await loadCollectionWorks(collection, deps);
  return {
    id: collection.id,
    title: collection.title,
    category: collection.category,
    works,
  };
}
