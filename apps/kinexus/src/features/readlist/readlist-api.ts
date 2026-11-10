import { Platform } from 'react-native';

import type { BookSearchHit, BookWork, ReadStatus } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export function isReadlistApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function authHeaders(json = true): Promise<HeadersInit> {
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!isReadlistApiConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  let res: Response;
  try {
    res = await fetch(`${configuredUrl()}${path}`, init);
  } catch (err) {
    if (
      err instanceof TypeError ||
      (err instanceof Error && /failed to fetch|networkerror|econnrefused/i.test(err.message))
    ) {
      throw new Error('Could not reach the API. Restart with npm run dev so the API on port 5301 is running.');
    }
    throw err;
  }
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify(body) });
}

async function del<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'DELETE', headers: await authHeaders(), body: JSON.stringify(body) });
}

async function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET', headers: await authHeaders(false) });
}

export async function searchBooks(query: string): Promise<BookSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const payload = await get<{ results?: BookSearchHit[] }>(`/books/search?q=${encodeURIComponent(q)}`);
  return payload.results ?? [];
}

export async function resolveBookUrl(urlOrIsbn: string): Promise<BookSearchHit[]> {
  const payload = await post<{ results?: BookSearchHit[] }>('/books/resolve-url', { url: urlOrIsbn.trim() });
  return payload.results ?? [];
}

export async function loadBookWork(workId: string): Promise<BookWork | null> {
  const payload = await get<{ work?: BookWork }>(`/books/work/${encodeURIComponent(workId)}`);
  return payload.work ?? null;
}

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

export async function loadBookCollections(): Promise<ReadlistCollectionSummary[]> {
  const payload = await get<{ collections?: ReadlistCollectionSummary[] }>('/books/collections');
  return payload.collections ?? [];
}

export async function loadBookCollection(id: string): Promise<ReadlistCollectionDetail | null> {
  const payload = await get<{ collection?: ReadlistCollectionDetail }>(
    `/books/collections/${encodeURIComponent(id)}`,
  );
  return payload.collection ?? null;
}

export type ReadlistRecommendation = {
  workId: string;
  title: string;
  authors: string[];
  firstPublishedYear: number | null;
  coverUrl: string | null;
  reason: string;
  seedTitle: string;
};

export async function loadReadlistRecommendations(
  householdId: string,
): Promise<{ results: ReadlistRecommendation[]; reason?: string }> {
  const payload = await get<{ results?: ReadlistRecommendation[]; reason?: string }>(
    `/readlist/recommendations?householdId=${encodeURIComponent(householdId)}`,
  );
  return {
    results: payload.results ?? [],
    reason: payload.reason,
  };
}

export async function ensureDefaultReadlist(householdId: string): Promise<string> {
  const payload = await post<{ listId?: string }>('/readlist/ensure-default', { householdId });
  if (!payload.listId) throw new Error('Could not open readlist');
  return payload.listId;
}

export async function createReadlistList(input: {
  householdId: string;
  name: string;
  visibility?: string;
  personIds?: readonly string[];
}): Promise<string> {
  const payload = await post<{ listId?: string }>('/readlist/lists', input);
  if (!payload.listId) throw new Error('Could not create list');
  return payload.listId;
}

export async function renameReadlistList(listId: string, name: string): Promise<void> {
  await patch('/readlist/lists', { listId, name });
}

export async function deleteReadlistList(listId: string): Promise<void> {
  await del('/readlist/lists', { listId });
}

export async function addReadlistItem(input: {
  listId: string;
  workId: string;
  preferredEditionFormat?: string | null;
  status?: ReadStatus;
}): Promise<{ itemId: string; workId: string }> {
  const payload = await post<{ itemId?: string; workId?: string }>('/readlist/items', input);
  if (!payload.itemId || !payload.workId) throw new Error('Could not add book');
  return { itemId: payload.itemId, workId: payload.workId };
}

export async function updateReadlistItem(input: {
  itemId: string;
  preferredEditionId?: string | null;
  clearPreferredEdition?: boolean;
}): Promise<void> {
  await patch('/readlist/items', input);
}

