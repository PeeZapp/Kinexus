export type EffortLevel = 'light' | 'moderate' | 'heavy' | 'max';

export const EFFORT_LEVELS = ['light', 'moderate', 'heavy', 'max'] as const;

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
  max: 'Max',
};

export const EFFORT_COLOR: Record<EffortLevel, string> = {
  light: '#22C55E',
  moderate: '#3B82F6',
  heavy: '#F59E0B',
  max: '#EF4444',
};

export function effortLevelFrom(value: unknown): EffortLevel | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return (EFFORT_LEVELS as readonly string[]).includes(key) ? (key as EffortLevel) : null;
}
