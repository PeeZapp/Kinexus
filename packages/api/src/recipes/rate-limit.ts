import { createHash } from 'node:crypto';

import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';

const GUEST_LIMIT = 5;
const USER_LIMIT = 20;
const memory = new Map<string, { windowStart: number; count: number }>();

export function resetRecipeImportRateLimit(): void {
  memory.clear();
}

export async function assertImportRateLimit(opts: { userId?: string; ip?: string }): Promise<void> {
  const hour = new Date();
  hour.setUTCMinutes(0, 0, 0);
  const windowStart = hour.getTime();
  const bucket = opts.userId ? `user:${opts.userId}` : `ip:${hashIp(opts.ip ?? 'local')}`;
  const limit = opts.userId ? USER_LIMIT : GUEST_LIMIT;

  const current = memory.get(bucket);
  const nextCount = !current || current.windowStart !== windowStart ? 1 : current.count + 1;
  if (nextCount > limit) {
    const err = Object.assign(new Error('Too many imports. Try again in a bit.'), { code: 'rate_limited' as const });
    throw err;
  }
  memory.set(bucket, { windowStart, count: nextCount });

  if (process.env.VITEST || !isServiceRoleConfigured()) return;
  const admin = createServiceClient();
  const iso = hour.toISOString();
  const { data } = await admin
    .from('recipe_import_rate')
    .select('count')
    .eq('bucket', bucket)
    .eq('window_start', iso)
    .maybeSingle();
  const stored = (data?.count as number | undefined) ?? 0;
  if (stored >= limit) {
    throw Object.assign(new Error('Too many imports. Try again in a bit.'), { code: 'rate_limited' as const });
  }
  await admin.from('recipe_import_rate').upsert({
    bucket,
    window_start: iso,
    count: Math.max(stored, nextCount),
  });
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}
