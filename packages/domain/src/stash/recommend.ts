import type {
  WatchlistItemStatus,
  WatchlistMediaType,
  WatchlistRecommendSeed,
  WatchlistReview,
  WatchlistTitle,
} from './types';

export const WATCHLIST_SCORE_MIN = 1;
export const WATCHLIST_SCORE_MAX = 10;
export const WATCHLIST_REVIEW_LIMIT = 2000;
export const WATCHLIST_LIKED_SCORE = 7;

export const WATCHLIST_GENRES: readonly {
  id: number;
  label: string;
  media: readonly WatchlistMediaType[];
}[] = [
  { id: 35, label: 'Comedy', media: ['movie', 'tv'] },
  { id: 18, label: 'Drama', media: ['movie', 'tv'] },
  { id: 16, label: 'Animation', media: ['movie', 'tv'] },
  { id: 80, label: 'Crime', media: ['movie', 'tv'] },
  { id: 99, label: 'Documentary', media: ['movie', 'tv'] },
  { id: 10751, label: 'Family', media: ['movie', 'tv'] },
  { id: 9648, label: 'Mystery', media: ['movie', 'tv'] },
  { id: 28, label: 'Action', media: ['movie'] },
  { id: 27, label: 'Horror', media: ['movie'] },
  { id: 878, label: 'Science fiction', media: ['movie'] },
  { id: 10749, label: 'Romance', media: ['movie'] },
  { id: 53, label: 'Thriller', media: ['movie'] },
  { id: 10759, label: 'Action', media: ['tv'] },
  { id: 10765, label: 'Sci-fi & fantasy', media: ['tv'] },
];

export function isWatchlistScore(value: number): boolean {
  return Number.isInteger(value) && value >= WATCHLIST_SCORE_MIN && value <= WATCHLIST_SCORE_MAX;
}

export function watchlistGenresFor(media: WatchlistMediaType) {
  return WATCHLIST_GENRES.filter((genre) => genre.media.includes(media));
}

export function isWatchlistGenre(media: WatchlistMediaType, id: number): boolean {
  return watchlistGenresFor(media).some((genre) => genre.id === id);
}

export function watchlistTitleKey(mediaType: WatchlistMediaType, tmdbId: number): string {
  return `${mediaType}-${tmdbId}`;
}

type SeedEntry = {
  title: Pick<WatchlistTitle, 'id' | 'tmdbId' | 'mediaType' | 'title'>;
  status: WatchlistItemStatus;
};

/** Titles this person liked, then other titles the household has watched. */
export function watchlistRecommendSeeds(input: {
  personId: string;
  reviews: readonly Pick<WatchlistReview, 'titleId' | 'personId' | 'score'>[];
  entries: readonly SeedEntry[];
}): WatchlistRecommendSeed[] {
  const byTitle = new Map<string, { title: SeedEntry['title']; watched: boolean }>();
  for (const entry of input.entries) {
    const current = byTitle.get(entry.title.id);
    if (!current) {
      byTitle.set(entry.title.id, { title: entry.title, watched: entry.status === 'watched' });
    } else if (entry.status === 'watched') {
      current.watched = true;
    }
  }

  const reviewByTitle = new Map<string, number>();
  for (const review of input.reviews) {
    if (review.personId !== input.personId || !isWatchlistScore(review.score)) continue;
    reviewByTitle.set(review.titleId, review.score);
  }

  const liked: WatchlistRecommendSeed[] = [];
  const watched: WatchlistRecommendSeed[] = [];
  for (const [titleId, row] of byTitle) {
    const score = reviewByTitle.get(titleId) ?? null;
    if (score != null && score < WATCHLIST_LIKED_SCORE) continue;
    const seed: WatchlistRecommendSeed = {
      tmdbId: row.title.tmdbId,
      mediaType: row.title.mediaType,
      title: row.title.title,
      userScore: score,
    };
    if (score != null && score >= WATCHLIST_LIKED_SCORE) liked.push(seed);
    else if (row.watched) watched.push(seed);
  }

  liked.sort((a, b) => (b.userScore ?? 0) - (a.userScore ?? 0) || a.title.localeCompare(b.title));
  const seen = new Set<string>();
  const seeds: WatchlistRecommendSeed[] = [];
  for (const seed of [...liked, ...watched]) {
    const key = watchlistTitleKey(seed.mediaType, seed.tmdbId);
    if (seen.has(key)) continue;
    seen.add(key);
    seeds.push(seed);
    if (seeds.length >= 8) break;
  }
  return seeds;
}

