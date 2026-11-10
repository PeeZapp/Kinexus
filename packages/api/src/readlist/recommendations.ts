import { createHash } from 'node:crypto';

import {
  emptyBookExternalIds,
  type BookSearchHit,
  type BookWork,
  type ReadStatus,
} from '@kinexus/domain';

import { AiBlockedError, completeResolved, resolveAiClient } from '../ai/resolve.js';
import { getBookCache, type BookCacheStore } from '../books/cache.js';
import { booksFetch, type BookHttpDeps } from '../books/http.js';
import { parseJsonObject } from '../recipe-draft.js';

const OL_BASE = 'https://openlibrary.org';
const OL_COVERS = 'https://covers.openlibrary.org';
const CANDIDATE_LIMIT = 10;
const SEARCH_LIMIT = 24;
const YEAR_FILTER = 'first_publish_year:[2010 TO *]';
const EMPTY_REASON = 'rate a few books';

export type ReadlistRecommendSeed = {
  workId: string;
  olWorkId: string | null;
  title: string;
  authors: string[];
  authorIds: string[];
  subjects: string[];
  status: ReadStatus;
  score: number | null;
};

export type ReadlistRecommendation = {
  workId: string;
  title: string;
  authors: string[];
  firstPublishedYear: number | null;
  coverUrl: string | null;
  reason: string;
  seedTitle: string;
};

export type ReadlistRecommendationsResult = {
  results: ReadlistRecommendation[];
  reason?: string;
  aiUsed: boolean;
};

type ListedWork = {
  workId: string;
  olWorkId: string | null;
};

type CandidateHit = BookSearchHit & {
  ratingsAverage: number | null;
  authorOverlap: string[];
  subjectOverlap: string[];
  seedTitle: string;
};

type OlSearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
  ratings_average?: number;
  subject?: string[];
  author_key?: string[];
};

export type RecommendFetchDeps = BookHttpDeps & {
  cache?: BookCacheStore;
  lookupWork?: (workId: string) => Promise<BookWork | null>;
  resolveAi?: typeof resolveAiClient;
  completeAi?: typeof completeResolved;
};

function workIdFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const match = key.match(/(OL\d+W)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function authorIdFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const match = key.match(/(OL\d+A)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function coverUrlFromId(coverId: number | null | undefined): string | null {
  if (coverId == null) return null;
  return `${OL_COVERS}/b/id/${coverId}-M.jpg`;
}

function normalizeSubject(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function hashRecommendSeeds(seeds: readonly { workId: string; olWorkId?: string | null }[]): string {
  const parts = seeds
    .map((seed) => (seed.olWorkId ?? seed.workId).trim().toUpperCase())
    .filter(Boolean)
    .sort();
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

/** Prefer finished works scored ≥7; else any finished/reading works. */
export function pickReadlistRecommendSeeds(
  rows: readonly ReadlistRecommendSeed[],
): ReadlistRecommendSeed[] {
  const finishedHigh = rows
    .filter((row) => row.status === 'finished' && (row.score ?? 0) >= 7)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title));
  if (finishedHigh.length > 0) return finishedHigh.slice(0, 8);

  const fallback = rows
    .filter((row) => row.status === 'finished' || row.status === 'reading')
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title));
  return fallback.slice(0, 8);
}

export function excludeListedWorkIds(
  candidates: readonly { workId: string }[],
  listed: readonly ListedWork[],
  seeds: readonly ReadlistRecommendSeed[],
): { workId: string }[] {
  const blocked = new Set<string>();
  for (const row of listed) {
    blocked.add(row.workId.toUpperCase());
    if (row.olWorkId) blocked.add(row.olWorkId.toUpperCase());
  }
  for (const seed of seeds) {
    blocked.add(seed.workId.toUpperCase());
    if (seed.olWorkId) blocked.add(seed.olWorkId.toUpperCase());
  }
  return candidates.filter((row) => !blocked.has(row.workId.toUpperCase()));
}

