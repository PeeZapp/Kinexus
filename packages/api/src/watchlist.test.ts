import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchFailureDetail, lookupWatchlistTitle } from './watchlist.js';

describe('fetchFailureDetail', () => {
  it('unwraps the cause hidden behind fetch failed', () => {
    const cause = new Error('connect ECONNRESET');
    Object.assign(cause, { code: 'ECONNRESET' });
    const err = new TypeError('fetch failed', { cause });
    expect(fetchFailureDetail(err)).toBe('connect ECONNRESET');
  });
});

describe('lookupWatchlistTitle', () => {
  const previous = process.env.TMDB_API_KEY;

  afterEach(() => {
    process.env.TMDB_API_KEY = previous;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries a dropped TMDB connection and still returns the title', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    const cause = new Error('connect ECONNRESET');
    Object.assign(cause, { code: 'ECONNRESET' });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed', { cause }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 11528,
            title: 'The Sandlot',
            overview: 'Summer baseball.',
            release_date: '1993-04-07',
            poster_path: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const title = await lookupWatchlistTitle({ tmdbId: 11528, mediaType: 'movie', country: 'AU' });

    expect(title.title).toBe('The Sandlot');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not surface the raw fetch failed message', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    const cause = new Error('connect ECONNREFUSED 13.226.38.124:443');
    Object.assign(cause, { code: 'ECONNREFUSED' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed', { cause })));

    await expect(lookupWatchlistTitle({ tmdbId: 11528, mediaType: 'movie', country: 'AU' })).rejects.toThrow(
      /Could not reach TMDB \(connect ECONNREFUSED/,
    );
  });
});
