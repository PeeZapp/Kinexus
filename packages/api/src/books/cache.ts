import { createHash } from 'node:crypto';

import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { BOOK_CACHE_TTL_MS, type BookCacheKind, type BookProviderName } from './provider.js';

export type BookCacheStore = {
  get<T>(provider: BookProviderName | 'cover', key: string): Promise<T | null>;
  set(provider: BookProviderName | 'cover', key: string, kind: BookCacheKind, payload: unknown): Promise<void>;
};

type MemoryEntry = { expiresAt: number; payload: unknown };

export function hashBookCacheKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function createMemoryBookCache(): BookCacheStore {
  const map = new Map<string, MemoryEntry>();
  return {
    async get<T>(provider, key) {
      const entry = map.get(`${provider}:${hashBookCacheKey(key)}`);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        map.delete(`${provider}:${hashBookCacheKey(key)}`);
        return null;
      }
      return entry.payload as T;
    },
    async set(provider, key, kind, payload) {
      map.set(`${provider}:${hashBookCacheKey(key)}`, {
        expiresAt: Date.now() + BOOK_CACHE_TTL_MS[kind],
        payload,
      });
    },
  };
}

export function createSupabaseBookCache(): BookCacheStore {
  return {
    async get<T>(provider, key) {
      if (!isServiceRoleConfigured()) return null;
      try {
        const admin = createServiceClient();
        const { data, error } = await admin
          .from('book_catalog_cache')
          .select('payload, expires_at')
          .eq('provider', provider)
          .eq('key_hash', hashBookCacheKey(key))
          .maybeSingle();
        if (error || !data) return null;
        if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
        return data.payload as T;
      } catch {
        return null;
      }
    },
    async set(provider, key, kind, payload) {
      if (!isServiceRoleConfigured()) return;
      try {
        const admin = createServiceClient();
        const expiresAt = new Date(Date.now() + BOOK_CACHE_TTL_MS[kind]).toISOString();
        await admin.from('book_catalog_cache').upsert(
          {
            provider,
            key_hash: hashBookCacheKey(key),
            payload,
            expires_at: expiresAt,
          },
          { onConflict: 'provider,key_hash' },
        );
      } catch {
        // Cache write failures must not break catalog reads.
      }
    },
  };
}

let defaultCache: BookCacheStore | null = null;

export function getBookCache(): BookCacheStore {
  if (!defaultCache) defaultCache = createSupabaseBookCache();
  return defaultCache;
}

/** Test helper. */
export function setBookCacheForTests(cache: BookCacheStore | null): void {
  defaultCache = cache;
}
