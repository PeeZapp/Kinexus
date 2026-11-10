import {
  bookMergeKey,
  emptyBookExternalIds,
  groupReadlistShelves,
  isValidIsbn,
  mergeProgressPercent,
  progressPercent,
  readStatusLabel,
  type BookExternalIds,
  type BookFormat,
  type BookSearchHit,
  type ReadlistEdition,
  type ReadlistEntry,
  type ReadlistItem,
  type ReadlistProgress,
  type ReadlistWork,
  type ReadStatus,
} from '@kinexus/domain';

export type ShelfKey = ReadStatus;

export const SHELF_ORDER: readonly ShelfKey[] = ['want_to_read', 'reading', 'finished'];

export function shelfTabLabel(status: ReadStatus): string {
  return readStatusLabel(status);
}

export function shelfCounts(items: readonly { status: ReadStatus }[]): Record<ShelfKey, number> {
  const shelves = groupReadlistShelves(items);
  return {
    want_to_read: shelves.wantToRead.length,
    reading: shelves.reading.length,
    finished: shelves.finished.length,
  };
}

export function itemsForShelf<T extends { status: ReadStatus }>(
  items: readonly T[],
  shelf: ShelfKey,
): T[] {
  const shelves = groupReadlistShelves(items);
  if (shelf === 'reading') return shelves.reading;
  if (shelf === 'finished') return shelves.finished;
  return shelves.wantToRead;
}

/** One card per work across lists — prefers the earliest finished item. */
export function dedupeFinishedItems<T extends { workId: string; status: ReadStatus; updatedAt?: string }>(
  items: readonly T[],
): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (item.status !== 'finished') continue;
    const existing = seen.get(item.workId);
    if (!existing) {
      seen.set(item.workId, item);
      continue;
    }
    if ((item.updatedAt ?? '') > (existing.updatedAt ?? '')) {
      seen.set(item.workId, item);
    }
  }
  return [...seen.values()];
}

/** Pasted ISBN or book URL should hit resolve-url instead of search. */
export function shouldResolveBookQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (isValidIsbn(trimmed)) return true;
  return /^https?:\/\//i.test(trimmed);
}

export function workExternalIds(work: ReadlistWork): BookExternalIds {
  return {
    ...emptyBookExternalIds(),
    isbn13: work.isbn13,
    openLibraryWorkId: work.olWorkId,
    hardcoverId: work.hardcoverId,
    googleVolumeId: work.googleVolumeId,
    goodreadsId: work.goodreadsId,
  };
}

export function findEntryForHit(
  entries: readonly ReadlistEntry[],
  hit: BookSearchHit,
  listId?: string | null,
): ReadlistEntry | null {
  for (const entry of entries) {
    if (listId && entry.list.id !== listId) continue;
    if (bookMergeKey(workExternalIds(entry.work), hit.ids)) return entry;
    if (entry.work.olWorkId && entry.work.olWorkId === hit.workId) return entry;
  }
  return null;
}

