import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WEB_SEARCH_FEATURES } from './features.js';
import { classifyProviderKeyFailure } from './key-errors.js';
import { scrubSecrets } from './scrub.js';

const { mockAdmin, usageRows, platformComplete, householdComplete } = vi.hoisted(() => {
  const usageRows: unknown[] = [];
  const platformComplete = vi.fn(async () => JSON.stringify({ ok: true, title: 'Soup', ingredients: [{ name: 'water' }], method: [{ type: 'step', text: 'Boil' }] }));
  const householdComplete = vi.fn(async () => JSON.stringify({ name: 'Soup', ingredients: [], method: [] }));
  return {
    usageRows,
    platformComplete,
    householdComplete,
    mockAdmin: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

vi.mock('../supabase-admin.js', () => ({
  isServiceRoleConfigured: () => true,
  createServiceClient: () => mockAdmin,
}));

vi.mock('./registry.js', async () => {
  const actual = await vi.importActual<typeof import('./registry.js')>('./registry.js');
  return {
    ...actual,
    createPlatformAiClient: () => ({
      provider: 'anthropic' as const,
      complete: platformComplete,
    }),
    createAiClientFromKey: () => ({
      provider: 'openai' as const,
      complete: householdComplete,
    }),
  };
});

function memberOk() {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { user_id: 'u1', role: 'adult' }, error: null }),
        }),
      }),
    }),
  };
}

describe('WEB_SEARCH_FEATURES', () => {
  it('lists features that request web search', () => {
    expect(WEB_SEARCH_FEATURES).toContain('extract_recipe_from_url');
    expect(WEB_SEARCH_FEATURES).toContain('generate_recipe_from_name');
    expect(WEB_SEARCH_FEATURES).toContain('estimate_recipe_nutrition');
    expect(WEB_SEARCH_FEATURES).not.toContain('classify_budget');
    expect(WEB_SEARCH_FEATURES).not.toContain('extract_recipe_from_photo');
  });
});

describe('classifyProviderKeyFailure', () => {
  it('maps auth and quota failures to invalid without leaking keys', () => {
    expect(classifyProviderKeyFailure(new Error('OpenAI request failed (401): invalid_api_key sk-proj-SECRETKEY99'))).toBe(
      'invalid',
    );
    expect(classifyProviderKeyFailure(new Error('Anthropic request failed (429): rate_limit'))).toBe('invalid');
    expect(classifyProviderKeyFailure(new Error('insufficient_quota / out of credit'))).toBe('invalid');
    const scrubbed = scrubSecrets('failed sk-ant-abcdefghijklmnopqrstuv');
    expect(scrubbed).not.toContain('sk-ant-abcdefghijklmnopqrstuv');
  });
});