function hitFromDoc(doc: OlSearchDoc): (BookSearchHit & { ratingsAverage: number | null }) | null {
  const workId = workIdFromKey(doc.key);
  const title = doc.title?.trim();
  const authors = (doc.author_name ?? []).map((name) => name.trim()).filter(Boolean);
  if (!workId || !title || authors.length === 0) return null;
  return {
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
    ratingsAverage: Number.isFinite(doc.ratings_average) ? Number(doc.ratings_average) : null,
  };
}

async function searchOpenLibrary(
  query: string,
  sort: string | undefined,
  deps: RecommendFetchDeps,
): Promise<Array<BookSearchHit & { ratingsAverage: number | null; subjects: string[]; authorKeys: string[] }>> {
  const url = new URL(`${OL_BASE}/search.json`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(SEARCH_LIMIT));
  if (sort) url.searchParams.set('sort', sort);
  const response = await booksFetch(
    'open_library',
    url.toString(),
    { headers: { Accept: 'application/json' } },
    deps,
  );
  if (!response.ok) throw new Error(`Open Library search failed (HTTP ${response.status})`);
  const payload = (await response.json()) as { docs?: OlSearchDoc[] };
  const out: Array<BookSearchHit & { ratingsAverage: number | null; subjects: string[]; authorKeys: string[] }> =
    [];
  for (const doc of payload.docs ?? []) {
    const hit = hitFromDoc(doc);
    if (!hit) continue;
    out.push({
      ...hit,
      subjects: (doc.subject ?? []).map(normalizeSubject).filter(Boolean).slice(0, 20),
      authorKeys: (doc.author_key ?? [])
        .map((key) => authorIdFromKey(key))
        .filter((id): id is string => Boolean(id)),
    });
  }
  return out;
}

function topSubjects(seeds: readonly ReadlistRecommendSeed[], limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const seed of seeds) {
    for (const subject of seed.subjects) {
      const key = normalizeSubject(subject);
      if (!key || key.length < 3) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([subject]) => subject);
}

function reasonForSeed(seedTitle: string): string {
  return `Because you loved ${seedTitle}`;
}

function bestSeedForCandidate(
  seeds: readonly ReadlistRecommendSeed[],
  authorOverlap: readonly string[],
  subjectOverlap: readonly string[],
): ReadlistRecommendSeed | null {
  if (seeds.length === 0) return null;
  const byAuthor = seeds.find((seed) =>
    seed.authors.some((name) => authorOverlap.some((a) => a.toLowerCase() === name.toLowerCase())) ||
    seed.authorIds.some((id) => authorOverlap.includes(id)),
  );
  if (byAuthor) return byAuthor;
  const bySubject = seeds.find((seed) =>
    seed.subjects.some((subject) => subjectOverlap.includes(normalizeSubject(subject))),
  );
  return bySubject ?? seeds[0] ?? null;
}

