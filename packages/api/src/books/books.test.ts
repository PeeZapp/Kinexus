import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryBookCache, setBookCacheForTests } from './cache.js';
import { getBookProvider } from './compose.js';
import { isGoogleBooksEnabled } from './google-books.js';
import { isHardcoverEnabled } from './hardcover.js';
import { resetOpenLibraryUaWarning } from './http.js';
import { parseBookUrl } from './parse-url.js';
import {
  bookProviderRequestCount,
  openLibraryRps,
  parseRetryAfterMs,
  resetBookOutboundRateLimits,
} from './rate-limit.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function mockOpenLibraryFetch(opts?: {
  onRequest?: (url: string) => void;
  failOnceWith429?: boolean;
}): typeof fetch {
  let saw429 = false;
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    opts?.onRequest?.(url);
    if (opts?.failOnceWith429 && !saw429 && url.includes('search.json')) {
      saw429 = true;
      return jsonResponse({ error: 'rate' }, { status: 429, headers: { 'Retry-After': '0' } });
    }
    if (url.includes('/search.json')) return jsonResponse(fixture('search.json'));
    if (url.includes('/works/OL45804W/editions.json')) return jsonResponse(fixture('editions.json'));
    if (url.includes('/works/OL45804W.json')) return jsonResponse(fixture('work.json'));
    if (url.includes('/authors/OL26320A.json')) return jsonResponse(fixture('author.json'));
    if (url.includes('/books/OL24331121M.json')) {
      return jsonResponse((fixture('editions.json') as { entries: unknown[] }).entries[0]);
    }
    return jsonResponse({ error: `unhandled ${url}` }, { status: 404 });
  }) as unknown as typeof fetch;
}

const PREV = {
  BOOKS_CONTACT_EMAIL: process.env.BOOKS_CONTACT_EMAIL,
  HARDCOVER_API_TOKEN: process.env.HARDCOVER_API_TOKEN,
  GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY,
  BOOKS_ENABLE_GOOGLE: process.env.BOOKS_ENABLE_GOOGLE,
};

