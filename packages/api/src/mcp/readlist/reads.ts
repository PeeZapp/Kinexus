import type { SupabaseClient } from '@supabase/supabase-js';
import {
  canViewReadlist,
  isReadStatus,
  type ReadlistList,
  type ReadStatus,
} from '@kinexus/domain';

import { AiBlockedError } from '../../ai/resolve.js';
import { getBookProvider } from '../../books/compose.js';
import {
  buildReadlistRecommendations,
  type ReadlistRecommendSeed,
  type ReadlistRecommendation,
} from '../../readlist/recommendations.js';
import {
  accessOpts,
  authorIdsFromJson,
  authorNamesFromJson,
  mcpStatusLabel,
  resolveCallerHousehold,
  resolveCallerPersonId,
  type AccessOpts,
} from './shared.js';

export type ReadlistBookSummary = {
  entryId: string;
  listId: string;
  bookId: string;
  title: string;
  authors: string[];
  status: ReadStatus;
  statusLabel: string;
  rating: number | null;
  year: number | null;
  coverUrl: string | null;
};

export type ReadlistGroup = {
  status: ReadStatus;
  label: string;
  books: ReadlistBookSummary[];
};

export type BookSearchResult = {
  bookId: string;
  title: string;
  authors: string[];
  year: number | null;
  coverUrl: string | null;
  isbn: string | null;
};

function toReadlistList(row: Record<string, unknown>, personIds: string[]): ReadlistList {
  return {
    id: String(row.id),
    householdId: String(row.household_id),
    createdBy: typeof row.created_by === 'string' ? row.created_by : null,
    name: String(row.name ?? ''),
    visibility: (row.visibility as ReadlistList['visibility']) ?? 'household',
    isDefault: Boolean(row.is_default),
    personIds,
    shareToken: typeof row.share_token === 'string' ? row.share_token : null,
    isShared: Boolean(row.is_shared),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

async function loadReadlistPeopleMap(
  client: SupabaseClient,
  householdId: string,
): Promise<Map<string, string[]>> {
  const { data, error } = await client
    .from('readlist_list_people')
    .select('list_id, person_id')
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const listId = String((row as { list_id: string }).list_id);
    const personId = String((row as { person_id: string }).person_id);
    const existing = map.get(listId) ?? [];
    existing.push(personId);
    map.set(listId, existing);
  }
  return map;
}

export async function loadVisibleReadlists(
  client: SupabaseClient,
  householdId: string,
  opts: AccessOpts,
): Promise<ReadlistList[]> {
  const peopleMap = await loadReadlistPeopleMap(client, householdId);
  const { data, error } = await client
    .from('readlist_lists')
    .select('*')
    .eq('household_id', householdId)
    .order('name');
  if (error) throw new Error(error.message);

  const lists: ReadlistList[] = [];
  for (const row of data ?? []) {
    const rec = row as Record<string, unknown>;
    const list = toReadlistList(rec, peopleMap.get(String(rec.id)) ?? []);
    if (!canViewReadlist(list, opts)) continue;
    lists.push(list);
  }
  return lists;
}

export async function getReadlist(
  client: SupabaseClient,
  userId: string,
  input: { status?: ReadStatus; limit?: number } = {},
): Promise<{ householdId: string; groups: ReadlistGroup[] }> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  const personId = await resolveCallerPersonId(client, householdId, userId);
  const opts = accessOpts(role, userId, personId);
  const lists = await loadVisibleReadlists(client, householdId, opts);
  const listIds = lists.map((list) => list.id);

  const groups: ReadlistGroup[] = [
    { status: 'want_to_read', label: mcpStatusLabel('want_to_read'), books: [] },
    { status: 'reading', label: mcpStatusLabel('reading'), books: [] },
    { status: 'finished', label: mcpStatusLabel('finished'), books: [] },
  ];

  if (listIds.length === 0) return { householdId, groups };

  const { data: items, error: itemsError } = await client
    .from('readlist_items')
    .select('*')
    .in('list_id', listIds)
    .order('added_at', { ascending: false });
  if (itemsError) throw new Error(itemsError.message);

  const filtered = (items ?? []).filter((row) => {
    const status = String((row as { status?: string }).status ?? '');
    if (!isReadStatus(status)) return false;
    if (input.status && status !== input.status) return false;
    return true;
  });

  const workIds = [...new Set(filtered.map((row) => String((row as { work_id: string }).work_id)))];
  const worksById = new Map<string, Record<string, unknown>>();
  if (workIds.length > 0) {
    const { data: works, error: worksError } = await client
      .from('readlist_works')
      .select('*')
      .in('id', workIds);
    if (worksError) throw new Error(worksError.message);
    for (const work of works ?? []) {
      worksById.set(String((work as { id: string }).id), work as Record<string, unknown>);
    }
  }

  const { data: reviews, error: reviewsError } = await client
    .from('readlist_reviews')
    .select('work_id, score')
    .eq('user_id', userId);
  if (reviewsError) throw new Error(reviewsError.message);
  const scoreByWork = new Map<string, number>();
  for (const row of reviews ?? []) {
    if (typeof row.work_id === 'string' && typeof row.score === 'number') {
      scoreByWork.set(row.work_id, row.score);
    }
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  let remaining = limit;
  const byStatus = new Map<ReadStatus, ReadlistBookSummary[]>([
    ['want_to_read', []],
    ['reading', []],
    ['finished', []],
  ]);

  for (const row of filtered) {
    if (remaining <= 0) break;
    const item = row as Record<string, unknown>;
    const status = item.status as ReadStatus;
    const workId = String(item.work_id);
    const work = worksById.get(workId);
    if (!work) continue;
    const bookId =
      (typeof work.ol_work_id === 'string' && work.ol_work_id) ||
      (typeof work.id === 'string' && work.id) ||
      workId;
    byStatus.get(status)!.push({
      entryId: String(item.id),
      listId: String(item.list_id),
      bookId,
      title: String(work.title ?? ''),
      authors: authorNamesFromJson(work.authors),
      status,
      statusLabel: mcpStatusLabel(status),
      rating: scoreByWork.get(workId) ?? null,
      year: typeof work.first_published_year === 'number' ? work.first_published_year : null,
      coverUrl: typeof work.cover_url === 'string' ? work.cover_url : null,
    });
    remaining -= 1;
  }

  return {
    householdId,
    groups: groups.map((group) => ({
      ...group,
      books: byStatus.get(group.status) ?? [],
    })),
  };
}

export async function searchBooks(
  client: SupabaseClient,
  userId: string,
  input: { query: string; limit?: number },
): Promise<{ householdId: string; results: BookSearchResult[] }> {
  const { householdId } = await resolveCallerHousehold(client, userId);
  const query = input.query.trim();
  if (!query) return { householdId, results: [] };
  const hits = await getBookProvider().searchBooks(query);
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 20);
  return {
    householdId,
    results: hits.slice(0, limit).map((hit) => ({
      bookId: hit.workId,
      title: hit.title,
      authors: hit.authors,
      year: hit.firstPublishedYear,
      coverUrl: hit.coverUrl,
      isbn: hit.ids.isbn13 ?? hit.ids.isbn10,
    })),
  };
}