/** Default list first, then A–Z. Shared-with-me lists are included by the query. */
export function sortReadlistLists<T extends { id: string; name: string; isDefault: boolean }>(
  lists: readonly T[],
  defaultListId?: string | null,
): T[] {
  return lists.slice().sort((a, b) => {
    const aDefault = a.isDefault || a.id === defaultListId;
    const bDefault = b.isDefault || b.id === defaultListId;
    if (aDefault !== bDefault) return aDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function showProgressSlider(status: ReadStatus): boolean {
  return status === 'reading';
}

export function authorLine(work: Pick<ReadlistWork, 'authors'> | { authors: readonly string[] }): string {
  const names = work.authors.map((author) => (typeof author === 'string' ? author : author.name)).filter(Boolean);
  return names.join(', ');
}

export function formatLabel(format: BookFormat): string {
  if (format === 'audiobook') return 'Audiobook';
  if (format === 'ebook') return 'Ebook';
  return 'Print';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${minutes}:${pad2(seconds)}`;
}

export function cardProgressPercent(
  progress: Pick<ReadlistProgress, 'percent' | 'pagesRead' | 'secondsListened'> | null | undefined,
  edition: Pick<ReadlistEdition, 'pages' | 'durationSeconds'> | null | undefined,
): number | null {
  if (!progress) return null;
  return mergeProgressPercent(progress, edition);
}

export function progressCaption(input: {
  status: ReadStatus;
  progress: Pick<ReadlistProgress, 'percent' | 'pagesRead' | 'secondsListened'> | null | undefined;
  edition: Pick<ReadlistEdition, 'format' | 'pages' | 'durationSeconds'> | null | undefined;
}): string | null {
  if (input.status !== 'reading') return null;
  const percent = cardProgressPercent(input.progress, input.edition);
  const edition = input.edition;
  if (edition?.format === 'audiobook' && edition.durationSeconds && edition.durationSeconds > 0) {
    const listened =
      input.progress?.secondsListened ??
      (percent != null ? Math.round((percent / 100) * edition.durationSeconds) : null);
    if (listened == null) return null;
    return `${formatDuration(listened)} / ${formatDuration(edition.durationSeconds)}`;
  }
  if (edition?.pages && edition.pages > 0) {
    const pagesRead =
      input.progress?.pagesRead ?? (percent != null ? Math.round((percent / 100) * edition.pages) : null);
    if (pagesRead == null) return null;
    return `p. ${pagesRead} of ${edition.pages}`;
  }
  if (percent == null) return null;
  return `${Math.round(percent)}%`;
}

/** In-memory list ops used by tests + optimistic UI. One item per work. */
export type LocalReadlistState = {
  items: ReadlistItem[];
};

export function addOrOpenWork(
  state: LocalReadlistState,
  input: { listId: string; workId: string; preferredEditionId?: string | null; status?: ReadStatus },
): { state: LocalReadlistState; existing: ReadlistItem | null; added: ReadlistItem | null } {
  const existing = state.items.find((item) => item.listId === input.listId && item.workId === input.workId) ?? null;
  if (existing) {
    if (input.preferredEditionId === undefined) {
      return { state, existing, added: null };
    }
    const nextItems = state.items.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            preferredEditionId: input.preferredEditionId ?? null,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    return {
      state: { items: nextItems },
      existing: nextItems.find((item) => item.id === existing.id) ?? existing,
      added: null,
    };
  }
  const now = new Date().toISOString();
  const added: ReadlistItem = {
    id: `item-${input.workId}`,
    listId: input.listId,
    workId: input.workId,
    preferredEditionId: input.preferredEditionId ?? null,
    status: input.status ?? 'want_to_read',
    addedBy: null,
    addedAt: now,
    updatedAt: now,
  };
  return { state: { items: [added, ...state.items] }, existing: null, added };
}

export function setLocalStatus(state: LocalReadlistState, itemId: string, status: ReadStatus): LocalReadlistState {
  return {
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, status, updatedAt: new Date().toISOString() } : item,
    ),
  };
}

export function setLocalEdition(
  state: LocalReadlistState,
  itemId: string,
  preferredEditionId: string | null,
): LocalReadlistState {
  return {
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, preferredEditionId, updatedAt: new Date().toISOString() } : item,
    ),
  };
}

export function progressFromSliderPercent(
  percent: number,
  edition: Pick<ReadlistEdition, 'format' | 'pages' | 'durationSeconds'> | null | undefined,
): { percent: number; pagesRead: number | null; secondsListened: number | null } {
  const clamped = progressPercent({ percent }) ?? 0;
  if (edition?.format === 'audiobook' && edition.durationSeconds && edition.durationSeconds > 0) {
    return {
      percent: clamped,
      pagesRead: null,
      secondsListened: Math.round((clamped / 100) * edition.durationSeconds),
    };
  }
  if (edition?.pages && edition.pages > 0) {
    return {
      percent: clamped,
      pagesRead: Math.round((clamped / 100) * edition.pages),
      secondsListened: null,
    };
  }
  return { percent: clamped, pagesRead: null, secondsListened: null };
}
