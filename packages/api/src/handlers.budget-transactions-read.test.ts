import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveVisionAiClient = vi.fn();
const completeResolved = vi.fn();

vi.mock('./ai/resolve.js', async () => {
  const actual = await vi.importActual<typeof import('./ai/resolve.js')>('./ai/resolve.js');
  return {
    ...actual,
    resolveVisionAiClient: (...args: unknown[]) => resolveVisionAiClient(...args),
    completeResolved: (...args: unknown[]) => completeResolved(...args),
  };
});

describe('handleBudgetTransactionsRead', () => {
  beforeEach(() => {
    resolveVisionAiClient.mockReset();
    completeResolved.mockReset();
    resolveVisionAiClient.mockResolvedValue({
      client: { provider: 'openai', complete: vi.fn() },
      keySource: 'platform',
      provider: 'openai',
      model: 'gpt-4o-mini',
      supportsWebSearch: false,
      userId: 'u1',
      householdId: 'h1',
      feature: 'read_bank_screenshots',
    });
  });

  it('mock AI then drops future date, zero amount, and balance lines', async () => {
    completeResolved.mockResolvedValue({
      text: JSON.stringify({
        transactions: [
          { date: '2026-11-10', description: 'COLES', amount: -12.5, pending: false },
          { date: '2026-12-01', description: 'Future', amount: -9, pending: false },
          { date: '2026-11-10', description: 'Zero', amount: 0, pending: false },
          { date: '2026-11-10', description: 'Available balance', amount: 400, pending: false },
        ],
      }),
      resultsMayVary: false,
      webSearchUsed: false,
      keySource: 'platform',
      provider: 'openai',
    });

    const { handleBudgetTransactionsRead } = await import('./handlers.js');
    const result = await handleBudgetTransactionsRead('u1', {
      householdId: 'h1',
      localDate: '2026-11-11',
      images: [{ mime: 'image/jpeg', base64: 'abc' }],
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      skipped: 3,
      transactions: [expect.objectContaining({ description: 'COLES', amount: -12.5 })],
    });
    expect(resolveVisionAiClient).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'read_bank_screenshots', householdId: 'h1' }),
    );
  });
});
