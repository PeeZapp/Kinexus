import { beforeEach, describe, expect, it, vi } from 'vitest';

import { guessShareFiles, guessShareTarget, shareTargetPrimaryActionLabel } from '@kinexus/domain';

const writeLastUsed = vi.fn(async () => undefined);
const stashImport = vi.fn();
const stashBudget = vi.fn();

vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  readAsStringAsync: vi.fn(async () => ''),
}));

vi.mock('@/src/features/lists/list-file-io', () => ({
  readListFileUri: vi.fn(async () => ({ fileName: 'import', mimeType: null, text: '', bytes: null })),
}));

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

vi.mock('@/src/features/finances/budget/budget-txn-share-stash', () => ({
  stashBudgetTxnShare: (...args: unknown[]) => stashBudget(...args),
}));

const { decideShareIntent } = await import('@/src/features/share/share-intent-route');
const { handoffShareTarget } = await import('@/src/features/share/share-target-handlers');

describe('share target picker model', () => {
  it('uses the top guess as the primary action label', () => {
    const guess = guessShareTarget({ url: 'https://www.imdb.com/title/tt0133093/' });
    expect(guess.targets[0]).toBe('watchlist');
    expect(shareTargetPrimaryActionLabel(guess.targets[0]!)).toBe('Add to Watchlist');
  });
});

describe('decideShareIntent', () => {
  it('opens the picker for multi-candidate files', () => {
    const decision = decideShareIntent({
      files: [{ fileName: 'shot.jpg', path: '/tmp/shot.jpg', mimeType: 'image/jpeg' }],
    });
    expect(decision.kind).toBe('files');
    if (decision.kind === 'files') {
      expect(decision.auto).toBe(false);
      expect(decision.guess.targets).toEqual(['bank_transactions', 'list_import']);
    }
  });

  it('auto-routes single-candidate list files', () => {
    const decision = decideShareIntent({
      files: [{ fileName: 'watchlist.xlsx', path: '/tmp/watchlist.xlsx', mimeType: 'application/vnd.ms-excel' }],
    });
    expect(decision.kind).toBe('files');
    if (decision.kind === 'files') {
      expect(decision.auto).toBe(true);
      expect(decision.guess.targets).toEqual(['list_import']);
    }
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

  it('ranks bank csv headers ahead of list import', () => {
    expect(
      guessShareFiles([
        {
          fileName: 'export.csv',
          mimeType: 'text/csv',
          textPreview: 'Date,Description,Amount\n1,Coffee,-4',
        },
      ]).targets[0],
    ).toBe('bank_transactions');
  });
});

describe('handoffShareTarget', () => {
  beforeEach(() => {
    writeLastUsed.mockClear();
    stashImport.mockClear();
    stashBudget.mockClear();
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

  it('hands bank transactions to finances with stash', async () => {
    const replace = vi.fn();
    const file = new File(['Date,Description,Amount\n01/01/2026,Coffee,-4.5\n'], 'commbank.csv', {
      type: 'text/csv',
    });
    await handoffShareTarget(
      {
        target: 'bank_transactions',
        url: null,
        text: null,
        list: null,
        files: [{ fileName: 'commbank.csv', mimeType: 'text/csv', file }],
      },
      { replace },
    );
    expect(stashBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'statement',
        fileName: 'commbank.csv',
      }),
    );
    expect(replace).toHaveBeenCalledWith({ pathname: '/finances', params: { addTransactions: '1' } });
  });
});