async function loadListedWorks(
  client: SupabaseClient,
  listIds: string[],
): Promise<{ workId: string; olWorkId: string | null }[]> {
  if (listIds.length === 0) return [];
  const { data: items, error } = await client
    .from('readlist_items')
    .select('work_id')
    .in('list_id', listIds);
  if (error) throw new Error(error.message);
  const workIds = [...new Set((items ?? []).map((row) => String((row as { work_id: string }).work_id)))];
  if (workIds.length === 0) return [];
  const { data: works, error: worksError } = await client
    .from('readlist_works')
    .select('id, ol_work_id')
    .in('id', workIds);
  if (worksError) throw new Error(worksError.message);
  return (works ?? []).map((row) => ({
    workId: String((row as { id: string }).id),
    olWorkId: typeof (row as { ol_work_id?: string }).ol_work_id === 'string'
      ? (row as { ol_work_id: string }).ol_work_id
      : null,
  }));
}

async function loadAutoSeeds(
  client: SupabaseClient,
  userId: string,
  listIds: string[],
): Promise<ReadlistRecommendSeed[]> {
  if (listIds.length === 0) return [];
  const { data: items, error: itemsError } = await client
    .from('readlist_items')
    .select('work_id, status')
    .in('list_id', listIds);
  if (itemsError) throw new Error(itemsError.message);

  const { data: reviews, error: reviewsError } = await client
    .from('readlist_reviews')
    .select('work_id, score')
    .eq('user_id', userId);
  if (reviewsError) throw new Error(reviewsError.message);
  const scoreByWork = new Map<string, number>();
  for (const row of reviews ?? []) {
    if (typeof row.work_id === 'string' && typeof row.score === 'number') {
      scoreByWork.set(row.work_id, row.score);
    }
  }

  const statusByWork = new Map<string, ReadStatus>();
  for (const row of items ?? []) {
    const status = typeof row.status === 'string' && isReadStatus(row.status) ? row.status : null;
    if (!status || typeof row.work_id !== 'string') continue;
    const prev = statusByWork.get(row.work_id);
    if (!prev || status === 'finished' || (status === 'reading' && prev === 'want_to_read')) {
      statusByWork.set(row.work_id, status);
    }
  }

  const workIds = [...statusByWork.keys()];
  const worksById = new Map<
    string,
    { title: string; authors: string[]; authorIds: string[]; olWorkId: string | null }
  >();
  if (workIds.length > 0) {
    const { data: works, error: worksError } = await client
      .from('readlist_works')
      .select('id, title, authors, ol_work_id')
      .in('id', workIds);
    if (worksError) throw new Error(worksError.message);
    for (const row of works ?? []) {
      worksById.set(row.id as string, {
        title: typeof row.title === 'string' ? row.title : '',
        authors: authorNamesFromJson(row.authors),
        authorIds: authorIdsFromJson(row.authors),
        olWorkId: typeof row.ol_work_id === 'string' ? row.ol_work_id : null,
      });
    }
  }

  const seeds: ReadlistRecommendSeed[] = [];
  for (const [workId, status] of statusByWork) {
    if (status !== 'finished' && status !== 'reading') continue;
    const work = worksById.get(workId);
    if (!work?.title) continue;
    seeds.push({
      workId,
      olWorkId: work.olWorkId,
      title: work.title,
      authors: work.authors,
      authorIds: work.authorIds,
      subjects: [],
      status,
      score: scoreByWork.get(workId) ?? null,
    });
  }
  return seeds;
}

