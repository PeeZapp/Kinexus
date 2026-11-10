import type { BookAuthor, BookFormat } from './books';

export const READ_STATUSES = ['want_to_read', 'reading', 'finished'] as const;
export type ReadStatus = (typeof READ_STATUSES)[number];

export const READLIST_VISIBILITIES = ['household', 'private', 'people', 'global'] as const;
export type ReadlistVisibility = (typeof READLIST_VISIBILITIES)[number];

export type ReadlistList = {
  id: string;
  householdId: string;
  createdBy: string | null;
  name: string;
  visibility: ReadlistVisibility;
  isDefault: boolean;
  personIds: string[];
  shareToken: string | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReadlistWork = {
  id: string;
  olWorkId: string | null;
  isbn13: string | null;
  hardcoverId: string | null;
  googleVolumeId: string | null;
  goodreadsId: string | null;
  title: string;
  authors: BookAuthor[];
  coverUrl: string | null;
  firstPublishedYear: number | null;
  createdAt: string;
};

export type ReadlistEdition = {
  id: string;
  workId: string;
  format: BookFormat;
  isbn10: string | null;
  isbn13: string | null;
  olEditionId: string | null;
  asin: string | null;
  pages: number | null;
  durationSeconds: number | null;
  publisher: string | null;
  publishedDate: string | null;
};

export type ReadlistItem = {
  id: string;
  listId: string;
  workId: string;
  preferredEditionId: string | null;
  status: ReadStatus;
  addedBy: string | null;
  addedAt: string;
  updatedAt: string;
};

export type ReadlistProgress = {
  id: string;
  userId: string;
  workId: string;
  editionId: string | null;
  pagesRead: number | null;
  percent: number | null;
  secondsListened: number | null;
  updatedAt: string;
};

export type ReadlistReview = {
  id: string;
  userId: string;
  workId: string;
  score: number;
  body: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReadlistEntry = {
  item: ReadlistItem;
  list: ReadlistList;
  work: ReadlistWork;
};

export type ReadlistShelves<T extends { status: ReadStatus } = ReadlistItem> = {
  wantToRead: T[];
  reading: T[];
  finished: T[];
};
