import { toStoredKg, type WeightUnit } from '../train/units';
import { matchWorkoutExercises, type ExerciseCatalogEntry } from './match-exercise';
import {
  emptyImportRow,
  type ImportPlan,
  type ImportRow,
  type WorkoutImportExercise,
  type WorkoutImportRoutine,
  type WorkoutImportSession,
  type WorkoutImportSet,
} from './types';

export type HistoryDedupeItem = {
  name: string;
  startedAt: string;
};

export type ParsedWorkoutFile = {
  sourceWeightUnit: WeightUnit;
  sessions: WorkoutImportSession[];
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().replace(/,/g, '');
  if (!trimmed) return null;
  const match = trimmed.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function parseRpe(raw: string | null | undefined): number | null {
  const n = parseNumber(raw);
  if (n == null) return null;
  if (n < 1 || n > 10) return null;
  return Math.round(n * 2) / 2;
}

/** Strong duration: "1h 9m", "45m", "1h 30m 5s", "90s". */
export function parseStrongDurationToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  let totalSec = 0;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*h/);
  const mins = text.match(/(\d+(?:\.\d+)?)\s*m(?!i)/);
  const secs = text.match(/(\d+(?:\.\d+)?)\s*s/);
  if (hours) totalSec += Number(hours[1]) * 3600;
  if (mins) totalSec += Number(mins[1]) * 60;
  if (secs) totalSec += Number(secs[1]);
  if (totalSec === 0) {
    const plain = parseNumber(text);
    if (plain == null) return null;
    // Bare number: treat as minutes when small, seconds when large.
    return plain > 180 ? Math.round(plain / 60) : Math.round(plain);
  }
  return Math.max(1, Math.round(totalSec / 60));
}

export function parseDurationSeconds(raw: string | null | undefined): number | null {
  const n = parseNumber(raw);
  if (n == null || n < 0) return null;
  return Math.round(n);
}

export function weightToStoredKg(value: number, unit: WeightUnit): number {
  return toStoredKg(value, unit);
}

export function distanceToMeters(value: number, unit: 'km' | 'mi'): number {
  return unit === 'mi' ? Math.round(value * 1609.344) : Math.round(value * 1000);
}

export function detectUnitFromHeader(header: string): WeightUnit | null {
  const key = header.toLowerCase();
  if (/\b(lbs?|pounds?)\b/.test(key) || key.includes('weight_lbs') || key.includes('weight (lb')) {
    return 'lb';
  }
  if (/\b(kgs?|kilograms?)\b/.test(key) || key.includes('weight_kg') || key.includes('weight (kg')) {
    return 'kg';
  }
  return null;
}

export function detectUnitFromCells(weights: readonly number[], fallback: WeightUnit): WeightUnit {
  if (weights.length === 0) return fallback;
  const over200 = weights.filter((w) => w > 200).length;
  const over140 = weights.filter((w) => w > 140).length;
  // Typical barbell work in lb often exceeds 200; kg rarely does for most lifts.
  if (over200 / weights.length >= 0.15 || over140 / weights.length >= 0.35) return 'lb';
  return fallback;
}

export function unitFromWeightCell(raw: string): WeightUnit | null {
  const lower = raw.toLowerCase();
  if (/\b(lbs?|pounds?)\b/.test(lower)) return 'lb';
  if (/\b(kgs?|kilograms?)\b/.test(lower)) return 'kg';
  return null;
}