async function seedsFromBookIds(bookIds: string[]): Promise<ReadlistRecommendSeed[]> {
  const provider = getBookProvider();
  const seeds: ReadlistRecommendSeed[] = [];
  for (const raw of bookIds) {
    const bookId = raw.trim();
    if (!bookId) continue;
    const work = await provider.lookupWork(bookId).catch(() => null);
    if (!work) continue;
    seeds.push({
      workId: work.id,
      olWorkId: work.ids.openLibraryWorkId ?? work.id,
      title: work.title,
      authors: work.authors.map((author) => author.name).filter(Boolean),
      authorIds: work.authors
        .map((author) => author.openLibraryAuthorId)
        .filter((id): id is string => Boolean(id)),
      subjects: work.subjects,
      status: 'finished',
      score: 8,
    });
  }
  return seeds;
}

export async function recommendBooks(
  client: SupabaseClient,
  userId: string,
  input: { limit?: number; basedOn?: string[] } = {},
): Promise<{
  householdId: string;
  results: Array<BookSearchResult & { reason: string }>;
  reason?: string;
}> {
  const { householdId, role } = await resolveCallerHousehold(client, userId);
  const personId = await resolveCallerPersonId(client, householdId, userId);
  const opts = accessOpts(role, userId, personId);
  const lists = await loadVisibleReadlists(client, householdId, opts);
  const listIds = lists.map((list) => list.id);
  const listed = await loadListedWorks(client, listIds);

  const seeds =
    input.basedOn && input.basedOn.length > 0
      ? await seedsFromBookIds(input.basedOn)
      : await loadAutoSeeds(client, userId, listIds);

  const provider = getBookProvider();
  const result = await buildReadlistRecommendations({
    userId,
    householdId,
    seeds,
    listed,
    deps: {
      lookupWork: (workId) => provider.lookupWork(workId),
      // Never call the household AI key from MCP — non-AI ranked list only.
      resolveAi: async () => {
        throw new AiBlockedError('no_access');
      },
    },
  });

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 20);
  const results = result.results.slice(0, limit).map((row: ReadlistRecommendation) => ({
    bookId: row.workId,
    title: row.title,
    authors: row.authors,
    year: row.firstPublishedYear,
    coverUrl: row.coverUrl,
    isbn: null as string | null,
    reason: row.reason,
  }));

  return {
    householdId,
    results,
    ...(result.reason ? { reason: result.reason } : {}),
  };
}

export {
  loadReadlistPeopleMap,
  toReadlistList,
  loadListedWorks,
};
