import { afterEach, describe, expect, it, vi } from 'vitest';

import { app } from './app.js';
import {
  assertSafeGooglePhotoUrl,
  extractLinkedGoogleSub,
  handleCompleteGoogleAvatarIntent,
  handleCreateGoogleAvatarIntent,
  type ProfileAvatarGoogleDeps,
} from './profile-avatar-google.js';
import { resetProfileAvatarGoogleRateLimit } from './profile-avatar-google-rate-limit.js';

/**
 * These are mocked unit tests (in-memory deps + fake UserInfo).
 * Live database-policy checks for client forge prevention live in
 * packages/db/supabase/migrations/20261106140000_profile_avatar_google.sql.
 */

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const GOOGLE_SUB = 'google-sub-aaa';
const OTHER_SUB = 'google-sub-bbb';
const INTENT_ID = '33333333-3333-3333-3333-333333333333';
const PHOTO = 'https://lh3.googleusercontent.com/a/photo';

afterEach(() => {
  resetProfileAvatarGoogleRateLimit();
});

function baseDeps(overrides: Partial<ProfileAvatarGoogleDeps> = {}): ProfileAvatarGoogleDeps {
  const intent = {
    id: INTENT_ID,
    userId: USER_A,
    googleSub: GOOGLE_SUB,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    consumedAt: null as string | null,
  };

  return {
    isConfigured: () => true,
    resolveLinkedGoogleSub: async (userId) => (userId === USER_A ? GOOGLE_SUB : null),
    insertIntent: async () => {},
    loadIntent: async (id) => (id === INTENT_ID ? { ...intent } : null),
    consumeIntent: async () => true,
    fetchGoogleUserInfo: async () => ({ sub: GOOGLE_SUB, picture: PHOTO }),
    saveGoogleAvatar: async () => {},
    assertIntentRateLimit: () => {},
    assertCompleteRateLimit: () => {},
    now: () => Date.now(),
    ...overrides,
  };
}

describe('extractLinkedGoogleSub', () => {
  it('reads the Google identity subject and ignores editable metadata pictures', () => {
    expect(
      extractLinkedGoogleSub([
        {
          provider: 'email',
          id: 'email-id',
          identity_data: { sub: 'email-sub', picture: 'https://evil.example/meta.png' },
        },
        {
          provider: 'google',
          id: GOOGLE_SUB,
          identity_data: { sub: GOOGLE_SUB, picture: 'https://lh3.googleusercontent.com/a/meta' },
        },
      ]),
    ).toBe(GOOGLE_SUB);

    expect(extractLinkedGoogleSub([{ provider: 'email', identity_data: { sub: 'x' } }])).toBeNull();
    expect(extractLinkedGoogleSub([])).toBeNull();
  });
});

describe('assertSafeGooglePhotoUrl', () => {
  it('accepts https public URLs and rejects unsafe references', () => {
    expect(assertSafeGooglePhotoUrl(PHOTO)).toBe(PHOTO);
    expect(() => assertSafeGooglePhotoUrl('http://lh3.googleusercontent.com/a/x')).toThrow(/https/i);
    expect(() => assertSafeGooglePhotoUrl('https://user:pass@lh3.googleusercontent.com/a/x')).toThrow(/invalid/i);
    expect(() => assertSafeGooglePhotoUrl('https://127.0.0.1/a.png')).toThrow(/not allowed/i);
    expect(() => assertSafeGooglePhotoUrl('not-a-url')).toThrow(/invalid/i);
  });
});

describe('route auth (mocked env not required)', () => {
  it('rejects unauthenticated intent and complete requests', async () => {
    const intent = await app.request('/profile/avatar/google/intent', { method: 'POST' });
    expect(intent.status).toBe(401);
    await expect(intent.json()).resolves.toMatchObject({ error: expect.any(String) });

    const complete = await app.request('/profile/avatar/google/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intentId: INTENT_ID, googleAccessToken: 'token' }),
    });
    expect(complete.status).toBe(401);
    const completeBody = await complete.json();
    expect(completeBody).toMatchObject({ error: expect.any(String) });
    expect(JSON.stringify(completeBody)).not.toMatch(/token/);
  });
});

describe('handleCreateGoogleAvatarIntent (mocked)', () => {
  it('rejects users without a linked Google identity', async () => {
    const result = await handleCreateGoogleAvatarIntent(
      USER_B,
      baseDeps({ resolveLinkedGoogleSub: async () => null }),
    );
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/link a google account/i);
  });

  it('creates a short-lived intent bound to the linked Google subject', async () => {
    const insertIntent = vi.fn(async () => {});
    const result = await handleCreateGoogleAvatarIntent(
      USER_A,
      baseDeps({
        insertIntent,
        now: () => 1_700_000_000_000,
      }),
    );
    expect(result.status).toBe(200);
    expect(result.body.intentId).toEqual(expect.any(String));
    expect(result.body.expiresAt).toEqual(expect.any(String));
    expect(insertIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_A,
        googleSub: GOOGLE_SUB,
      }),
    );
  });
});

