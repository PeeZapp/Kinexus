import type { Day, GeneratedTrainDay, TrainGlobalGoal, TrainGlobalLevel } from '@kinexus/domain';

export type TrainSplitStyle = 'auto' | 'full_body' | 'upper_lower' | 'ppl' | 'bro' | 'custom';

export const TRAIN_SPLIT_STYLE_OPTIONS: { id: TrainSplitStyle; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'full_body', label: 'Full body' },
  { id: 'upper_lower', label: 'Upper / Lower' },
  { id: 'ppl', label: 'Push / Pull / Legs' },
  { id: 'bro', label: 'Bro split' },
];

export type TrainGenerateAudience = 'me' | 'household' | 'buddies';

export type CardioAddon = 'none' | 'finisher' | 'separate_days';

export type GymProfileId = 'home' | 'work' | null;

export type TrainGeneratePrefs = {
  goal: TrainGlobalGoal;
  level: TrainGlobalLevel;
  daysPerWeek: number;
  days: Day[];
  dayTimes: Partial<Record<Day, string>>;
  durationMin: number;
  splitStyle: TrainSplitStyle;
  customFocusByDay: Partial<Record<Day, string>>;
  focusWeights: Record<string, number>;
  equipment: string[];
  gymProfile: GymProfileId;
  gymProfiles: { home: string[]; work: string[] };
  avoidBodyParts: string[];
  avoidExerciseIds: string[];
  intensityRpe: number | null;
  progressiveOverload: boolean;
  cardioAddon: CardioAddon;
  preferSavedWorkouts: boolean;
  /** When false, plan days are intents only (no generated exercises / workouts). */
  fillWorkouts: boolean;
  audience: TrainGenerateAudience;
  buddyUserIds: string[];
};

export type PreviewDay = GeneratedTrainDay & {
  scheduledTime: string | null;
  seed: number;
};

export const DEFAULT_TRAIN_GENERATE_PREFS: TrainGeneratePrefs = {
  goal: 'hypertrophy',
  level: 'intermediate',
  daysPerWeek: 3,
  days: ['monday', 'wednesday', 'friday'],
  dayTimes: {},
  durationMin: 40,
  splitStyle: 'auto',
  customFocusByDay: {},
  focusWeights: {},
  equipment: [],
  gymProfile: null,
  gymProfiles: { home: ['dumbbells', 'bodyweight', 'bands'], work: ['machines', 'cable', 'dumbbells'] },
  avoidBodyParts: [],
  avoidExerciseIds: [],
  intensityRpe: null,
  progressiveOverload: true,
  cardioAddon: 'none',
  preferSavedWorkouts: false,
  fillWorkouts: false,
  audience: 'me',
  buddyUserIds: [],
};

export function parseGeneratePrefs(raw: Record<string, unknown> | null | undefined): TrainGeneratePrefs {
  const base = { ...DEFAULT_TRAIN_GENERATE_PREFS };
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    days: Array.isArray(raw.days) ? (raw.days as Day[]) : base.days,
    dayTimes: raw.dayTimes && typeof raw.dayTimes === 'object' ? (raw.dayTimes as TrainGeneratePrefs['dayTimes']) : base.dayTimes,
    customFocusByDay:
      raw.customFocusByDay && typeof raw.customFocusByDay === 'object'
        ? (raw.customFocusByDay as TrainGeneratePrefs['customFocusByDay'])
        : base.customFocusByDay,
    focusWeights:
      raw.focusWeights && typeof raw.focusWeights === 'object'
        ? (raw.focusWeights as Record<string, number>)
        : base.focusWeights,
    equipment: Array.isArray(raw.equipment) ? (raw.equipment as string[]) : base.equipment,
    gymProfiles:
      raw.gymProfiles && typeof raw.gymProfiles === 'object'
        ? {
            home: Array.isArray((raw.gymProfiles as { home?: unknown }).home)
              ? ((raw.gymProfiles as { home: string[] }).home)
              : base.gymProfiles.home,
            work: Array.isArray((raw.gymProfiles as { work?: unknown }).work)
              ? ((raw.gymProfiles as { work: string[] }).work)
              : base.gymProfiles.work,
          }
        : base.gymProfiles,
    avoidBodyParts: Array.isArray(raw.avoidBodyParts) ? (raw.avoidBodyParts as string[]) : base.avoidBodyParts,
    avoidExerciseIds: Array.isArray(raw.avoidExerciseIds) ? (raw.avoidExerciseIds as string[]) : base.avoidExerciseIds,
    buddyUserIds: Array.isArray(raw.buddyUserIds) ? (raw.buddyUserIds as string[]) : base.buddyUserIds,
  } as TrainGeneratePrefs;
}
