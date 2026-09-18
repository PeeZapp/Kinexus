import { describe, expect, it } from 'vitest';

import { canonicalizeUrl, filterSavedLinks, inferLinkType } from './links';
import type { SavedLink } from './types';

function link(partial: Partial<SavedLink> & Pick<SavedLink, 'id' | 'title'>): SavedLink {
  return {
    householdId: 'h1',
    collectionIds: [],
    url: 'https://example.com/a',
    canonicalUrl: 'https://example.com/a',
    description: null,
    imageUrl: null,
    siteName: null,
    faviconUrl: null,
    linkType: 'article',
    status: 'saved',
    priority: 0,
    tags: [],
    notes: null,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...partial,
  };
}

describe('stash links', () => {
  it('canonicalizes youtube and strips www', () => {
    expect(canonicalizeUrl('https://www.youtube.com/watch?v=abc123&t=12s#foo')).toBe(
      'https://www.youtube.com/watch?v=abc123',
    );
    expect(canonicalizeUrl('https://www.Example.com/path/')).toBe('https://example.com/path');
  });

  it('infers type from host and path', () => {
    expect(inferLinkType('https://youtu.be/abc')).toBe('video');
    expect(inferLinkType('https://www.amazon.com/dp/B00')).toBe('product');
    expect(inferLinkType('https://allrecipes.com/recipe/123')).toBe('recipe');
  });

  it('filters by collection and hides archived', () => {
    const links = [
      link({ id: '1', title: 'Keep', collectionIds: ['c1'], createdAt: '2026-01-03T00:00:00.000Z' }),
      link({ id: '2', title: 'Old', status: 'archived', collectionIds: ['c1'] }),
      link({ id: '3', title: 'Other', collectionIds: ['c2'] }),
    ];
    const filtered = filterSavedLinks(links, { collectionId: 'c1', hideArchived: true, sort: 'newest' });
    expect(filtered.map((item) => item.id)).toEqual(['1']);
  });
});