export function scoreAndRankCandidates(
  seeds: readonly ReadlistRecommendSeed[],
  hits: readonly {
    workId: string;
    title: string;
    authors: string[];
    firstPublishedYear: number | null;
    coverUrl: string | null;
    ratingsAverage?: number | null;
    subjects?: string[];
    authorKeys?: string[];
  }[],
  listed: readonly ListedWork[],
  limit = CANDIDATE_LIMIT,
): ReadlistRecommendation[] {
  const allowed = excludeListedWorkIds(hits, listed, seeds);
  const seedAuthorNames = new Set(
    seeds.flatMap((seed) => seed.authors.map((name) => name.trim().toLowerCase())).filter(Boolean),
  );
  const seedAuthorIds = new Set(seeds.flatMap((seed) => seed.authorIds.map((id) => id.toUpperCase())));
  const seedSubjects = new Set(seeds.flatMap((seed) => seed.subjects.map(normalizeSubject)).filter(Boolean));

  const scored: Array<CandidateHit & { points: number }> = [];
  const seen = new Set<string>();
  for (const hit of allowed) {
    const key = hit.workId.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!hit.title?.trim() || hit.authors.length === 0) continue;

    const authorOverlap = hit.authors.filter((name) => seedAuthorNames.has(name.trim().toLowerCase()));
    const authorKeyOverlap = (hit.authorKeys ?? []).filter((id) => seedAuthorIds.has(id.toUpperCase()));
    const subjectOverlap = (hit.subjects ?? []).filter((subject) => seedSubjects.has(normalizeSubject(subject)));
    const seed = bestSeedForCandidate(
      seeds,
      [...authorOverlap, ...authorKeyOverlap],
      subjectOverlap,
    );
    if (!seed) continue;

    let points = 0;
    points += (authorOverlap.length + authorKeyOverlap.length) * 12;
    points += subjectOverlap.length * 5;
    const rating = hit.ratingsAverage ?? null;
    if (rating != null) points += Math.min(8, rating * 1.2);

    scored.push({
      workId: hit.workId,
      title: hit.title.trim(),
      authors: hit.authors,
      firstPublishedYear: hit.firstPublishedYear,
      coverUrl: hit.coverUrl,
      editionCount: 0,
      ids: { ...emptyBookExternalIds(), openLibraryWorkId: hit.workId },
      ratingsAverage: rating,
      authorOverlap: [...authorOverlap, ...authorKeyOverlap],
      subjectOverlap,
      seedTitle: seed.title,
      points,
    });
  }

  scored.sort(
    (a, b) =>
      b.points - a.points ||
      (b.ratingsAverage ?? 0) - (a.ratingsAverage ?? 0) ||
      a.title.localeCompare(b.title),
  );

  return scored.slice(0, limit).map((row) => ({
    workId: row.workId,
    title: row.title,
    authors: row.authors,
    firstPublishedYear: row.firstPublishedYear,
    coverUrl: row.coverUrl,
    reason: reasonForSeed(row.seedTitle),
    seedTitle: row.seedTitle,
  }));
}

