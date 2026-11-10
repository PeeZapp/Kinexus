/** Curated Readlist browse collections (Open Library subjects / search). */

export type ReadlistCollectionSource =
  | { kind: 'subject'; subject: string }
  | { kind: 'search'; query: string; sort?: string };

export type ReadlistCollection = {
  id: string;
  title: string;
  category: string;
  source: ReadlistCollectionSource;
};

/** Prefer contemporary catalog hits (Open Library year range in the query). */
const SINCE_2005 = 'first_publish_year:[2005 TO *]';
const SINCE_2010 = 'first_publish_year:[2010 TO *]';

/**
 * Sources are real Open Library subjects / queries.
 * Genre shelves use year-filtered search so Browse is not a classics dump;
 * Classics stays subject-based on purpose.
 */
export const READLIST_COLLECTIONS: readonly ReadlistCollection[] = [
  {
    id: 'fantasy',
    title: 'Fantasy',
    category: 'Fantasy',
    source: { kind: 'search', query: `subject:fantasy ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'crime-thrillers',
    title: 'Crime & thrillers',
    category: 'Crime & thrillers',
    source: {
      kind: 'search',
      query: `subject:(thriller OR crime OR "mystery and detective stories") ${SINCE_2010}`,
      sort: 'rating',
    },
  },
  {
    id: 'sci-fi',
    title: 'Sci-fi',
    category: 'Sci-fi',
    source: { kind: 'search', query: `subject:science_fiction ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'romance',
    title: 'Romance',
    category: 'Romance',
    source: { kind: 'search', query: `subject:romance ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'horror',
    title: 'Horror',
    category: 'Horror',
    source: { kind: 'search', query: `subject:horror ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'kids-family',
    title: 'Kids & family',
    category: 'Kids & family',
    source: {
      kind: 'search',
      query: `subject:(juvenile_fiction OR "children's fiction") ${SINCE_2010}`,
      sort: 'rating',
    },
  },
  {
    id: 'young-adult',
    title: 'Young adult',
    category: 'Young adult',
    source: { kind: 'search', query: `subject:young_adult_fiction ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'contemporary',
    title: 'Contemporary fiction',
    category: 'Contemporary fiction',
    source: {
      kind: 'search',
      query: `subject:("contemporary fiction" OR "literary fiction") ${SINCE_2010}`,
      sort: 'rating',
    },
  },
  {
    id: 'graphic-novels',
    title: 'Graphic novels',
    category: 'Graphic novels',
    source: {
      kind: 'search',
      query: `subject:("graphic novels" OR comics) ${SINCE_2005}`,
      sort: 'rating',
    },
  },
  {
    id: 'classics',
    title: 'Classics',
    category: 'Classics',
    source: { kind: 'subject', subject: 'classics' },
  },
  {
    id: 'non-fiction',
    title: 'Non-fiction',
    category: 'Non-fiction',
    source: { kind: 'search', query: `subject:nonfiction ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'biography',
    title: 'Biography',
    category: 'Biography',
    source: { kind: 'search', query: `subject:biography ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'memoir',
    title: 'Memoir',
    category: 'Memoir',
    source: { kind: 'search', query: `subject:memoir ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'history',
    title: 'History',
    category: 'History',
    source: { kind: 'search', query: `subject:history ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'true-crime',
    title: 'True crime',
    category: 'True crime',
    source: { kind: 'search', query: `subject:("true crime" OR true_crime) ${SINCE_2005}`, sort: 'rating' },
  },
  {
    id: 'self-improvement',
    title: 'Self-improvement',
    category: 'Self-improvement',
    source: { kind: 'search', query: `subject:(self-help OR "self help") ${SINCE_2010}`, sort: 'rating' },
  },
  {
    id: 'business',
    title: 'Business',
    category: 'Business',
    source: {
      kind: 'search',
      query: `subject:(business OR entrepreneurship OR leadership) ${SINCE_2010}`,
      sort: 'rating',
    },
  },
  {
    id: 'award-winners',
    title: 'Award winners',
    category: 'Award winners',
    source: {
      kind: 'search',
      query: `subject:(pulitzer_prize OR "national book award" OR "booker prize") ${SINCE_2005}`,
      sort: 'rating',
    },
  },
] as const;

export const READLIST_COLLECTION_CATEGORIES: readonly string[] = [
  ...new Set(READLIST_COLLECTIONS.map((collection) => collection.category)),
];

export function readlistCollectionById(id: string): ReadlistCollection | null {
  return READLIST_COLLECTIONS.find((collection) => collection.id === id) ?? null;
}

export function readlistCollectionsForCategory(category: string | null): readonly ReadlistCollection[] {
  if (!category) return READLIST_COLLECTIONS;
  return READLIST_COLLECTIONS.filter((collection) => collection.category === category);
}

/** Stable fingerprint so API cache refreshes when a source changes. */
export function readlistCollectionSourceKey(collection: ReadlistCollection): string {
  if (collection.source.kind === 'subject') {
    return `subject:${collection.source.subject}`;
  }
  return `search:${collection.source.query}|${collection.source.sort ?? ''}`;
}
