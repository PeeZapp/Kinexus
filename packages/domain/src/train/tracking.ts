export const TRACKING_TYPES = ['reps', 'time', 'intervals', 'distance'] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const TARGET_UNITS = ['reps', 'sec', 'min', 'km', 'm'] as const;
export type TargetUnit = (typeof TARGET_UNITS)[number];

export type InferTrackingInput = {
  name: string;
  category?: string | null;
  canonicalKey?: string | null;
  /** Catalogue `exercises.instructions` (and custom exercises when present). */
  instructions?: string[] | null;
};

export type TrackingTargetRow = {
  tracking?: TrackingType | null;
  targetUnit?: TargetUnit | null;
  targetSets: number;
  targetReps: string;
  targetDurationSec?: number | null;
  targetDistanceKm?: number | null;
};

export type TrackingTargets = {
  tracking: TrackingType;
  targetUnit: TargetUnit;
  targetSets: number;
  targetReps: string;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
};

const INTERVALS_NAME =
  /\b(planks?|wall\s*sits?|dead\s*hangs?|hangs?|isometrics?|hollows?|l-?sits?|static\s+stretch(?:es)?|holds?)\b/i;
const HOLD_FOR_SEC = /\bhold\s+for\s+\d+(\.\d+)?\s*(sec|secs|seconds)\b/i;
const INTERVAL_ROUNDS = /\b\d+\s*[x×]\s*\d+(\.\d+)?\s*(sec|secs|seconds)\b/i;
const SPRINT_INTERVALS = /\bsprint\s+intervals?\b|\bintervals?\b/i;

const TIME_NAME =
  /\b(walk(?:ing)?|jogs?|jogging|runs?|running|hikes?|hiking|cycles?|cycling|bikes?|biking|treadmills?|ellipticals?|stairs?|stair\s*climbers?|rowings?|rowers?|swims?|swimming|ski\s*ergs?)\b/i;
const FOR_MIN = /\bfor\s+\d+(\.\d+)?\s*(min|mins|minutes)\b/i;

const DISTANCE_KM = /\b\d+(\.\d+)?\s*km\b/i;
const DISTANCE_M = /\b\d+(\.\d+)?\s*m\b(?!\s*(in|inute|inutes))/i;
const FOR_DISTANCE = /\bfor\s+distance\b/i;

export function isTrackingType(value: string | null | undefined): value is TrackingType {
  return value === 'reps' || value === 'time' || value === 'intervals' || value === 'distance';
}

export function trackingTypeFrom(value: string | null | undefined): TrackingType {
  return isTrackingType(value) ? value : 'reps';
}

export function isTargetUnit(value: string | null | undefined): value is TargetUnit {
  return value === 'reps' || value === 'sec' || value === 'min' || value === 'km' || value === 'm';
}

export function unitToTracking(unit: TargetUnit): TrackingType {
  if (unit === 'sec') return 'intervals';
  if (unit === 'min') return 'time';
  if (unit === 'km' || unit === 'm') return 'distance';
  return 'reps';
}

/** Fallback when `target_unit` is missing (pre-migration rows / part-2 surfaces). */
export function trackingToUnit(
  tracking: TrackingType | null | undefined,
  opts?: { targetDistanceKm?: number | null },
): TargetUnit {
  const type = trackingTypeFrom(tracking);
  if (type === 'intervals') return 'sec';
  if (type === 'time') return 'min';
  if (type === 'distance') {
    const km = opts?.targetDistanceKm;
    if (km != null && km > 0 && km < 1 && Math.abs(km * 1000 - Math.round(km * 1000)) < 1e-9) {
      return 'm';
    }
    return 'km';
  }
  return 'reps';
}

export function targetUnitFrom(
  value: string | null | undefined,
  tracking?: TrackingType | null,
  opts?: { targetDistanceKm?: number | null },
): TargetUnit {
  if (isTargetUnit(value)) return value;
  return trackingToUnit(tracking, opts);
}

export function trackingChipLabel(type: TrackingType): string {
  if (type === 'time') return 'Time';
  if (type === 'intervals') return 'Intervals';
  if (type === 'distance') return 'Distance';
  return 'Sets × reps';
}

export function targetUnitLabel(unit: TargetUnit): string {
  return unit;
}

/**
 * Auto-pick unit when an exercise is added.
 * Intervals/sec first, then explicit distance wording, then time/min (cardio), else reps.
 */
export function inferTracking(input: InferTrackingInput): TargetUnit {
  const nameKey = `${input.name} ${input.canonicalKey ?? ''}`.trim();
  const instructions = (input.instructions ?? []).join(' ');
  const haystack = `${nameKey} ${instructions}`.trim();

  if (
    INTERVALS_NAME.test(nameKey) ||
    HOLD_FOR_SEC.test(haystack) ||
    INTERVAL_ROUNDS.test(haystack) ||
    SPRINT_INTERVALS.test(nameKey)
  ) {
    return 'sec';
  }

  if (DISTANCE_KM.test(haystack) || FOR_DISTANCE.test(haystack)) {
    return 'km';
  }
  if (DISTANCE_M.test(haystack)) {
    return 'm';
  }

  if ((input.category ?? '').trim() === 'Cardio' || TIME_NAME.test(nameKey) || FOR_MIN.test(instructions)) {
    return 'min';
  }

  return 'reps';
}

