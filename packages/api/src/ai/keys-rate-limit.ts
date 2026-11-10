const memory = new Map<string, { minuteStart: number; minuteCount: number; dayStart: number; dayCount: number }>();

const MINUTE_LIMIT = 5;
const DAY_LIMIT = 20;

export function resetAiKeyRateLimit(): void {
  memory.clear();
}

export async function assertAiKeyRateLimit(userId: string): Promise<void> {
  const now = Date.now();
  const minuteStart = now - (now % 60_000);
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const dayStart = day.getTime();

  const current = memory.get(userId);
  const next = !current
    ? { minuteStart, minuteCount: 1, dayStart, dayCount: 1 }
    : {
        minuteStart,
        minuteCount: current.minuteStart === minuteStart ? current.minuteCount + 1 : 1,
        dayStart,
        dayCount: current.dayStart === dayStart ? current.dayCount + 1 : 1,
      };

  if (next.minuteCount > MINUTE_LIMIT || next.dayCount > DAY_LIMIT) {
    throw Object.assign(new Error('Too many AI key attempts. Try again later.'), {
      code: 'rate_limited' as const,
    });
  }
  memory.set(userId, next);
}
