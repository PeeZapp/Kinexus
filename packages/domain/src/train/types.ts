import type { EffortLevel } from './effort';

export type RestExtra = 'off' | 'quiz' | 'memory';

export type CatalogExercise = {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  targetMuscle: string;
};

export type RemixPick = {
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: string;
};

export type LoggedSet = {
  weight: string;
  reps: string;
  done: boolean;
};

export type ExerciseRecord = {
  lastWeight: string;
  lastReps: string;
  bestWeight: string;
  bestReps: string;
};

export type RecordUpdate = ExerciseRecord & {
  isPr: boolean;
};

/** Planned load for an exercise. Weights are stored in kg. */
export type WorkoutExercise = {
  id: string;
  exerciseId: string | null;
  name: string;
  position: number;
  targetSets: number;
  targetReps: string;
  /** Stored kg. Null when unset or using effort only. */
  targetWeight: number | null;
  targetEffort: EffortLevel | null;
  targetRpe: number | null;
  note: string;
  supersetId: string | null;
};

export type WorkoutBuilderSeed = {
  name: string;
  visibility: 'private' | 'household' | 'people';
  personIds: string[];
  splitId: string | null;
  durationMin: number | null;
  exercises: {
    exerciseId: string | null;
    name: string;
    targetSets: number;
    targetReps: string;
    targetWeight?: number | null;
    targetEffort?: EffortLevel | null;
    targetRpe?: number | null;
    note?: string;
    supersetId?: string | null;
  }[];
  notes?: { position: number; body: string }[];
};

export type BuiltExercise = {
  key: string;
  exerciseId: string | null;
  name: string;
  category: string | null;
  targetSets: number;
  targetReps: string;
  targetWeight: number | null;
  targetEffort: EffortLevel | null;
  targetRpe: number | null;
  note: string;
  personalNote: string;
  supersetId: string | null;
};
