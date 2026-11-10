import { describe, expect, it } from 'vitest';

import {
  READLIST_COLLECTION_CATEGORIES,
  READLIST_COLLECTIONS,
  readlistCollectionById,
  readlistCollectionsForCategory,
} from './collections';

describe('READLIST_COLLECTIONS', () => {
  it('has unique ids and every category maps to a source', () => {
    const ids = READLIST_COLLECTIONS.map((collection) => collection.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(READLIST_COLLECTIONS.length).toBeGreaterThanOrEqual(12);
    expect(READLIST_COLLECTIONS.length).toBeLessThanOrEqual(24);
    expect(READLIST_COLLECTIONS.some((c) => c.id === 'horror')).toBe(true);
    expect(READLIST_COLLECTIONS.some((c) => c.id === 'contemporary')).toBe(true);
    expect(READLIST_COLLECTIONS.filter((c) => c.id !== 'classics').every((c) => c.source.kind === 'search')).toBe(
      true,
    );

    for (const collection of READLIST_COLLECTIONS) {
      expect(collection.title.trim()).toBeTruthy();
      expect(collection.category.trim()).toBeTruthy();
      expect(READLIST_COLLECTION_CATEGORIES).toContain(collection.category);
      if (collection.source.kind === 'subject') {
        expect(collection.source.subject.trim()).toBeTruthy();
      } else {
        expect(collection.source.query.trim()).toBeTruthy();
      }
    }
  });

  it('looks up by id and filters by category', () => {
    expect(readlistCollectionById('fantasy')?.title).toBe('Fantasy');
    expect(readlistCollectionById('missing')).toBeNull();
    expect(readlistCollectionsForCategory('Sci-fi').map((c) => c.id)).toEqual(['sci-fi']);
    expect(readlistCollectionsForCategory(null).length).toBe(READLIST_COLLECTIONS.length);
  });
});