export type WatchlistTasteSeed = {
  key: string;
  title: string;
  userScore: number | null;
  publicScore: number | null;
};

export type WatchlistTasteCandidate = {
  key: string;
  publicScore: number | null;
  voteCount: number;
  sources: readonly string[];
};

export type WatchlistTasteRank = {
  key: string;
  reason: string;
};

/** Average public score of titles this person rated highly. */
export function watchlistTasteBand(seeds: readonly WatchlistTasteSeed[]): number | null {
  const liked = seeds.filter(
    (seed) => (seed.userScore ?? 0) >= WATCHLIST_LIKED_SCORE && seed.publicScore != null,
  );
  const pool = liked.length > 0 ? liked : seeds.filter((seed) => seed.publicScore != null);
  if (pool.length === 0) return null;
  const sum = pool.reduce((total, seed) => total + (seed.publicScore ?? 0), 0);
  return Math.round((sum / pool.length) * 10) / 10;
}

function formatScore(value: number): string {
  return value.toFixed(1);
}

function reasonFor(
  candidate: WatchlistTasteCandidate,
  seeds: readonly WatchlistTasteSeed[],
  band: number | null,
): string {
  const names = candidate.sources
    .map((key) => seeds.find((seed) => seed.key === key)?.title)
    .filter((name): name is string => Boolean(name))
    .slice(0, 2);
  const because =
    names.length === 0
      ? 'Similar to titles you liked'
      : names.length === 1
        ? `Similar to ${names[0]}`
        : `Similar to ${names[0]} and ${names[1]}`;
  if (candidate.publicScore != null && band != null) {
    return `${because}. Public score ${formatScore(candidate.publicScore)}, near the ${formatScore(band)} band of what you rate highly.`;
  }
  return `${because}.`;
}

/**
 * Rank catalog picks by how often liked titles point at them and how close
 * their public score is to the band of titles this person rates highly.
 */
export function rankWatchlistSuggestions(
  seeds: readonly WatchlistTasteSeed[],
  candidates: readonly WatchlistTasteCandidate[],
  exclude: ReadonlySet<string>,
  limit = 12,
): WatchlistTasteRank[] {
  const band = watchlistTasteBand(seeds);
  const ranked = candidates
    .filter((candidate) => !exclude.has(candidate.key) && !seeds.some((seed) => seed.key === candidate.key))
    .map((candidate) => {
      let points = candidate.sources.length * 10;
      if (band != null && candidate.publicScore != null) {
        const delta = Math.abs(candidate.publicScore - band);
        points += Math.max(0, 12 - delta * 6);
        if (delta > 2.2) points -= 8;
      } else if (candidate.publicScore != null && candidate.publicScore >= 7.5) {
        points += 2;
      }
      if (candidate.voteCount >= 200) points += 1;
      return { candidate, points, delta: band != null && candidate.publicScore != null ? Math.abs(candidate.publicScore - band) : null };
    })
    .sort((a, b) => b.points - a.points || (a.delta ?? 99) - (b.delta ?? 99));

  const close = ranked.filter((row) => row.delta == null || row.delta <= 1.6);
  const picked = close.length >= 5 ? close : ranked;
  return picked.slice(0, limit).map((row) => ({
    key: row.candidate.key,
    reason: reasonFor(row.candidate, seeds, band),
  }));
}
