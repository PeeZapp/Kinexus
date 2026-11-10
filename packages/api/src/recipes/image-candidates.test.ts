import { describe, expect, it } from 'vitest';

import {
  dedupeUrls,
  isYoutubeGreyPlaceholder,
  rankImageCandidates,
  youtubeThumbUrls,
} from './image-candidates.js';

describe('image candidates', () => {
  it('builds the six YouTube still URLs', () => {
    expect(youtubeThumbUrls('abc123')).toEqual([
      'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
      'https://i.ytimg.com/vi/abc123/sddefault.jpg',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'https://i.ytimg.com/vi/abc123/1.jpg',
      'https://i.ytimg.com/vi/abc123/2.jpg',
      'https://i.ytimg.com/vi/abc123/3.jpg',
    ]);
  });

  it('skips the YouTube grey placeholder by content-length', () => {
    expect(isYoutubeGreyPlaceholder(1097)).toBe(true);
    expect(isYoutubeGreyPlaceholder(2_499)).toBe(true);
    expect(isYoutubeGreyPlaceholder(2_500)).toBe(false);
    expect(isYoutubeGreyPlaceholder(48_000)).toBe(false);
    expect(isYoutubeGreyPlaceholder(null)).toBe(false);
  });

  it('orders by size descending and dedupes by URL', () => {
    expect(
      rankImageCandidates(
        [
          { url: 'https://cdn.example/a.jpg', bytes: 1_000 },
          { url: 'https://cdn.example/b.jpg', bytes: 9_000 },
          { url: 'https://cdn.example/a.jpg', bytes: 8_000 },
          { url: 'https://cdn.example/c.jpg', bytes: 4_000 },
        ],
        10,
      ),
    ).toEqual(['https://cdn.example/b.jpg', 'https://cdn.example/a.jpg', 'https://cdn.example/c.jpg']);
  });

  it('caps at max and drops empty seeds', () => {
    expect(dedupeUrls(['https://a', '', 'https://a', 'https://b', undefined, 'https://c'], 2)).toEqual([
      'https://a',
      'https://b',
    ]);
    expect(rankImageCandidates([{ url: 'https://a', bytes: 1 }, { url: 'https://b', bytes: 2 }], 1)).toEqual([
      'https://b',
    ]);
  });
});
