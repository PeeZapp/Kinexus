type CacheEntry<T> = { at: number; value: T };

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export type RequestCounters = {
  trakt: number;
  streamingAvailability: number;
  tmdbImages: number;
};

const counters: RequestCounters = {
  trakt: 0,
  streamingAvailability: 0,
  tmdbImages: 0,
};

export function watchlistProviderRequestCounts(): Readonly<RequestCounters> {
  return { ...counters };
}

export function resetWatchlistProviderRequestCounts(): void {
  counters.trakt = 0;
  counters.streamingAvailability = 0;
  counters.tmdbImages = 0;
}

export function bumpWatchlistProviderRequest(kind: keyof RequestCounters): void {
  counters[kind] += 1;
  if (counters[kind] === 1 || counters[kind] % 25 === 0) {
    console.info(
      `[watchlist-dev] requests trakt=${counters.trakt} streaming=${counters.streamingAvailability} tmdbImages=${counters.tmdbImages}`,
    );
  }
}

export function createTtlCache<T>(ttlMs = DEFAULT_TTL_MS) {
  const map = new Map<string, CacheEntry<T>>();
  const inflight = new Map<string, Promise<T>>();

  return {
    get(key: string): T | undefined {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.at > ttlMs) {
        map.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T): void {
      map.set(key, { at: Date.now(), value });
    },
    async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
      const cached = this.get(key);
      if (cached !== undefined) return cached;
      const pending = inflight.get(key);
      if (pending) return pending;
      const task = (async () => {
        try {
          const value = await load();
          this.set(key, value);
          return value;
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, task);
      return task;
    },
    clear(): void {
      map.clear();
      inflight.clear();
    },
  };
}
