import { afterEach, describe, expect, it } from 'vitest';

import { handleWatchlistImportMatch, handleWatchlistLookup } from '../handlers.js';
import { WATCHLIST_PROVIDER_HEADER } from './provider.js';

describe('trakt-mode writes return 403', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousSwitch = process.env.WATCHLIST_DEV_SWITCH;

  afterEach(() => {
    process.env.NODE_ENV = previousEnv;
    if (previousSwitch == null) delete process.env.WATCHLIST_DEV_SWITCH;
    else process.env.WATCHLIST_DEV_SWITCH = previousSwitch;
  });

  function traktRequest() {
    return new Request('http://localhost/watchlist/lookup', {
      headers: { [WATCHLIST_PROVIDER_HEADER]: 'trakt' },
    });
  }

  it('rejects persist lookup in trakt preview', async () => {
    process.env.NODE_ENV = 'development';
    process.env.WATCHLIST_DEV_SWITCH = '1';
    const result = await handleWatchlistLookup(
      { tmdbId: 603, mediaType: 'movie', country: 'AU', persist: true },
      traktRequest(),
    );
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ error: expect.stringMatching(/look-only/i) });
  });

  it('rejects import match in trakt preview', async () => {
    process.env.NODE_ENV = 'development';
    process.env.WATCHLIST_DEV_SWITCH = '1';
    const result = await handleWatchlistImportMatch(
      'user-1',
      { rows: [{ key: '1', title: 'Jaws', year: 1975 }], country: 'AU' },
      traktRequest(),
    );
    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ error: expect.stringMatching(/look-only/i) });
  });

  it('allows persist lookup when the switch is off even with a trakt header', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.WATCHLIST_DEV_SWITCH;
    // Without the switch the provider is tmdb; we only assert the write guard does not trip.
    // Lookup itself may 503 without TMDB keys — that is outside this guard test.
    const result = await handleWatchlistLookup(
      { tmdbId: 603, mediaType: 'movie', country: 'AU', persist: true },
      traktRequest(),
    );
    expect(result.status).not.toBe(403);
  });
});