describe('handleCompleteGoogleAvatarIntent (mocked)', () => {
  it('rejects wrong-user intents without saving', async () => {
    const saveGoogleAvatar = vi.fn(async () => {});
    const consumeIntent = vi.fn(async () => true);
    const result = await handleCompleteGoogleAvatarIntent(
      USER_B,
      { intentId: INTENT_ID, googleAccessToken: 'token' },
      baseDeps({
        resolveLinkedGoogleSub: async (userId) => (userId === USER_B ? OTHER_SUB : GOOGLE_SUB),
        saveGoogleAvatar,
        consumeIntent,
      }),
    );
    expect(result.status).toBe(403);
    expect(saveGoogleAvatar).not.toHaveBeenCalled();
    expect(consumeIntent).not.toHaveBeenCalled();
  });

  it('rejects a Google subject that does not match the intent / linked identity', async () => {
    const saveGoogleAvatar = vi.fn(async () => {});
    const consumeIntent = vi.fn(async () => true);
    const result = await handleCompleteGoogleAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, googleAccessToken: 'token' },
      baseDeps({
        fetchGoogleUserInfo: async () => ({ sub: OTHER_SUB, picture: PHOTO }),
        saveGoogleAvatar,
        consumeIntent,
      }),
    );
    expect(result.status).toBe(403);
    expect(saveGoogleAvatar).not.toHaveBeenCalled();
    expect(consumeIntent).not.toHaveBeenCalled();
  });

  it('rejects editable-metadata-style spoof by requiring UserInfo subject match', async () => {
    const saveGoogleAvatar = vi.fn(async () => {});
    const result = await handleCompleteGoogleAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, googleAccessToken: 'token' },
      baseDeps({
        // Token proves a different subject even if a client also sent user_metadata.picture.
        fetchGoogleUserInfo: async () => ({
          sub: 'attacker-sub',
          picture: 'https://lh3.googleusercontent.com/a/spoof',
        }),
        saveGoogleAvatar,
      }),
    );
    expect(result.status).toBe(403);
    expect(saveGoogleAvatar).not.toHaveBeenCalled();
  });

  it('rejects expired intents and leaves avatar unchanged', async () => {
    const saveGoogleAvatar = vi.fn(async () => {});
    const result = await handleCompleteGoogleAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, googleAccessToken: 'token' },
      baseDeps({
        loadIntent: async () => ({
          id: INTENT_ID,
          userId: USER_A,
          googleSub: GOOGLE_SUB,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
          consumedAt: null,
        }),
        saveGoogleAvatar,
      }),
    );
    expect(result.status).toBe(410);
    expect(saveGoogleAvatar).not.toHaveBeenCalled();
  });

  it('rejects replayed intents and concurrent losers', async () => {
    const saveGoogleAvatar = vi.fn(async () => {});
    const replayed = await handleCompleteGoogleAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, googleAccessToken: 'token' },
      baseDeps({
        loadIntent: async () => ({
          id: INTENT_ID,
          userId: USER_A,
          googleSub: GOOGLE_SUB,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          consumedAt: new Date().toISOString(),
        }),
        saveGoogleAvatar,
      }),
    );
    expect(replayed.status).toBe(409);
    expect(saveGoogleAvatar).not.toHaveBeenCalled();

    const concurrent = await handleCompleteGoogleAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, googleAccessToken: 'token' },
      baseDeps({
        consumeIntent: async () => false,
        saveGoogleAvatar,
      }),
    );
    expect(concurrent.status).toBe(409);
    expect(saveGoogleAvatar).not.toHaveBeenCalled();
  });

  it('preserves the existing avatar when Google has no photo or verification fails', async () => {
    const saveGoogleAvatar = vi.fn(async () => {});
    const consumeIntent = vi.fn(async () => true);

    const missing = await handleCompleteGoogleAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, googleAccessToken: 'token' },
      baseDeps({
        fetchGoogleUserInfo: async () => ({ sub: GOOGLE_SUB }),
        saveGoogleAvatar,
        consumeIntent,
      }),
    );
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatch(/no profile photo/i);
    expect(saveGoogleAvatar).not.toHaveBeenCalled();
    expect(consumeIntent).not.toHaveBeenCalled();

    const failed = await handleCompleteGoogleAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, googleAccessToken: 'token' },
      baseDeps({
        fetchGoogleUserInfo: async () => {
          throw new Error('Google profile verification failed');
        },
        saveGoogleAvatar,
        consumeIntent,
      }),
    );
    expect(failed.status).toBe(401);
    expect(saveGoogleAvatar).not.toHaveBeenCalled();
    expect(consumeIntent).not.toHaveBeenCalled();
  });

  it('saves a server-controlled Google photo after successful verification', async () => {
    const saveGoogleAvatar = vi.fn(async () => {});
    const consumeIntent = vi.fn(async () => true);
    const result = await handleCompleteGoogleAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, googleAccessToken: 'google-access-token' },
      baseDeps({ saveGoogleAvatar, consumeIntent }),
    );
    expect(result).toEqual({ status: 200, body: { ok: true, avatarSource: 'google' } });
    expect(consumeIntent).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      userId: USER_A,
      googleSub: GOOGLE_SUB,
    });
    expect(saveGoogleAvatar).toHaveBeenCalledWith({ userId: USER_A, photoUrl: PHOTO });
    // Response must never echo the Google credential.
    expect(JSON.stringify(result.body)).not.toMatch(/google-access-token/);
  });
});
