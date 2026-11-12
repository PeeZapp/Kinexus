import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';

export type WatchlistCatalogProvider = 'tmdb' | 'trakt';

const STORAGE_KEY = 'kinexus.watchlist.devProvider';

let memoryProvider: WatchlistCatalogProvider = 'tmdb';
const listeners = new Set<(value: WatchlistCatalogProvider) => void>();

function watchlistDevSwitchEnabled(): boolean {
  return Boolean(__DEV__) && process.env.EXPO_PUBLIC_WATCHLIST_DEV_SWITCH === '1';
}

export function isWatchlistProviderSwitchVisible(): boolean {
  return watchlistDevSwitchEnabled();
}

export function isWatchlistPreviewOnly(): boolean {
  return watchlistDevSwitchEnabled() && memoryProvider === 'trakt';
}

export function getWatchlistCatalogProvider(): WatchlistCatalogProvider {
  if (!watchlistDevSwitchEnabled()) return 'tmdb';
  return memoryProvider;
}

function notify(value: WatchlistCatalogProvider) {
  for (const listener of listeners) listener(value);
}

export async function setWatchlistCatalogProvider(next: WatchlistCatalogProvider): Promise<void> {
  if (!watchlistDevSwitchEnabled()) return;
  memoryProvider = next;
  notify(next);
  await AsyncStorage.setItem(STORAGE_KEY, next);
}

export function subscribeWatchlistCatalogProvider(
  listener: (value: WatchlistCatalogProvider) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let hydrated = false;

export async function hydrateWatchlistCatalogProvider(): Promise<WatchlistCatalogProvider> {
  if (!watchlistDevSwitchEnabled()) {
    memoryProvider = 'tmdb';
    return 'tmdb';
  }
  if (hydrated) return memoryProvider;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  memoryProvider = raw === 'trakt' ? 'trakt' : 'tmdb';
  hydrated = true;
  notify(memoryProvider);
  return memoryProvider;
}

export function useWatchlistCatalogProvider(): {
  provider: WatchlistCatalogProvider;
  previewOnly: boolean;
  visible: boolean;
  setProvider: (next: WatchlistCatalogProvider) => void;
} {
  const queryClient = useQueryClient();
  const [provider, setProviderState] = useState<WatchlistCatalogProvider>(getWatchlistCatalogProvider);
  const visible = isWatchlistProviderSwitchVisible();

  useEffect(() => {
    if (!visible) return;
    void hydrateWatchlistCatalogProvider().then(setProviderState);
    return subscribeWatchlistCatalogProvider(setProviderState);
  }, [visible]);

  const setProvider = useCallback(
    (next: WatchlistCatalogProvider) => {
      void setWatchlistCatalogProvider(next).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      });
    },
    [queryClient],
  );

  return {
    provider,
    previewOnly: visible && provider === 'trakt',
    visible,
    setProvider,
  };
}
