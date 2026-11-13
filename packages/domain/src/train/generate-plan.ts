import { DAYS, type Day } from '../meals/types';
import type { TrainGlobalGoal, TrainGlobalLevel } from './library';
import {
  generateFromCategoryMix,
  getRemixDefaultsForCategory,
  isCompoundExercise,
  remixCategoryOf,
  type RemixCategory,
} from './remix';
export { isCompoundExercise } from './remix';
import {
  defaultTargetFor,
  progressionStepForLevel,
  type TargetUnit,
  type TrackingType,
} from './tracking';
import type { CatalogExercise, RemixPick } from './types';
import { exerciseEquipmentMatches, normalizeExerciseEquipment } from './equipment';
import {
  displayFocusLabel,
  fillWorkoutFromSessionType,
  sessionTypeIdFromFocus,
} from './workout-templates';

/** Muscle / focus groups used for recovery and weekly caps. */
export type TrainFocus =
  | 'Upper'
  | 'Lower'
  | 'Push'
  | 'Pull'
  | 'Legs'
  | 'Full Body'
  | 'Cardio'
  | 'Mobility'
  | 'Core';

export type GeneratePlanGoal = TrainGlobalGoal;
export type GeneratePlanLevel = TrainGlobalLevel;

export type SavedWorkoutCandidate = {
  id: string;
  name: string;
  /** Focus labels this workout can cover (e.g. Upper, Push). */
  focus: readonly string[];
  durationMin: number | null;
  exerciseIds: readonly string[];
};

export type TrainSplitStyleId = 'auto' | 'full_body' | 'upper_lower' | 'ppl' | 'bro' | 'custom';

export type GeneratePlanInput = {
  /** Training sessions per week (2–6). Ignored when `days` is provided. */
  daysPerWeek: number;
  /** Explicit training days. When set, overrides daysPerWeek placement. */
  days?: readonly Day[];
  goal: GeneratePlanGoal;
  level: GeneratePlanLevel;
  durationMin: number;
  /** When set, overrides auto focus sequence from daysPerWeek × goal. */
  splitStyle?: TrainSplitStyleId | string | null;
  /** Per-day focus overrides (session-type or legacy labels). */
  focusByDay?: Partial<Record<Day, string>>;
  /** Allowed equipment strings; empty/omitted = all. */
  equipment?: readonly string[];
  /** Catalogue exercise ids to never pick. */
  avoidExerciseIds?: readonly string[];
  allowDuplicates?: boolean;
  preferSavedWorkouts?: boolean;
  savedWorkouts?: readonly SavedWorkoutCandidate[];
  catalogue: readonly CatalogExercise[];
  /** Seeded PRNG — same seed → same plan. */
  seed: number;
};

export type GeneratedTrainExercise = {
  exerciseId: string;
  name: string;
  tracking: TrackingType;
  targetUnit: TargetUnit;
  targetSets: number;
  targetReps: string;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
  targetRpe: number;
  category: RemixCategory | null;
};

export type GeneratedTrainDay = {
  day: Day;
  restDay: boolean;
  focus: string[];
  durationMin: number;
  exercises: GeneratedTrainExercise[];
  workoutId: string | null;
  explanation: string;
};

type Prescription = { sets: number; reps: string; rpe: number };

/** Extends CATEGORY_DEFAULTS with goal × level sets / reps / RPE. */
const GOAL_LEVEL_RX: Record<GeneratePlanGoal, Record<GeneratePlanLevel, Prescription>> = {
  strength: {
    beginner: { sets: 3, reps: '5-8', rpe: 7 },
    intermediate: { sets: 4, reps: '3-6', rpe: 8 },
    advanced: { sets: 5, reps: '1-5', rpe: 9 },
  },
  hypertrophy: {
    beginner: { sets: 3, reps: '8-12', rpe: 7 },
    intermediate: { sets: 4, reps: '8-12', rpe: 8 },
    advanced: { sets: 4, reps: '6-12', rpe: 8 },
  },
  conditioning: {
    beginner: { sets: 3, reps: '12-15', rpe: 6 },
    intermediate: { sets: 3, reps: '15-20', rpe: 7 },
    advanced: { sets: 4, reps: '12-20', rpe: 8 },
  },
  mobility: {
    beginner: { sets: 2, reps: '30s', rpe: 5 },
    intermediate: { sets: 2, reps: '45s', rpe: 5 },
    advanced: { sets: 3, reps: '60s', rpe: 6 },
  },
  fat_loss: {
    beginner: { sets: 3, reps: '10-15', rpe: 7 },
    intermediate: { sets: 3, reps: '12-15', rpe: 7 },
    advanced: { sets: 4, reps: '10-15', rpe: 8 },
  },
};

