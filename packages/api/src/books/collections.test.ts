import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryBookCache, setBookCacheForTests } from './cache.js';
import { getReadlistCollection, listReadlistCollections, loadCollectionWorks } from './collections.js';
import { resetBookOutboundRateLimits } from './rate-limit.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('readlist collections', () => {
  beforeEach(() => {
    resetBookOutboundRateLimits();
    setBookCacheForTests(createMemoryBookCache());
  });

  it('filters unresolved and blank works', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse({
        docs: [
          { key: '/works/OL1W', title: 'Good Book', author_name: ['Ada'], cover_i: 1 },
          { key: '/works/OL2W', title: 'No Author', author_name: [], cover_i: 2 },
          { key: '/works/OL3W', title: '  ', author_name: ['Bob'], cover_i: 3 },
          { key: '/works/OL4W', title: 'Also Good', author_name: ['Cara'] },
        ],
      });
    }) as unknown as typeof fetch;

    const detail = await getReadlistCollection('fantasy', { fetchImpl });
    expect(detail?.works.map((work) => work.workId)).toEqual(['OL1W', 'OL4W']);
    expect(detail?.works.every((work) => work.title.trim() && work.authors.length > 0)).toBe(true);
    expect(calls).toBe(1);
  });

  it('hits cache on second collection fetch', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse({
        docs: [{ key: '/works/OL9W', title: 'Cached', author_name: ['Dee'], cover_i: 9 }],
      });
    }) as unknown as typeof fetch;

    const source = {
      id: 'fantasy',
      title: 'Fantasy',
      category: 'Fantasy',
      source: { kind: 'search' as const, query: 'subject:fantasy first_publish_year:[2010 TO *]', sort: 'rating' },
    };
    const first = await loadCollectionWorks(source, { fetchImpl });
    const second = await loadCollectionWorks(source, { fetchImpl });
    expect(first).toEqual(second);
    expect(calls).toBe(1);
  });

  it('lists collections with category and cover previews', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/subjects/')) {
        return jsonResponse({
          works: [
            { key: '/works/OL1W', title: 'One', authors: [{ name: 'A' }], cover_id: 11 },
            { key: '/works/OL2W', title: 'Two', authors: [{ name: 'B' }], cover_id: 12 },
          ],
        });
      }
      return jsonResponse({
        docs: [
          {
            key: '/works/OL3W',
            title: 'Prize',
            author_name: ['C'],
            cover_i: 13,
          },
        ],
      });
    }) as unknown as typeof fetch;

    const collections = await listReadlistCollections({ fetchImpl });
    expect(collections.length).toBeGreaterThan(0);
    expect(collections.every((row) => row.id && row.title && row.category)).toBe(true);
    expect(collections.some((row) => row.coverPreviews.length > 0)).toBe(true);
  });
});
