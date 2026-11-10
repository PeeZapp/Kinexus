import {
  goodreadsWorkDedupeKey,
  isBookFormat,
  isReadStatus,
  type BookFormat,
  type BookWork,
  type GoodreadsMatchTier,
  type ReadStatus,
} from '@kinexus/domain';

import { createUserClient } from '../auth.js';
import { getBookProvider } from '../books/compose.js';
import type { ReadlistImportMatchRowResult } from './import-match.js';

export const READLIST_IMPORT_COMMIT_BATCH_CAP = 50;

export type ReadlistCommitRow = {
  key: string;
  tier: GoodreadsMatchTier;
  workId: string | null;
  title: string;
  author: string | null;
  isbn10: string | null;
  isbn13: string | null;
  score: number | null;
  format: BookFormat;
  status: ReadStatus;
};

export type ReadlistCommitProgress = {
  done: number;
  total: number;
  imported: number;
  skippedDuplicate: number;
  checkThese: number;
};

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

async function upsertCatalogWork(
  client: ReturnType<typeof createUserClient>,
  workId: string,
  formatHint: BookFormat | null,
): Promise<{ catalogWorkId: string; preferredEditionId: string | null }> {
  const { data: existing } = await client.from('readlist_works').select('id').eq('id', workId).maybeSingle();
  let catalogWorkId = typeof existing?.id === 'string' ? existing.id : null;
  let work: BookWork | null = null;

  if (!catalogWorkId) {
    work = await getBookProvider().lookupWork(workId);
    if (!work) throw new Error(`Work not found: ${workId}`);
    const { data, error } = await client.rpc('upsert_readlist_work', {
      p_work: bookWorkPayload(work),
    });
    if (error) throw new Error(error.message);
    if (typeof data !== 'string' || !data) throw new Error('Could not save work');
    catalogWorkId = data;
  }

  let preferredEditionId: string | null = null;
  if (formatHint) {
    if (work) {
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

  return { catalogWorkId, preferredEditionId };
}

export function parseCommitRows(raw: unknown): ReadlistCommitRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ReadlistCommitRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const key = typeof row.key === 'string' ? row.key.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!key || !title) continue;
    const tier = row.tier;
    if (tier !== 'exact' && tier !== 'likely' && tier !== 'unsure' && tier !== 'none') continue;
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
    out.push({
      key,
      tier,
      workId: typeof row.workId === 'string' && row.workId.trim() ? row.workId.trim() : null,
      title,
      author: typeof row.author === 'string' && row.author.trim() ? row.author.trim() : null,
      isbn10: typeof row.isbn10 === 'string' && row.isbn10.trim() ? row.isbn10.trim() : null,
      isbn13: typeof row.isbn13 === 'string' && row.isbn13.trim() ? row.isbn13.trim() : null,
      score,
      format,
      status: statusRaw,
    });
    if (out.length >= READLIST_IMPORT_COMMIT_BATCH_CAP) break;
  }
  return out;
}

export function commitRowsFromMatchResults(
  rows: readonly ReadlistImportMatchRowResult[],
): ReadlistCommitRow[] {
  return rows.map((row) => ({
    key: row.key,
    tier: row.tier,
    workId: row.match?.workId ?? null,
    title: row.import.title,
    author: row.import.author,
    isbn10: row.import.isbn10,
    isbn13: row.import.isbn13,
    score: row.import.score,
    format: row.import.format,
    status: row.import.status,
  }));
}

/**
 * Writes exact + likely matches into the selected list. Unsure/none returned as checkThese.
 * Dedupes by work within the batch. Does not write before this is called.
 */
export async function commitReadlistImport(input: {
  client: ReturnType<typeof createUserClient>;
  listId: string;
  rows: readonly ReadlistCommitRow[];
}): Promise<{
  progress: ReadlistCommitProgress;
  importedWorkIds: string[];
  checkThese: ReadlistCommitRow[];
}> {
  const auto = input.rows.filter((row) => row.tier === 'exact' || row.tier === 'likely');
  const checkThese: ReadlistCommitRow[] = input.rows.filter(
    (row) => row.tier === 'unsure' || row.tier === 'none',
  );

  const seen = new Set<string>();
  const importedWorkIds: string[] = [];
  let skippedDuplicate = 0;
  let done = 0;

  for (const row of auto) {
    done += 1;
    if (!row.workId) {
      checkThese.push({ ...row, tier: 'none' });
      continue;
    }
    const dedupe = goodreadsWorkDedupeKey({
      workId: row.workId,
      isbn13: row.isbn13,
      isbn10: row.isbn10,
      title: row.title,
      author: row.author,
    });
    if (seen.has(dedupe)) {
      skippedDuplicate += 1;
      continue;
    }
    seen.add(dedupe);

    const { catalogWorkId, preferredEditionId } = await upsertCatalogWork(
      input.client,
      row.workId,
      row.format,
    );

    const { error: addError } = await input.client.rpc('add_readlist_item', {
      p_list_id: input.listId,
      p_work_id: catalogWorkId,
      p_preferred_edition_id: preferredEditionId,
      p_status: row.status,
    });
    if (addError) throw new Error(addError.message);

    if (row.score != null) {
      const { error: reviewError } = await input.client.rpc('upsert_readlist_review', {
        p_work_id: catalogWorkId,
        p_score: row.score,
        p_body: null,
      });
      if (reviewError) throw new Error(reviewError.message);
    }

    importedWorkIds.push(catalogWorkId);
  }

  return {
    progress: {
      done,
      total: auto.length,
      imported: importedWorkIds.length,
      skippedDuplicate,
      checkThese: checkThese.length,
    },
    importedWorkIds,
    checkThese,
  };
}
