/** Standard emoji logos for household settings (no photo uploads). */
export const HOUSEHOLD_EMOJIS = [
  '🏠',
  '🏡',
  '👨‍👩‍👧‍👦',
  '👨‍👩‍👧',
  '👪',
  '🐶',
  '🐱',
  '🌲',
  '☀️',
  '🌊',
  '⚽',
  '🎮',
  '🍕',
  '☕',
  '✈️',
  '🎵',
  '📚',
  '🔥',
  '🌟',
  '🌈',
  '🏔️',
  '🚲',
  '🎯',
  '🧩',
] as const;

export const DEFAULT_HOUSEHOLD_EMOJI = '🏠';

export type HouseholdEmoji = (typeof HOUSEHOLD_EMOJIS)[number];

export function normalizeHouseholdEmoji(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (trimmed && (HOUSEHOLD_EMOJIS as readonly string[]).includes(trimmed)) return trimmed;
  return DEFAULT_HOUSEHOLD_EMOJI;
}