/** Soft weekly set targets per recovery muscle group, by level. */
const WEEKLY_VOLUME_TARGET: Record<GeneratePlanLevel, number> = {
  beginner: 8,
  intermediate: 12,
  advanced: 16,
};

const MAX_SESSIONS_PER_GROUP: Record<GeneratePlanLevel, number> = {
  beginner: 2,
  intermediate: 3,
  advanced: 4,
};

const FOCUS_CATEGORIES: Record<TrainFocus, readonly RemixCategory[]> = {
  Upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  Lower: ['Legs', 'Glutes', 'Core'],
  Push: ['Chest', 'Shoulders', 'Triceps'],
  Pull: ['Back', 'Biceps'],
  Legs: ['Legs', 'Glutes'],
  'Full Body': ['Full Body', 'Chest', 'Back', 'Legs', 'Shoulders'],
  Cardio: ['Cardio'],
  Mobility: ['Mobility'],
  Core: ['Core'],
};

/** Primary recovery tag per category / focus label. */
const RECOVERY_GROUP: Record<string, string> = {
  Chest: 'push',
  Shoulders: 'push',
  Triceps: 'push',
  Push: 'push',
  Back: 'pull',
  Biceps: 'pull',
  Pull: 'pull',
  Legs: 'legs',
  Glutes: 'legs',
  Lower: 'legs',
};

/** Focus labels may tax multiple recovery groups (Upper hits push+pull). */
const FOCUS_RECOVERY_GROUPS: Record<string, readonly string[]> = {
  Upper: ['push', 'pull'],
  Lower: ['legs'],
  Push: ['push'],
  Pull: ['pull'],
  Legs: ['legs'],
  'Full Body': ['push', 'pull', 'legs'],
  Cardio: ['cardio'],
  Mobility: ['mobility'],
  Core: ['core'],
};

const DAY_INDEX: Record<Day, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function isTrainFocus(value: string): value is TrainFocus {
  return value in FOCUS_CATEGORIES;
}

/** Split template: ordered focuses for N training days given goal. */
export function splitTemplateFor(daysPerWeek: number, goal: GeneratePlanGoal): TrainFocus[] {
  const n = Math.max(2, Math.min(6, Math.round(daysPerWeek)));
  if (goal === 'mobility') {
    return Array.from({ length: n }, () => 'Mobility' as const);
  }
  if (goal === 'conditioning' || goal === 'fat_loss') {
    if (n <= 2) return ['Full Body', 'Cardio'];
    if (n === 3) return ['Full Body', 'Cardio', 'Full Body'];
    if (n === 4) return ['Full Body', 'Cardio', 'Full Body', 'Cardio'];
    if (n === 5) return ['Full Body', 'Cardio', 'Full Body', 'Cardio', 'Core'];
    return ['Full Body', 'Cardio', 'Full Body', 'Cardio', 'Full Body', 'Cardio'];
  }
  // strength / hypertrophy
  if (n === 2) return ['Full Body', 'Full Body'];
  if (n === 3) return ['Push', 'Pull', 'Legs'];
  if (n === 4) return ['Upper', 'Lower', 'Upper', 'Lower'];
  if (n === 5) return ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
  return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
}

/**
 * Ordered focus labels for N training days from a named split.
 * Labels are session-type vocabulary (or legacy generate focuses).
 */
