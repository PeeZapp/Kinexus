import { describe, expect, it } from 'vitest';

import type { WatchlistItem, WatchlistList, WatchlistTitle } from './types';
import {
  canManageWatchlist,
  canViewWatchlist,
  filterWatchlistEntries,
  groupWatchlistProviders,
  parseStoredProviders,
  parseWatchlistUrl,
  pickYoutubeTrailerUrl,
  slugToQuery,
  streamingSummary,
  tmdbImageUrl,
  watchlistEntries,
  watchlistListError,
  watchlistProviderOptions,
  yearFromDate,
} from './watchlist';

function list(partial: Partial<WatchlistList> & Pick<WatchlistList, 'id' | 'name'>): WatchlistList {
  return {
    householdId: 'h1',
    createdBy: 'u1',
    visibility: 'household',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...partial,
  };
}

function title(partial: Partial<WatchlistTitle> & Pick<WatchlistTitle, 'id' | 'title'>): WatchlistTitle {
  return {
    householdId: 'h1',
    tmdbId: 1,
    mediaType: 'movie',
    year: 1999,
    overview: null,
    posterPath: null,
    backdropPath: null,
    imdbId: null,
    sourceUrl: null,
    tmdbWatchUrl: null,
    trailerUrl: null,
    providers: [],
    providersCountry: 'AU',
    providersFetchedAt: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...partial,
  };
}

function item(partial: Partial<WatchlistItem> & Pick<WatchlistItem, 'id' | 'listId' | 'titleId'>): WatchlistItem {
  return {
    householdId: 'h1',
    addedBy: 'u1',
    status: 'want',
    notes: null,
    addedAt: '2026-01-02',
    ...partial,
  };
}

describe('watchlist urls', () => {
  it('parses IMDb and TMDB title pages', () => {
    expect(parseWatchlistUrl('https://www.imdb.com/title/tt0133093/')).toEqual({
      kind: 'imdb',
      imdbId: 'tt0133093',
    });
    expect(parseWatchlistUrl('https://www.themoviedb.org/movie/603-the-matrix')).toEqual({
      kind: 'tmdb',
      mediaType: 'movie',
      tmdbId: 603,
    });
    expect(parseWatchlistUrl('https://www.themoviedb.org/tv/1396')).toEqual({
      kind: 'tmdb',
      mediaType: 'tv',
      tmdbId: 1396,
    });
  });

  it('turns RT / Letterboxd / JustWatch title slugs into searches', () => {
    expect(parseWatchlistUrl('https://www.rottentomatoes.com/m/the_matrix')).toEqual({
      kind: 'search',
      query: 'the matrix',
      source: 'Rotten Tomatoes',
    });
    expect(parseWatchlistUrl('https://letterboxd.com/film/the-matrix/')).toEqual({
      kind: 'search',
      query: 'the matrix',
      source: 'Letterboxd',
    });
    expect(parseWatchlistUrl('https://www.justwatch.com/au/tv-show/the-bear')).toEqual({
      kind: 'search',
      query: 'the bear',
      source: 'JustWatch',
    });
  });

  it('rejects list pages instead of scraping them', () => {
    const imdbList = parseWatchlistUrl('https://www.imdb.com/list/ls000123456/');
    expect(imdbList).toEqual({ kind: 'list', source: 'IMDb' });
    expect(watchlistListError(imdbList)).toMatch(/lists can’t be imported/i);
    expect(parseWatchlistUrl('https://letterboxd.com/user/list/favourites/').kind).toBe('list');
  });

  it('slug-to-query drops years and separators', () => {
    expect(slugToQuery('spider-man-no-way-home-2021')).toBe('spider man no way home');
    expect(yearFromDate('1999-03-31')).toBe(1999);
    expect(tmdbImageUrl('/abc.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/abc.jpg');
  });
});

describe('watchlist visibility', () => {
  it('hides personal lists from other household members', () => {
    const mine = list({ id: 'p', name: 'Mine', visibility: 'personal', createdBy: 'u1' });
    expect(canViewWatchlist(mine, { userId: 'u1' })).toBe(true);
    expect(canViewWatchlist(mine, { userId: 'u2' })).toBe(false);
    expect(canManageWatchlist(mine, { userId: 'u2', role: 'admin' })).toBe(false);
    expect(canManageWatchlist(list({ id: 'h', name: 'Family' }), { userId: 'u2', role: 'admin' })).toBe(true);
  });
});

describe('watchlist entries', () => {
  it('joins and filters titles', () => {
    const family = list({ id: 'fam', name: 'Family' });
    const matrix = title({
      id: 't1',
      title: 'The Matrix',
      tmdbId: 603,
      providers: [
        {
          offerType: 'flatrate',
          providerId: 8,
          providerName: 'Netflix',
          logoPath: null,
          displayPriority: 0,
        },
      ],
    });
    const bear = title({
      id: 't2',
      title: 'The Bear',
      mediaType: 'tv',
      tmdbId: 136315,
      providers: [
        {
          offerType: 'flatrate',
          providerId: 9,
          providerName: 'Prime Video',
          logoPath: null,
          displayPriority: 1,
        },
      ],
    });
    const rows = watchlistEntries(
      [family],
      [matrix, bear],
      [
        item({ id: 'i1', listId: 'fam', titleId: 't1', status: 'want', addedAt: '2026-02-01' }),
        item({ id: 'i2', listId: 'fam', titleId: 't2', status: 'watching', addedAt: '2026-03-01' }),
      ],
    );
    expect(rows).toHaveLength(2);
    expect(filterWatchlistEntries(rows, { mediaType: 'tv' }).map((row) => row.title.title)).toEqual(['The Bear']);
    expect(filterWatchlistEntries(rows, { search: 'matrix' })).toHaveLength(1);
    expect(filterWatchlistEntries(rows, { providerId: 8 }).map((row) => row.title.title)).toEqual(['The Matrix']);
    expect(watchlistProviderOptions(rows).map((row) => row.providerName)).toEqual(['Netflix', 'Prime Video']);
  });

  it('groups providers and summarises streaming', () => {
    const providers = parseStoredProviders([
      { offer_type: 'rent', provider_id: 2, provider_name: 'Apple TV', display_priority: 1 },
      { offer_type: 'flatrate', provider_id: 8, provider_name: 'Netflix', display_priority: 0 },
      { offer_type: 'flatrate', provider_id: 337, provider_name: 'Disney Plus', display_priority: 2 },
    ]);
    const groups = groupWatchlistProviders(providers);
    expect(groups[0]?.label).toBe('Stream');
    expect(streamingSummary(providers)).toBe('Netflix · Disney Plus');
  });

  it('picks the best YouTube trailer', () => {
    expect(
      pickYoutubeTrailerUrl([
        { site: 'Vimeo', key: '111', type: 'Trailer', official: true },
        { site: 'YouTube', key: 'teaser1', type: 'Teaser', official: true, iso_639_1: 'en' },
        { site: 'YouTube', key: 'dQw4w9WgXcQ', type: 'Trailer', official: true, iso_639_1: 'en', name: 'Official Trailer' },
        { site: 'YouTube', key: 'clip1', type: 'Clip', official: false },
      ]),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(pickYoutubeTrailerUrl([])).toBeNull();
  });
});
