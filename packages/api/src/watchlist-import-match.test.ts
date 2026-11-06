import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleWatchlistImportMatch } from './handlers.js';
import { resetWatchlistImportMatchRateLimit } from './watchlist-import-rate-limit.js';
import {
  matchWatchlistImportRows,
  resetWatchlistImportMatchCache,
  WATCHLIST_IMPORT_MATCH_BATCH_CAP,
} from './watchlist.js';

describe('watchlist import match', () => {
  const previous = process.env.TMDB_API_KEY;

  afterEach(() => {
    process.env.TMDB_API_KEY = previous;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetWatchlistImportMatchCache();
    resetWatchlistImportMatchRateLimit();
  });

  it('matches IMDb rows via /find and title rows via search', async () => {
    process.env.TMDB_API_KEY = 'test-key-secret-value';
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      // Key stays on the server-side TMDB request only (never in the match payload).
      if (url.includes('/find/tt1375666')) {
        return new Response(
          JSON.stringify({
            movie_results: [
              {
                id: 27205,
                title: 'Inception',
                release_date: '2010-07-16',
                overview: 'Dreams',
                poster_path: '/inception.jpg',
              },
            ],
            tv_results: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/search/multi')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 603,
                media_type: 'movie',
                title: 'The Matrix',
                release_date: '1999-03-31',
                overview: 'Neo',
                poster_path: null,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await matchWatchlistImportRows({
      country: 'AU',
      rows: [
        { key: '0', imdbId: 'tt1375666', title: 'Inception', year: 2010 },
        { key: '1', title: 'The Matrix', year: 1999 },
      ],
    });

    expect(results[0]).toMatchObject({
      key: '0',
      confidence: 1,
      match: { tmdbId: 27205, title: 'Inception', imdbId: 'tt1375666' },
    });
    expect(results[1]?.match?.tmdbId).toBe(603);
    expect(results[1]?.confidence).toBeGreaterThanOrEqual(0.9);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('api_key='))).toBe(true);
    expect(JSON.stringify(results)).not.toContain('test-key-secret-value');
  });

  it('enforces the batch cap', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    await expect(
      matchWatchlistImportRows({
        rows: Array.from({ length: WATCHLIST_IMPORT_MATCH_BATCH_CAP + 1 }, (_, i) => ({
          key: String(i),
          title: `Title ${i}`,
        })),
      }),
    ).rejects.toThrow(/at most/i);
  });

  it('caches repeated lookups', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          movie_results: [{ id: 1, title: 'Heat', release_date: '1995-01-01' }],
          tv_results: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await matchWatchlistImportRows({ rows: [{ key: 'a', imdbId: 'tt0113277' }] });
    await matchWatchlistImportRows({ rows: [{ key: 'b', imdbId: 'tt0113277' }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rate-limits per user on the handler', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ movie_results: [], tv_results: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    for (let i = 0; i < 30; i++) {
      const ok = await handleWatchlistImportMatch('user-1', {
        rows: [{ key: '0', imdbId: `tt${String(i).padStart(7, '0')}` }],
      });
      expect(ok.status).toBe(200);
    }
    const limited = await handleWatchlistImportMatch('user-1', {
      rows: [{ key: '0', imdbId: 'tt9999999' }],
    });
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ errorCode: 'rate_limited' });

    const other = await handleWatchlistImportMatch('user-2', {
      rows: [{ key: '0', imdbId: 'tt0000001' }],
    });
    expect(other.status).toBe(200);
  });

  it('rejects oversized batches on the handler without leaking the key', async () => {
    process.env.TMDB_API_KEY = 'super-secret-tmdb-key';
    const result = await handleWatchlistImportMatch('user-x', {
      rows: Array.from({ length: WATCHLIST_IMPORT_MATCH_BATCH_CAP + 1 }, (_, i) => ({
        key: String(i),
        title: 'X',
      })),
    });
    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).not.toContain('super-secret-tmdb-key');
  });
});
