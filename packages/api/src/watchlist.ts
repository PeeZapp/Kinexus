/**
 * Thin re-export of the TMDB watchlist implementation.
 * HTTP handlers should prefer getWatchlistProvider(req) so the DEV-only Trakt switch works.
 * MCP and existing unit tests keep calling these TMDB exports directly.
 */
export {
  WATCHLIST_IMPORT_MATCH_BATCH_CAP,
  directorHitsFromCrew,
  fetchAuCertification,
  fetchFailureDetail,
  isStrongDirectorNameMatch,
  listStreamingServices,
  lookupWatchlistTitle,
  matchWatchlistImportRows,
  mergeWatchlistDirectorHits,
  recommendWatchlistTitles,
  resetWatchlistImportMatchCache,
  resolveWatchlistUrl,
  searchWatchlistPeople,
  searchWatchlistTitles,
  discoverWatchlistTitles,
  watchlistPersonMovies,
  watchlistTitleCast,
  type WatchlistCastMember,
  type WatchlistImportMatchCandidate,
  type WatchlistImportMatchResult,
  type WatchlistImportMatchRow,
  type WatchlistPersonCredit,
  type WatchlistPersonHit,
} from './watchlist/tmdb.js';

export {
  WATCHLIST_PROVIDER_HEADER,
  getWatchlistProvider,
  parseWatchlistProviderHeader,
  resolveWatchlistProviderName,
  watchlistDevSwitchEnabled,
  watchlistWriteForbidden,
  type WatchlistProvider,
  type WatchlistProviderName,
} from './watchlist/provider.js';
