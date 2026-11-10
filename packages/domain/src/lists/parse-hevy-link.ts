import { exerciseGuideKind, type EffortLevel } from '../train/effort';
import {
  applyExerciseMatch,
  normalizeExerciseName,
  rankExerciseMatches,
  type ExerciseCatalogEntry,
} from './match-exercise';
import { type ImportPlan, type WorkoutImportExercise, type WorkoutImportSet } from './types';
import { buildExerciseFromSets, routinesToRows } from './workout-import';

export const HEVY_LINK_PUBLIC_ERROR = "That workout isn't public or couldn't be read";

export type HevyLinkKind = 'workout' | 'routine' | 'short';

export type ClassifiedHevyLink = {
  kind: HevyLinkKind;
  id: string | null;
  canonicalUrl: string;
};

export type ParsedHevyLinkSet = {
  reps: string | null;
  weightKg: number | null;
  durationSec: number | null;
  distanceM: number | null;
};

export type ParsedHevyLinkExercise = {
  name: string;
  sets: ParsedHevyLinkSet[];
};

export type ParsedHevyLinkWorkout = {
  title: string;
  exercises: ParsedHevyLinkExercise[];
  privateOrBlocked: boolean;
};

export type HevyLinkMatchStatus = 'matched' | 'likely' | 'missing';

export type HevyLinkMatchedExercise = WorkoutImportExercise & {
  matchStatus: HevyLinkMatchStatus;
  sourceName: string;
  /** When missing, import will create a personal custom exercise unless the user picks one. */
  willCreateCustom: boolean;
  targetEffort: EffortLevel | null;
};

export type HevyLinkImportPreview = {
  title: string;
  url: string;
  exercises: HevyLinkMatchedExercise[];
};

export type LibraryWorkoutFingerprint = {
  id: string;
  name: string;
  exerciseNames: readonly string[];
};

