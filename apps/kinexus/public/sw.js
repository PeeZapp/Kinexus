/* Kinexus PWA service worker.
   Network-first for pages so deploys are not stuck behind a stale shell.
   Cache-first only for hashed Expo assets. Do not precache the whole site.
   Succeeded recipe-import JSON is network-first with a dedicated cache. */

const VERSION = 'kinexus-pwa-v2';
const STATIC_CACHE = `${VERSION}-static`;
const RECIPE_CACHE = 'kinexus-recipes-v1';
const RECIPE_JSON = /^\/api\/recipes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      await Promise.all(keys.filter((key) => !key.startsWith(VERSION) && key !== RECIPE_CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
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