export function buildExerciseFromSets(
  name: string,
  sets: WorkoutImportSet[],
  note: string | null = null,
): WorkoutImportExercise {
  const working = sets.filter((set) => {
    const type = (set.setType ?? '').toLowerCase();
    return type !== 'warmup' && type !== 'warm-up' && type !== 'rest timer' && type !== 'rest';
  });
  const use = working.length > 0 ? working : sets;
  const last = use[use.length - 1] ?? null;
  const reps = use.map((set) => set.reps).filter((value): value is string => Boolean(value));
  const modeReps = mostCommon(reps) ?? last?.reps ?? '8';
  const weights = use.map((set) => set.weightKg).filter((value): value is number => value != null);
  const rpes = use.map((set) => set.rpe).filter((value): value is number => value != null);
  return {
    name: name.trim(),
    exerciseId: null,
    matchConfidence: null,
    candidates: null,
    status: name.trim() ? 'ready' : 'invalid',
    note,
    sets,
    targetSets: Math.max(1, Math.min(20, use.length || 1)),
    targetReps: modeReps,
    targetWeightKg: weights.length > 0 ? weights[weights.length - 1]! : null,
    targetRpe: rpes.length > 0 ? rpes[rpes.length - 1]! : null,
  };
}

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0]!;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Collapse sessions with the same name into one routine template (most recent session wins). */
export function routinesFromSessions(sessions: readonly WorkoutImportSession[]): WorkoutImportRoutine[] {
  const byName = new Map<string, { routine: WorkoutImportRoutine; startedAt: string }>();
  for (const session of sessions) {
    const key = normalizeName(session.name);
    if (!key) continue;
    const existing = byName.get(key);
    const startedAt = session.startedAt ?? '';
    if (!existing) {
      byName.set(key, {
        startedAt,
        routine: {
          name: session.name.trim(),
          durationMin: session.durationMin,
          exercises: session.exercises,
          status: 'ready',
          note: null,
          sessionCount: 1,
        },
      });
      continue;
    }
    existing.routine.sessionCount += 1;
    if (startedAt >= existing.startedAt) {
      existing.startedAt = startedAt;
      existing.routine = {
        ...existing.routine,
        name: session.name.trim(),
        durationMin: session.durationMin,
        exercises: session.exercises,
        sessionCount: existing.routine.sessionCount,
      };
    }
  }
  return [...byName.values()].map((entry) => entry.routine);
}

export function routineDedupeKey(name: string): string {
  return `routine:${normalizeName(name)}`;
}

export function historyDedupeKey(name: string, startedAt: string | null | undefined): string | null {
  if (!startedAt) return null;
  return `history:${normalizeName(name)}|${startedAt}`;
}

export function applyRoutineDedupe(
  routines: WorkoutImportRoutine[],
  existingNames: readonly string[],
): WorkoutImportRoutine[] {
  const existing = new Set(existingNames.map((name) => routineDedupeKey(name)));
  const seen = new Set<string>();
  return routines.map((routine) => {
    const key = routineDedupeKey(routine.name);
    if (existing.has(key) || seen.has(key)) {
      return { ...routine, status: 'duplicate', note: 'Routine already exists' };
    }
    seen.add(key);
    return { ...routine, status: 'ready', note: null };
  });
}

export function applyHistoryDedupe(
  sessions: WorkoutImportSession[],
  existing: readonly HistoryDedupeItem[],
): WorkoutImportSession[] {
  const existingKeys = new Set(
    existing
      .map((item) => historyDedupeKey(item.name, item.startedAt))
      .filter((key): key is string => Boolean(key)),
  );
  const seen = new Set<string>();
  return sessions.map((session) => {
    const key = historyDedupeKey(session.name, session.startedAt);
    if (!key) {
      return { ...session, status: 'invalid', note: 'Missing start time' };
    }
    if (existingKeys.has(key) || seen.has(key)) {
      return { ...session, status: 'duplicate', note: 'Session already imported' };
    }
    seen.add(key);
    return { ...session, status: 'ready', note: null };
  });
}

export function matchPlanExercises(plan: ImportPlan, catalog: readonly ExerciseCatalogEntry[]): ImportPlan {
  if (!plan.workoutSessions?.length && !plan.workoutRoutines?.length) return plan;

  const sessions = (plan.workoutSessions ?? []).map((session) => ({
    ...session,
    exercises: matchWorkoutExercises(session.exercises, catalog),
  }));
  const routines = routinesFromSessions(sessions).map((routine) => ({
    ...routine,
    exercises: matchWorkoutExercises(routine.exercises, catalog),
  }));

  return {
    ...plan,
    workoutSessions: sessions,
    workoutRoutines: routines,
    rows: routinesToRows(routines),
  };
}

