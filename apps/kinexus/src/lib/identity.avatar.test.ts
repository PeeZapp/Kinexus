import { describe, expect, it } from 'vitest';

import {
  AVATAR_PRESET_IDS,
  DEFAULT_AVATAR_PRESET,
  isAvatarPresetId,
  normalizeAvatarPresetWrite,
  resolveAvatarPresetId,
} from './identity-avatar';

describe('avatar presets', () => {
  it('recognises allowlisted preset ids', () => {
    for (const id of AVATAR_PRESET_IDS) {
      expect(isAvatarPresetId(id)).toBe(true);
    }
    expect(isAvatarPresetId('preset:unknown')).toBe(false);
    expect(isAvatarPresetId(null)).toBe(false);
  });

  it('falls back legacy urls and data urls to the default preset', () => {
    expect(resolveAvatarPresetId(null)).toBe(DEFAULT_AVATAR_PRESET);
    expect(resolveAvatarPresetId('https://lh3.googleusercontent.com/a/x')).toBe(DEFAULT_AVATAR_PRESET);
    expect(resolveAvatarPresetId('data:image/png;base64,aaa')).toBe(DEFAULT_AVATAR_PRESET);
    expect(
      resolveAvatarPresetId(
        'https://proj.supabase.co/storage/v1/object/public/profile-avatars/u/1.webp',
      ),
    ).toBe(DEFAULT_AVATAR_PRESET);
    expect(resolveAvatarPresetId('preset:meals')).toBe('preset:meals');
  });

  it('rejects arbitrary writes client-side', () => {
    expect(normalizeAvatarPresetWrite(null)).toBeNull();
    expect(normalizeAvatarPresetWrite('')).toBeNull();
    expect(normalizeAvatarPresetWrite('preset:train')).toBe('preset:train');
    expect(() => normalizeAvatarPresetWrite('https://evil.example/x.png')).toThrow(/avatar/i);
    expect(() => normalizeAvatarPresetWrite('data:image/png;base64,aaa')).toThrow(/avatar/i);
    // Client profile updates only accept presets; unfinished Google avatar columns are out of scope.
    expect(() => normalizeAvatarPresetWrite('https://lh3.googleusercontent.com/a/x')).toThrow(/avatar/i);
  });
});
