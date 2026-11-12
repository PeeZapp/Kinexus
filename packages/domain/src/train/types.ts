import type { EffortLevel } from './effort';
import type { TargetUnit, TrackingType } from './tracking';

export type RestExtra = 'off' | 'quiz' | 'memory';

export type CatalogExercise = {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  targetMuscle: string;
  /** Catalogue slug used for modality matching (walk, assault bike, …). */
  canonicalKey?: string | null;
  /** Explicit REMIX category; when set, wins over heuristics. */
  category?: string | null;
  /** When set, wins over the compound-name heuristic. */
  isCompound?: boolean | null;
  /** Catalogue / custom exercise steps when present. */
  instructions?: string[] | null;
};

export type RemixPick = {
  exerciseId: string;
  name: string;
  tracking?: TrackingType;
  targetUnit?: TargetUnit;
  targetSets: number;
  targetReps: string;
  targetDurationSec?: number | null;
  targetDistanceKm?: number | null;
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
  /** Defaults to reps when omitted (legacy rows / part-2 surfaces). */
  tracking?: TrackingType;
  targetUnit?: TargetUnit;
  targetSets: number;
  targetReps: string;
  /** Seconds: total for time/min, per-round for intervals/sec. */
  targetDurationSec?: number | null;
  targetDistanceKm?: number | null;
  /** Stored kg. Null when unset or using effort only. */
  targetWeight: number | null;
  targetEffort: EffortLevel | null;
  targetRpe: number | null;
  note: string;
  supersetId: string | null;
};

export type WorkoutBuilderSeed = {
  name: string;
  visibility: 'private' | 'household' | 'people' | 'buddies' | 'buddies_selected' | 'global';
  personIds: string[];
  buddyUserIds?: string[];
  splitId: string | null;
  durationMin: number | null;
  exercises: {
    exerciseId: string | null;
    name: string;
    tracking?: TrackingType;
    targetUnit?: TargetUnit;
    targetSets: number;
    targetReps: string;
    targetDurationSec?: number | null;
    targetDistanceKm?: number | null;
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
  tracking?: TrackingType;
  targetUnit?: TargetUnit;
  targetSets: number;
  targetReps: string;
  targetDurationSec?: number | null;
  targetDistanceKm?: number | null;
  targetWeight: number | null;
  targetEffort: EffortLevel | null;
  targetRpe: number | null;
  note: string;
  personalNote: string;
  supersetId: string | null;
};