describe('resolveAiClient', () => {
  beforeEach(() => {
    usageRows.length = 0;
    platformComplete.mockClear();
    householdComplete.mockClear();
    mockAdmin.from.mockReset();
    mockAdmin.rpc.mockReset();
    mockAdmin.from.mockImplementation(() => memberOk());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses platform when household has no key', async () => {
    mockAdmin.rpc.mockImplementation(async (name: string) => {
      if (name === 'internal_get_household_ai_key_material') return { data: [], error: null };
      if (name === 'internal_insert_ai_usage_log') {
        usageRows.push('ok');
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    const { resolveAiClient, completeResolved } = await import('./resolve.js');
    const resolved = await resolveAiClient({
      userId: 'u1',
      householdId: 'h1',
      feature: 'extract_recipe',
    });
    expect(resolved.keySource).toBe('platform');
    expect(resolved.provider).toBe('anthropic');
    await completeResolved(resolved, { prompt: 'hi', json: true });
    expect(platformComplete).toHaveBeenCalled();
    expect(householdComplete).not.toHaveBeenCalled();
    expect(usageRows.length).toBe(1);
  });

  it('uses household key when allowed and valid', async () => {
    mockAdmin.rpc.mockImplementation(async (name: string) => {
      if (name === 'internal_get_household_ai_key_material') {
        return {
          data: [{ provider: 'openai', key_status: 'valid', secret: 'sk-test-household-key' }],
          error: null,
        };
      }
      if (name === 'can_use_household_ai_key') return { data: true, error: null };
      if (name === 'internal_insert_ai_usage_log') {
        usageRows.push('ok');
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    const { resolveAiClient, completeResolved } = await import('./resolve.js');
    const resolved = await resolveAiClient({
      userId: 'u1',
      householdId: 'h1',
      feature: 'extract_recipe',
    });
    expect(resolved.keySource).toBe('household');
    expect(resolved.provider).toBe('openai');
    await completeResolved(resolved, { prompt: 'hi', json: true });
    expect(householdComplete).toHaveBeenCalled();
    expect(platformComplete).not.toHaveBeenCalled();
  });

  it('throws no_access with no platform call when disallowed', async () => {
    mockAdmin.rpc.mockImplementation(async (name: string) => {
      if (name === 'internal_get_household_ai_key_material') {
        return {
          data: [{ provider: 'openai', key_status: 'valid', secret: 'sk-test-household-key' }],
          error: null,
        };
      }
      if (name === 'can_use_household_ai_key') return { data: false, error: null };
      if (name === 'internal_insert_ai_usage_log') {
        usageRows.push('blocked_no_access');
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    const { resolveAiClient, AiBlockedError } = await import('./resolve.js');
    await expect(
      resolveAiClient({ userId: 'u1', householdId: 'h1', feature: 'classify_budget' }),
    ).rejects.toMatchObject({ code: 'no_access' });
    expect(platformComplete).not.toHaveBeenCalled();
    expect(householdComplete).not.toHaveBeenCalled();
    expect(usageRows).toEqual(['blocked_no_access']);
    expect(AiBlockedError).toBeTruthy();
  });

  it('throws key_paused for everyone when key status is not ok', async () => {
    mockAdmin.rpc.mockImplementation(async (name: string) => {
      if (name === 'internal_get_household_ai_key_material') {
        return {
          data: [{ provider: 'openai', key_status: 'invalid', secret: 'sk-test-household-key' }],
          error: null,
        };
      }
      if (name === 'internal_insert_ai_usage_log') {
        usageRows.push('blocked_paused');
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    const { resolveAiClient } = await import('./resolve.js');
    await expect(
      resolveAiClient({ userId: 'u1', householdId: 'h1', feature: 'estimate_recipe_nutrition' }),
    ).rejects.toMatchObject({ code: 'key_paused' });
    expect(platformComplete).not.toHaveBeenCalled();
    expect(usageRows).toEqual(['blocked_paused']);
  });

  it('marks household key paused on provider failure without platform fallback', async () => {
    householdComplete.mockRejectedValueOnce(new Error('OpenAI request failed (401): invalid_api_key'));
    mockAdmin.rpc.mockImplementation(async (name: string) => {
      if (name === 'internal_get_household_ai_key_material') {
        return {
          data: [{ provider: 'openai', key_status: 'valid', secret: 'sk-test-household-key' }],
          error: null,
        };
      }
      if (name === 'can_use_household_ai_key') return { data: true, error: null };
      if (name === 'internal_set_household_ai_key_status') {
        usageRows.push('set_invalid');
        return { data: null, error: null };
      }
      if (name === 'internal_insert_ai_usage_log') {
        usageRows.push('error');
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
    const { resolveAiClient, completeResolved } = await import('./resolve.js');
    const resolved = await resolveAiClient({
      userId: 'u1',
      householdId: 'h1',
      feature: 'extract_recipe',
    });
    await expect(completeResolved(resolved, { prompt: 'hi' })).rejects.toMatchObject({ code: 'key_paused' });
    expect(platformComplete).not.toHaveBeenCalled();
    expect(usageRows).toContain('set_invalid');
    expect(usageRows).toContain('error');
  });

  it('downgrades web search when household provider lacks it', async () => {
    mockAdmin.rpc.mockImplementation(async (name: string) => {
      if (name === 'internal_get_household_ai_key_material') {
        return {
          data: [{ provider: 'openai', key_status: 'valid', secret: 'sk-test-household-key' }],
          error: null,
        };
      }
      if (name === 'can_use_household_ai_key') return { data: true, error: null };
      if (name === 'internal_insert_ai_usage_log') return { data: null, error: null };
      return { data: null, error: null };
    });
    const { resolveAiClient, completeResolved } = await import('./resolve.js');
    const resolved = await resolveAiClient({
      userId: 'u1',
      householdId: 'h1',
      feature: 'generate_recipe_from_name',
    });
    expect(resolved.supportsWebSearch).toBe(false);
    const out = await completeResolved(resolved, { prompt: 'hi', webSearch: true });
    expect(out.resultsMayVary).toBe(true);
    expect(out.webSearchUsed).toBe(false);
    expect(householdComplete).toHaveBeenCalledWith(expect.objectContaining({ webSearch: false }));
  });

  it('platform catalogue path ignores household key pause', async () => {
    const { resolvePlatformAiClient } = await import('./resolve.js');
    const client = resolvePlatformAiClient();
    await client.complete({ prompt: 'price' });
    expect(platformComplete).toHaveBeenCalled();
    expect(householdComplete).not.toHaveBeenCalled();
  });

  it('falls back to a platform vision provider when household key cannot read photos', async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    mockAdmin.rpc.mockImplementation(async (name: string) => {
      if (name === 'internal_get_household_ai_key_material') {
        return {
          data: [{ provider: 'deepseek', key_status: 'valid', secret: 'sk-test-deepseek' }],
          error: null,
        };
      }
      if (name === 'can_use_household_ai_key') return { data: true, error: null };
      return { data: null, error: null };
    });
    try {
      const { resolveVisionAiClient } = await import('./resolve.js');
      const resolved = await resolveVisionAiClient({
        userId: 'u1',
        householdId: 'h1',
        feature: 'extract_recipe_from_photo',
      });
      expect(resolved.provider).toBe('anthropic');
      expect(resolved.keySource).toBe('platform');
    } finally {
      if (prev == null) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});

describe('resolveAiStatus', () => {
  beforeEach(() => {
    mockAdmin.from.mockReset();
    mockAdmin.rpc.mockReset();
  });

  it('returns the right reason per member', async () => {
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'household_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { user_id: 'u1', role: 'adult' }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'household_ai_keys') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { key_status: 'valid' }, error: null }),
            }),
          }),
        };
      }
      return memberOk();
    });
    mockAdmin.rpc.mockResolvedValue({ data: false, error: null });
    const { resolveAiStatus } = await import('./resolve.js');
    const status = await resolveAiStatus('u1', 'h1');
    expect(status).toMatchObject({ blocked: 'no_access', hasKey: true, keySource: null });
  });
});
