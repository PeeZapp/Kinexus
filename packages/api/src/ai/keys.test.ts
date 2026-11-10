import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectProviderFromKey, keyLast4, resolveHouseholdAiKey } from './detect.js';
import { assertAiKeyRateLimit, resetAiKeyRateLimit } from './keys-rate-limit.js';
import { scrubErrorMessage, scrubSecrets, scrubUnknown } from './scrub.js';

const { mockAdmin, mockUser } = vi.hoisted(() => ({
  mockAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  mockUser: {
    rpc: vi.fn(),
  },
}));

vi.mock('../supabase-admin.js', () => ({
  isServiceRoleConfigured: () => true,
  createServiceClient: () => mockAdmin,
}));

vi.mock('../auth.js', () => ({
  readBearerToken: () => 'token',
  createUserClient: () => mockUser,
}));

function memberQuery(role: string | null) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () =>
            role ? { data: { role, user_id: 'u1' }, error: null } : { data: null, error: null },
        }),
      }),
    }),
  };
}

describe('detectProviderFromKey', () => {
  it('maps clear prefixes', () => {
    expect(detectProviderFromKey('sk-ant-abc123')).toEqual({ provider: 'anthropic', needsProvider: false });
    expect(detectProviderFromKey('pplx-abc123')).toEqual({ provider: 'perplexity', needsProvider: false });
    expect(detectProviderFromKey('AIzaSyAbc')).toEqual({ provider: 'gemini', needsProvider: false });
  });

  it('marks ambiguous sk- for openai/deepseek validation', () => {
    expect(detectProviderFromKey('sk-proj-abc')).toEqual({ provider: null, needsProvider: false });
  });

  it('asks for provider when detection fails', () => {
    expect(detectProviderFromKey('not-a-key')).toEqual({ provider: null, needsProvider: true });
  });
});

describe('resolveHouseholdAiKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates openai before deepseek for ambiguous sk-', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('api.openai.com')) return new Response('{}', { status: 200 });
      return new Response('nope', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await resolveHouseholdAiKey({ key: 'sk-test-openai-key' });
    expect(result).toEqual({ ok: true, provider: 'openai' });
  });

  it('falls through to deepseek when openai fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('api.openai.com')) return new Response('nope', { status: 401 });
      if (String(url).includes('api.deepseek.com')) return new Response('{}', { status: 200 });
      return new Response('nope', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await resolveHouseholdAiKey({ key: 'sk-test-deepseek-key' });
    expect(result).toEqual({ ok: true, provider: 'deepseek' });
  });

  it('returns needsProvider when prefix is unknown', async () => {
    const result = await resolveHouseholdAiKey({ key: 'xyz-unknown' });
    expect(result).toEqual({ ok: false, needsProvider: true });
  });
});

describe('scrubber', () => {
  it('keeps only last4 of keys in strings', () => {
    const scrubbed = scrubSecrets('using sk-ant-abcdefghijklmnopqrstuv and Authorization: Bearer secret-token');
    expect(scrubbed).toContain('••••');
    expect(scrubbed).not.toContain('sk-ant-abcdefghijklmnopqrstuv');
    expect(scrubbed.toLowerCase()).not.toContain('secret-token');
    expect(keyLast4('sk-ant-abcdefghijklmnopqrstuv')).toBe('stuv');
  });

  it('scrubs objects without leaking full keys', () => {
    const scrubbed = scrubUnknown({
      key: 'sk-ant-abcdefghijklmnopqrstuv',
      Authorization: 'Bearer abc.def.ghi',
      nested: { message: 'failed with sk-proj-1234567890abcd' },
    }) as Record<string, unknown>;
    expect(JSON.stringify(scrubbed)).not.toContain('sk-ant-abcdefghijklmnopqrstuv');
    expect(JSON.stringify(scrubbed)).not.toContain('abc.def.ghi');
    expect(scrubErrorMessage(new Error('bad sk-ant-abcdefghijklmnopqrstuv'))).toContain('••••');
  });
});

