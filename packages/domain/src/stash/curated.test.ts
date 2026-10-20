import { describe, expect, it } from 'vitest';

import { CURATED_WATCHLISTS, curatedWatchlistById, curatedWatchlistsForAudience, searchCuratedWatchlists } from './curated';
import { watchlistTitleKey } from './recommend';

describe('curated watchlists', () => {
  it('keeps list ids and titles unique', () => {
    const ids = CURATED_WATCHLISTS.map((list) => list.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const list of CURATED_WATCHLISTS) {
      const keys = list.titles.map((title) => watchlistTitleKey(title.mediaType, title.tmdbId));
      expect(new Set(keys).size).toBe(keys.length);
      expect(list.titles.length).toBeGreaterThanOrEqual(50);
      expect(list.titles.length).toBeLessThanOrEqual(100);
      expect(list.audience).toBeTruthy();
    }
  });

  it('hides older-audience lists from younger viewers', () => {
    const forKids = curatedWatchlistsForAudience('all');
    expect(forKids.every((list) => list.audience === 'all')).toBe(true);
    expect(forKids.map((list) => list.id)).toEqual(
      expect.arrayContaining(['kids-movie-classics', 'kids-show-favourites']),
    );
    expect(curatedWatchlistsForAudience('7+').some((list) => list.audience === '16+')).toBe(false);
  });

  it('returns every list when the search is empty', () => {
    expect(searchCuratedWatchlists('  ')).toHaveLength(CURATED_WATCHLISTS.length);
  });

  it('finds a list by mood and by a title inside it', () => {
    expect(searchCuratedWatchlists('heist').map((match) => match.list.id)).toEqual(['jobs-worth-planning']);
    const quiet = searchCuratedWatchlists('paterson');
    expect(quiet.map((match) => match.list.id)).toEqual(['quiet-sundays']);
    expect(quiet[0]?.matchedTitles).toEqual(['Paterson']);
  });

  it('groups comedy and action lists by those words', () => {
    expect(searchCuratedWatchlists('comedy').map((match) => match.list.id)).toEqual([
      'hangout-comedies',
      'romantic-comedies',
      'sharp-comedies',
    ]);
    expect(searchCuratedWatchlists('80s').map((match) => match.list.id)).toEqual(['eighties-action']);
    expect(searchCuratedWatchlists('rewatchables').map((match) => match.list.id)).toEqual(['rewatchables']);
  });

  it('looks up a list by id', () => {
    expect(curatedWatchlistById('easy-rewatches')?.name).toBe('Easy rewatches');
    expect(curatedWatchlistById('missing')).toBeNull();
  });
});
