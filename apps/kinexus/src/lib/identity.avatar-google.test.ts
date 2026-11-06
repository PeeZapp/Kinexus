import { describe, expect, it } from 'vitest';

import { resolveAvatarDisplay, resolveAvatarPresetId } from './identity-avatar';
import { mapOwnIdentity } from './identity-own';

describe('google avatar display tolerance', () => {
  it('maps google source with https url and falls back when url missing', () => {
    const withGoogle = mapOwnIdentity({
      id: '11111111-1111-1111-1111-111111111111',
      global_handle: 'Swift-Oak-42',
      username: null,
      username_changed_at: null,
      display_name: 'Pat',
      avatar_url: 'preset:meals',
      avatar_source: 'google',
      avatar_google_url: 'https://lh3.googleusercontent.com/a/photo',
      is_verified_creator: false,
    });
    expect(withGoogle.avatarSource).toBe('google');
    expect(withGoogle.avatarGoogleUrl).toBe('https://lh3.googleusercontent.com/a/photo');
    expect(resolveAvatarPresetId(withGoogle.avatarUrl)).toBe('preset:meals');

    const missingUrl = mapOwnIdentity({
      id: '11111111-1111-1111-1111-111111111111',
      global_handle: 'Swift-Oak-42',
      username: null,
      username_changed_at: null,
      display_name: 'Pat',
      avatar_url: 'preset:train',
      avatar_source: 'google',
      avatar_google_url: null,
      is_verified_creator: false,
    });
    expect(missingUrl.avatarSource).toBe('preset');
    expect(missingUrl.avatarGoogleUrl).toBeNull();
  });

  it('resolveAvatarDisplay prefers google then preset fallback', () => {
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

    expect(
      resolveAvatarDisplay({
        avatarUrl: 'preset:lists',
        avatarSource: 'google',
        avatarGoogleUrl: null,
      }),
    ).toEqual({ kind: 'preset', preset: 'preset:lists' });
  });

  it('preset switch path uses avatar_url write only (clears google server-side)', () => {
    // Client never writes avatar_source/avatar_google_url; selecting a preset
    // goes through saveOwnAvatarPreset → update avatar_url only.
    const afterPreset = mapOwnIdentity({
      id: '11111111-1111-1111-1111-111111111111',
      global_handle: 'Swift-Oak-42',
      username: null,
      username_changed_at: null,
      display_name: 'Pat',
      avatar_url: 'preset:today',
      avatar_source: 'preset',
      avatar_google_url: null,
      is_verified_creator: false,
    });
    expect(afterPreset.avatarSource).toBe('preset');
    expect(afterPreset.avatarGoogleUrl).toBeNull();
    expect(afterPreset.avatarUrl).toBe('preset:today');
  });
});
