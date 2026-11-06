import { afterEach, describe, expect, it, vi } from 'vitest';

import { app } from './app.js';
import {
  extractLinkedFacebookId,
  handleCompleteFacebookAvatarIntent,
  handleCreateFacebookAvatarIntent,
  handleGetFacebookAvatarPicture,
  resetFacebookPictureUrlCache,
  type ProfileAvatarFacebookDeps,
} from './profile-avatar-facebook.js';
import { resetProfileAvatarFacebookRateLimit } from './profile-avatar-facebook-rate-limit.js';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const FACEBOOK_ID = '1000123456789';
const OTHER_ID = '1000987654321';
const INTENT_ID = '33333333-3333-3333-3333-333333333333';
const PHOTO = 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=1&oe=EXPIRE';

afterEach(() => {
  resetProfileAvatarFacebookRateLimit();
  resetFacebookPictureUrlCache();
});

function baseDeps(overrides: Partial<ProfileAvatarFacebookDeps> = {}): ProfileAvatarFacebookDeps {
  const intent = {
    id: INTENT_ID,
    userId: USER_A,
    facebookId: FACEBOOK_ID,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    consumedAt: null as string | null,
  };

  return {
    isConfigured: () => true,
    facebookAppCredentials: () => ({ appId: 'app-id', appSecret: 'app-secret' }),
    resolveLinkedFacebookId: async (userId) => (userId === USER_A ? FACEBOOK_ID : null),
    insertIntent: async () => {},
    loadIntent: async (id) => (id === INTENT_ID ? { ...intent } : null),
    consumeIntent: async () => true,
    fetchFacebookMe: async () => ({ id: FACEBOOK_ID, hasPhoto: true }),
    saveFacebookAvatar: async () => {},
    loadFacebookAvatarId: async (userId) => (userId === USER_A ? FACEBOOK_ID : null),
    resolveFacebookPictureUrl: async () => PHOTO,
    assertIntentRateLimit: () => {},
    assertCompleteRateLimit: () => {},
    assertPictureRateLimit: () => {},
    now: () => Date.now(),
    ...overrides,
  };
}

describe('extractLinkedFacebookId', () => {
  it('reads the Facebook identity id and ignores editable metadata pictures', () => {
    expect(
      extractLinkedFacebookId([
        {
          provider: 'email',
          id: 'email-id',
          identity_data: { sub: 'email-sub', picture: 'https://evil.example/meta.png' },
        },
        {
          provider: 'facebook',
          id: FACEBOOK_ID,
          identity_data: { user_id: FACEBOOK_ID, picture: 'https://graph.facebook.com/meta' },
        },
      ]),
    ).toBe(FACEBOOK_ID);

    expect(extractLinkedFacebookId([{ provider: 'email', identity_data: { sub: 'x' } }])).toBeNull();
    expect(extractLinkedFacebookId([])).toBeNull();
  });
});

describe('route auth (mocked)', () => {
  it('rejects unauthenticated facebook avatar routes', async () => {
    const intent = await app.request('/profile/avatar/facebook/intent', { method: 'POST' });
    expect(intent.status).toBe(401);

    const complete = await app.request('/profile/avatar/facebook/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intentId: INTENT_ID, facebookAccessToken: 'token' }),
    });
    expect(complete.status).toBe(401);
    const completeBody = await complete.json();
    expect(JSON.stringify(completeBody)).not.toMatch(/token/);

    const picture = await app.request('/profile/avatar/facebook/picture', { method: 'GET' });
    expect(picture.status).toBe(401);
  });
});

describe('handleCreateFacebookAvatarIntent (mocked)', () => {
  it('rejects users without a linked Facebook identity', async () => {
    const result = await handleCreateFacebookAvatarIntent(
      USER_B,
      baseDeps({ resolveLinkedFacebookId: async () => null }),
    );
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/connect facebook/i);
  });

  it('creates a short-lived intent bound to the linked Facebook id', async () => {
    const insertIntent = vi.fn(async () => {});
    const result = await handleCreateFacebookAvatarIntent(
      USER_A,
      baseDeps({
        insertIntent,
        now: () => 1_700_000_000_000,
      }),
    );
    expect(result.status).toBe(200);
    expect(result.body.intentId).toEqual(expect.any(String));
    expect(insertIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_A,
        facebookId: FACEBOOK_ID,
      }),
    );
  });
});

