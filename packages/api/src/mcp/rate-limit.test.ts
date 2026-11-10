import { beforeEach, describe, expect, it } from 'vitest';

import { assertMcpRateLimit, resetMcpRateLimit } from './rate-limit.js';

describe('mcp rate limit', () => {
  beforeEach(() => {
    resetMcpRateLimit();
  });

  it('limits per user and per client', async () => {
    for (let i = 0; i < 120; i += 1) {
      await assertMcpRateLimit({ userId: 'u1', clientId: 'c1' });
    }
    await expect(assertMcpRateLimit({ userId: 'u1', clientId: 'c-other' })).rejects.toMatchObject({
      code: 'rate_limited',
    });

    resetMcpRateLimit();
    for (let i = 0; i < 240; i += 1) {
      await assertMcpRateLimit({ userId: `u-${i}`, clientId: 'c-hot' });
    }
    await expect(assertMcpRateLimit({ userId: 'fresh', clientId: 'c-hot' })).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });
});
