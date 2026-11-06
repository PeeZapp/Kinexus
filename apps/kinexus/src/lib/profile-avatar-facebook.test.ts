import { describe, expect, it, vi } from 'vitest';

import {
  clearFacebookAvatarIntent,
  facebookIdentityAlreadyLinkedElsewhere,
  runFacebookAvatarOptIn,
  sessionHasLinkedFacebookIdentity,
  storeFacebookAvatarIntent,
  takeFacebookAvatarIntent,
} from './profile-avatar-facebook-flow';

describe('linked Facebook identity detection', () => {
  it('detects facebook provider only', () => {
    expect(sessionHasLinkedFacebookIdentity([{ provider: 'email' }])).toBe(false);
    expect(sessionHasLinkedFacebookIdentity([{ provider: 'facebook' }])).toBe(true);
    expect(sessionHasLinkedFacebookIdentity(null)).toBe(false);
  });
});

describe('facebook identity already linked elsewhere', () => {
  it('recognizes Supabase already-linked errors and aborts messaging', () => {
    expect(facebookIdentityAlreadyLinkedElsewhere('Identity is already linked')).toBe(true);
    expect(
      facebookIdentityAlreadyLinkedElsewhere(
        'Identity is already associated with a different user',
      ),
    ).toBe(true);
    expect(facebookIdentityAlreadyLinkedElsewhere('That Facebook account is already linked to another')).toBe(
      true,
    );
    expect(facebookIdentityAlreadyLinkedElsewhere('network timeout')).toBe(false);
  });
});

describe('facebook avatar intent round-trip storage', () => {
  it('stores intent without tokens and clears after take', () => {
    clearFacebookAvatarIntent();
    storeFacebookAvatarIntent({ intentId: 'intent-1', expectedUserId: 'user-a' });
    const taken = takeFacebookAvatarIntent();
    expect(taken).toEqual({ intentId: 'intent-1', expectedUserId: 'user-a' });
    expect(JSON.stringify(taken)).not.toMatch(/token|access/i);
    expect(takeFacebookAvatarIntent()).toBeNull();
  });
});

describe('runFacebookAvatarOptIn', () => {
  it('completes the happy path and never persists the provider token', async () => {
    const complete = vi.fn(async () => ({ ok: true as const, avatarSource: 'facebook' as const }));
    const reauth = vi.fn(async () => ({
      ok: true as const,
      providerToken: 'fb-access-token',
      userId: 'user-a',
    }));
    const result = await runFacebookAvatarOptIn({
      expectedUserId: 'user-a',
      createIntent: async () => ({ intentId: 'intent-1' }),
      reauth,
      complete,
    });
    expect(result).toEqual({ ok: true, avatarSource: 'facebook' });
    expect(complete).toHaveBeenCalledWith('intent-1', 'fb-access-token');
    expect(JSON.stringify(result)).not.toMatch(/fb-access-token/);
  });

  it('aborts when createIntent fails and keeps selection', async () => {
    const result = await runFacebookAvatarOptIn({
      expectedUserId: 'user-a',
      createIntent: async () => {
        throw new Error('Connect Facebook first');
      },
      reauth: async () => ({ ok: true, providerToken: 'x', userId: 'user-a' }),
      complete: async () => ({ ok: true, avatarSource: 'facebook' }),
    });
    expect(result).toEqual({
      ok: false,
      keepSelection: true,
      error: 'Connect Facebook first',
    });
  });

  it('aborts on user mismatch without completing', async () => {
    const complete = vi.fn(async () => ({ ok: true as const, avatarSource: 'facebook' as const }));
    const result = await runFacebookAvatarOptIn({
      expectedUserId: 'user-a',
      createIntent: async () => ({ intentId: 'intent-1' }),
      reauth: async () => ({
        ok: true,
        providerToken: 'token',
        userId: 'user-b',
      }),
      complete,
    });
    expect(result).toEqual({
      ok: false,
      keepSelection: true,
      error: 'Facebook did not match your account',
    });
    expect(complete).not.toHaveBeenCalled();
  });
});