describe('handleCompleteFacebookAvatarIntent (mocked)', () => {
  it('rejects a Facebook id that does not match the intent / linked identity', async () => {
    const saveFacebookAvatar = vi.fn(async () => {});
    const consumeIntent = vi.fn(async () => true);
    const result = await handleCompleteFacebookAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, facebookAccessToken: 'token' },
      baseDeps({
        fetchFacebookMe: async () => ({ id: OTHER_ID, hasPhoto: true }),
        saveFacebookAvatar,
        consumeIntent,
      }),
    );
    expect(result.status).toBe(403);
    expect(saveFacebookAvatar).not.toHaveBeenCalled();
    expect(consumeIntent).not.toHaveBeenCalled();
  });

  it('rejects expired intents and leaves avatar unchanged', async () => {
    const saveFacebookAvatar = vi.fn(async () => {});
    const result = await handleCompleteFacebookAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, facebookAccessToken: 'token' },
      baseDeps({
        loadIntent: async () => ({
          id: INTENT_ID,
          userId: USER_A,
          facebookId: FACEBOOK_ID,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
          consumedAt: null,
        }),
        saveFacebookAvatar,
      }),
    );
    expect(result.status).toBe(410);
    expect(saveFacebookAvatar).not.toHaveBeenCalled();
  });

  it('rejects replayed intents', async () => {
    const saveFacebookAvatar = vi.fn(async () => {});
    const replayed = await handleCompleteFacebookAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, facebookAccessToken: 'token' },
      baseDeps({
        loadIntent: async () => ({
          id: INTENT_ID,
          userId: USER_A,
          facebookId: FACEBOOK_ID,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          consumedAt: new Date().toISOString(),
        }),
        saveFacebookAvatar,
      }),
    );
    expect(replayed.status).toBe(409);
    expect(saveFacebookAvatar).not.toHaveBeenCalled();
  });

  it('saves the verified Facebook id after successful verification (no CDN url persisted)', async () => {
    const saveFacebookAvatar = vi.fn(async () => {});
    const consumeIntent = vi.fn(async () => true);
    const result = await handleCompleteFacebookAvatarIntent(
      USER_A,
      { intentId: INTENT_ID, facebookAccessToken: 'facebook-access-token' },
      baseDeps({ saveFacebookAvatar, consumeIntent }),
    );
    expect(result).toEqual({ status: 200, body: { ok: true, avatarSource: 'facebook' } });
    expect(consumeIntent).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      userId: USER_A,
      facebookId: FACEBOOK_ID,
    });
    expect(saveFacebookAvatar).toHaveBeenCalledWith({ userId: USER_A, facebookId: FACEBOOK_ID });
    expect(JSON.stringify(result.body)).not.toMatch(/facebook-access-token/);
    expect(JSON.stringify(saveFacebookAvatar.mock.calls)).not.toMatch(/platform-lookaside|fbsbx/);
  });
});

describe('handleGetFacebookAvatarPicture (mocked)', () => {
  it('serves a fresh picture url and falls back when Graph has no photo', async () => {
    const resolveFacebookPictureUrl = vi.fn(async () => PHOTO);
    const ok = await handleGetFacebookAvatarPicture(
      USER_A,
      baseDeps({ resolveFacebookPictureUrl, now: () => 1_000 }),
    );
    expect(ok).toEqual({ status: 200, body: { url: PHOTO } });
    expect(resolveFacebookPictureUrl).toHaveBeenCalledTimes(1);

    const cached = await handleGetFacebookAvatarPicture(
      USER_A,
      baseDeps({ resolveFacebookPictureUrl, now: () => 1_000 + 30_000 }),
    );
    expect(cached.status).toBe(200);
    expect(resolveFacebookPictureUrl).toHaveBeenCalledTimes(1);

    const missing = await handleGetFacebookAvatarPicture(
      USER_A,
      baseDeps({
        resolveFacebookPictureUrl: async () => null,
        now: () => 1_000 + 10 * 60_000,
      }),
    );
    expect(missing.status).toBe(404);
    expect(missing.body.fallback).toBe('preset');
  });
});