export function focusSequenceForSplit(
  style: string | null | undefined,
  daysPerWeek: number,
  goal: GeneratePlanGoal = 'hypertrophy',
): string[] {
  const n = Math.max(1, Math.min(7, Math.round(daysPerWeek)));
  if (style === 'full_body') return Array.from({ length: n }, () => 'Full Body');
  if (style === 'upper_lower') {
    return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'Upper' : 'Lower'));
  }
  if (style === 'ppl') {
    const cycle = ['Push', 'Pull', 'Legs'] as const;
    return Array.from({ length: n }, (_, i) => cycle[i % 3]!);
  }
  if (style === 'bro') {
    const cycle = ['Chest & Triceps', 'Back & Biceps', 'Legs', 'Shoulders', 'Arms'] as const;
    return Array.from({ length: n }, (_, i) => cycle[i % cycle.length]!);
  }
  if (n === 1) {
    if (goal === 'mobility') return ['Mobility'];
    if (goal === 'conditioning' || goal === 'fat_loss') return ['Full Body'];
    return ['Full Body'];
  }
  return splitTemplateFor(n, goal);
}

/** Map free-form / session-type labels onto recovery-aware TrainFocus values. */
export function coerceTrainFocus(label: string): TrainFocus {
  if (isTrainFocus(label)) return label;
  const id = sessionTypeIdFromFocus(label);
  switch (id) {
    case 'upper_push':
    case 'push':
    case 'chest_tris':
    case 'shoulders':
      return 'Push';
    case 'upper_pull':
    case 'pull':
    case 'back_bis':
      return 'Pull';
    case 'legs':
    case 'lower':
    case 'glutes':
      return 'Legs';
    case 'upper':
    case 'arms':
      return 'Upper';
    case 'full_body':
    case 'circuit':
      return 'Full Body';
    case 'core':
      return 'Core';
    case 'mobility':
    case 'stretch':
    case 'active_recovery':
      return 'Mobility';
    case 'walk':
    case 'jog':
    case 'run':
    case 'cycle':
    case 'assault_bike':
    case 'row':
    case 'swim':
    case 'stair_climber':
    case 'elliptical':
    case 'jump_rope':
    case 'hiit':
    case 'zone2':
    case 'plyometrics':
      return 'Cardio';
    default:
      return 'Full Body';
  }
}

/** Intent-only week: real session types on training days, no exercises. */
export function buildIntentWeekDays(input: {
  trainingDays: readonly Day[];
  durationMin: number;
  goal?: GeneratePlanGoal;
  splitStyle?: string | null;
  customFocusByDay?: Partial<Record<Day, string>>;
}): GeneratedTrainDay[] {
  const preferred = new Set(input.trainingDays);
  const ordered = DAYS.filter((day) => preferred.has(day));
  const sequence = focusSequenceForSplit(
    input.splitStyle,
    ordered.length,
    input.goal ?? 'hypertrophy',
  );
  let index = 0;
  return DAYS.map((day) => {
    if (!preferred.has(day)) {
      return {
        day,
        restDay: true,
        focus: [],
        durationMin: 0,
        exercises: [],
        workoutId: null,
        explanation: 'Rest',
      };
    }
    const raw = input.customFocusByDay?.[day] ?? sequence[index++] ?? 'Full Body';
    const label = displayFocusLabel(raw);
    return {
      day,
      restDay: false,
      focus: [label],
      durationMin: input.durationMin,
      exercises: [],
      workoutId: null,
      explanation: label,
    };
  });
}

/** Spread N sessions across the week with gaps when possible. */
export function pickTrainingDays(daysPerWeek: number, random: () => number = () => 0): Day[] {
  const n = Math.max(1, Math.min(7, Math.round(daysPerWeek)));
  if (n >= 7) return [...DAYS];
  const patterns: Record<number, Day[][]> = {
    1: [['wednesday'], ['monday'], ['friday']],
    2: [
      ['monday', 'thursday'],
      ['tuesday', 'friday'],
      ['monday', 'friday'],
    ],
    3: [
      ['monday', 'wednesday', 'friday'],
      ['tuesday', 'thursday', 'saturday'],
    ],
    4: [
      ['monday', 'tuesday', 'thursday', 'friday'],
      ['monday', 'wednesday', 'friday', 'saturday'],
    ],
    5: [
      ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
      ['monday', 'tuesday', 'thursday', 'friday', 'saturday'],
    ],
    6: [
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'],
    ],
  };
  const options = patterns[n] ?? [['monday', 'wednesday', 'friday']];
  const pick = options[Math.floor(random() * options.length) % options.length];
  return pick ? [...pick] : ['monday', 'wednesday', 'friday'];
}