export function defaultTrackingTargets(unit: TargetUnit): TrackingTargets {
  if (unit === 'min') {
    return {
      tracking: 'time',
      targetUnit: 'min',
      targetSets: 1,
      targetReps: '30 min',
      targetDurationSec: 30 * 60,
      targetDistanceKm: null,
    };
  }
  if (unit === 'sec') {
    return {
      tracking: 'intervals',
      targetUnit: 'sec',
      targetSets: 3,
      targetReps: '30 s',
      targetDurationSec: 30,
      targetDistanceKm: null,
    };
  }
  if (unit === 'km') {
    return {
      tracking: 'distance',
      targetUnit: 'km',
      targetSets: 1,
      targetReps: '2 km',
      targetDurationSec: null,
      targetDistanceKm: 2,
    };
  }
  if (unit === 'm') {
    return {
      tracking: 'distance',
      targetUnit: 'm',
      targetSets: 6,
      targetReps: '200 m',
      targetDurationSec: null,
      targetDistanceKm: 0.2,
    };
  }
  return {
    tracking: 'reps',
    targetUnit: 'reps',
    targetSets: 3,
    targetReps: '10',
    targetDurationSec: null,
    targetDistanceKm: null,
  };
}

function formatKm(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000) / 1000);
}

function metresFromKm(km: number): number {
  return Math.max(1, Math.round(km * 1000));
}

function resolveUnit(row: TrackingTargetRow): TargetUnit {
  return targetUnitFrom(row.targetUnit, row.tracking, { targetDistanceKm: row.targetDistanceKm });
}

export function formatTrackingTarget(row: TrackingTargetRow): string {
  const unit = resolveUnit(row);
  const sets = Math.max(1, row.targetSets || 1);

  if (unit === 'min') {
    const minutes =
      row.targetDurationSec != null && row.targetDurationSec > 0
        ? Math.max(1, Math.round(row.targetDurationSec / 60))
        : Number.parseInt(row.targetReps, 10) || 30;
    const amount = sets === 1 ? `${minutes} min` : `${sets} × ${minutes} min`;
    const km = row.targetDistanceKm;
    if (km != null && km > 0) return `${amount} · ${formatKm(km)} km`;
    return amount;
  }

  if (unit === 'sec') {
    const seconds =
      row.targetDurationSec != null && row.targetDurationSec > 0
        ? row.targetDurationSec
        : Number.parseInt(row.targetReps, 10) || 30;
    return `${sets} × ${seconds} s`;
  }

  if (unit === 'km') {
    const km =
      row.targetDistanceKm != null && row.targetDistanceKm > 0
        ? row.targetDistanceKm
        : Number.parseFloat(row.targetReps) || 2;
    return sets === 1 ? `${formatKm(km)} km` : `${sets} × ${formatKm(km)} km`;
  }

  if (unit === 'm') {
    const metres =
      row.targetDistanceKm != null && row.targetDistanceKm > 0
        ? metresFromKm(row.targetDistanceKm)
        : Number.parseInt(row.targetReps, 10) || 200;
    return sets === 1 ? `${metres} m` : `${sets} × ${metres} m`;
  }

  return `${sets} × ${row.targetReps || '–'}`;
}

/** Keep target_sets / target_reps readable for screens not yet on tracking (part 2). */
export function trackingCompatTargets(input: {
  tracking?: TrackingType;
  targetUnit?: TargetUnit;
  targetSets: number;
  targetReps: string;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
}): TrackingTargets {
  const unit =
    input.targetUnit ??
    trackingToUnit(input.tracking, { targetDistanceKm: input.targetDistanceKm });
  const tracking = input.tracking ?? unitToTracking(unit);
  const sets = Math.max(1, Math.min(20, input.targetSets || 1));

  if (unit === 'min') {
    const sec = input.targetDurationSec != null && input.targetDurationSec > 0 ? input.targetDurationSec : 30 * 60;
    const minutes = Math.max(1, Math.round(sec / 60));
    return {
      tracking: 'time',
      targetUnit: 'min',
      targetSets: sets,
      targetReps: `${minutes} min`,
      targetDurationSec: sec,
      targetDistanceKm: input.targetDistanceKm,
    };
  }
  if (unit === 'sec') {
    const sec = input.targetDurationSec != null && input.targetDurationSec > 0 ? input.targetDurationSec : 30;
    return {
      tracking: 'intervals',
      targetUnit: 'sec',
      targetSets: sets,
      targetReps: `${sec} s`,
      targetDurationSec: sec,
      targetDistanceKm: null,
    };
  }
  if (unit === 'km') {
    const km =
      input.targetDistanceKm != null && input.targetDistanceKm > 0 ? input.targetDistanceKm : 2;
    return {
      tracking: 'distance',
      targetUnit: 'km',
      targetSets: sets,
      targetReps: `${formatKm(km)} km`,
      targetDurationSec: null,
      targetDistanceKm: km,
    };
  }
  if (unit === 'm') {
    const km =
      input.targetDistanceKm != null && input.targetDistanceKm > 0
        ? input.targetDistanceKm
        : 0.2;
    const metres = metresFromKm(km);
    return {
      tracking: 'distance',
      targetUnit: 'm',
      targetSets: sets,
      targetReps: `${metres} m`,
      targetDurationSec: null,
      targetDistanceKm: km,
    };
  }
  return {
    tracking: 'reps',
    targetUnit: 'reps',
    targetSets: sets,
    targetReps: input.targetReps,
    targetDurationSec: null,
    targetDistanceKm: null,
  };
}
