const INTENT_LIMIT = 8;
const COMPLETE_LIMIT = 16;
const PICTURE_LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;

type Bucket = { windowStart: number; count: number };

const intentBuckets = new Map<string, Bucket>();
const completeBuckets = new Map<string, Bucket>();
const pictureBuckets = new Map<string, Bucket>();

export function resetProfileAvatarFacebookRateLimit(): void {
  intentBuckets.clear();
  completeBuckets.clear();
  pictureBuckets.clear();
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

export function assertAvatarFacebookIntentRateLimit(userId: string): void {
  assertLimit(intentBuckets, userId, INTENT_LIMIT, 'Too many Facebook avatar attempts. Try again later.');
}

export function assertAvatarFacebookCompleteRateLimit(userId: string): void {
  assertLimit(completeBuckets, userId, COMPLETE_LIMIT, 'Too many Facebook avatar attempts. Try again later.');
}

export function assertAvatarFacebookPictureRateLimit(userId: string): void {
  assertLimit(pictureBuckets, userId, PICTURE_LIMIT, 'Too many Facebook photo requests. Try again later.');
}
