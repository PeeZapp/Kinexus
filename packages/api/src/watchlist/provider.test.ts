import { afterEach, describe, expect, it } from 'vitest';

import {
  getWatchlistProvider,
  resolveWatchlistProviderName,
  WATCHLIST_PROVIDER_HEADER,
  watchlistWriteForbidden,
} from './provider.js';

describe('watchlist provider switch', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousSwitch = process.env.WATCHLIST_DEV_SWITCH;

  afterEach(() => {
    process.env.NODE_ENV = previousEnv;
    if (previousSwitch == null) delete process.env.WATCHLIST_DEV_SWITCH;
    else process.env.WATCHLIST_DEV_SWITCH = previousSwitch;
  });

  function requestWithProvider(value: string) {
    return new Request('http://localhost/watchlist/search', {
      headers: { [WATCHLIST_PROVIDER_HEADER]: value },
    });
  }

  it('ignores the header in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.WATCHLIST_DEV_SWITCH = '1';
    expect(resolveWatchlistProviderName(requestWithProvider('trakt'))).toBe('tmdb');
    expect(getWatchlistProvider(requestWithProvider('trakt')).name).toBe('tmdb');
  });

  it('ignores the header when WATCHLIST_DEV_SWITCH is unset', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.WATCHLIST_DEV_SWITCH;
    expect(resolveWatchlistProviderName(requestWithProvider('trakt'))).toBe('tmdb');
    expect(getWatchlistProvider(requestWithProvider('trakt')).name).toBe('tmdb');
  });

  it('honours trakt when NODE_ENV is not production and the switch is on', () => {
    process.env.NODE_ENV = 'development';
    process.env.WATCHLIST_DEV_SWITCH = '1';
    expect(resolveWatchlistProviderName(requestWithProvider('trakt'))).toBe('trakt');
    expect(getWatchlistProvider(requestWithProvider('trakt')).name).toBe('trakt');
  });

  it('always returns tmdb for MCP', () => {
    process.env.NODE_ENV = 'development';
    process.env.WATCHLIST_DEV_SWITCH = '1';
    expect(resolveWatchlistProviderName(requestWithProvider('trakt'), { mcp: true })).toBe('tmdb');
  });

  it('blocks writes in trakt preview', () => {
    expect(watchlistWriteForbidden('tmdb')).toBeNull();
    const blocked = watchlistWriteForbidden('trakt');
    expect(blocked?.status).toBe(403);
    expect(blocked?.body.error).toMatch(/look-only/i);
  });
});
