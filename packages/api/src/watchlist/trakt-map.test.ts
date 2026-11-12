import { describe, expect, it } from 'vitest';

import { parseSaTmdbId, requireTmdbId, tmdbIdFromTraktIds } from './trakt.js';

describe('trakt mapping drops rows without tmdbId', () => {
  it('reads numeric Trakt ids.tmdb', () => {
    expect(tmdbIdFromTraktIds({ tmdb: 603 })).toBe(603);
    expect(tmdbIdFromTraktIds({ tmdb: null })).toBeNull();
    expect(tmdbIdFromTraktIds({ tmdb: 0 })).toBeNull();
    expect(tmdbIdFromTraktIds(undefined)).toBeNull();
  });

  it('parses Streaming Availability tmdbId strings', () => {
    expect(parseSaTmdbId('movie/603')).toEqual({ mediaType: 'movie', tmdbId: 603 });
    expect(parseSaTmdbId('tv/1396')).toEqual({ mediaType: 'tv', tmdbId: 1396 });
    expect(parseSaTmdbId('show/1396')).toEqual({ mediaType: 'tv', tmdbId: 1396 });
    expect(parseSaTmdbId('')).toBeNull();
    expect(parseSaTmdbId('movie/')).toBeNull();
  });

  it('requireTmdbId drops missing or invalid ids', () => {
    expect(requireTmdbId({ title: 'Keep', tmdbId: 11 })).toEqual({ title: 'Keep', tmdbId: 11 });
    expect(requireTmdbId({ title: 'Drop', tmdbId: null })).toBeNull();
    expect(requireTmdbId({ title: 'Drop', tmdbId: 0 })).toBeNull();
    expect(requireTmdbId({ title: 'Drop' })).toBeNull();
    expect(requireTmdbId(null)).toBeNull();
  });
});