function withAcceptedExercise(
  exercise: WorkoutImportExercise,
  priorName: string,
  candidate: { exerciseId: string; name: string; confidence: number },
): WorkoutImportExercise {
  if (normalizeName(exercise.name) !== normalizeName(priorName)) return exercise;
  return {
    ...exercise,
    name: candidate.name,
    exerciseId: candidate.exerciseId,
    matchConfidence: candidate.confidence,
    candidates: null,
    status: 'ready',
    note: null,
  };
}

export function acceptExerciseMatch(
  plan: ImportPlan,
  routineIndex: number,
  exerciseIndex: number,
  candidate: { exerciseId: string; name: string; confidence: number },
): ImportPlan {
  if (!plan.workoutRoutines) return plan;
  const prior = plan.workoutRoutines[routineIndex]?.exercises[exerciseIndex];
  if (!prior) return plan;
  const priorName = prior.name;

  const routines = plan.workoutRoutines.map((routine, rIndex) => {
    if (rIndex !== routineIndex) return routine;
    return {
      ...routine,
      exercises: routine.exercises.map((exercise, eIndex) =>
        eIndex === exerciseIndex ? withAcceptedExercise(exercise, priorName, candidate) : exercise,
      ),
    };
  });
  const sessions = (plan.workoutSessions ?? []).map((session) => ({
    ...session,
    exercises: session.exercises.map((exercise) => withAcceptedExercise(exercise, priorName, candidate)),
  }));

  return {
    ...plan,
    workoutRoutines: routines,
    workoutSessions: sessions,
    rows: routinesToRows(routines),
  };
}

/** Keep free-text name (no catalogue custom). */
export function keepExerciseFreeText(
  plan: ImportPlan,
  routineIndex: number,
  exerciseIndex: number,
): ImportPlan {
  if (!plan.workoutRoutines) return plan;
  const routines = plan.workoutRoutines.map((routine, rIndex) => {
    if (rIndex !== routineIndex) return routine;
    const exercises = routine.exercises.map((exercise, eIndex) => {
      if (eIndex !== exerciseIndex) return exercise;
      return {
        ...exercise,
        exerciseId: null,
        candidates: null,
        status: 'ready' as const,
        note: 'Free-text name',
      };
    });
    return { ...routine, exercises };
  });
  return { ...plan, workoutRoutines: routines, rows: routinesToRows(routines) };
}

export function routinesToRows(routines: readonly WorkoutImportRoutine[]): ImportRow[] {
  return routines.map((routine) =>
    emptyImportRow({
      title: routine.name,
      sets: routine.exercises.length,
      notes: routine.note,
      status: routine.status,
      note: routine.note,
    }),
  );
}

export function summarizeWorkoutImport(plan: ImportPlan): {
  routinesReady: number;
  routinesDuplicate: number;
  exercisesNeedMatch: number;
  historyReady: number;
  historyDuplicate: number;
} {
  const routines = plan.workoutRoutines ?? [];
  const sessions = plan.workoutSessions ?? [];
  return {
    routinesReady: routines.filter((item) => item.status === 'ready').length,
    routinesDuplicate: routines.filter((item) => item.status === 'duplicate').length,
    exercisesNeedMatch: routines
      .filter((item) => item.status === 'ready')
      .flatMap((item) => item.exercises)
      .filter((item) => item.status === 'needsMatch').length,
    historyReady: sessions.filter((item) => item.status === 'ready').length,
    historyDuplicate: sessions.filter((item) => item.status === 'duplicate').length,
  };
}

export function refreshWorkoutImportPlan(
  plan: ImportPlan,
  existingRoutineNames: readonly string[],
  existingHistory: readonly HistoryDedupeItem[] = [],
): ImportPlan {
  if (!plan.workoutRoutines && !plan.workoutSessions) return plan;
  const routines = applyRoutineDedupe(plan.workoutRoutines ?? [], existingRoutineNames);
  const sessions = applyHistoryDedupe(plan.workoutSessions ?? [], existingHistory);
  return {
    ...plan,
    workoutRoutines: routines,
    workoutSessions: sessions,
    rows: routinesToRows(routines),
    supportsHistory: plan.supportsHistory ?? true,
    customExercisesSupported: false,
  };
}
