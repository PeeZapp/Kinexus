import { describe, expect, it, vi } from 'vitest';

import {
  clearGoogleAvatarIntent,
  runGoogleAvatarOptIn,
  sessionHasLinkedGoogleIdentity,
  storeGoogleAvatarIntent,
  takeGoogleAvatarIntent,
} from './profile-avatar-google-flow';

describe('linked Google identity detection', () => {
  it('is true only when a google identity is present', () => {
    expect(sessionHasLinkedGoogleIdentity([{ provider: 'email' }])).toBe(false);
    expect(sessionHasLinkedGoogleIdentity([{ provider: 'google' }])).toBe(true);
    expect(sessionHasLinkedGoogleIdentity(null)).toBe(false);
  });
});

describe('google avatar intent round-trip storage', () => {
  it('stores intent in memory and drops it on take (no token fields)', () => {
    clearGoogleAvatarIntent();
    storeGoogleAvatarIntent({ intentId: 'intent-1', expectedUserId: 'user-a' });
    const taken = takeGoogleAvatarIntent();
    expect(taken).toEqual({ intentId: 'intent-1', expectedUserId: 'user-a' });
    expect(taken).not.toHaveProperty('googleAccessToken');
    expect(takeGoogleAvatarIntent()).toBeNull();
  });
});

describe('runGoogleAvatarOptIn', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  it('happy path: intent → reauth → complete', async () => {
    const createIntent = vi.fn(async () => ({ intentId: 'intent-1', expiresAt: '2099-01-01T00:00:00Z' }));
    const reauth = vi.fn(async () => ({
      ok: true as const,
      userId,
      providerToken: 'google-access-token',
    }));
    const complete = vi.fn(async () => ({ ok: true as const, avatarSource: 'google' as const }));
    const storeIntent = vi.fn();
    const takeIntent = vi.fn(() => ({ intentId: 'intent-1', expectedUserId: userId }));
    const clearIntent = vi.fn();

    const result = await runGoogleAvatarOptIn({
      expectedUserId: userId,
      createIntent,
      reauth,
      complete,
      storeIntent,
      takeIntent,
      clearIntent,
    });

    expect(result).toEqual({ ok: true, avatarSource: 'google' });
    expect(createIntent).toHaveBeenCalledOnce();
    expect(storeIntent).toHaveBeenCalledWith({ intentId: 'intent-1', expectedUserId: userId });
    expect(reauth).toHaveBeenCalledWith(userId);
    expect(complete).toHaveBeenCalledWith('intent-1', 'google-access-token');
    expect(clearIntent).toHaveBeenCalled();
  });

  it('intent failure keeps preset and skips reauth', async () => {
    const reauth = vi.fn();
    const complete = vi.fn();
    const result = await runGoogleAvatarOptIn({
      expectedUserId: userId,
      createIntent: async () => {
        throw new Error('No linked Google');
      },
      reauth,
      complete,
      storeIntent: vi.fn(),
      takeIntent: vi.fn(() => null),
      clearIntent: vi.fn(),
    });
    expect(result).toEqual({ ok: false, keepPreset: true, error: 'No linked Google' });
    expect(reauth).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('complete 403/409/410 keeps preset', async () => {
    for (const status of [403, 409, 410]) {
      const complete = vi.fn(async () => {
        const err = new Error(`fail ${status}`) as Error & { status?: number };
        err.status = status;
        throw err;
      });
      const result = await runGoogleAvatarOptIn({
        expectedUserId: userId,
        createIntent: async () => ({ intentId: 'intent-1', expiresAt: '' }),
        reauth: async () => ({ ok: true, userId, providerToken: 'tok' }),
        complete,
        storeIntent: vi.fn(),
        takeIntent: vi.fn(() => ({ intentId: 'intent-1', expectedUserId: userId })),
        clearIntent: vi.fn(),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.keepPreset).toBe(true);
        expect(result.error).toMatch(/fail/);
      }
    }
  });

  it('uid mismatch on return aborts without complete', async () => {
    const complete = vi.fn();
    const result = await runGoogleAvatarOptIn({
      expectedUserId: userId,
      createIntent: async () => ({ intentId: 'intent-1', expiresAt: '' }),
      reauth: async () => ({
        ok: false,
        code: 'mismatch',
        error: 'Google sign-in did not match your account',
      }),
      complete,
      storeIntent: vi.fn(),
      takeIntent: vi.fn(() => ({ intentId: 'intent-1', expectedUserId: userId })),
      clearIntent: vi.fn(),
    });
    expect(result).toEqual({
      ok: false,
      keepPreset: true,
      error: 'Google sign-in did not match your account',
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it('reauth returning a different user id aborts without complete', async () => {
    const complete = vi.fn();
    const result = await runGoogleAvatarOptIn({
      expectedUserId: userId,
      createIntent: async () => ({ intentId: 'intent-1', expiresAt: '' }),
      reauth: async () => ({
        ok: true,
        userId: '22222222-2222-2222-2222-222222222222',
        providerToken: 'tok',
      }),
      complete,
      storeIntent: vi.fn(),
      takeIntent: vi.fn(() => ({ intentId: 'intent-1', expectedUserId: userId })),
      clearIntent: vi.fn(),
    });
    expect(result.ok).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });
});
