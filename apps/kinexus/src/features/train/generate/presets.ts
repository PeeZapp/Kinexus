import type { TrainGeneratePrefs } from '@/src/features/train/generate/types';

export type TrainGeneratePreset = {
  id: string;
  name: string;
  prefs: Partial<TrainGeneratePrefs>;
};

export const TRAIN_GENERATE_PRESETS: TrainGeneratePreset[] = [
  {
    id: 'beginner_3_fb',
    name: '3-day beginner full body',
    prefs: {
      goal: 'hypertrophy',
      level: 'beginner',
      daysPerWeek: 3,
      days: ['monday', 'wednesday', 'friday'],
      durationMin: 40,
      splitStyle: 'full_body',
      equipment: ['bodyweight', 'dumbbells', 'barbell'],
      preferSavedWorkouts: false,
      cardioAddon: 'none',
      progressiveOverload: true,
      intensityRpe: 7,
    },
  },
  {
    id: 'ppl_6',
    name: 'PPL 6-day',
    prefs: {
      goal: 'hypertrophy',
      level: 'intermediate',
      daysPerWeek: 6,
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      durationMin: 50,
      splitStyle: 'ppl',
      equipment: ['barbell', 'dumbbells', 'cable', 'machines'],
      preferSavedWorkouts: false,
      cardioAddon: 'finisher',
      progressiveOverload: true,
      intensityRpe: 8,
    },
  },
  {
    id: 'home_db_4',
    name: 'Home dumbbell 4-day',
    prefs: {
      goal: 'hypertrophy',
      level: 'beginner',
      daysPerWeek: 4,
      days: ['monday', 'tuesday', 'thursday', 'friday'],
      durationMin: 40,
      splitStyle: 'upper_lower',
      equipment: ['dumbbells', 'bodyweight', 'bands'],
      gymProfile: 'home',
      preferSavedWorkouts: true,
      cardioAddon: 'none',
      progressiveOverload: true,
      intensityRpe: 7,
    },
  },
];
