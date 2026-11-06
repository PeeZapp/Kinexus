import { describe, expect, it, vi } from 'vitest';

import {
  stripProviderTokensFromSessionValue,
  wrapAuthStorageWithoutProviderTokens,
} from './auth-session-storage';

describe('auth session storage provider token strip', () => {
  it('removes provider_token and provider_refresh_token from persisted session JSON', () => {
    const raw = JSON.stringify({
      access_token: 'access',
      refresh_token: 'refresh',
      provider_token: 'google-access',
      provider_refresh_token: 'google-refresh',
      user: { id: 'u1' },
    });
    const stripped = JSON.parse(stripProviderTokensFromSessionValue(raw)) as Record<string, unknown>;
    expect(stripped.access_token).toBe('access');
    expect(stripped.refresh_token).toBe('refresh');
    expect(stripped.user).toEqual({ id: 'u1' });
    expect(stripped).not.toHaveProperty('provider_token');
    expect(stripped).not.toHaveProperty('provider_refresh_token');
  });

  it('strips nested currentSession provider tokens', () => {
    const raw = JSON.stringify({
      currentSession: {
        access_token: 'access',
        refresh_token: 'refresh',
        provider_token: 'google-access',
        provider_refresh_token: 'google-refresh',
      },
    });
    const stripped = JSON.parse(stripProviderTokensFromSessionValue(raw)) as {
      currentSession: Record<string, unknown>;
    };
    expect(stripped.currentSession.access_token).toBe('access');
    expect(stripped.currentSession).not.toHaveProperty('provider_token');
    expect(stripped.currentSession).not.toHaveProperty('provider_refresh_token');
  });

  it('wraps storage setItem so provider tokens never reach the base store', async () => {
    const store = new Map<string, string>();
    const base = {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    };
    const wrapped = wrapAuthStorageWithoutProviderTokens(base);
    await wrapped.setItem(
      'sb-session',
      JSON.stringify({
        access_token: 'access',
        refresh_token: 'refresh',
        provider_token: 'google-access',
        provider_refresh_token: 'google-refresh',
      }),
    );
    const persisted = JSON.parse(store.get('sb-session')!) as Record<string, unknown>;
    expect(persisted).not.toHaveProperty('provider_token');
    expect(persisted).not.toHaveProperty('provider_refresh_token');
    expect(persisted.access_token).toBe('access');
  });
});
