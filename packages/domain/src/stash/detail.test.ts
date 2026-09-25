import { describe, expect, it } from 'vitest';

import {
  STASH_DETAIL_ATTEMPT_LIMIT,
  STASH_DETAIL_GAVE_UP_NOTE,
  STASH_DETAIL_PENDING_NOTE,
  detailNote,
  detailStatusForSave,
  titleFromSourceUrl,
} from './detail';

describe('wishlist detail status', () => {
  it('queues a saved link that has no price', () => {
    expect(detailStatusForSave('https://www.nike.com/au/t/air-max', null)).toBe('pending');
  });

  it('keeps a priced item off the daily list', () => {
    expect(detailStatusForSave('https://shop.example/products/mug', 24)).toBe('ready');
    expect(detailStatusForSave('', null)).toBe('ready');
  });

  it('explains the wait, then stops after the attempt limit', () => {
    expect(detailNote('ready', 0)).toBeNull();
    expect(detailNote('pending', 1)).toBe(STASH_DETAIL_PENDING_NOTE);
    expect(detailNote('pending', STASH_DETAIL_ATTEMPT_LIMIT)).toBe(STASH_DETAIL_GAVE_UP_NOTE);
  });

  it('names a product from the most descriptive part of the URL', () => {
    expect(titleFromSourceUrl('https://www.nike.com/au/t/air-max-90-shoes/IB1234')).toBe('Air Max 90 Shoes');
    expect(titleFromSourceUrl('https://shop.example.com/products/blue-widget')).toBe('Blue Widget');
    expect(titleFromSourceUrl('not a url')).toBe('Saved item');
  });
});