afterEach(() => {
  for (const [key, value] of Object.entries(PREV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  setBookCacheForTests(null);
  resetBookOutboundRateLimits();
  resetOpenLibraryUaWarning();
  vi.restoreAllMocks();
});

beforeEach(() => {
  delete process.env.HARDCOVER_API_TOKEN;
  delete process.env.GOOGLE_BOOKS_API_KEY;
  delete process.env.BOOKS_ENABLE_GOOGLE;
  process.env.BOOKS_CONTACT_EMAIL = 'books@example.com';
  setBookCacheForTests(createMemoryBookCache());
  resetBookOutboundRateLimits();
});

describe('parseBookUrl', () => {
  it('resolves each supported host and bare ISBN', () => {
    expect(parseBookUrl('https://openlibrary.org/works/OL45804W')).toEqual({
      kind: 'openLibraryWork',
      workId: 'OL45804W',
    });
    expect(parseBookUrl('https://www.goodreads.com/book/show/5907.The_Hobbit')).toMatchObject({
      kind: 'goodreads',
      goodreadsId: '5907',
      query: 'The Hobbit',
    });
    expect(parseBookUrl('https://www.amazon.com/dp/B00TESTASI')).toEqual({
      kind: 'asin',
      asin: 'B00TESTASI',
    });
    expect(parseBookUrl('https://books.google.com/books?id=abc123')).toEqual({
      kind: 'googleVolume',
      volumeId: 'abc123',
    });
    expect(parseBookUrl('https://hardcover.app/books/the-hobbit')).toEqual({
      kind: 'hardcover',
      hardcoverId: null,
      query: 'the hobbit',
    });
    expect(parseBookUrl('9780306406157')).toEqual({ kind: 'isbn', isbn: '9780306406157' });
    expect(parseBookUrl('0-306-40615-2')).toEqual({ kind: 'isbn', isbn: '9780306406157' });
  });
});

describe('book provider fixtures', () => {
  it('search returns works with at least one edition', async () => {
    const provider = getBookProvider({ fetchImpl: mockOpenLibraryFetch() });
    const results = await provider.searchBooks('hobbit');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((hit) => hit.editionCount >= 1)).toBe(true);
    expect(results.some((hit) => hit.title === 'No Editions')).toBe(false);
  });

  it('audiobook edition sits under the same work with format=audiobook', async () => {
    const provider = getBookProvider({ fetchImpl: mockOpenLibraryFetch() });
    const work = await provider.lookupWork('OL45804W');
    expect(work).not.toBeNull();
    expect(work?.editions.some((e) => e.format === 'audiobook')).toBe(true);
    expect(work?.editions.every((e) => e.workId === 'OL45804W')).toBe(true);
  });

  it('lookupWork never fabricates editions', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/works/OL45804W/editions.json')) return jsonResponse({ entries: [] });
      if (url.includes('/works/OL45804W.json')) return jsonResponse(fixture('work.json'));
      if (url.includes('/authors/OL26320A.json')) return jsonResponse(fixture('author.json'));
      return jsonResponse({}, { status: 404 });
    }) as unknown as typeof fetch;
    const provider = getBookProvider({ fetchImpl });
    const work = await provider.lookupWork('OL45804W');
    expect(work?.editions).toEqual([]);
  });

  it('lookupWork falls back to edition description when work has none', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/works/OL45804W/editions.json')) {
        return jsonResponse({
          entries: [
            {
              key: '/books/OL24331121M',
              title: 'The Hobbit',
              description: 'Edition-only synopsis.',
              works: [{ key: '/works/OL45804W' }],
            },
          ],
        });
      }
      if (url.includes('/works/OL45804W.json')) {
        return jsonResponse({
          key: '/works/OL45804W',
          title: 'The Hobbit',
          authors: [{ author: { key: '/authors/OL26320A' } }],
        });
      }
      if (url.includes('/authors/OL26320A.json')) return jsonResponse(fixture('author.json'));
      return jsonResponse({}, { status: 404 });
    }) as unknown as typeof fetch;
    const provider = getBookProvider({ fetchImpl });
    const work = await provider.lookupWork('OL45804W');
    expect(work?.blurb).toBe('Edition-only synopsis.');
  });

  it('lookupWork hides synopsis when neither work nor edition has a description', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/works/OL45804W/editions.json')) {
        return jsonResponse({
          entries: [{ key: '/books/OL24331121M', title: 'The Hobbit', works: [{ key: '/works/OL45804W' }] }],
        });
      }
      if (url.includes('/works/OL45804W.json')) {
        return jsonResponse({
          key: '/works/OL45804W',
          title: 'The Hobbit',
          authors: [{ author: { key: '/authors/OL26320A' } }],
        });
      }
      if (url.includes('/authors/OL26320A.json')) return jsonResponse(fixture('author.json'));
      return jsonResponse({}, { status: 404 });
    }) as unknown as typeof fetch;
    const provider = getBookProvider({ fetchImpl });
    const work = await provider.lookupWork('OL45804W');
    expect(work?.blurb).toBeNull();
  });

  it('resolveBookUrl works for each host + bare ISBN via Open Library search/lookup', async () => {
    const provider = getBookProvider({ fetchImpl: mockOpenLibraryFetch() });
    const fromWork = await provider.resolveBookUrl('https://openlibrary.org/works/OL45804W');
    expect(fromWork[0]?.workId).toBe('OL45804W');

    const fromGoodreads = await provider.resolveBookUrl('https://www.goodreads.com/book/show/5907.The_Hobbit');
    expect(fromGoodreads.length).toBeGreaterThan(0);

    const fromAmazon = await provider.resolveBookUrl('https://www.amazon.com/dp/B00TESTASI');
    expect(fromAmazon.length).toBeGreaterThan(0);

    const fromGoogle = await provider.resolveBookUrl('https://books.google.com/books?id=abc123');
    expect(fromGoogle.length).toBeGreaterThan(0);

    const fromHardcover = await provider.resolveBookUrl('https://hardcover.app/books/the-hobbit');
    expect(fromHardcover.length).toBeGreaterThan(0);

    const fromIsbn = await provider.resolveBookUrl('9780547928227');
    expect(fromIsbn.length).toBeGreaterThan(0);
  });

  it('cache hit skips second outbound call', async () => {
    let calls = 0;
    const fetchImpl = mockOpenLibraryFetch({
      onRequest: () => {
        calls += 1;
      },
    });
    const cache = createMemoryBookCache();
    setBookCacheForTests(cache);
    const provider = getBookProvider({ fetchImpl, cache });
    await provider.searchBooks('hobbit');
    const afterFirst = calls;
    await provider.searchBooks('hobbit');
    expect(calls).toBe(afterFirst);
  });

  it('honours 429 Retry-After with backoff then succeeds', async () => {
    const fetchImpl = mockOpenLibraryFetch({ failOnceWith429: true });
    const provider = getBookProvider({ fetchImpl });
    const results = await provider.searchBooks('hobbit');
    expect(results.length).toBeGreaterThan(0);
    expect(bookProviderRequestCount('open_library')).toBeGreaterThanOrEqual(2);
  });

  it('adapters are off when env is missing', () => {
    delete process.env.HARDCOVER_API_TOKEN;
    delete process.env.GOOGLE_BOOKS_API_KEY;
    delete process.env.BOOKS_ENABLE_GOOGLE;
    expect(isHardcoverEnabled()).toBe(false);
    expect(isGoogleBooksEnabled()).toBe(false);
    const provider = getBookProvider({ fetchImpl: mockOpenLibraryFetch() });
    expect(provider.name).toBe('composed');
  });

  it('Open Library rps depends on contact email', () => {
    process.env.BOOKS_CONTACT_EMAIL = 'books@example.com';
    expect(openLibraryRps()).toBe(3);
    delete process.env.BOOKS_CONTACT_EMAIL;
    expect(openLibraryRps()).toBe(1);
  });

  it('parseRetryAfterMs reads seconds', () => {
    expect(parseRetryAfterMs('2', 1000)).toBe(2000);
  });
});