function stripWww(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase();
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.trim().replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function mostCommonReps(values: readonly string[]): string {
  if (values.length === 0) return '8';
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

function repsFromSet(raw: Record<string, unknown>): string | null {
  const direct = num(raw.reps);
  if (direct != null) return String(Math.round(direct));
  const range = asRecord(raw.rep_range) ?? asRecord(raw.repRange);
  if (range) {
    const start = num(range.start ?? range.min ?? range.from);
    const end = num(range.end ?? range.max ?? range.to);
    if (start != null && end != null && start !== end) return `${Math.round(start)}-${Math.round(end)}`;
    if (start != null) return String(Math.round(start));
    if (end != null) return String(Math.round(end));
  }
  const text = str(raw.rep_range) ?? str(raw.repRange);
  if (text && /\d/.test(text)) return text.replace(/\s+/g, '');
  return null;
}

function parseSet(raw: unknown): ParsedHevyLinkSet | null {
  const row = asRecord(raw);
  if (!row) return null;
  const type = (str(row.type) ?? str(row.set_type) ?? '').toLowerCase();
  if (type === 'warmup' || type === 'warm-up' || type === 'rest' || type === 'rest timer') return null;

  const weightKg =
    num(row.weight_kg) ??
    num(row.weightKg) ??
    (num(row.weight_lbs) != null ? Math.round(((num(row.weight_lbs) ?? 0) / 2.2046226218) * 100) / 100 : null) ??
    (num(row.weightLbs) != null ? Math.round(((num(row.weightLbs) ?? 0) / 2.2046226218) * 100) / 100 : null);

  const durationSec = num(row.duration_seconds) ?? num(row.durationSeconds) ?? num(row.duration);
  const distanceM =
    num(row.distance_meters) ??
    num(row.distanceMeters) ??
    (num(row.distance_km) != null ? Math.round((num(row.distance_km) ?? 0) * 1000) : null) ??
    (num(row.distanceMiles) != null ? Math.round((num(row.distanceMiles) ?? 0) * 1609.344) : null);

  return {
    reps: repsFromSet(row),
    weightKg,
    durationSec: durationSec != null && durationSec >= 0 ? Math.round(durationSec) : null,
    distanceM: distanceM != null && distanceM >= 0 ? Math.round(distanceM) : null,
  };
}

function exerciseName(raw: Record<string, unknown>): string | null {
  const template = asRecord(raw.exercise_template) ?? asRecord(raw.exerciseTemplate);
  return (
    str(raw.title) ??
    str(raw.name) ??
    str(raw.exercise_title) ??
    str(raw.exerciseTitle) ??
    (template ? str(template.title) ?? str(template.name) : null)
  );
}

function parseExercise(raw: unknown): ParsedHevyLinkExercise | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = exerciseName(row);
  if (!name) return null;
  const sets = asArray(row.sets)
    .map(parseSet)
    .filter((set): set is ParsedHevyLinkSet => Boolean(set));
  return { name, sets };
}

function parseWorkoutLike(raw: unknown): { title: string; exercises: ParsedHevyLinkExercise[] } | null {
  const row = asRecord(raw);
  if (!row) return null;
  const title = str(row.title) ?? str(row.name) ?? str(row.workout_title) ?? 'Workout';
  const exercises = asArray(row.exercises)
    .map(parseExercise)
    .filter((ex): ex is ParsedHevyLinkExercise => Boolean(ex));
  if (exercises.length === 0) return null;
  return { title, exercises };
}

function walkForWorkout(node: unknown, depth = 0): { title: string; exercises: ParsedHevyLinkExercise[] } | null {
  if (depth > 8) return null;
  const row = asRecord(node);
  if (!row) {
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = walkForWorkout(item, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }

  for (const key of ['workout', 'routine', 'sharedWorkout', 'sharedRoutine', 'data'] as const) {
    if (key in row) {
      const direct = parseWorkoutLike(row[key]);
      if (direct) return direct;
      const nested = walkForWorkout(row[key], depth + 1);
      if (nested) return nested;
    }
  }

  if (Array.isArray(row.exercises)) {
    const direct = parseWorkoutLike(row);
    if (direct) return direct;
  }

  for (const value of Object.values(row)) {
    if (!value || typeof value !== 'object') continue;
    const hit = walkForWorkout(value, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function extractNextData(html: string): unknown | null {
  const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(decodeEntities(match[1].trim())) as unknown;
  } catch {
    return null;
  }
}

function extractLdJsonWorkouts(html: string): { title: string; exercises: ParsedHevyLinkExercise[] } | null {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse((match[1] ?? '').trim()) as unknown;
      const items: unknown[] = Array.isArray(data)
        ? data
        : asRecord(data)?.['@graph']
          ? asArray(asRecord(data)!['@graph'])
          : [data];
      for (const item of items) {
        const row = asRecord(item);
        if (!row) continue;
        const type = row['@type'];
        const types = Array.isArray(type) ? type : [type];
        const isWorkout = types.some(
          (t) => typeof t === 'string' && /workout|exerciseplan|sportsactivity/i.test(t),
        );
        if (!isWorkout && !Array.isArray(row.exercise)) continue;
        const title = str(row.name) ?? str(row.headline) ?? 'Workout';
        const exerciseNodes = asArray(row.exercise ?? row.itemListElement);
        const exercises: ParsedHevyLinkExercise[] = [];
        for (const node of exerciseNodes) {
          const ex = asRecord(node);
          if (!ex) continue;
          const name =
            str(ex.name) ??
            str(asRecord(ex.item)?.name) ??
            str(asRecord(ex.exercise)?.name);
          if (!name) continue;
          exercises.push({ name, sets: [] });
        }
        if (exercises.length > 0) return { title, exercises };
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function looksPrivateOrBlocked(html: string): boolean {
  const lower = html.toLowerCase();
  if (lower.includes('this workout is private')) return true;
  if (lower.includes('this routine is private')) return true;
  if (lower.includes('workout is private')) return true;
  if (lower.includes('routine is private')) return true;
  if (lower.includes('sign in to view')) return true;
  if (lower.includes('you must be signed in')) return true;
  if (lower.includes('content is not available')) return true;
  if (lower.includes('page not found') && lower.includes('404')) return true;
  return false;
}

export function isHevyHost(host: string): boolean {
  const h = stripWww(host);
  return h === 'hevy.com' || h === 'hevy.app' || h.endsWith('.hevy.com') || h.endsWith('.hevy.app');
}

/**
 * Classify a Hevy share URL. Short hevy.app links are resolved server-side via redirects.
 */
export function classifyHevyWorkoutImportUrl(rawUrl: string): ClassifiedHevyLink | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!/^https?:$/i.test(parsed.protocol)) return null;
  if (!isHevyHost(parsed.hostname)) return null;

  const path = parsed.pathname.replace(/\/+/g, '/');
  const workout = path.match(/^\/workout\/([a-zA-Z0-9_-]+)\/?$/i);
  if (workout) {
    return {
      kind: 'workout',
      id: workout[1]!,
      canonicalUrl: `https://hevy.com/workout/${workout[1]}`,
    };
  }
  const routine = path.match(/^\/routine\/([a-zA-Z0-9_-]+)\/?$/i);
  if (routine) {
    return {
      kind: 'routine',
      id: routine[1]!,
      canonicalUrl: `https://hevy.com/routine/${routine[1]}`,
    };
  }

  // hevy.app short links / unknown paths — fetch resolves the final URL.
  return {
    kind: 'short',
    id: path.replace(/^\/+|\/+$/g, '') || null,
    canonicalUrl: parsed.href,
  };
}

export function isHevyWorkoutImportUrl(rawUrl: string): boolean {
  return classifyHevyWorkoutImportUrl(rawUrl) != null;
}

/**
 * Pure HTML → workout parser. Prefers __NEXT_DATA__, then ld+json.
 */
export function parseHevyShareHtml(html: string, _url?: string): ParsedHevyLinkWorkout {
  const privateOrBlocked = looksPrivateOrBlocked(html);
  const next = extractNextData(html);
  if (next) {
    const pageProps = asRecord(asRecord(asRecord(next)?.props)?.pageProps);
    if (pageProps) {
      for (const key of ['workout', 'routine', 'sharedWorkout', 'sharedRoutine'] as const) {
        const hit = parseWorkoutLike(pageProps[key]);
        if (hit) return { ...hit, privateOrBlocked: false };
      }
      const initial = asRecord(pageProps.initialState) ?? asRecord(pageProps.dehydratedState);
      if (initial) {
        const hit = parseWorkoutLike(initial.workout) ?? parseWorkoutLike(initial.routine) ?? walkForWorkout(initial);
        if (hit) return { ...hit, privateOrBlocked: false };
      }
    }
    const walked = walkForWorkout(next);
    if (walked) return { ...walked, privateOrBlocked: false };
  }

  const ld = extractLdJsonWorkouts(html);
  if (ld) return { ...ld, privateOrBlocked: false };

  if (privateOrBlocked) {
    return { title: '', exercises: [], privateOrBlocked: true };
  }
  return { title: '', exercises: [], privateOrBlocked: true };
}

function toImportSets(sets: readonly ParsedHevyLinkSet[]): WorkoutImportSet[] {
  return sets.map((set) => ({
    reps: set.reps,
    weightKg: set.weightKg,
    distanceM: set.distanceM,
    durationSec: set.durationSec,
    rpe: null,
    setType: null,
  }));
}

/**
 * Map Load (weights) from relative weight within the workout:
 * top third Heavy, middle Medium, bottom Light; bodyweight → Light.
 * Cardio / mobility / plyo → Effort Medium.
 */
export function mapHevyLinkIntensities(
  exercises: readonly ParsedHevyLinkExercise[],
  categoryByName: ReadonlyMap<string, string | null> = new Map(),
): EffortLevel[] {
  const weightScores = exercises.map((ex) => {
    const weights = ex.sets.map((set) => set.weightKg).filter((w): w is number => w != null && w > 0);
    if (weights.length === 0) return null;
    return Math.max(...weights);
  });
  const ranked = weightScores
    .map((score, index) => ({ score, index }))
    .filter((row): row is { score: number; index: number } => row.score != null)
    .sort((a, b) => b.score - a.score);

  const loadByIndex = new Map<number, EffortLevel>();
  if (ranked.length === 1) {
    loadByIndex.set(ranked[0]!.index, 'moderate');
  } else if (ranked.length === 2) {
    loadByIndex.set(ranked[0]!.index, 'heavy');
    loadByIndex.set(ranked[1]!.index, 'light');
  } else if (ranked.length >= 3) {
    const third = Math.max(1, Math.ceil(ranked.length / 3));
    ranked.forEach((row, order) => {
      if (order < third) loadByIndex.set(row.index, 'heavy');
      else if (order < third * 2) loadByIndex.set(row.index, 'moderate');
      else loadByIndex.set(row.index, 'light');
    });
  }

  return exercises.map((ex, index) => {
    const category =
      categoryByName.get(normalizeExerciseName(ex.name)) ??
      categoryByName.get(ex.name.trim().toLowerCase()) ??
      null;
    if (exerciseGuideKind(category) === 'effort') return 'moderate';
    if (loadByIndex.has(index)) return loadByIndex.get(index)!;
    // Bodyweight / no load → Light
    return 'light';
  });
}

function matchStatusFromExercise(exercise: WorkoutImportExercise): HevyLinkMatchStatus {
  if (exercise.exerciseId && exercise.status === 'ready') return 'matched';
  if ((exercise.candidates?.length ?? 0) > 0) return 'likely';
  return 'missing';
}

export function matchHevyLinkExercises(
  parsed: ParsedHevyLinkWorkout,
  catalog: readonly ExerciseCatalogEntry[],
): HevyLinkMatchedExercise[] {
  const categoryByName = new Map<string, string | null>();
  for (const entry of catalog) {
    categoryByName.set(normalizeExerciseName(entry.name), entry.category ?? null);
    categoryByName.set(entry.name.trim().toLowerCase(), entry.category ?? null);
  }
  const intensities = mapHevyLinkIntensities(parsed.exercises, categoryByName);

  return parsed.exercises.map((ex, index) => {
    const sets = toImportSets(ex.sets);
    const base = buildExerciseFromSets(ex.name, sets);
    // Prefer modal reps across sets (buildExerciseFromSets already does this).
    const repValues = sets.map((set) => set.reps).filter((v): v is string => Boolean(v));
    if (repValues.length > 0) {
      base.targetReps = mostCommonReps(repValues);
    }
    const candidates = rankExerciseMatches(ex.name, catalog);
    const matched = applyExerciseMatch(base, candidates);
    const status = matchStatusFromExercise(matched);
    const catalogHit = matched.exerciseId
      ? catalog.find((entry) => entry.id === matched.exerciseId)
      : null;
    const effortCategory = catalogHit?.category ?? null;
    const targetEffort =
      exerciseGuideKind(effortCategory) === 'effort'
        ? ('moderate' as EffortLevel)
        : intensities[index] ?? 'light';

    return {
      ...matched,
      sourceName: ex.name,
      matchStatus: status,
      willCreateCustom: status === 'missing',
      targetEffort,
      // Missing stays importable — Import creates a personal custom exercise.
      status: status === 'likely' ? 'needsMatch' : 'ready',
      note:
        status === 'matched'
          ? null
          : status === 'likely'
            ? 'Needs confirmation'
            : 'Will be added to your exercises',
      exerciseId: status === 'missing' ? null : matched.exerciseId,
    };
  });
}

export function exerciseSetFingerprint(names: readonly string[]): string {
  return [...names]
    .map((name) => normalizeExerciseName(name))
    .filter(Boolean)
    .sort()
    .join('|');
}

/** Same normalised title + same exercise set → library duplicate. */
export function findMatchingLibraryWorkout(
  title: string,
  exerciseNames: readonly string[],
  library: readonly LibraryWorkoutFingerprint[],
): LibraryWorkoutFingerprint | null {
  const titleKey = normalizeExerciseName(title);
  const setKey = exerciseSetFingerprint(exerciseNames);
  if (!titleKey || !setKey) return null;
  for (const workout of library) {
    if (normalizeExerciseName(workout.name) !== titleKey) continue;
    if (exerciseSetFingerprint(workout.exerciseNames) === setKey) return workout;
  }
  return null;
}

export function buildImportPlanFromHevyLink(preview: HevyLinkImportPreview): ImportPlan {
  const routine = {
    name: preview.title.trim() || 'Hevy workout',
    durationMin: null,
    exercises: preview.exercises,
    status: 'ready' as const,
    note: null,
    sessionCount: 1,
  };
  return {
    format: 'hevy-link',
    kind: 'workout',
    suggestedName: routine.name,
    headers: null,
    mapping: {},
    rows: routinesToRows([routine]),
    weightUnit: 'kg',
    sourceWeightUnit: 'kg',
    workoutSessions: null,
    workoutRoutines: [routine],
    supportsHistory: false,
    importHistory: false,
    customExercisesSupported: true,
  };
}

export function acceptHevyLinkExerciseMatch(
  plan: ImportPlan,
  exerciseIndex: number,
  candidate: { exerciseId: string; name: string; confidence: number },
): ImportPlan {
  const routine = plan.workoutRoutines?.[0];
  if (!routine) return plan;
  const exercises = routine.exercises.map((exercise, index) => {
    if (index !== exerciseIndex) return exercise;
    const next: HevyLinkMatchedExercise = {
      ...(exercise as HevyLinkMatchedExercise),
      name: candidate.name,
      exerciseId: candidate.exerciseId,
      matchConfidence: candidate.confidence,
      candidates: null,
      status: 'ready',
      note: null,
      matchStatus: 'matched',
      willCreateCustom: false,
      sourceName: (exercise as HevyLinkMatchedExercise).sourceName ?? exercise.name,
      targetEffort: (exercise as HevyLinkMatchedExercise).targetEffort ?? null,
    };
    return next;
  });
  const routines = [{ ...routine, exercises }];
  return {
    ...plan,
    workoutRoutines: routines,
    rows: routinesToRows(routines),
  };
}

/** Keep missing exercise as a personal custom (will create on import). */
export function keepHevyLinkAsCustom(plan: ImportPlan, exerciseIndex: number): ImportPlan {
  const routine = plan.workoutRoutines?.[0];
  if (!routine) return plan;
  const exercises = routine.exercises.map((exercise, index) => {
    if (index !== exerciseIndex) return exercise;
    const sourceName = (exercise as HevyLinkMatchedExercise).sourceName ?? exercise.name;
    const next: HevyLinkMatchedExercise = {
      ...(exercise as HevyLinkMatchedExercise),
      name: sourceName,
      exerciseId: null,
      candidates: null,
      status: 'ready',
      note: 'Will be added to your exercises',
      matchStatus: 'missing',
      willCreateCustom: true,
      sourceName,
      targetEffort: (exercise as HevyLinkMatchedExercise).targetEffort ?? 'light',
    };
    return next;
  });
  const routines = [{ ...routine, exercises }];
  return {
    ...plan,
    workoutRoutines: routines,
    rows: routinesToRows(routines),
  };
}
