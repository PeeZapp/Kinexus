import { describe, expect, it } from 'vitest';

import { getBookProvider } from './compose.js';

const live = process.env.BOOKS_LIVE_SMOKE === '1';

describe.runIf(live)('books live smoke', () => {
  it('searches Open Library for a known title', async () => {
    const provider = getBookProvider();
    const results = await provider.searchBooks('The Hobbit Tolkien');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.editionCount).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
