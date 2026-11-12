/**
 * Web Share Target file stash (Cache API), written by public/sw.js and consumed here.
 * Native shares use expo-share-intent paths instead.
 */

export const SHARE_FILES_CACHE = 'kinexus-share-files-v1';
export const SHARE_FILES_INDEX_KEY = '/__kinexus_share_files_index__';
export const SHARE_FILE_KEY_PREFIX = '/__kinexus_share_file__/';

export type SharedShareTargetFile = {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
};

type ShareFileIndexEntry = {
  key: string;
  name: string;
  type: string;
};

async function bytesFromResponse(response: Response): Promise<Uint8Array> {
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Read and clear files stashed by the service worker share POST handler. */
export async function takeSharedShareTargetFiles(): Promise<SharedShareTargetFile[]> {
  if (typeof caches === 'undefined') return [];
  try {
    const cache = await caches.open(SHARE_FILES_CACHE);
    const indexRes = await cache.match(SHARE_FILES_INDEX_KEY);
    if (!indexRes) return [];
    const index = (await indexRes.json()) as ShareFileIndexEntry[];
    const out: SharedShareTargetFile[] = [];
    for (const entry of index) {
      const res = await cache.match(entry.key);
      if (!res) continue;
      out.push({
        fileName: entry.name || 'shared',
        mimeType: entry.type || res.headers.get('Content-Type'),
        bytes: await bytesFromResponse(res),
      });
      await cache.delete(entry.key);
    }
    await cache.delete(SHARE_FILES_INDEX_KEY);
    return out;
  } catch {
    return [];
  }
}

export async function clearSharedShareTargetFiles(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(SHARE_FILES_CACHE);
    const indexRes = await cache.match(SHARE_FILES_INDEX_KEY);
    if (indexRes) {
      const index = (await indexRes.json()) as ShareFileIndexEntry[];
      await Promise.all(index.map((entry) => cache.delete(entry.key)));
    }
    await cache.delete(SHARE_FILES_INDEX_KEY);
  } catch {
    /* ignore */
  }
}
