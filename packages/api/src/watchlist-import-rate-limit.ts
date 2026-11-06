const LIMIT = 30;
const WINDOW_MS = 60 * 60 * 1000;

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

export function resetWatchlistImportMatchRateLimit(): void {
  buckets.clear();
}

export function assertWatchlistImportMatchRateLimit(userId: string): void {
  const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  const key = `user:${userId}`;
  const current = buckets.get(key);
  const nextCount = !current || current.windowStart !== windowStart ? 1 : current.count + 1;
  if (nextCount > LIMIT) {
    throw Object.assign(new Error('Too many import match requests. Try again later.'), {
      status: 429,
      code: 'rate_limited' as const,
    });
  }
  buckets.set(key, { windowStart, count: nextCount });
}
