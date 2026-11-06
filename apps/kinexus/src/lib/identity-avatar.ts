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

export function normalizeAvatarPresetWrite(value: string | null | undefined): AvatarPresetId | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isAvatarPresetId(trimmed)) {
    throw new Error('Choose an avatar from the list');
  }
  return trimmed;
}
