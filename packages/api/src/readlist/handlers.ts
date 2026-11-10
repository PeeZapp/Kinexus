import type { BookWork, GoodreadsImportRow, ReadStatus } from '@kinexus/domain';
import { isBookFormat, isReadStatus } from '@kinexus/domain';

import { createUserClient, readBearerToken } from '../auth.js';
import { getBookProvider } from '../books/compose.js';
import { buildReadlistExport, type ReadlistExportFormat } from './export.js';
import { commitReadlistImport, parseCommitRows } from './import-commit.js';
import {
  matchReadlistImportRows,
  READLIST_IMPORT_MATCH_BATCH_CAP,
  type ReadlistImportMatchRowResult,
} from './import-match.js';
import {
  buildReadlistRecommendations,
  type ReadlistRecommendSeed,
} from './recommendations.js';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${label} is required`);
  return value.trim();
}

function asOptionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Invalid string');
  const trimmed = value.trim();
  return trimmed || null;
}

function asOptionalInt(value: unknown, label: string): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new HttpError(400, `${label} must be a non-negative integer`);
  }
  return n;
}

function asOptionalPercent(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new HttpError(400, 'percent must be between 0 and 100');
  }
  return n;
}

function userClientFrom(request: Request) {
  const token = readBearerToken(request);
  if (!token) throw new HttpError(401, 'Sign in required');
  return createUserClient(token);
}

function fail(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  const message = err instanceof Error && err.message ? err.message : 'Request failed';
  return { status: 400, body: { error: message } };
}

function bookWorkPayload(work: BookWork) {
  return {
    id: work.id,
    title: work.title,
    authors: work.authors,
    firstPublishedYear: work.firstPublishedYear,
    coverUrl: work.coverUrl,
    ids: work.ids,
    editions: work.editions.map((edition) => ({
      id: edition.id,
      workId: edition.workId,
      title: edition.title,
      format: edition.format,
      pageCount: edition.pageCount,
      publishedYear: edition.publishedYear,
      publisher: edition.publisher,
      ids: edition.ids,
    })),
  };
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function upsertWorkFromCatalogId(
  client: ReturnType<typeof createUserClient>,
  workId: string,
): Promise<{ catalogWorkId: string; work: BookWork | null }> {
  if (looksLikeUuid(workId)) {
    const { data: existing } = await client
      .from('readlist_works')
      .select('id')
      .eq('id', workId)
      .maybeSingle();
    if (existing?.id) return { catalogWorkId: existing.id, work: null };
  }

  const { data: byOl } = await client
    .from('readlist_works')
    .select('id')
    .eq('ol_work_id', workId)
    .maybeSingle();
  if (byOl?.id) return { catalogWorkId: byOl.id, work: null };

  const work = await getBookProvider().lookupWork(workId);
  if (!work) throw new HttpError(404, 'Work not found');
  const { data, error } = await client.rpc('upsert_readlist_work', {
    p_work: bookWorkPayload(work),
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string' || !data) throw new Error('Could not save work');
  return { catalogWorkId: data, work };
}

export async function handleEnsureDefaultReadlist(
  _userId: string,
  body: { householdId?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const householdId = asString(body.householdId, 'householdId');
    const client = userClientFrom(request);
    const { data, error } = await client.rpc('ensure_default_readlist', {
      p_household_id: householdId,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { listId: data } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleCreateReadlistList(
  _userId: string,
  body: {
    householdId?: unknown;
    name?: unknown;
    visibility?: unknown;
    personIds?: unknown;
  },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const householdId = asString(body.householdId, 'householdId');
    const name = asString(body.name, 'name');
    const visibility = asOptionalString(body.visibility) ?? 'household';
    const personIds = Array.isArray(body.personIds)
      ? body.personIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
      : [];
    const client = userClientFrom(request);
    const { data, error } = await client.rpc('create_readlist_list', {
      p_household_id: householdId,
      p_name: name,
      p_visibility: visibility,
      p_person_ids: personIds,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { listId: data } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleRenameReadlistList(
  _userId: string,
  body: { listId?: unknown; name?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const listId = asString(body.listId, 'listId');
    const name = asString(body.name, 'name');
    const client = userClientFrom(request);
    const { data, error } = await client.rpc('rename_readlist_list', {
      p_list_id: listId,
      p_name: name,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { listId: data } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleDeleteReadlistList(
  _userId: string,
  body: { listId?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const listId = asString(body.listId, 'listId');
    const client = userClientFrom(request);
    const { error } = await client.rpc('delete_readlist_list', { p_list_id: listId });
    if (error) throw new Error(error.message);
    return { status: 200, body: { ok: true } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleAddReadlistItem(
  _userId: string,
  body: {
    listId?: unknown;
    workId?: unknown;
    preferredEditionFormat?: unknown;
    status?: unknown;
  },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const listId = asString(body.listId, 'listId');
    const workId = asString(body.workId, 'workId');
    const statusRaw = asOptionalString(body.status) ?? 'want_to_read';
    if (!isReadStatus(statusRaw)) throw new HttpError(400, 'Invalid status');

    const client = userClientFrom(request);
    const { catalogWorkId, work } = await upsertWorkFromCatalogId(client, workId);

    let preferredEditionId: string | null = null;
    const formatHint = asOptionalString(body.preferredEditionFormat);
    if (formatHint && work) {
      const match = work.editions.find((edition) => edition.format === formatHint);
      if (match?.ids.openLibraryEditionId) {
        const { data: editions } = await client
          .from('readlist_editions')
          .select('id')
          .eq('work_id', catalogWorkId)
          .eq('ol_edition_id', match.ids.openLibraryEditionId)
          .maybeSingle();
        preferredEditionId = typeof editions?.id === 'string' ? editions.id : null;
      }
      if (!preferredEditionId) {
        const { data: editions } = await client
          .from('readlist_editions')
          .select('id')
          .eq('work_id', catalogWorkId)
          .eq('format', formatHint)
          .limit(1)
          .maybeSingle();
        preferredEditionId = typeof editions?.id === 'string' ? editions.id : null;
      }
    }

    const { data, error } = await client.rpc('add_readlist_item', {
      p_list_id: listId,
      p_work_id: catalogWorkId,
      p_preferred_edition_id: preferredEditionId,
      p_status: statusRaw,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { itemId: data, workId: catalogWorkId } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleUpdateReadlistItem(
  _userId: string,
  body: {
    itemId?: unknown;
    preferredEditionId?: unknown;
    clearPreferredEdition?: unknown;
  },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const itemId = asString(body.itemId, 'itemId');
    const preferredEditionId = asOptionalString(body.preferredEditionId);
    const clearPreferredEdition = body.clearPreferredEdition === true;
    const client = userClientFrom(request);
    const { data, error } = await client.rpc('update_readlist_item', {
      p_item_id: itemId,
      p_preferred_edition_id: preferredEditionId,
      p_clear_preferred_edition: clearPreferredEdition,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { itemId: data } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleRemoveReadlistItem(
  _userId: string,
  body: { itemId?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const itemId = asString(body.itemId, 'itemId');
    const client = userClientFrom(request);
    const { error } = await client.rpc('remove_readlist_item', { p_item_id: itemId });
    if (error) throw new Error(error.message);
    return { status: 200, body: { ok: true } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleSetReadlistItemStatus(
  _userId: string,
  body: { itemId?: unknown; status?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const itemId = asString(body.itemId, 'itemId');
    const status = asString(body.status, 'status');
    if (!isReadStatus(status)) throw new HttpError(400, 'Invalid status');
    const client = userClientFrom(request);
    const { data, error } = await client.rpc('set_readlist_item_status', {
      p_item_id: itemId,
      p_status: status,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { itemId: data } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleUpsertReadlistProgress(
  _userId: string,
  body: {
    workId?: unknown;
    editionId?: unknown;
    pagesRead?: unknown;
    percent?: unknown;
    secondsListened?: unknown;
  },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const workId = asString(body.workId, 'workId');
    const client = userClientFrom(request);
    const { catalogWorkId } = await upsertWorkFromCatalogId(client, workId);
    const { data, error } = await client.rpc('upsert_readlist_progress', {
      p_work_id: catalogWorkId,
      p_edition_id: asOptionalString(body.editionId),
      p_pages_read: asOptionalInt(body.pagesRead, 'pagesRead'),
      p_percent: asOptionalPercent(body.percent),
      p_seconds_listened: asOptionalInt(body.secondsListened, 'secondsListened'),
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { progressId: data } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleUpsertReadlistReview(
  _userId: string,
  body: { workId?: unknown; score?: unknown; body?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const workId = asString(body.workId, 'workId');
    const scoreRaw = body.score;
    const score = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw);
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      throw new HttpError(400, 'score must be an integer from 1 to 10');
    }
    const reviewBody = asOptionalString(body.body);
    const client = userClientFrom(request);
    const { catalogWorkId } = await upsertWorkFromCatalogId(client, workId);
    const { data, error } = await client.rpc('upsert_readlist_review', {
      p_work_id: catalogWorkId,
      p_score: score,
      p_body: reviewBody,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { reviewId: data } };
  } catch (err) {
    return fail(err);
  }
}

export async function handleDeleteReadlistReview(
  _userId: string,
  body: { workId?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const workId = asString(body.workId, 'workId');
    const client = userClientFrom(request);
    const { catalogWorkId } = await upsertWorkFromCatalogId(client, workId);
    const { error } = await client.rpc('delete_readlist_review', { p_work_id: catalogWorkId });
    if (error) throw new Error(error.message);
    return { status: 200, body: { ok: true } };
  } catch (err) {
    return fail(err);
  }
}

function parseMatchImportRows(raw: unknown): GoodreadsImportRow[] {
  if (!Array.isArray(raw)) return [];
  const out: GoodreadsImportRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!title) continue;
    const key = typeof row.key === 'string' && row.key.trim() ? row.key.trim() : String(out.length);
    const statusRaw = typeof row.status === 'string' ? row.status : 'want_to_read';
    if (!isReadStatus(statusRaw)) continue;
    const formatRaw = typeof row.format === 'string' ? row.format : 'print';
    const format = isBookFormat(formatRaw) ? formatRaw : 'print';
    const scoreRaw = row.score;
    const score =
      scoreRaw == null || scoreRaw === ''
        ? null
        : Number.isInteger(Number(scoreRaw)) && Number(scoreRaw) >= 1 && Number(scoreRaw) <= 10
          ? Number(scoreRaw)
          : null;
    const myRatingRaw = row.myRating;
    const myRating =
      myRatingRaw == null || myRatingRaw === ''
        ? score != null
          ? Math.round(score / 2)
          : 0
        : Number.isFinite(Number(myRatingRaw))
          ? Math.max(0, Math.min(5, Math.round(Number(myRatingRaw))))
          : 0;
    out.push({
      key,
      bookId: typeof row.bookId === 'string' && row.bookId.trim() ? row.bookId.trim() : null,
      title,
      author: typeof row.author === 'string' && row.author.trim() ? row.author.trim() : null,
      additionalAuthors:
        typeof row.additionalAuthors === 'string' && row.additionalAuthors.trim()
          ? row.additionalAuthors.trim()
          : null,
      isbn10: typeof row.isbn10 === 'string' && row.isbn10.trim() ? row.isbn10.trim() : null,
      isbn13: typeof row.isbn13 === 'string' && row.isbn13.trim() ? row.isbn13.trim() : null,
      myRating,
      score,
      binding: typeof row.binding === 'string' && row.binding.trim() ? row.binding.trim() : null,
      format,
      pages:
        row.pages == null || row.pages === ''
          ? null
          : Number.isInteger(Number(row.pages))
            ? Number(row.pages)
            : null,
      dateRead: typeof row.dateRead === 'string' && row.dateRead.trim() ? row.dateRead.trim() : null,
      dateAdded: typeof row.dateAdded === 'string' && row.dateAdded.trim() ? row.dateAdded.trim() : null,
      exclusiveShelf:
        typeof row.exclusiveShelf === 'string' && row.exclusiveShelf.trim()
          ? row.exclusiveShelf.trim()
          : 'to-read',
      status: statusRaw,
      readCount:
        row.readCount == null || row.readCount === ''
          ? null
          : Number.isInteger(Number(row.readCount))
            ? Number(row.readCount)
            : null,
    });
    if (out.length >= READLIST_IMPORT_MATCH_BATCH_CAP) break;
  }
  return out;
}

/** Match only — never writes. */
export async function handleReadlistImportMatch(
  _userId: string,
  body: { rows?: unknown },
): Promise<{ status: number; body: unknown }> {
  try {
    const rows = parseMatchImportRows(body.rows);
    if (rows.length === 0) return { status: 400, body: { error: 'At least one row is required' } };
    if (Array.isArray(body.rows) && body.rows.length > READLIST_IMPORT_MATCH_BATCH_CAP) {
      return {
        status: 400,
        body: { error: `Match at most ${READLIST_IMPORT_MATCH_BATCH_CAP} rows per request` },
      };
    }
    const result = await matchReadlistImportRows(rows);
    return { status: 200, body: result };
  } catch (err) {
    return fail(err);
  }
}

/** Writes only after the user taps Import. */
export async function handleReadlistImportCommit(
  _userId: string,
  body: { listId?: unknown; rows?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const listId = asString(body.listId, 'listId');
    const rows = parseCommitRows(body.rows);
    if (rows.length === 0) return { status: 400, body: { error: 'At least one row is required' } };
    const client = userClientFrom(request);
    const result = await commitReadlistImport({ client, listId, rows });
    return {
      status: 200,
      body: {
        progress: result.progress,
        importedWorkIds: result.importedWorkIds,
        checkThese: result.checkThese,
      },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function handleReadlistExport(
  _userId: string,
  query: { listId?: string | null; format?: string | null },
  request: Request,
): Promise<
  | { status: number; body: { error: string } }
  | { status: 200; fileName: string; mimeType: string; text: string }
> {
  try {
    const listId = asString(query.listId, 'listId');
    const formatRaw = (query.format ?? 'goodreads').trim().toLowerCase();
    const format: ReadlistExportFormat = formatRaw === 'json' ? 'json' : 'goodreads';
    if (formatRaw !== 'json' && formatRaw !== 'goodreads') {
      throw new HttpError(400, 'format must be goodreads or json');
    }
    const client = userClientFrom(request);
    const built = await buildReadlistExport({ client, listId, format });
    return { status: 200, ...built };
  } catch (err) {
    return fail(err);
  }
}

function authorNamesFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      out.push(entry.trim());
      continue;
    }
    if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') {
      const name = (entry as { name: string }).name.trim();
      if (name) out.push(name);
    }
  }
  return out;
}

function authorIdsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = (entry as { openLibraryAuthorId?: unknown }).openLibraryAuthorId;
    if (typeof id === 'string' && id.trim()) out.push(id.trim().toUpperCase());
  }
  return out;
}

export async function handleGetReadlistRecommendations(
  userId: string,
  query: { householdId?: string | null },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    const householdId = asString(query.householdId, 'householdId');
    const client = userClientFrom(request);

    const { data: lists, error: listsError } = await client
      .from('readlist_lists')
      .select('id')
      .eq('household_id', householdId);
    if (listsError) throw new Error(listsError.message);
    const listIds = (lists ?? []).map((row) => row.id as string).filter(Boolean);
    if (listIds.length === 0) {
      return { status: 200, body: { results: [], reason: 'rate a few books', aiUsed: false } };
    }

    const { data: items, error: itemsError } = await client
      .from('readlist_items')
      .select('list_id, work_id, status')
      .in('list_id', listIds);
    if (itemsError) throw new Error(itemsError.message);

    const workIds = [...new Set((items ?? []).map((row) => row.work_id as string).filter(Boolean))];

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

    const listed = workIds.map((workId) => ({
      workId,
      olWorkId: worksById.get(workId)?.olWorkId ?? null,
    }));

    const statusByWork = new Map<string, ReadStatus>();
    for (const row of items ?? []) {
      const status = typeof row.status === 'string' && isReadStatus(row.status) ? row.status : null;
      if (!status || typeof row.work_id !== 'string') continue;
      const prev = statusByWork.get(row.work_id);
      if (!prev || status === 'finished' || (status === 'reading' && prev === 'want_to_read')) {
        statusByWork.set(row.work_id, status);
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

    const provider = getBookProvider();
    const result = await buildReadlistRecommendations({
      userId,
      householdId,
      seeds,
      listed,
      deps: {
        lookupWork: (workId) => provider.lookupWork(workId),
      },
    });
    return { status: 200, body: result };
  } catch (err) {
    return fail(err);
  }
}

export type { ReadlistImportMatchRowResult };
