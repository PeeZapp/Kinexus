import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * Supabase may serialise provider_token / provider_refresh_token into persisted
 * session JSON. Strip those on every write so one-shot Google re-auth tokens
 * never land on disk. Normal access/refresh session persistence stays intact.
 */
export function stripProviderTokensFromSessionValue(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return value;
    const root = parsed as Record<string, unknown>;
    delete root.provider_token;
    delete root.provider_refresh_token;
    const nested = root.currentSession;
    if (nested && typeof nested === 'object') {
      const session = nested as Record<string, unknown>;
      delete session.provider_token;
      delete session.provider_refresh_token;
    }
    return JSON.stringify(root);
  } catch {
    return value;
  }
}

export function wrapAuthStorageWithoutProviderTokens(base: SupportedStorage): SupportedStorage {
  return {
    getItem: (key) => base.getItem(key),
    removeItem: (key) => base.removeItem(key),
    setItem: (key, value) => base.setItem(key, stripProviderTokensFromSessionValue(value)),
  };
}
