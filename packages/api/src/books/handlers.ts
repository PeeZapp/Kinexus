import { getReadlistCollection, listReadlistCollections } from './collections.js';
import { getBookProvider } from './compose.js';

function booksError(err: unknown, fallback: string) {
  const status =
    err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 502;
  const message = err instanceof Error && err.message ? err.message : fallback;
  return { status: status as 400 | 404 | 422 | 502, body: { error: message } };
}

export async function handleBooksSearch(query: string) {
  try {
    const q = query.trim();
    if (!q) return { status: 400 as const, body: { error: 'q is required' } };
    const results = await getBookProvider().searchBooks(q);
    return { status: 200 as const, body: { results } };
  } catch (err) {
    return booksError(err, 'Could not search books');
  }
}

export async function handleBooksWork(workId: string) {
  try {
    const id = workId.trim();
    if (!id) return { status: 400 as const, body: { error: 'work id is required' } };
    const work = await getBookProvider().lookupWork(id);
    if (!work) return { status: 404 as const, body: { error: 'Work not found' } };
    return { status: 200 as const, body: { work } };
  } catch (err) {
    return booksError(err, 'Could not load that work');
  }
}

export async function handleBooksResolveUrl(body: { url?: unknown }) {
  try {
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return { status: 400 as const, body: { error: 'url is required' } };
    const results = await getBookProvider().resolveBookUrl(url);
    return { status: 200 as const, body: { results } };
  } catch (err) {
    return booksError(err, 'Could not resolve that link');
  }
}

export async function handleBooksCollections() {
  try {
    const collections = await listReadlistCollections();
    return { status: 200 as const, body: { collections } };
  } catch (err) {
    return booksError(err, 'Could not load collections');
  }
}

export async function handleBooksCollection(id: string) {
  try {
    const collectionId = id.trim();
    if (!collectionId) return { status: 400 as const, body: { error: 'collection id is required' } };
    const collection = await getReadlistCollection(collectionId);
    if (!collection) return { status: 404 as const, body: { error: 'Collection not found' } };
    return { status: 200 as const, body: { collection } };
  } catch (err) {
    return booksError(err, 'Could not load that collection');
  }
}
