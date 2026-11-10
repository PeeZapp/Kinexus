import {
  buildGoodreadsCsv,
  buildGoodreadsExportJson,
  formatToBinding,
  isBookFormat,
  type GoodreadsExportItem,
  type ReadStatus,
} from '@kinexus/domain';

import { createUserClient } from '../auth.js';

export type ReadlistExportFormat = 'goodreads' | 'json';

type ItemRow = {
  id: string;
  work_id: string;
  status: string;
  added_at: string;
  preferred_edition_id: string | null;
};

type WorkRow = {
  id: string;
  title: string;
  authors: unknown;
  isbn13: string | null;
  goodreads_id: string | null;
};

type EditionRow = {
  id: string;
  work_id: string;
  format: string;
  isbn10: string | null;
  isbn13: string | null;
  pages: number | null;
};

type ReviewRow = {
  work_id: string;
  score: number;
};

function authorName(authors: unknown): string {
  if (!Array.isArray(authors) || authors.length === 0) return '';
  const first = authors[0];
  if (first && typeof first === 'object' && typeof (first as { name?: unknown }).name === 'string') {
    return (first as { name: string }).name;
  }
  if (typeof first === 'string') return first;
  return '';
}

function additionalAuthors(authors: unknown): string | null {
  if (!Array.isArray(authors) || authors.length < 2) return null;
  const names = authors
    .slice(1)
    .map((entry) => {
      if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') {
        return (entry as { name: string }).name;
      }
      return typeof entry === 'string' ? entry : '';
    })
    .filter(Boolean);
  return names.length > 0 ? names.join(', ') : null;
}

export async function buildReadlistExport(input: {
  client: ReturnType<typeof createUserClient>;
  listId: string;
  format: ReadlistExportFormat;
}): Promise<{ fileName: string; mimeType: string; text: string }> {
  const { data: list, error: listError } = await input.client
    .from('readlist_lists')
    .select('id, name')
    .eq('id', input.listId)
    .maybeSingle();
  if (listError) throw new Error(listError.message);
  if (!list?.id) throw Object.assign(new Error('List not found'), { status: 404 });

  const { data: items, error: itemsError } = await input.client
    .from('readlist_items')
    .select('id, work_id, status, added_at, preferred_edition_id')
    .eq('list_id', input.listId);
  if (itemsError) throw new Error(itemsError.message);

  const itemRows = (items ?? []) as ItemRow[];
  const workIds = [...new Set(itemRows.map((item) => item.work_id))];

  let works: WorkRow[] = [];
  let editions: EditionRow[] = [];
  let reviews: ReviewRow[] = [];

  if (workIds.length > 0) {
    const { data: workData, error: workError } = await input.client
      .from('readlist_works')
      .select('id, title, authors, isbn13, goodreads_id')
      .in('id', workIds);
    if (workError) throw new Error(workError.message);
    works = (workData ?? []) as WorkRow[];

    const { data: editionData, error: editionError } = await input.client
      .from('readlist_editions')
      .select('id, work_id, format, isbn10, isbn13, pages')
      .in('work_id', workIds);
    if (editionError) throw new Error(editionError.message);
    editions = (editionData ?? []) as EditionRow[];

    const { data: reviewData, error: reviewError } = await input.client
      .from('readlist_reviews')
      .select('work_id, score')
      .in('work_id', workIds);
    if (reviewError) throw new Error(reviewError.message);
    reviews = (reviewData ?? []) as ReviewRow[];
  }

  const workById = new Map(works.map((work) => [work.id, work]));
  const reviewByWork = new Map(reviews.map((review) => [review.work_id, review]));
  const editionsByWork = new Map<string, EditionRow[]>();
  for (const edition of editions) {
    const list = editionsByWork.get(edition.work_id) ?? [];
    list.push(edition);
    editionsByWork.set(edition.work_id, list);
  }

  const exportItems: GoodreadsExportItem[] = [];
  for (const item of itemRows) {
    const work = workById.get(item.work_id);
    if (!work) continue;
    const preferred =
      item.preferred_edition_id != null
        ? (editionsByWork.get(item.work_id) ?? []).find((edition) => edition.id === item.preferred_edition_id)
        : null;
    const fallback = (editionsByWork.get(item.work_id) ?? [])[0] ?? null;
    const edition = preferred ?? fallback;
    const format = edition && isBookFormat(edition.format) ? edition.format : 'print';
    const status = item.status as ReadStatus;
    const dateAdded = typeof item.added_at === 'string' ? item.added_at.slice(0, 10) : null;
    exportItems.push({
      bookId: work.goodreads_id,
      title: work.title,
      author: authorName(work.authors),
      additionalAuthors: additionalAuthors(work.authors),
      isbn10: edition?.isbn10 ?? null,
      isbn13: edition?.isbn13 ?? work.isbn13 ?? null,
      score: reviewByWork.get(work.id)?.score ?? null,
      format,
      binding: formatToBinding(format),
      pages: edition?.pages ?? null,
      dateRead: status === 'finished' ? dateAdded : null,
      dateAdded,
      status,
      readCount: status === 'finished' ? 1 : 0,
    });
  }

  const listName = typeof list.name === 'string' ? list.name : 'Readlist';
  if (input.format === 'json') {
    return buildGoodreadsExportJson(listName, input.listId, exportItems);
  }
  return buildGoodreadsCsv(listName, exportItems);
}