/** Keep AI picks that exist in the candidate set; drop invented titles. */
export function applyAiRecommendationOrder(
  candidates: readonly ReadlistRecommendation[],
  aiRows: readonly { workId?: string; title?: string; reason?: string }[],
): ReadlistRecommendation[] {
  const byId = new Map(candidates.map((row) => [row.workId.toUpperCase(), row]));
  const byTitle = new Map(candidates.map((row) => [row.title.trim().toLowerCase(), row]));
  const out: ReadlistRecommendation[] = [];
  const seen = new Set<string>();

  for (const row of aiRows) {
    const fromId = row.workId ? byId.get(row.workId.trim().toUpperCase()) : undefined;
    const fromTitle = row.title ? byTitle.get(row.title.trim().toLowerCase()) : undefined;
    const match = fromId ?? fromTitle;
    if (!match) continue;
    const key = match.workId.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const reason =
      typeof row.reason === 'string' && row.reason.trim()
        ? row.reason.trim().slice(0, 160)
        : match.reason;
    out.push({ ...match, reason });
    if (out.length >= CANDIDATE_LIMIT) break;
  }

  for (const row of candidates) {
    if (out.length >= CANDIDATE_LIMIT) break;
    const key = row.workId.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function parseAiRecommendationRows(text: string): { workId?: string; title?: string; reason?: string }[] {
  try {
    const raw = parseJsonObject(text);
    const rows = Array.isArray(raw.results)
      ? raw.results
      : Array.isArray(raw.recommendations)
        ? raw.recommendations
        : [];
    const out: { workId?: string; title?: string; reason?: string }[] = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const rec = row as Record<string, unknown>;
      out.push({
        workId: typeof rec.workId === 'string' ? rec.workId : undefined,
        title: typeof rec.title === 'string' ? rec.title : undefined,
        reason: typeof rec.reason === 'string' ? rec.reason : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function enrichSeed(
  seed: ReadlistRecommendSeed,
  deps: RecommendFetchDeps,
): Promise<ReadlistRecommendSeed> {
  const olId = seed.olWorkId;
  if (!olId || !deps.lookupWork) return seed;
  try {
    const work = await deps.lookupWork(olId);
    if (!work) return seed;
    return {
      ...seed,
      title: work.title || seed.title,
      authors: work.authors.map((author) => author.name).filter(Boolean).length
        ? work.authors.map((author) => author.name)
        : seed.authors,
      authorIds: work.authors
        .map((author) => author.openLibraryAuthorId)
        .filter((id): id is string => Boolean(id)),
      subjects: work.subjects.length > 0 ? work.subjects : seed.subjects,
    };
  } catch {
    return seed;
  }
}

async function loadCandidateHits(
  seeds: readonly ReadlistRecommendSeed[],
  deps: RecommendFetchDeps,
): Promise<
  Array<BookSearchHit & { ratingsAverage: number | null; subjects: string[]; authorKeys: string[] }>
> {
  const queries: string[] = [];
  const authorKeys = new Set(seeds.flatMap((seed) => seed.authorIds).filter(Boolean));
  const authorNames = new Set(seeds.flatMap((seed) => seed.authors).filter(Boolean));
  for (const authorId of [...authorKeys].slice(0, 4)) {
    queries.push(`author_key:${authorId} ${YEAR_FILTER}`);
  }
  if (queries.length === 0) {
    for (const name of [...authorNames].slice(0, 4)) {
      queries.push(`author:"${name.replace(/"/g, '')}" ${YEAR_FILTER}`);
    }
  }
  for (const subject of topSubjects(seeds)) {
    const slug = subject.replace(/\s+/g, '_');
    queries.push(`subject:${slug} ${YEAR_FILTER}`);
  }

  const buckets = await Promise.all(
    queries.map(async (query) => {
      try {
        return await searchOpenLibrary(query, 'rating', deps);
      } catch {
        return [];
      }
    }),
  );
  return buckets.flat();
}

export async function buildReadlistRecommendations(input: {
  userId: string;
  householdId: string;
  seeds: readonly ReadlistRecommendSeed[];
  listed: readonly ListedWork[];
  deps?: RecommendFetchDeps;
}): Promise<ReadlistRecommendationsResult> {
  const deps = input.deps ?? {};
  const picked = pickReadlistRecommendSeeds(input.seeds);
  if (picked.length === 0) {
    return { results: [], reason: EMPTY_REASON, aiUsed: false };
  }

  const enriched = await Promise.all(picked.map((seed) => enrichSeed(seed, deps)));
  const cache = deps.cache ?? getBookCache();
  const seedHash = hashRecommendSeeds(enriched);
  const cacheKey = `recommend:v1:${input.userId}:${seedHash}`;

  let ranked = await cache.get<ReadlistRecommendation[]>('open_library', cacheKey);
  if (!ranked) {
    const hits = await loadCandidateHits(enriched, deps);
    ranked = scoreAndRankCandidates(enriched, hits, input.listed);
    await cache.set('open_library', cacheKey, 'search', ranked);
  }

  if (ranked.length === 0) {
    return { results: [], reason: EMPTY_REASON, aiUsed: false };
  }

  const resolveAi = deps.resolveAi ?? resolveAiClient;
  const completeAi = deps.completeAi ?? completeResolved;

  try {
    const resolved = await resolveAi({
      userId: input.userId,
      householdId: input.householdId,
      feature: 'readlist_recommend',
    });
    const catalog = ranked
      .map(
        (row) =>
          `- workId: ${row.workId}; title: ${JSON.stringify(row.title)}; authors: ${JSON.stringify(row.authors.join(', '))}; seed: ${JSON.stringify(row.seedTitle)}; baseReason: ${JSON.stringify(row.reason)}`,
      )
      .join('\n');
    const out = await completeAi(resolved, {
      json: true,
      maxTokens: 1200,
      system:
        'You reorder book recommendations. Use only the given workIds/titles. Never invent books. Respond with valid JSON only.',
      prompt: `Reorder these book suggestions for a reader. You may only pick from this list and rewrite a one-line reason that references a real seed title from the list.

Candidates:
${catalog}

Return ONLY JSON: { "results": [ { "workId": string, "title": string, "reason": string } ] }
Reasons should look like "Because you loved <seed title>" when possible.`,
    });
    const aiRows = parseAiRecommendationRows(out.text);
    const next = applyAiRecommendationOrder(ranked, aiRows);
    return { results: next, aiUsed: true };
  } catch (err) {
    if (err instanceof AiBlockedError) {
      return { results: ranked, aiUsed: false };
    }
    return { results: ranked, aiUsed: false };
  }
}
