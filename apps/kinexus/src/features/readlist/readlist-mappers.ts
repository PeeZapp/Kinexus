import type { Database } from '@kinexus/db';
import {
  isBookFormat,
  isReadStatus,
  isReadlistVisibility,
  type BookAuthor,
  type ReadlistEdition,
  type ReadlistItem,
  type ReadlistList,
  type ReadlistProgress,
  type ReadlistReview,
  type ReadlistWork,
} from '@kinexus/domain';

type ListRow = Database['public']['Tables']['readlist_lists']['Row'];
type ItemRow = Database['public']['Tables']['readlist_items']['Row'];
type WorkRow = Database['public']['Tables']['readlist_works']['Row'];
type EditionRow = Database['public']['Tables']['readlist_editions']['Row'];
type ProgressRow = Database['public']['Tables']['readlist_progress']['Row'];
type ReviewRow = Database['public']['Tables']['readlist_reviews']['Row'];

function authorsFromJson(value: WorkRow['authors']): BookAuthor[] {
  if (!Array.isArray(value)) return [];
  const out: BookAuthor[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      out.push({ name: entry.trim(), openLibraryAuthorId: null });
      continue;
    }
    if (entry && typeof entry === 'object' && 'name' in entry && typeof (entry as { name: unknown }).name === 'string') {
      const name = (entry as { name: string }).name.trim();
      if (!name) continue;
      const ol =
        'openLibraryAuthorId' in entry && typeof (entry as { openLibraryAuthorId: unknown }).openLibraryAuthorId === 'string'
          ? (entry as { openLibraryAuthorId: string }).openLibraryAuthorId
          : null;
      out.push({ name, openLibraryAuthorId: ol });
    }
  }
  return out;
}

export function readlistListFromRow(row: ListRow, personIds: string[] = []): ReadlistList {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    name: row.name,
    visibility: isReadlistVisibility(row.visibility) ? row.visibility : 'private',
    isDefault: row.is_default,
    personIds,
    shareToken: row.share_token ?? null,
    isShared: Boolean(row.is_shared),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function readlistWorkFromRow(row: WorkRow): ReadlistWork {
  return {
    id: row.id,
    olWorkId: row.ol_work_id,
    isbn13: row.isbn13,
    hardcoverId: row.hardcover_id,
    googleVolumeId: row.google_volume_id,
    goodreadsId: row.goodreads_id,
    title: row.title,
    authors: authorsFromJson(row.authors),
    coverUrl: row.cover_url,
    firstPublishedYear: row.first_published_year,
    createdAt: row.created_at,
  };
}

export function readlistEditionFromRow(row: EditionRow): ReadlistEdition {
  return {
    id: row.id,
    workId: row.work_id,
    format: isBookFormat(row.format) ? row.format : 'print',
    isbn10: row.isbn10,
    isbn13: row.isbn13,
    olEditionId: row.ol_edition_id,
    asin: row.asin,
    pages: row.pages,
    durationSeconds: row.duration_seconds,
    publisher: row.publisher,
    publishedDate: row.published_date,
  };
}

export function readlistItemFromRow(row: ItemRow): ReadlistItem {
  return {
    id: row.id,
    listId: row.list_id,
    workId: row.work_id,
    preferredEditionId: row.preferred_edition_id,
    status: isReadStatus(row.status) ? row.status : 'want_to_read',
    addedBy: row.added_by,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

export function readlistProgressFromRow(row: ProgressRow): ReadlistProgress {
  return {
    id: row.id,
    userId: row.user_id,
    workId: row.work_id,
    editionId: row.edition_id,
    pagesRead: row.pages_read,
    percent: row.percent == null ? null : Number(row.percent),
    secondsListened: row.seconds_listened,
    updatedAt: row.updated_at,
  };
}

export function readlistReviewFromRow(row: ReviewRow): ReadlistReview {
  return {
    id: row.id,
    userId: row.user_id,
    workId: row.work_id,
    score: row.score,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