export function prescriptionFor(
  goal: GeneratePlanGoal,
  level: GeneratePlanLevel,
  category: string | null,
): Prescription {
  const base = GOAL_LEVEL_RX[goal][level];
  if (!category) return { ...base };
  const catDefaults = getRemixDefaultsForCategory(category);
  // Goal × level owns sets/reps/RPE; category defaults only tune endurance-style work.
  if (category === 'Cardio' || category === 'Mobility') {
    return {
      sets: Math.min(base.sets, catDefaults.sets),
      reps: catDefaults.reps,
      rpe: Math.min(base.rpe, 6),
    };
  }
  return { ...base };
}

export function compoundFirstOrder<T extends { name: string; exerciseId: string }>(
  picks: readonly T[],
  byId: ReadonlyMap<string, CatalogExercise>,
): T[] {
  return [...picks].sort((a, b) => {
    const ea = byId.get(a.exerciseId);
    const eb = byId.get(b.exerciseId);
    const ca = ea ? (isCompoundExercise(ea) ? 0 : 1) : 1;
    const cb = eb ? (isCompoundExercise(eb) ? 0 : 1) : 1;
    return ca - cb;
  });
}

function recoveryGroupsForFocus(focus: readonly string[]): Set<string> {
  const groups = new Set<string>();
  for (const label of focus) {
    const multi = FOCUS_RECOVERY_GROUPS[label];
    if (multi) {
      for (const g of multi) groups.add(g);
      continue;
    }
    const mapped = RECOVERY_GROUP[label];
    if (mapped) groups.add(mapped);
    if (isTrainFocus(label)) {
      for (const cat of FOCUS_CATEGORIES[label]) {
        const g = RECOVERY_GROUP[cat];
        if (g) groups.add(g);
      }
    }
  }
  return groups;
}

function filterCatalogue(
  catalogue: readonly CatalogExercise[],
  equipment: readonly string[] | undefined,
  avoid: ReadonlySet<string>,
): CatalogExercise[] {
  const allowedEq = equipment?.length
    ? new Set(equipment.map((e) => normalizeExerciseEquipment(e)).filter(Boolean))
    : null;
  return catalogue.filter((ex) => {
    if (avoid.has(ex.id)) return false;
    if (!allowedEq) return true;
    return exerciseEquipmentMatches(ex.equipment, allowedEq);
  });
}

function categoriesForFocus(focus: readonly string[]): RemixCategory[] {
  const out: RemixCategory[] = [];
  for (const label of focus) {
    if (isTrainFocus(label)) {
      for (const cat of FOCUS_CATEGORIES[label]) {
        if (!out.includes(cat)) out.push(cat);
      }
    }
  }
  return out.length > 0 ? out : ['Full Body'];
}

function savedFitsFocus(workout: SavedWorkoutCandidate, focus: readonly string[]): boolean {
  if (workout.focus.length === 0) return false;
  const want = new Set(focus.map((f) => f.toLowerCase()));
  return workout.focus.some((f) => want.has(f.toLowerCase()));
}

function volumeCategory(ex: CatalogExercise): string {
  const cat = remixCategoryOf(ex);
  if (!cat) return 'other';
  return RECOVERY_GROUP[cat] ?? cat;
}

/**
 * Rules-based weekly train plan. Pure — no DB. Pool may include custom exercises
 * (optional category / isCompound on CatalogExercise).
 */
