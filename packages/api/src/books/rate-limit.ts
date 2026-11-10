type Bucket = {
  nextAllowedAt: number;
  requestCount: number;
  lastLoggedCount: number;
};

const buckets = new Map<string, Bucket>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function openLibraryRps(): number {
  return process.env.BOOKS_CONTACT_EMAIL?.trim() ? 3 : 1;
}

export function resetBookOutboundRateLimits(): void {
  buckets.clear();
}

export function bookProviderRequestCount(provider: string): number {
  return buckets.get(provider)?.requestCount ?? 0;
}

/**
 * Serialise outbound calls per provider to honour rps, then bump the counter.
 * Hardcover may also pass an extra wait from Retry-After / rate-limit headers.
 */
export async function awaitBookProviderSlot(provider: string, rps: number, extraWaitMs = 0): Promise<void> {
  const intervalMs = Math.ceil(1000 / Math.max(1, rps));
  const bucket = buckets.get(provider) ?? { nextAllowedAt: 0, requestCount: 0, lastLoggedCount: 0 };
  const now = Date.now();
  const waitMs = Math.max(0, bucket.nextAllowedAt - now, extraWaitMs);
  if (waitMs > 0) await sleep(waitMs);
  bucket.nextAllowedAt = Date.now() + intervalMs;
  bucket.requestCount += 1;
  if (bucket.requestCount - bucket.lastLoggedCount >= 1) {
    console.info(`books.provider.request provider=${provider} count=${bucket.requestCount}`);
    bucket.lastLoggedCount = bucket.requestCount;
  }
  buckets.set(provider, bucket);
}

export function parseRetryAfterMs(header: string | null, fallbackMs: number): number {
  if (!header) return fallbackMs;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) {
    // Retry-After may be seconds or an HTTP date; prefer seconds when numeric.
    return asInt > 1_000_000 ? Math.max(0, asInt - Date.now()) : asInt * 1000;
  }
  const when = Date.parse(header);
  if (Number.isFinite(when)) return Math.max(0, when - Date.now());
  return fallbackMs;
}

/** Hardcover rate-limit headers → wait ms before next call (0 if none). */
export function hardcoverHeaderWaitMs(headers: Headers): number {
  const retry = headers.get('retry-after');
  if (retry) return parseRetryAfterMs(retry, 1000);
  const remaining = headers.get('x-ratelimit-remaining') ?? headers.get('ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset') ?? headers.get('ratelimit-reset');
  if (remaining === '0' && reset) {
    const resetNum = Number(reset);
    if (Number.isFinite(resetNum)) {
      // reset may be unix seconds or delay seconds
      if (resetNum > 1_000_000_000) return Math.max(0, resetNum * 1000 - Date.now());
      return Math.max(0, resetNum * 1000);
    }
  }
  return 0;
}
