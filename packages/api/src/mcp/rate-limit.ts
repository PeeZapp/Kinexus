const memory = new Map<string, { windowStart: number; count: number }>();

const USER_LIMIT = 120;
const CLIENT_LIMIT = 240;
const WINDOW_MS = 60_000;

export function resetMcpRateLimit(): void {
  memory.clear();
}

export async function assertMcpRateLimit(opts: { userId: string; clientId?: string | null }): Promise<void> {
  bump(`user:${opts.userId}`, USER_LIMIT);
  if (opts.clientId) bump(`client:${opts.clientId}`, CLIENT_LIMIT);
}

function bump(bucket: string, limit: number): void {
  const now = Date.now();
  const windowStart = now - (now % WINDOW_MS);
  const current = memory.get(bucket);
  const nextCount = !current || current.windowStart !== windowStart ? 1 : current.count + 1;
  if (nextCount > limit) {
    throw Object.assign(new Error('Too many MCP requests. Try again in a bit.'), { code: 'rate_limited' as const });
  }
  memory.set(bucket, { windowStart, count: nextCount });
}
