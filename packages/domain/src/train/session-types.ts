/**
 * Canonical plan-day session types.
 * A plan day is an intention; a built workout is optional.
 */

export const TRAIN_SESSION_KINDS = ['strength', 'conditioning', 'recovery', 'other'] as const;
export type TrainSessionKind = (typeof TRAIN_SESSION_KINDS)[number];

export type TrainSessionType = {
  id: string;
  label: string;
  kind: TrainSessionKind;
  /** Remix / catalogue categories used when filling a workout. */
  categories: readonly string[];
  /** Prefer duration targets (min / distance) over sets×reps when true. */
  durationBased?: boolean;
};

export const TRAIN_SESSION_TYPES = [
  // Strength / hypertrophy
  { id: 'full_body', label: 'Full Body', kind: 'strength', categories: ['Full Body', 'Core'] },
  { id: 'upper', label: 'Upper', kind: 'strength', categories: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'] },
  { id: 'lower', label: 'Lower', kind: 'strength', categories: ['Legs', 'Glutes', 'Core'] },
  { id: 'upper_push', label: 'Upper Push', kind: 'strength', categories: ['Chest', 'Shoulders', 'Triceps'] },
  { id: 'upper_pull', label: 'Upper Pull', kind: 'strength', categories: ['Back', 'Biceps', 'Shoulders'] },
  { id: 'legs', label: 'Legs', kind: 'strength', categories: ['Legs', 'Glutes', 'Core'] },
  { id: 'push', label: 'Push', kind: 'strength', categories: ['Chest', 'Shoulders', 'Triceps'] },
  { id: 'pull', label: 'Pull', kind: 'strength', categories: ['Back', 'Biceps'] },
  { id: 'chest_tris', label: 'Chest & Triceps', kind: 'strength', categories: ['Chest', 'Triceps'] },
  { id: 'back_bis', label: 'Back & Biceps', kind: 'strength', categories: ['Back', 'Biceps'] },
  { id: 'shoulders', label: 'Shoulders', kind: 'strength', categories: ['Shoulders', 'Core'] },
  { id: 'arms', label: 'Arms', kind: 'strength', categories: ['Biceps', 'Triceps'] },
  { id: 'glutes', label: 'Glutes', kind: 'strength', categories: ['Glutes', 'Legs'] },
  { id: 'core', label: 'Core', kind: 'strength', categories: ['Core'] },

  // Conditioning / cardio (full sessions or in-workout blocks)
  { id: 'walk', label: 'Walk', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'jog', label: 'Jog', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'run', label: 'Run', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'cycle', label: 'Cycle', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'assault_bike', label: 'Assault Bike', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'row', label: 'Row', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'swim', label: 'Swim', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'stair_climber', label: 'Stair Climber', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'elliptical', label: 'Elliptical', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'jump_rope', label: 'Jump Rope', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'hiit', label: 'HIIT', kind: 'conditioning', categories: ['Cardio', 'Plyometrics', 'Full Body'] },
  { id: 'zone2', label: 'Zone 2', kind: 'conditioning', categories: ['Cardio'], durationBased: true },
  { id: 'circuit', label: 'Circuit', kind: 'conditioning', categories: ['Full Body', 'Core', 'Cardio'] },
  { id: 'plyometrics', label: 'Plyometrics', kind: 'conditioning', categories: ['Plyometrics', 'Legs'] },

  // Recovery / other
  { id: 'mobility', label: 'Mobility', kind: 'recovery', categories: ['Mobility'] },
  { id: 'stretch', label: 'Stretch', kind: 'recovery', categories: ['Mobility'] },
  { id: 'active_recovery', label: 'Active Recovery', kind: 'recovery', categories: ['Mobility', 'Cardio'], durationBased: true },
  { id: 'sports', label: 'Sports', kind: 'other', categories: [] },
  { id: 'custom', label: 'Custom', kind: 'other', categories: [] },
] as const satisfies readonly TrainSessionType[];

export type TrainSessionTypeId = (typeof TRAIN_SESSION_TYPES)[number]['id'];

const BY_ID = new Map<string, TrainSessionType>(TRAIN_SESSION_TYPES.map((row) => [row.id, row]));

export function isTrainSessionTypeId(value: string): value is TrainSessionTypeId {
  return BY_ID.has(value);
}

export function trainSessionTypeById(id: string): TrainSessionType | null {
  return BY_ID.get(id) ?? null;
}

export function trainSessionTypesByKind(kind: TrainSessionKind): TrainSessionType[] {
  return TRAIN_SESSION_TYPES.filter((row) => row.kind === kind);
}

/**
 * Preferred catalogue canonical_keys for duration-based session types.
 * Used when filling a single-modality session or adding a cardio block.
 */
export const SESSION_TYPE_EXERCISE_KEYS: Partial<Record<TrainSessionTypeId, readonly string[]>> = {
  walk: ['outdoor walk', 'walking', 'treadmill walking', 'walking on incline treadmill'],
  jog: ['outdoor jog', 'jogging', 'jogging treadmill'],
  run: ['running treadmill', 'outdoor jog', 'jogging'],
  cycle: ['spin bike', 'bike stationary', 'bike cardio stationary', 'bike recumbent'],
  assault_bike: ['assault bike', 'fan bike'],
  row: ['rowing stationary'],
  swim: ['easy swim', 'continuous easy freestyle swim', 'Swimming 50m sprints'],
  stair_climber: ['stairmaster', 'walking on stepmill'],
  elliptical: ['elliptical', 'elliptical trainer', 'walk elliptical cross trainer'],
  jump_rope: ['jump rope', 'Jump rope: basic jumps', 'skipping'],
  zone2: ['outdoor walk', 'treadmill walking', 'bike stationary', 'easy swim', 'rowing stationary'],
  active_recovery: ['outdoor walk', 'easy swim', 'walking'],
};

/** Map a free-form focus label (legacy generate) onto a session type when possible. */
export function resolveSessionTypeFromFocus(focus: string): TrainSessionType | null {
  const normalized = focus.trim().toLowerCase();
  if (!normalized) return null;
  for (const row of TRAIN_SESSION_TYPES) {
    if (row.label.toLowerCase() === normalized || row.id === normalized.replace(/\s+/g, '_')) {
      return row;
    }
  }
  const aliases: Record<string, TrainSessionTypeId> = {
    push: 'push',
    pull: 'pull',
    legs: 'legs',
    upper: 'upper',
    lower: 'lower',
    'full body': 'full_body',
    cardio: 'zone2',
    mobility: 'mobility',
    core: 'core',
  };
  const alias = aliases[normalized];
  return alias ? trainSessionTypeById(alias) : null;
}

export function preferredExerciseKeysForSessionType(id: string): readonly string[] {
  if (!isTrainSessionTypeId(id)) return [];
  return SESSION_TYPE_EXERCISE_KEYS[id] ?? [];
}

/** Default prescription for duration-based modalities. */
export function durationTargetForSessionType(id: string, durationMin = 30): { sets: number; reps: string } {
  const minutes = Math.max(10, Math.min(90, durationMin));
  return { sets: 1, reps: `${minutes} min` };
}

/** True when a target/logged reps string is duration or distance (not count reps). */
export function isDurationTarget(reps: string | null | undefined): boolean {
  const value = (reps ?? '').trim().toLowerCase();
  if (!value) return false;
  if (/^\d+:\d{2}(:\d{2})?$/.test(value)) return true;
  return /^\d+(\.\d+)?\s*(min|mins|minutes|sec|secs|seconds|km|mi|m|hr|hrs|hours)\b/.test(value);
}
