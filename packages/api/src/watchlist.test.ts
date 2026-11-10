import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WatchlistSearchHit } from '@kinexus/domain';

import {
  directorHitsFromCrew,
  fetchFailureDetail,
  isStrongDirectorNameMatch,
  lookupWatchlistTitle,
  mergeWatchlistDirectorHits,
  searchWatchlistTitles,
  watchlistTitleCast,
} from './watchlist.js';

function movie(tmdbId: number, title: string, director?: string): WatchlistSearchHit {
  return {
    tmdbId,
    mediaType: 'movie',
    title,
    year: 2000,
    overview: null,
    posterPath: null,
    backdropPath: null,
    imdbId: null,
    ...(director ? { director } : {}),
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

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

describe('watchlistTitleCast', () => {
  const previous = process.env.TMDB_API_KEY;

  afterEach(() => {
    process.env.TMDB_API_KEY = previous;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the top billed cast for a movie or show', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            cast: [
              { id: 2, name: 'Second', character: 'Friend', profile_path: null, order: 1 },
              { id: 1, name: 'Lead', character: 'Hero', profile_path: '/lead.jpg', order: 0 },
              { id: 1, name: 'Lead', character: 'Hero', profile_path: '/lead.jpg', order: 0 },
              { id: 3, name: '   ', character: 'Extra', order: 2 },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const cast = await watchlistTitleCast({ tmdbId: 11528, mediaType: 'movie' });

    expect(cast).toEqual([
      { id: 1, name: 'Lead', character: 'Hero', profilePath: '/lead.jpg' },
      { id: 2, name: 'Second', character: 'Friend', profilePath: null },
    ]);
  });
});

describe('director name match', () => {
  it('accepts a surname, a full name, and a long prefix, and rejects a fragment', () => {
    expect(isStrongDirectorNameMatch('Spielberg', 'Steven Spielberg')).toBe(true);
    expect(isStrongDirectorNameMatch('Steven Spielberg', 'Steven Spielberg')).toBe(true);
    expect(isStrongDirectorNameMatch('steven spi', 'Steven Spielberg')).toBe(false);
    expect(isStrongDirectorNameMatch('berg', 'Steven Spielberg')).toBe(false);
    expect(isStrongDirectorNameMatch('Heat', 'Michael Mann')).toBe(false);
  });
});

describe('directorHitsFromCrew', () => {
  it('keeps Director jobs, dedupes by tmdb id, and takes the most popular 20', () => {
    const crew = [
      { id: 1, job: 'Producer', title: 'Produced', popularity: 100, release_date: '1990-01-01' },
      { id: 2, job: 'Assistant Director', title: 'Assisted', popularity: 90, release_date: '1991-01-01' },
      { id: 3, job: 'Director', title: 'Jaws', popularity: 10, release_date: '1975-06-20' },
      { id: 3, job: 'Director', title: 'Jaws', popularity: 40, release_date: '1975-06-20' },
      { id: 4, job: 'Director', title: 'E.T.', popularity: 30, release_date: '1982-06-11' },
      ...Array.from({ length: 20 }, (_, index) => ({
        id: 100 + index,
        job: 'Director',
        title: `Film ${index}`,
        popularity: index,
        release_date: '2001-01-01',
      })),
    ];

    const hits = directorHitsFromCrew('Steven Spielberg', crew);

    expect(hits).toHaveLength(20);
    expect(hits.map((hit) => hit.tmdbId).slice(0, 2)).toEqual([3, 4]);
    expect(hits.every((hit) => hit.director === 'Steven Spielberg')).toBe(true);
    expect(hits.some((hit) => hit.title === 'Produced' || hit.title === 'Assisted')).toBe(false);
    expect(new Set(hits.map((hit) => hit.tmdbId)).size).toBe(hits.length);
  });
});

describe('mergeWatchlistDirectorHits', () => {
  it('places director films after strong title matches and keeps one row per tmdb id', () => {
    const titles: WatchlistSearchHit[] = [
      movie(1, 'Spielberg'),
      { ...movie(9, 'Spielberg'), mediaType: 'tv' },
      movie(2, 'Totally Unrelated'),
      movie(3, 'Jaws'),
    ];
    const directed = [movie(1, 'Spielberg', 'Steven Spielberg'), movie(3, 'Jaws', 'Steven Spielberg'), movie(4, 'E.T.', 'Steven Spielberg')];

    const merged = mergeWatchlistDirectorHits('Spielberg', titles, directed);

    expect(merged.map((hit) => `${hit.mediaType}:${hit.tmdbId}`)).toEqual(['movie:1', 'tv:9', 'movie:3', 'movie:4', 'movie:2']);
    expect(merged.find((hit) => hit.tmdbId === 1 && hit.mediaType === 'movie')?.director).toBe('Steven Spielberg');
    expect(merged.find((hit) => hit.tmdbId === 3)?.director).toBe('Steven Spielberg');
    expect(merged.find((hit) => hit.tmdbId === 2)?.director).toBeUndefined();
  });
});

describe('searchWatchlistTitles director merge', () => {
  const previous = process.env.TMDB_API_KEY;

  afterEach(() => {
    process.env.TMDB_API_KEY = previous;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('merges the top directing person after a strong title hit', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/multi')) {
        return jsonResponse({
          results: [
            { id: 1, media_type: 'movie', title: 'Spielberg', release_date: '2017-10-05', popularity: 3 },
            { id: 2, media_type: 'movie', title: 'Totally Unrelated', release_date: '2001-01-01', popularity: 1 },
          ],
        });
      }
      if (url.includes('/search/person')) {
        return jsonResponse({
          results: [{ id: 488, name: 'Steven Spielberg', known_for_department: 'Directing' }],
        });
      }
      if (url.includes('/person/488/movie_credits')) {
        return jsonResponse({
          crew: [
            { id: 1, job: 'Director', title: 'Spielberg', release_date: '2017-10-05', popularity: 3 },
            { id: 578, job: 'Director', title: 'Jaws', release_date: '1975-06-20', popularity: 40 },
            { id: 329, job: 'Producer', title: 'Back to the Future', release_date: '1985-07-03', popularity: 80 },
            { id: 424, job: 'Director', title: "Schindler's List", release_date: '1993-12-15', popularity: 50 },
          ],
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const hits = await searchWatchlistTitles('Spielberg', 'AU');

    expect(hits.map((hit) => hit.title)).toEqual(['Spielberg', "Schindler's List", 'Jaws', 'Totally Unrelated']);
    expect(hits[0]?.director).toBe('Steven Spielberg');
    expect(hits.filter((hit) => hit.title === 'Jaws')).toHaveLength(1);
    expect(hits.some((hit) => hit.title === 'Back to the Future')).toBe(false);
  });

  it('does not add director films when the query matches a title and no directing person matches', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/multi')) {
        return jsonResponse({
          results: [{ id: 578, media_type: 'movie', title: 'Jaws', release_date: '1975-06-20' }],
        });
      }
      if (url.includes('/search/person')) {
        return jsonResponse({
          results: [
            { id: 31, name: 'Tom Hanks', known_for_department: 'Acting' },
            { id: 488, name: 'Steven Spielberg', known_for_department: 'Directing' },
          ],
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const hits = await searchWatchlistTitles('Jaws', 'AU');

    expect(hits.map((hit) => hit.title)).toEqual(['Jaws']);
    expect(hits[0]?.director).toBeUndefined();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/movie_credits'))).toBe(false);
  });

  it('still returns title hits when the person search fails', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/search/multi')) {
          return jsonResponse({
            results: [{ id: 578, media_type: 'movie', title: 'Jaws', release_date: '1975-06-20' }],
          });
        }
        throw new Error('TMDB request failed (HTTP 500)');
      }),
    );

    const hits = await searchWatchlistTitles('Jaws', 'AU');

    expect(hits.map((hit) => hit.title)).toEqual(['Jaws']);
  });
});

describe('lookupWatchlistTitle director', () => {
  const previous = process.env.TMDB_API_KEY;

  afterEach(() => {
    process.env.TMDB_API_KEY = previous;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('joins movie directors from credits and ignores other crew jobs', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 329,
          title: 'Back to the Future',
          release_date: '1985-07-03',
          credits: {
            crew: [
              { job: 'Director', name: 'Robert Zemeckis' },
              { job: 'Director', name: 'Robert Zemeckis' },
              { job: 'Writer', name: 'Bob Gale' },
              { job: 'Director', name: 'Bob Gale' },
              { job: 'Director', name: '  ' },
            ],
          },
        }),
      ),
    );

    const title = await lookupWatchlistTitle({ tmdbId: 329, mediaType: 'movie', country: 'AU' });

    expect(title.director).toBe('Robert Zemeckis, Bob Gale');
  });
});
