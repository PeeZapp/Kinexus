import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isValidBankScreenshotTxn,
  normalizeBankScreenshotRows,
  readBankScreenshotsWithAi,
} from './read-bank-screenshots.js';
import type { ResolvedAiClient } from './resolve.js';

const complete = vi.fn();

function resolved(): ResolvedAiClient {
  return {
    client: { provider: 'openai', complete },
    keySource: 'platform',
    provider: 'openai',
    model: 'gpt-4o-mini',
    supportsWebSearch: false,
    userId: 'user-1',
    householdId: 'hh-1',
    feature: 'read_bank_screenshots',
  };
}

vi.mock('./resolve.js', async () => {
  const actual = await vi.importActual<typeof import('./resolve.js')>('./resolve.js');
  return {
    ...actual,
    completeResolved: async (client: ResolvedAiClient, input: { images?: unknown[]; prompt: string; json?: boolean }) => {
      const text = await client.client.complete(input as never);
      return {
        text,
        resultsMayVary: false,
        webSearchUsed: false,
        keySource: client.keySource,
        provider: client.provider,
      };
    },
  };
});

describe('normalizeBankScreenshotRows', () => {
  const today = '2026-11-11';

  it('drops future dates, zero amounts, and balance lines', () => {
    const result = normalizeBankScreenshotRows(
      [
        { date: '2026-11-10', description: 'COLES', amount: -32.4, pending: false },
        { date: '2026-12-01', description: 'Future', amount: -10, pending: false },
        { date: '2026-11-10', description: 'Zero', amount: 0, pending: false },
        { date: '2026-11-10', description: 'Available balance', amount: 1200, pending: false },
        { date: 'Today', description: 'Uber', amount: -18, pending: true },
      ],
      today,
    );
    expect(result.transactions).toEqual([
      expect.objectContaining({ date: '2026-11-10', description: 'COLES', amount: -32.4, pending: false }),
      expect.objectContaining({ date: '2026-11-11', description: 'Uber', amount: -18, pending: true }),
    ]);
    expect(result.skipped).toBe(3);
  });

  it('rejects dates older than 120 days', () => {
    expect(
      isValidBankScreenshotTxn(
        { date: '2026-06-01', description: 'Old', amount: -5 },
        today,
      ),
    ).toBe(false);
  });
});

describe('readBankScreenshotsWithAi', () => {
  beforeEach(() => {
    complete.mockReset();
  });

  it('sends images and validates model rows', async () => {
    complete.mockResolvedValue(
      JSON.stringify({
        transactions: [
          { date: 'Yesterday', description: 'COLES 123', amount: -40, pending: false },
          { date: '2026-11-11', description: 'Closing balance', amount: 900, pending: false },
        ],
      }),
    );
    const result = await readBankScreenshotsWithAi(
      resolved(),
      [{ mime: 'image/jpeg', base64: 'abc' }],
      '2026-11-11',
    );
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        images: [{ mime: 'image/jpeg', base64: 'abc' }],
      }),
    );
    expect(result.value.transactions).toHaveLength(1);
    expect(result.value.transactions[0]?.date).toBe('2026-11-10');
    expect(result.value.transactions[0]?.merchantKey).toBeTruthy();
    expect(result.value.skipped).toBe(1);
  });
});
