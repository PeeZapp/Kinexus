import type { Database } from '@kinexus/db';
import {
  isWatchlistItemStatus,
  isWatchlistMediaType,
  isWatchlistVisibility,
  parseStoredProviders,
  type WatchlistItem,
  type WatchlistList,
  type WatchlistTitle,
} from '@kinexus/domain';

type ListRow = Database['public']['Tables']['watchlist_lists']['Row'];
type TitleRow = Database['public']['Tables']['watchlist_titles']['Row'];
type ItemRow = Database['public']['Tables']['watchlist_items']['Row'];

export function watchlistListFromRow(row: ListRow): WatchlistList {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    name: row.name,
    visibility: isWatchlistVisibility(row.visibility) ? row.visibility : 'household',
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
    providers: parseStoredProviders(row.providers),
    providersCountry: row.providers_country,
    providersFetchedAt: row.providers_fetched_at,
    createdAt: row.created_at,
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
