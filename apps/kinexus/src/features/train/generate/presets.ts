import type { TrainGeneratePrefs } from '@/src/features/train/generate/types';

export type TrainGeneratePreset = {
  id: string;
  name: string;
  prefs: Partial<TrainGeneratePrefs>;
};

export const TRAIN_GENERATE_PRESETS: TrainGeneratePreset[] = [
  {
    id: 'consistent_3',
    name: 'Stay consistent',
    prefs: {
      goal: 'hypertrophy',
      level: 'beginner',
      daysPerWeek: 3,
      days: ['monday', 'wednesday', 'friday'],
      durationMin: 40,
      splitStyle: 'full_body',
      fillWorkouts: false,
      preferSavedWorkouts: false,
      cardioAddon: 'none',
    },
  },
  {
    id: 'build_4',
    name: 'Build a bit',
    prefs: {
      goal: 'hypertrophy',
      level: 'intermediate',
      daysPerWeek: 4,
      days: ['monday', 'tuesday', 'thursday', 'friday'],
      durationMin: 45,
      splitStyle: 'upper_lower',
      fillWorkouts: false,
      preferSavedWorkouts: false,
      cardioAddon: 'none',
    },
  },
  {
    id: 'ppl_6',
    name: 'Push / Pull / Legs',
    prefs: {
      goal: 'hypertrophy',
      level: 'intermediate',
      daysPerWeek: 6,
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      durationMin: 50,
      splitStyle: 'ppl',
      fillWorkouts: false,
      preferSavedWorkouts: false,
      cardioAddon: 'none',
    },
  },
  {
    id: 'strength_walks',
    name: 'Strength + walks',
    prefs: {
      goal: 'strength',
      level: 'beginner',
      daysPerWeek: 5,
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      durationMin: 40,
      splitStyle: 'full_body',
      fillWorkouts: false,
      preferSavedWorkouts: false,
      cardioAddon: 'separate_days',
    },
  },
];