export async function removeReadlistItem(itemId: string): Promise<void> {
  await del('/readlist/items', { itemId });
}

export async function setReadlistItemStatus(itemId: string, status: ReadStatus): Promise<void> {
  await post('/readlist/items/status', { itemId, status });
}

export async function upsertReadlistProgress(input: {
  workId: string;
  editionId?: string | null;
  pagesRead?: number | null;
  percent?: number | null;
  secondsListened?: number | null;
}): Promise<void> {
  await post('/readlist/progress', input);
}

export async function upsertReadlistReview(input: {
  workId: string;
  score: number;
  body?: string | null;
}): Promise<void> {
  await post('/readlist/reviews', input);
}

export async function deleteReadlistReview(workId: string): Promise<void> {
  await del('/readlist/reviews', { workId });
}

export type ReadlistImportMatchRow = {
  key: string;
  bookId?: string | null;
  title: string;
  author?: string | null;
  additionalAuthors?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  myRating?: number;
  score?: number | null;
  binding?: string | null;
  format: string;
  pages?: number | null;
  dateRead?: string | null;
  dateAdded?: string | null;
  exclusiveShelf?: string;
  status: ReadStatus;
  readCount?: number | null;
};

export type ReadlistImportMatchCandidate = {
  workId: string;
  title: string;
  authors: string[];
  firstPublishedYear: number | null;
  coverUrl: string | null;
  isbn13: string | null;
  confidence: number;
};

export type ReadlistImportMatchResultRow = {
  key: string;
  tier: 'exact' | 'likely' | 'unsure' | 'none';
  matchedBy: 'isbn13' | 'isbn10' | 'title_author' | null;
  confidence: number;
  match: ReadlistImportMatchCandidate | null;
  candidates: ReadlistImportMatchCandidate[];
  import: {
    title: string;
    author: string | null;
    isbn10: string | null;
    isbn13: string | null;
    score: number | null;
    format: string;
    status: ReadStatus;
    pages: number | null;
    dateRead: string | null;
    dateAdded: string | null;
  };
};

export type ReadlistImportMatchResponse = {
  counts: {
    total: number;
    exact: number;
    likely: number;
    unsure: number;
    none: number;
    matched: number;
  };
  rows: ReadlistImportMatchResultRow[];
};

export async function matchReadlistImport(
  rows: readonly ReadlistImportMatchRow[],
): Promise<ReadlistImportMatchResponse> {
  return post<ReadlistImportMatchResponse>('/readlist/import/match', { rows });
}

export type ReadlistImportCommitRow = {
  key: string;
  tier: 'exact' | 'likely' | 'unsure' | 'none';
  workId: string | null;
  title: string;
  author: string | null;
  isbn10: string | null;
  isbn13: string | null;
  score: number | null;
  format: string;
  status: ReadStatus;
};

export type ReadlistImportCommitResponse = {
  progress: {
    done: number;
    total: number;
    imported: number;
    skippedDuplicate: number;
    checkThese: number;
  };
  importedWorkIds: string[];
  checkThese: ReadlistImportCommitRow[];
};

export async function commitReadlistImport(
  listId: string,
  rows: readonly ReadlistImportCommitRow[],
): Promise<ReadlistImportCommitResponse> {
  return post<ReadlistImportCommitResponse>('/readlist/import/commit', { listId, rows });
}

export async function exportReadlistList(
  listId: string,
  format: 'goodreads' | 'json' = 'goodreads',
): Promise<{ fileName: string; mimeType: string; text: string }> {
  if (!isReadlistApiConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(
    `${configuredUrl()}/readlist/export?listId=${encodeURIComponent(listId)}&format=${encodeURIComponent(format)}`,
    { method: 'GET', headers: await authHeaders(false) },
  );
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Export failed (${res.status})`);
  }
  const text = await res.text();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const fileNameMatch = disposition.match(/filename="([^"]+)"/i);
  const mimeType = res.headers.get('Content-Type')?.split(';')[0]?.trim() || 'text/csv';
  return {
    fileName: fileNameMatch?.[1] ?? (format === 'json' ? 'readlist.json' : 'readlist-goodreads.csv'),
    mimeType,
    text,
  };
}
