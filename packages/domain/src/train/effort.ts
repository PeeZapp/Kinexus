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

/** Builder intensity guide: load (weights) vs effort (cardio / body-intensity). */
export type ExerciseGuideKind = 'load' | 'effort';

export type GuideOption = {
  level: Exclude<EffortLevel, 'max'>;
  label: string;
};

/** Light / Medium / Heavy for weighted work. */
export const LOAD_GUIDE_OPTIONS: readonly GuideOption[] = [
  { level: 'light', label: 'Light' },
  { level: 'moderate', label: 'Medium' },
  { level: 'heavy', label: 'Heavy' },
];

/** Light / Medium / Hard for cardio and similar. */
export const EFFORT_GUIDE_OPTIONS: readonly GuideOption[] = [
  { level: 'light', label: 'Light' },
  { level: 'moderate', label: 'Medium' },
  { level: 'heavy', label: 'Hard' },
];

const EFFORT_GUIDE_CATEGORIES = new Set(['Cardio', 'Mobility', 'Plyometrics']);

export function exerciseGuideKind(category: string | null | undefined): ExerciseGuideKind {
  if (category && EFFORT_GUIDE_CATEGORIES.has(category)) return 'effort';
  return 'load';
}

export function guideOptionsFor(kind: ExerciseGuideKind): readonly GuideOption[] {
  return kind === 'effort' ? EFFORT_GUIDE_OPTIONS : LOAD_GUIDE_OPTIONS;
}

export function guideTitleFor(kind: ExerciseGuideKind): string {
  return kind === 'effort' ? 'Effort' : 'Load';
}

export function effortLevelFrom(value: unknown): EffortLevel | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return (EFFORT_LEVELS as readonly string[]).includes(key) ? (key as EffortLevel) : null;
}
