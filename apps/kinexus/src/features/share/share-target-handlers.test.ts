import { beforeEach, describe, expect, it, vi } from 'vitest';

import { guessShareTarget, shareTargetPrimaryActionLabel } from '@kinexus/domain';

import { decideShareIntent } from '@/src/features/share/share-intent-route';
import { handoffShareTarget } from '@/src/features/share/share-target-handlers';

const writeLastUsed = vi.fn(async () => undefined);
const stashImport = vi.fn();

vi.mock('@/src/features/share/share-target-last-list', async () => {
  const actual = await vi.importActual<typeof import('@/src/features/share/share-target-last-list')>(
    '@/src/features/share/share-target-last-list',
  );
  return {
    ...actual,
    writeLastUsedShareList: (...args: unknown[]) => writeLastUsed(...args),
  };
});

vi.mock('@/src/features/lists/list-import-stash', () => ({
  stashListImport: (...args: unknown[]) => stashImport(...args),
}));

describe('share target picker model', () => {
  it('uses the top guess as the primary action label', () => {
    const guess = guessShareTarget({ url: 'https://www.imdb.com/title/tt0133093/' });
    expect(guess.targets[0]).toBe('watchlist');
    expect(shareTargetPrimaryActionLabel(guess.targets[0]!)).toBe('Add to Watchlist');
  });
});

describe('decideShareIntent', () => {
  it('bypasses the picker for list import files', () => {
    const decision = decideShareIntent({
      files: [{ fileName: 'watchlist.csv', path: '/tmp/watchlist.csv', mimeType: 'text/csv' }],
      text: 'https://example.com',
    });
    expect(decision.kind).toBe('file');
  });

  it('opens the picker for shared links', () => {
    const decision = decideShareIntent({
      webUrl: 'https://www.imdb.com/title/tt0133093/',
      title: 'The Matrix',
    });
    expect(decision.kind).toBe('picker');
    if (decision.kind === 'picker') {
      expect(decision.guess.targets[0]).toBe('watchlist');
      expect(decision.guess.preview.title).toBe('The Matrix');
    }
  });
});

describe('handoffShareTarget', () => {
  beforeEach(() => {
    writeLastUsed.mockClear();
    stashImport.mockClear();
  });

  it('hands recipe to /import', async () => {
    const replace = vi.fn();
    await handoffShareTarget(
      { target: 'recipe', url: 'https://allrecipes.com/recipe/1', text: null, list: null },
      { replace },
    );
    expect(replace).toHaveBeenCalledWith({ pathname: '/import', params: { url: 'https://allrecipes.com/recipe/1' } });
  });

  it('hands watchlist to resolve+add screen with list', async () => {
    const replace = vi.fn();
    await handoffShareTarget(
      {
        target: 'watchlist',
        url: 'https://www.imdb.com/title/tt0133093/',
        text: null,
        list: { id: 'wl1', name: 'Want' },
      },
      { replace },
    );
    expect(writeLastUsed).toHaveBeenCalledWith('watchlist', { id: 'wl1', name: 'Want' });
    expect(replace).toHaveBeenCalledWith({
      pathname: '/lists/watchlist',
      params: { shareUrl: 'https://www.imdb.com/title/tt0133093/', listId: 'wl1' },
    });
  });

  it('hands IMDb/Letterboxd list links to link import', async () => {
    const replace = vi.fn();
    await handoffShareTarget(
      {
        target: 'watchlist',
        url: 'https://www.imdb.com/list/ls000123456/',
        text: null,
        list: { id: 'wl1', name: 'Want' },
      },
      { replace },
    );
    expect(stashImport).toHaveBeenCalledWith(
      expect.objectContaining({
        kindHint: 'watchlist',
        linkUrl: 'https://www.imdb.com/list/ls000123456/',
      }),
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: '/lists/import',
      params: {
        kind: 'watchlist',
        linkUrl: 'https://www.imdb.com/list/ls000123456/',
        listId: 'wl1',
      },
    });
  });

  it('hands readlist to resolve-url screen', async () => {
    const replace = vi.fn();
    await handoffShareTarget(
      {
        target: 'readlist',
        url: 'https://www.goodreads.com/book/show/1',
        text: null,
        list: { id: 'rl1', name: 'Want to read' },
      },
      { replace },
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: '/lists/readlist',
      params: { shareUrl: 'https://www.goodreads.com/book/show/1', listId: 'rl1' },
    });
  });

  it('hands wishlist to add-by-link screen', async () => {
    const replace = vi.fn();
    await handoffShareTarget(
      {
        target: 'wishlist',
        url: 'https://www.amazon.com/dp/B00ABCDE12',
        text: null,
        list: { id: 'wish1', name: 'Gifts' },
      },
      { replace },
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: '/lists/wishlists',
      params: { shareUrl: 'https://www.amazon.com/dp/B00ABCDE12', listId: 'wish1' },
    });
  });

  it('hands shopping text to list import', async () => {
    const replace = vi.fn();
    await handoffShareTarget(
      { target: 'shopping', url: null, text: 'milk\neggs', list: null },
      { replace },
    );
    expect(stashImport).toHaveBeenCalledWith({
      fileName: 'share.txt',
      mimeType: 'text/plain',
      text: 'milk\neggs',
      bytes: null,
      kindHint: 'shopping',
    });
    expect(replace).toHaveBeenCalledWith({ pathname: '/lists/import', params: { kind: 'shopping' } });
  });

  it('hands Hevy links to workout link import', async () => {
    const replace = vi.fn();
    const guess = guessShareTarget({ url: 'https://hevy.com/workout/9zxJ5CLFduN' });
    expect(guess.targets[0]).toBe('workout');
    expect(shareTargetPrimaryActionLabel(guess.targets[0]!)).toBe('Import workout');
    await handoffShareTarget(
      {
        target: 'workout',
        url: 'https://hevy.com/workout/9zxJ5CLFduN',
        text: null,
        list: null,
      },
      { replace },
    );
    expect(stashImport).toHaveBeenCalledWith(
      expect.objectContaining({
        kindHint: 'workout',
        linkUrl: 'https://hevy.com/workout/9zxJ5CLFduN',
      }),
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: '/lists/import',
      params: { kind: 'workout', linkUrl: 'https://hevy.com/workout/9zxJ5CLFduN' },
    });
  });
});
