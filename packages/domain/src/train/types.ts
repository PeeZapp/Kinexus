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
