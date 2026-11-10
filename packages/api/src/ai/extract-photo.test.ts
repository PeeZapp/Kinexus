import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractRecipeFromPhoto } from './extract.js';
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
    feature: 'extract_recipe_from_photo',
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

describe('extractRecipeFromPhoto', () => {
  beforeEach(() => {
    complete.mockReset();
  });

  it('sends images and returns a normalized recipe draft', async () => {
    complete.mockResolvedValue(
      JSON.stringify({
        name: 'Lemon pasta',
        emoji: '🍋',
        ingredients: [{ name: 'spaghetti', amount: '400g', category: 'grains' }],
        method: ['Boil pasta', 'Toss with lemon'],
        mealSlots: ['dinner'],
      }),
    );

    const result = await extractRecipeFromPhoto(resolved(), [
      { mime: 'image/jpeg', base64: 'abc123' },
    ]);

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        json: true,
        images: [{ mime: 'image/jpeg', base64: 'abc123' }],
      }),
    );
    expect(result.value.name).toBe('Lemon pasta');
    expect(result.value.ingredients).toEqual([
      { name: 'spaghetti', amount: '400g', category: 'grains' },
    ]);
    expect(result.value.method).toEqual(['Boil pasta', 'Toss with lemon']);
    expect(result.provider).toBe('openai');
  });
});
