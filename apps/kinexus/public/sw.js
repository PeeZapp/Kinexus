/* Kinexus PWA service worker.
   Network-first for pages so deploys are not stuck behind a stale shell.
   Cache-first only for hashed Expo assets. Do not precache the whole site.
   Succeeded recipe-import JSON is network-first with a dedicated cache.
   Intercepts Web Share Target POSTs so Android installed PWAs can receive shares.
   Shared files are stashed in Cache API, then the client takes them on /share/recipe. */

const VERSION = 'kinexus-pwa-v4';
const STATIC_CACHE = `${VERSION}-static`;
const RECIPE_CACHE = 'kinexus-recipes-v1';
const SHARE_FILES_CACHE = 'kinexus-share-files-v1';
const SHARE_FILES_INDEX_KEY = '/__kinexus_share_files_index__';
const SHARE_FILE_KEY_PREFIX = '/__kinexus_share_file__/';
const RECIPE_JSON = /^\/api\/recipes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHARE_RECIPE_PATH = '/share/recipe';

const BYPASS_PREFIXES = [
  '/api/',
  '/health',
  '/scrape',
  '/archive-frame',
  '/ai',
  '/prices',
  '/quotes',
  '/collectibles',
  '/budget',
  '/watchlist',
];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION) && key !== RECIPE_CACHE && key !== SHARE_FILES_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === SHARE_RECIPE_PATH) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== 'GET') return;

  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') return;

  if (RECIPE_JSON.test(url.pathname)) {
    event.respondWith(networkFirstRecipe(request));
    return;
  }

  if (shouldBypass(url.pathname)) return;

  if (url.pathname.startsWith('/_expo/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});

async function stashShareFiles(files) {
  const cache = await caches.open(SHARE_FILES_CACHE);
  const existing = await cache.match(SHARE_FILES_INDEX_KEY);
  if (existing) {
    try {
      const prev = await existing.json();
      await Promise.all((prev || []).map((entry) => cache.delete(entry.key)));
    } catch {
      /* ignore */
    }
    await cache.delete(SHARE_FILES_INDEX_KEY);
  }

  const index = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file || typeof file !== 'object') continue;
    const key = `${SHARE_FILE_KEY_PREFIX}${i}`;
    const type = file.type || 'application/octet-stream';
    const name = file.name || `shared-${i}`;
    await cache.put(
      key,
      new Response(file, {
        headers: {
          'Content-Type': type,
          'X-File-Name': encodeURIComponent(name),
        },
      }),
    );
    index.push({ key, name, type });
  }
  await cache.put(
    SHARE_FILES_INDEX_KEY,
    new Response(JSON.stringify(index), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  return index.length;
}

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const params = new URLSearchParams();
    for (const key of ['url', 'text', 'title']) {
      const value = formData.get(key);
      if (typeof value === 'string' && value.trim()) params.set(key, value);
    }
    const files = formData.getAll('files').filter((entry) => entry && typeof entry === 'object' && 'arrayBuffer' in entry);
    if (files.length > 0) {
      const count = await stashShareFiles(files);
      if (count > 0) params.set('sharedFiles', '1');
    }
    const target = params.toString() ? `${SHARE_RECIPE_PATH}?${params}` : SHARE_RECIPE_PATH;
    return Response.redirect(target, 303);
  } catch {
    return Response.redirect(SHARE_RECIPE_PATH, 303);
  }
}

function shouldBypass(pathname) {
  return BYPASS_PREFIXES.some((prefix) => {
    if (pathname === prefix) return true;
    const withSlash = prefix.endsWith('/') ? prefix : `${prefix}/`;
    return pathname.startsWith(withSlash);
  });
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const home = await caches.match('/');
    if (home) return home;
    throw err;
  }
}

async function networkFirstRecipe(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const data = await clone.json().catch(() => null);
      if (data?.job?.status === 'succeeded' && data.job.recipe) {
        const cache = await caches.open(RECIPE_CACHE);
        await cache.put(request, response.clone());
      }
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}
