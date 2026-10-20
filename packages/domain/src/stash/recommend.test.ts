import { describe, expect, it } from 'vitest';

import {
  rankWatchlistSuggestions,
  watchlistRecommendSeeds,
  watchlistTasteBand,
  type WatchlistTasteCandidate,
  type WatchlistTasteSeed,
} from './recommend';

function seed(partial: Partial<WatchlistTasteSeed> & Pick<WatchlistTasteSeed, 'key' | 'title'>): WatchlistTasteSeed {
  return { userScore: 8, publicScore: 8, ...partial };
}

function candidate(
  partial: Partial<WatchlistTasteCandidate> & Pick<WatchlistTasteCandidate, 'key'>,
): WatchlistTasteCandidate {
  return { publicScore: 8, voteCount: 500, sources: ['a'], ...partial };
}

describe('watchlist taste band', () => {
  it('uses the public scores of titles rated highly', () => {
    const band = watchlistTasteBand([
      seed({ key: 'movie-1', title: 'Liked', userScore: 9, publicScore: 8.4 }),
      seed({ key: 'movie-2', title: 'Also', userScore: 8, publicScore: 7.6 }),
      seed({ key: 'movie-3', title: 'Meh', userScore: 4, publicScore: 5 }),
    ]);
    expect(band).toBe(8);
  });
});

describe('rank watchlist suggestions', () => {
  const seeds = [
    seed({ key: 'movie-1', title: 'Parasite', userScore: 9, publicScore: 8.2 }),
    seed({ key: 'tv-2', title: 'The Bear', userScore: 8, publicScore: 7.8 }),
  ];

  it('prefers a similar public score over a similarly linked low score', () => {
    const ranked = rankWatchlistSuggestions(
      seeds,
      [
        candidate({ key: 'movie-9', publicScore: 8.1, sources: ['movie-1'] }),
        candidate({ key: 'movie-4', publicScore: 5.2, sources: ['movie-1'] }),
      ],
      new Set(),
    );
    expect(ranked.map((row) => row.key)).toEqual(['movie-9', 'movie-4']);
    expect(ranked[0]?.reason).toMatch(/Parasite/);
    expect(ranked[0]?.reason).toMatch(/8\.1/);
  });

  it('drops titles already saved', () => {
    const ranked = rankWatchlistSuggestions(
      seeds,
      [candidate({ key: 'movie-9', sources: ['tv-2'] })],
      new Set(['movie-9']),
    );
    expect(ranked).toEqual([]);
  });
});

describe('watchlist recommend seeds', () => {
  const title = {
    id: 't1',
    tmdbId: 1,
    mediaType: 'movie' as const,
    title: 'Inception',
  };

  it('starts with high personal scores, then other watched titles', () => {
    const seeds = watchlistRecommendSeeds({
      personId: 'p1',
      reviews: [
        { titleId: 't1', personId: 'p1', score: 9 },
        { titleId: 't2', personId: 'p1', score: 4 },
        { titleId: 't1', personId: 'p2', score: 2 },
      ],
      entries: [
        { title, status: 'watched' },
        {
          title: { id: 't2', tmdbId: 2, mediaType: 'movie', title: 'Skip' },
          status: 'watched',
        },
        {
          title: { id: 't3', tmdbId: 3, mediaType: 'tv', title: 'Queued' },
          status: 'want',
        },
        {
          title: { id: 't4', tmdbId: 4, mediaType: 'tv', title: 'Finished' },
          status: 'watched',
        },
      ],
    });
    expect(seeds.map((row) => row.title)).toEqual(['Inception', 'Finished']);
    expect(seeds[0]?.userScore).toBe(9);
    expect(seeds[1]?.userScore).toBeNull();
  });
});