describe('assertAiKeyRateLimit', () => {
  beforeEach(() => resetAiKeyRateLimit());

  it('allows 5 per minute then blocks', async () => {
    for (let i = 0; i < 5; i += 1) await assertAiKeyRateLimit('user-a');
    await expect(assertAiKeyRateLimit('user-a')).rejects.toMatchObject({ code: 'rate_limited' });
  });
});

describe('/ai/keys handlers', () => {
  beforeEach(() => {
    resetAiKeyRateLimit();
    mockAdmin.from.mockReset();
    mockAdmin.rpc.mockReset();
    mockUser.rpc.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-admins on set/remove/access', async () => {
    mockAdmin.from.mockImplementation(() => memberQuery('adult'));
    const { handleSetAiKey, handleDeleteAiKey, handleGetAiKeyAccess, handlePutAiKeyAccess } = await import('./keys.js');

    const set = await handleSetAiKey('u1', { householdId: 'h1', key: 'sk-ant-testkey1234' });
    expect(set.status).toBe(403);

    const del = await handleDeleteAiKey('u1', { householdId: 'h1' });
    expect(del.status).toBe(403);

    const access = await handleGetAiKeyAccess('u1', 'h1', new Request('http://local/ai/keys/access'));
    expect(access.status).toBe(403);

    const put = await handlePutAiKeyAccess(
      'u1',
      { householdId: 'h1', userId: 'u2', allowed: true },
      new Request('http://local/ai/keys/access'),
    );
    expect(put.status).toBe(403);
  });

  it('stores a validated key for admins and never returns the secret', async () => {
    mockAdmin.from.mockImplementation(() => memberQuery('admin'));
    mockAdmin.rpc.mockResolvedValue({ data: null, error: null });
    const { handleSetAiKey, handleGetAiKey } = await import('./keys.js');

    const set = await handleSetAiKey('u1', { householdId: 'h1', key: 'sk-ant-abcdefghijklmnopqrstuv' });
    expect(set.status).toBe(200);
    expect(JSON.stringify(set.body)).not.toContain('sk-ant-abcdefghijklmnopqrstuv');
    expect(set.body).toMatchObject({ last4: 'stuv', provider: 'anthropic', hasKey: true });
    expect(mockAdmin.rpc).toHaveBeenCalledWith(
      'internal_store_household_ai_key',
      expect.objectContaining({
        p_household_id: 'h1',
        p_provider: 'anthropic',
        p_last4: 'stuv',
        p_key_status: 'valid',
        p_actor: 'u1',
      }),
    );
    const storeArgs = mockAdmin.rpc.mock.calls[0]?.[1] as { p_secret: string };
    expect(storeArgs.p_secret).toBe('sk-ant-abcdefghijklmnopqrstuv');

    mockAdmin.from.mockImplementation(() => memberQuery('adult'));
    mockUser.rpc.mockResolvedValue({
      data: [
        {
          provider: 'anthropic',
          last4: 'stuv',
          key_status: 'valid',
          last_checked_at: null,
          created_at: null,
          updated_at: null,
          allowed: false,
          has_key: true,
        },
      ],
      error: null,
    });
    const get = await handleGetAiKey('u1', 'h1', new Request('http://local/ai/keys'));
    expect(get.status).toBe(200);
    expect(JSON.stringify(get.body)).not.toContain('sk-ant-abcdefghijklmnopqrstuv');
    expect(get.body).toMatchObject({ last4: 'stuv', allowed: false, hasKey: true });
  });

  it('rate limits key set attempts', async () => {
    mockAdmin.from.mockImplementation(() => memberQuery('owner'));
    mockAdmin.rpc.mockResolvedValue({ data: null, error: null });
    const { handleSetAiKey } = await import('./keys.js');
    for (let i = 0; i < 5; i += 1) {
      const result = await handleSetAiKey('rate-user', { householdId: 'h1', key: 'sk-ant-abcdefghijklmnopqrstuv' });
      expect(result.status).toBe(200);
    }
    const blocked = await handleSetAiKey('rate-user', { householdId: 'h1', key: 'sk-ant-abcdefghijklmnopqrstuv' });
    expect(blocked.status).toBe(429);
  });
});
