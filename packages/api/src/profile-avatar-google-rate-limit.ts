const INTENT_LIMIT = 8;
const COMPLETE_LIMIT = 16;
const WINDOW_MS = 60 * 60 * 1000;

type Bucket = { windowStart: number; count: number };

const intentBuckets = new Map<string, Bucket>();
const completeBuckets = new Map<string, Bucket>();

export function resetProfileAvatarGoogleRateLimit(): void {
  intentBuckets.clear();
  completeBuckets.clear();
}

function assertLimit(store: Map<string, Bucket>, userId: string, limit: number, message: string): void {
  const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  const key = `user:${userId}`;
  const current = store.get(key);
  const nextCount = !current || current.windowStart !== windowStart ? 1 : current.count + 1;
  if (nextCount > limit) {
    throw Object.assign(new Error(message), { code: 'rate_limited' as const });
  }
  store.set(key, { windowStart, count: nextCount });
}

export function assertAvatarGoogleIntentRateLimit(userId: string): void {
  assertLimit(intentBuckets, userId, INTENT_LIMIT, 'Too many Google avatar attempts. Try again later.');
}

export function assertAvatarGoogleCompleteRateLimit(userId: string): void {
  assertLimit(completeBuckets, userId, COMPLETE_LIMIT, 'Too many Google avatar attempts. Try again later.');
}
