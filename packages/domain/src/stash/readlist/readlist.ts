import { canEditShared, canSeeShared } from '../../household/access';
import type { HouseholdRole } from '../../household/types';
import type {
  ReadlistEntry,
  ReadlistItem,
  ReadlistList,
  ReadlistProgress,
  ReadlistShelves,
  ReadlistVisibility,
  ReadlistWork,
  ReadStatus,
} from './types';
import { READ_STATUSES, READLIST_VISIBILITIES } from './types';

const STATUS_SET = new Set<string>(READ_STATUSES);
const VISIBILITY_SET = new Set<string>(READLIST_VISIBILITIES);

export function isReadStatus(value: string): value is ReadStatus {
  return STATUS_SET.has(value);
}

export function isReadlistVisibility(value: string): value is ReadlistVisibility {
  return VISIBILITY_SET.has(value);
}

export function readStatusLabel(status: ReadStatus): string {
  if (status === 'reading') return 'Reading';
  if (status === 'finished') return 'Already read';
  return 'Want to read';
}

export function normalizeReadlistShare(
  visibility: ReadlistVisibility,
  personIds: readonly string[],
): { visibility: ReadlistVisibility; personIds: string[] } {
  if (visibility === 'global') return { visibility: 'global', personIds: [] };
  if (visibility !== 'people') return { visibility, personIds: [] };
  return { visibility: 'people', personIds: [...new Set(personIds)] };
}

export function canViewReadlist(
  list: ReadlistList,
  opts: { role: HouseholdRole | null; userId: string | null; personId: string | null },
): boolean {
  if (list.visibility === 'global') return Boolean(opts.userId);
  return canSeeShared({
    role: opts.role,
    userId: opts.userId,
    personId: opts.personId,
    createdBy: list.createdBy,
    visibility: list.visibility,
    personIds: list.personIds,
  });
}

export function canManageReadlist(
  list: ReadlistList,
  opts: { role: HouseholdRole | null; userId: string | null; personId: string | null },
): boolean {
  const visibility = list.visibility === 'global' ? 'household' : list.visibility;
  return canEditShared(
    {
      role: opts.role,
      userId: opts.userId,
      personId: opts.personId,
      createdBy: list.createdBy,
      visibility,
      personIds: list.personIds,
    },
    true,
  );
}

export function readlistEntries(
  lists: readonly ReadlistList[],
  works: readonly ReadlistWork[],
  items: readonly ReadlistItem[],
): ReadlistEntry[] {
  const listsById = new Map(lists.map((list) => [list.id, list]));
  const worksById = new Map(works.map((work) => [work.id, work]));
  const entries: ReadlistEntry[] = [];
  for (const item of items) {
    const list = listsById.get(item.listId);
    const work = worksById.get(item.workId);
    if (!list || !work) continue;
    entries.push({ item, list, work });
  }
  return entries.sort((a, b) => b.item.addedAt.localeCompare(a.item.addedAt));
}

/** Group items into the three v1 shelves (Want to read / Reading / Already read). */
export function groupReadlistShelves<T extends { status: ReadStatus }>(
  items: readonly T[],
): ReadlistShelves<T> {
  const shelves: ReadlistShelves<T> = {
    wantToRead: [],
    reading: [],
    finished: [],
  };
  for (const item of items) {
    if (item.status === 'reading') shelves.reading.push(item);
    else if (item.status === 'finished') shelves.finished.push(item);
    else shelves.wantToRead.push(item);
  }
  return shelves;
}

/** Prefer explicit percent; else pages_read / pages; else seconds / duration. */
export function progressPercent(input: {
  percent?: number | null;
  pagesRead?: number | null;
  pages?: number | null;
  secondsListened?: number | null;
  durationSeconds?: number | null;
}): number | null {
  if (input.percent != null && Number.isFinite(input.percent)) {
    return clampPercent(input.percent);
  }
  if (
    input.pagesRead != null &&
    input.pages != null &&
    input.pages > 0 &&
    Number.isFinite(input.pagesRead)
  ) {
    return clampPercent((input.pagesRead / input.pages) * 100);
  }
  if (
    input.secondsListened != null &&
    input.durationSeconds != null &&
    input.durationSeconds > 0 &&
    Number.isFinite(input.secondsListened)
  ) {
    return clampPercent((input.secondsListened / input.durationSeconds) * 100);
  }
  return null;
}

export function progressFromPages(pagesRead: number, pages: number): number | null {
  return progressPercent({ pagesRead, pages });
}

export function progressFromSeconds(secondsListened: number, durationSeconds: number): number | null {
  return progressPercent({ secondsListened, durationSeconds });
}

export function mergeProgressPercent(
  progress: Pick<ReadlistProgress, 'percent' | 'pagesRead' | 'secondsListened'>,
  edition: { pages?: number | null; durationSeconds?: number | null } | null | undefined,
): number | null {
  return progressPercent({
    percent: progress.percent,
    pagesRead: progress.pagesRead,
    pages: edition?.pages ?? null,
    secondsListened: progress.secondsListened,
    durationSeconds: edition?.durationSeconds ?? null,
  });
}

function clampPercent(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}
