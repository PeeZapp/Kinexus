import type { Database } from '@kinexus/db';
import {
  isWatchlistAudience,
  isWatchlistItemStatus,
  isWatchlistListKind,
  isWatchlistMediaType,
  isWatchlistVisibility,
  parseStoredProviders,
  type WatchlistItem,
  type WatchlistList,
  type WatchlistReview,
  type WatchlistTitle,
} from '@kinexus/domain';

type ListRow = Database['public']['Tables']['watchlist_lists']['Row'];
type TitleRow = Database['public']['Tables']['watchlist_titles']['Row'];
type ItemRow = Database['public']['Tables']['watchlist_items']['Row'];
type ReviewRow = Database['public']['Tables']['watchlist_reviews']['Row'];

function samplePosterPathsFromRow(value: ListRow['sample_poster_paths']): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 4);
}

export function watchlistListFromRow(row: ListRow): WatchlistList {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    name: row.name,
    visibility: isWatchlistVisibility(row.visibility) ? row.visibility : 'household',
    kind: isWatchlistListKind(row.kind) ? row.kind : 'custom',
    audience: isWatchlistAudience(row.audience) ? row.audience : '18+',
    blurb: row.blurb?.trim() || null,
    samplePosterPaths: samplePosterPathsFromRow(row.sample_poster_paths),
    personIds: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function watchlistTitleFromRow(row: TitleRow): WatchlistTitle {
  return {
    id: row.id,
    householdId: row.household_id,
    tmdbId: row.tmdb_id,
    mediaType: isWatchlistMediaType(row.media_type) ? row.media_type : 'movie',
    title: row.title,
    year: row.year,
    overview: row.overview,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    imdbId: row.imdb_id,
    sourceUrl: row.source_url,
    tmdbWatchUrl: row.tmdb_watch_url,
    trailerUrl: row.trailer_url,
    contentRating: row.content_rating,
    audience: row.audience && isWatchlistAudience(row.audience) ? row.audience : null,
    providers: parseStoredProviders(row.providers),
    providersCountry: row.providers_country,
    providersFetchedAt: row.providers_fetched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function watchlistReviewFromRow(row: ReviewRow): WatchlistReview {
  return {
    id: row.id,
    householdId: row.household_id,
    titleId: row.title_id,
    personId: row.person_id,
    score: row.score,
    body: row.body,
    updatedAt: row.updated_at,
  };
}

export function watchlistItemFromRow(row: ItemRow): WatchlistItem {
  return {
    id: row.id,
    householdId: row.household_id,
    listId: row.list_id,
    titleId: row.title_id,
    addedBy: row.added_by,
    status: isWatchlistItemStatus(row.status) ? row.status : 'want',
    notes: row.notes,
    addedAt: row.added_at,
  };
}
