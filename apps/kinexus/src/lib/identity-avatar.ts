/** Allowlisted preset IDs stored in profiles.avatar_url. */
export const AVATAR_PRESET_IDS = [
  'preset:today',
  'preset:calendar',
  'preset:meals',
  'preset:lists',
  'preset:finances',
  'preset:nutrition',
  'preset:train',
  'preset:settings',
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];

export const DEFAULT_AVATAR_PRESET: AvatarPresetId = 'preset:today';

export const AVATAR_PRESET_LABELS: Record<AvatarPresetId, string> = {
  'preset:today': 'Today',
  'preset:calendar': 'Calendar',
  'preset:meals': 'Meals',
  'preset:lists': 'Lists',
  'preset:finances': 'Money',
  'preset:nutrition': 'Nutrition',
  'preset:train': 'Train',
  'preset:settings': 'More',
};

export function isAvatarPresetId(value: string | null | undefined): value is AvatarPresetId {
  if (!value) return false;
  return (AVATAR_PRESET_IDS as readonly string[]).includes(value);
}

/**
 * Map a stored profiles.avatar_url to a safe preset.
 * Legacy http(s)/data/storage URLs and unknown values fall back to the default.
 */
export function resolveAvatarPresetId(stored: string | null | undefined): AvatarPresetId {
  if (isAvatarPresetId(stored)) return stored;
  return DEFAULT_AVATAR_PRESET;
}

/** Display choice for ProfileAvatar — Google URL / Facebook id when opted in, else preset. */
export function resolveAvatarDisplay(input: {
  avatarUrl?: string | null;
  avatarSource?: 'preset' | 'google' | 'facebook' | null;
  avatarGoogleUrl?: string | null;
  avatarFacebookId?: string | null;
}):
  | { kind: 'google'; uri: string; preset: AvatarPresetId }
  | { kind: 'facebook'; facebookId: string; preset: AvatarPresetId }
  | { kind: 'preset'; preset: AvatarPresetId } {
  const preset = resolveAvatarPresetId(input.avatarUrl);
  if (
    input.avatarSource === 'facebook' &&
    typeof input.avatarFacebookId === 'string' &&
    input.avatarFacebookId.trim()
  ) {
    return { kind: 'facebook', facebookId: input.avatarFacebookId.trim(), preset };
  }
  const uri = input.avatarGoogleUrl;
  if (input.avatarSource === 'google' && typeof uri === 'string' && uri.startsWith('https://')) {
    return { kind: 'google', uri, preset };
  }
  return { kind: 'preset', preset };
}

export function normalizeAvatarPresetWrite(value: string | null | undefined): AvatarPresetId | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isAvatarPresetId(trimmed)) {
    throw new Error('Choose an avatar from the list');
  }
  return trimmed;
}
