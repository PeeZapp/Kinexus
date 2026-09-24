export type StashPriceSource = 'manual' | 'scraped';

export type StashListVisibility = 'household' | 'private' | 'people';

export type StashProduct = {
  id: string;
  householdId: string;
  title: string;
  currentPrice: number | null;
  originalPrice: number | null;
  isOnSale: boolean;
  imageUrl: string | null;
  sourceUrl: string;
  storeName: string | null;
  description: string | null;
  sku: string | null;
  priceSource: StashPriceSource | null;
  isOwned: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StashListKind = 'checklist' | 'wishlist';

export type StashList = {
  id: string;
  householdId: string;
  createdBy: string | null;
  name: string;
  kind: StashListKind;
  visibility: StashListVisibility;
  personIds: string[];
  parentListId: string | null;
  shareToken: string | null;
  isShared: boolean;
  emoji: string | null;
  theme: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StashListProduct = {
  listId: string;
  productId: string;
  addedAt: string;
};

export type StashListNode = StashList & { children: StashListNode[] };

export type StashListItemPriority = 0 | 1 | 2 | 3 | 4;

export type StashListRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type StashListItem = {
  id: string;
  householdId: string;
  listId: string;
  title: string;
  notes: string | null;
  category: string | null;
  priority: StashListItemPriority;
  dueOn: string | null;
  recurrence: StashListRecurrence;
  assignedPersonId: string | null;
  isChecked: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedLinkType = 'recipe' | 'video' | 'article' | 'tool' | 'place' | 'product' | 'other';

export type SavedLinkStatus = 'saved' | 'try_next' | 'tried' | 'liked' | 'not_for_me' | 'archived';

export type SavedLinkPriority = 0 | 1 | 2 | 3 | 4;

export type SavedLinkCollection = {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedLink = {
  id: string;
  householdId: string;
  collectionIds: string[];
  url: string;
  canonicalUrl: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  linkType: SavedLinkType;
  status: SavedLinkStatus;
  priority: SavedLinkPriority;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScrapedProduct = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  storeName: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  sku: string | null;
};

export type ScrapedLink = {
  url: string;
  canonicalUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  linkType: SavedLinkType;
};

export type WatchlistVisibility = 'household' | 'personal';

export type WatchlistMediaType = 'movie' | 'tv';

export type WatchlistItemStatus = 'want' | 'watching' | 'watched';

export type WatchlistOfferType = 'flatrate' | 'ads' | 'free' | 'rent' | 'buy';

export type WatchlistList = {
  id: string;
  householdId: string;
  createdBy: string | null;
  name: string;
  visibility: WatchlistVisibility;
  createdAt: string;
  updatedAt: string;
};

export type WatchlistProvider = {
  offerType: WatchlistOfferType;
  providerId: number;
  providerName: string;
  logoPath: string | null;
  displayPriority: number;
};

export type WatchlistTitle = {
  id: string;
  householdId: string;
  tmdbId: number;
  mediaType: WatchlistMediaType;
  title: string;
  year: number | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  imdbId: string | null;
  sourceUrl: string | null;
  tmdbWatchUrl: string | null;
  trailerUrl: string | null;
  providers: WatchlistProvider[];
  providersCountry: string | null;
  providersFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WatchlistItem = {
  id: string;
  householdId: string;
  listId: string;
  titleId: string;
  addedBy: string | null;
  status: WatchlistItemStatus;
  notes: string | null;
  addedAt: string;
};

export type WatchlistEntry = {
  item: WatchlistItem;
  list: WatchlistList;
  title: WatchlistTitle;
};

export type WatchlistSearchHit = {
  tmdbId: number;
  mediaType: WatchlistMediaType;
  title: string;
  year: number | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  imdbId: string | null;
};

export type WatchlistResolvedTitle = WatchlistSearchHit & {
  sourceUrl: string | null;
  tmdbWatchUrl: string | null;
  trailerUrl: string | null;
  providers: WatchlistProvider[];
  providersCountry: string;
};

export type WatchlistUrlParse =
  | { kind: 'imdb'; imdbId: string }
  | { kind: 'tmdb'; mediaType: WatchlistMediaType; tmdbId: number }
  | { kind: 'search'; query: string; source: string }
  | { kind: 'list'; source: string }
  | { kind: 'invalid'; reason: string };
