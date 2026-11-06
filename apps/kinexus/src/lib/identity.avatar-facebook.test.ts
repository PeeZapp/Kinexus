import { describe, expect, it } from 'vitest';

import { resolveAvatarDisplay, resolveAvatarPresetId } from './identity-avatar';
import { mapOwnIdentity } from './identity-own';

describe('facebook avatar display', () => {
  it('maps facebook source with id and falls back when id missing', () => {
    const withFacebook = mapOwnIdentity({
      id: '11111111-1111-1111-1111-111111111111',
      global_handle: 'Swift-Oak-42',
      username: null,
      username_changed_at: null,
      display_name: 'Pat',
      avatar_url: 'preset:meals',
      avatar_source: 'facebook',
      avatar_facebook_id: '1000123456789',
      is_verified_creator: false,
    });
    expect(withFacebook.avatarSource).toBe('facebook');
    expect(withFacebook.avatarFacebookId).toBe('1000123456789');
    expect(withFacebook.avatarGoogleUrl).toBeNull();
    expect(resolveAvatarPresetId(withFacebook.avatarUrl)).toBe('preset:meals');

    const missingId = mapOwnIdentity({
      id: '11111111-1111-1111-1111-111111111111',
      global_handle: 'Swift-Oak-42',
      username: null,
      username_changed_at: null,
      display_name: 'Pat',
      avatar_url: 'preset:train',
      avatar_source: 'facebook',
      avatar_facebook_id: null,
      is_verified_creator: false,
    });
    expect(missingId.avatarSource).toBe('preset');
    expect(missingId.avatarFacebookId).toBeNull();
  });

  it('resolveAvatarDisplay prefers facebook then google then preset', () => {
    expect(
      resolveAvatarDisplay({
        avatarUrl: 'preset:lists',
        avatarSource: 'facebook',
        avatarFacebookId: '1000123456789',
      }),
    ).toEqual({
      kind: 'facebook',
      facebookId: '1000123456789',
      preset: 'preset:lists',
    });

    expect(
      resolveAvatarDisplay({
        avatarUrl: 'preset:lists',
        avatarSource: 'google',
        avatarGoogleUrl: 'https://lh3.googleusercontent.com/a/x',
      }),
    ).toEqual({
      kind: 'google',
      uri: 'https://lh3.googleusercontent.com/a/x',
      preset: 'preset:lists',
    });
  });

  it('preset switch path clears facebook server-side (client writes avatar_url only)', () => {
    const afterPreset = mapOwnIdentity({
      id: '11111111-1111-1111-1111-111111111111',
      global_handle: 'Swift-Oak-42',
      username: null,
      username_changed_at: null,
      display_name: 'Pat',
      avatar_url: 'preset:today',
      avatar_source: 'preset',
      avatar_google_url: null,
      avatar_facebook_id: null,
      is_verified_creator: false,
    });
    expect(afterPreset.avatarSource).toBe('preset');
    expect(afterPreset.avatarFacebookId).toBeNull();
    expect(afterPreset.avatarGoogleUrl).toBeNull();
  });
});