export function generateTrainPlan(input: GeneratePlanInput): GeneratedTrainDay[] {
  const random = mulberry32(input.seed);
  const avoid = new Set(input.avoidExerciseIds ?? []);
  const allowDup = input.allowDuplicates === true;
  const pool = filterCatalogue(input.catalogue, input.equipment, avoid);
  const byId = new Map(pool.map((ex) => [ex.id, ex]));

  const trainingDays = (
    input.days && input.days.length > 0
      ? [...input.days]
      : pickTrainingDays(input.daysPerWeek, random)
  ).sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);

  const sequenceLabels = focusSequenceForSplit(input.splitStyle, trainingDays.length, input.goal);
  const focuses = sequenceLabels.map((label) => coerceTrainFocus(label));
  const maxSessions = MAX_SESSIONS_PER_GROUP[input.level];
  const volumeTarget = WEEKLY_VOLUME_TARGET[input.level];

  const usedExerciseIds = new Set<string>();
  const groupSessionCounts = new Map<string, number>();
  const groupLastDay = new Map<string, Day>();
  const weeklySets = new Map<string, number>();
  const usedSaved = new Set<string>();

  const dayFocus = new Map<Day, TrainFocus | null>();
  const dayFocusLabel = new Map<Day, string>();
  const dayRecoveryNote = new Map<Day, string>();

  for (let i = 0; i < trainingDays.length; i += 1) {
    const day = trainingDays[i]!;
    const override = input.focusByDay?.[day]?.trim();
    const preferredLabel = override || sequenceLabels[i] || 'Full Body';
    const preferred = coerceTrainFocus(preferredLabel);
    // Enforce max sessions + 48h recovery by swapping toward a compatible focus.
    const tryOrder: TrainFocus[] = [
      preferred,
      ...focuses.filter((f) => f !== preferred),
      'Full Body',
      'Core',
      'Mobility',
    ];
    let chosen: TrainFocus | null = null;
    let chosenLabel = preferredLabel;
    let note: string = preferredLabel;
    for (const candidate of tryOrder) {
      const groups = recoveryGroupsForFocus([candidate]);
      let ok = true;
      let blockedBy: Day | null = null;
      for (const g of groups) {
        if ((groupSessionCounts.get(g) ?? 0) >= maxSessions) {
          ok = false;
          break;
        }
        const last = groupLastDay.get(g);
        if (last && last !== day && Math.abs(DAY_INDEX[last] - DAY_INDEX[day]) < 2) {
          ok = false;
          blockedBy = last;
          break;
        }
      }
      if (ok) {
        chosen = candidate;
        chosenLabel = candidate === preferred ? preferredLabel : candidate;
        const prior = [...groups]
          .map((g) => groupLastDay.get(g))
          .filter((d): d is Day => !!d && d !== day)
          .sort((a, b) => DAY_INDEX[b] - DAY_INDEX[a])[0];
        note = prior ? `${candidate}, 48h after last ${candidate.toLowerCase()}` : candidate;
        void blockedBy;
        break;
      }
    }
    dayFocus.set(day, chosen);
    if (chosen) {
      dayFocusLabel.set(day, chosenLabel);
      dayRecoveryNote.set(day, note);
      for (const g of recoveryGroupsForFocus([chosen])) {
        groupSessionCounts.set(g, (groupSessionCounts.get(g) ?? 0) + 1);
        groupLastDay.set(g, day);
      }
    }
  }

  const results: GeneratedTrainDay[] = [];

  for (const day of DAYS) {
    const focus = dayFocus.get(day) ?? null;
    if (!focus) {
      results.push({
        day,
        restDay: true,
        focus: [],
        durationMin: 0,
        exercises: [],
        workoutId: null,
        explanation: 'Rest',
      });
      continue;
    }

    const labelForDay = dayFocusLabel.get(day) ?? focus;
    const focusLabels = [focus];
    const explanation = dayRecoveryNote.get(day) ?? labelForDay;

    // preferSavedWorkouts
    if (input.preferSavedWorkouts && input.savedWorkouts?.length) {
      const candidates = input.savedWorkouts.filter(
        (w) =>
          !usedSaved.has(w.id) &&
          savedFitsFocus(w, [labelForDay, ...focusLabels]) &&
          (w.durationMin == null || Math.abs(w.durationMin - input.durationMin) <= 20),
      );
      const pick = candidates[Math.floor(random() * Math.max(candidates.length, 1))];
      if (pick && candidates.length > 0) {
        usedSaved.add(pick.id);
        for (const id of pick.exerciseIds) usedExerciseIds.add(id);
        results.push({
          day,
          restDay: false,
          focus: [displayFocusLabel(labelForDay)],
          durationMin: pick.durationMin ?? input.durationMin,
          exercises: [],
          workoutId: pick.id,
          explanation: `${displayFocusLabel(labelForDay)} · saved workout`,
        });
        continue;
      }
    }

    const displayFocus = [displayFocusLabel(labelForDay)];
    const sessionTypeId = sessionTypeIdFromFocus(labelForDay) ?? sessionTypeIdFromFocus(focus);
    let dayPool = pool;
    if (!allowDup) {
      dayPool = pool.filter((ex) => !usedExerciseIds.has(ex.id));
      if (dayPool.length < 3) dayPool = pool;
    }

    let exercises: GeneratedTrainExercise[] = [];
    if (sessionTypeId) {
      const filled = fillWorkoutFromSessionType({
        sessionTypeId,
        durationMin: input.durationMin,
        catalogue: dayPool,
        goal: input.goal,
        level: input.level,
        seed: Math.floor(random() * 1_000_000),
        avoidExerciseIds: allowDup ? [] : [...usedExerciseIds],
      });
      exercises = filled.map((pick) => {
        if (!allowDup) usedExerciseIds.add(pick.exerciseId);
        const ex = byId.get(pick.exerciseId);
        if (ex) {
          const group = volumeCategory(ex);
          weeklySets.set(group, (weeklySets.get(group) ?? 0) + pick.targetSets);
        }
        return {
          exerciseId: pick.exerciseId,
          name: pick.name,
          tracking: pick.tracking,
          targetUnit: pick.targetUnit,
          targetSets: pick.targetSets,
          targetReps: pick.targetReps,
          targetDurationSec: pick.targetDurationSec,
          targetDistanceKm: pick.targetDistanceKm,
          targetRpe: pick.targetRpe,
          category: pick.category,
        };
      });
    }

    if (exercises.length === 0) {
      const cats = categoriesForFocus(focusLabels);
      const weights = cats.map((cat) => {
        const group = RECOVERY_GROUP[cat] ?? cat;
        const sets = weeklySets.get(group) ?? 0;
        const deficit = Math.max(0, volumeTarget - sets);
        return 40 + deficit * 8 + random() * 10;
      });
      const raw = generateFromCategoryMix(cats, weights, input.durationMin, dayPool, random);
      const ordered = compoundFirstOrder(raw, byId);
      const step = progressionStepForLevel(input.level);
      exercises = ordered.map((pick: RemixPick) => {
        const ex = byId.get(pick.exerciseId);
        const category = ex ? remixCategoryOf(ex) : null;
        const rx = prescriptionFor(input.goal, input.level, category);
        const targets = defaultTargetFor({
          name: pick.name,
          category: ex?.category ?? category,
          canonicalKey: ex?.canonicalKey,
          instructions: ex?.instructions,
          repsDefaults: { sets: rx.sets, reps: rx.reps },
          progressionStep: step,
        });
        // Intervals: keep hold duration; sets are the progression lever from rx.
        const targetSets = targets.targetUnit === 'sec' ? rx.sets : targets.targetSets;
        const targetReps =
          targets.targetUnit === 'reps' ? rx.reps : targets.targetReps;
        if (!allowDup) usedExerciseIds.add(pick.exerciseId);
        if (ex) {
          const group = volumeCategory(ex);
          weeklySets.set(group, (weeklySets.get(group) ?? 0) + targetSets);
        }
        return {
          exerciseId: pick.exerciseId,
          name: pick.name,
          tracking: targets.tracking,
          targetUnit: targets.targetUnit,
          targetSets,
          targetReps,
          targetDurationSec: targets.targetDurationSec,
          targetDistanceKm: targets.targetDistanceKm,
          targetRpe: rx.rpe,
          category,
        };
      });
    }

    results.push({
      day,
      restDay: false,
      focus: displayFocus,
      durationMin: input.durationMin,
      exercises,
      workoutId: null,
      explanation: displayFocusLabel(explanation),
    });
  }

  return results;
}

export function weeklyVolumeByGroup(days: readonly GeneratedTrainDay[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const day of days) {
    for (const ex of day.exercises) {
      const group = ex.category ? RECOVERY_GROUP[ex.category] ?? ex.category : 'other';
      totals.set(group, (totals.get(group) ?? 0) + ex.targetSets);
    }
  }
  return totals;
}

export { WEEKLY_VOLUME_TARGET, MAX_SESSIONS_PER_GROUP, GOAL_LEVEL_RX };
