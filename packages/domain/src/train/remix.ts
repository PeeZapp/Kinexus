import type { CatalogExercise, RemixPick } from './types';

export const REMIX_CATEGORIES = [
  'Chest',
  'Triceps',
  'Back',
  'Biceps',
  'Legs',
  'Glutes',
  'Shoulders',
  'Core',
  'Cardio',
  'Full Body',
  'Plyometrics',
  'Mobility',
] as const;

export type RemixCategory = (typeof REMIX_CATEGORIES)[number];

export const REMIX_DURATIONS = [20, 30, 40, 50, 60, 70, 80, 90] as const;

export const REMIX_CATEGORY_COLOR: Record<RemixCategory, string> = {
  Chest: '#FF4D4D',
  Triceps: '#FF7070',
  Back: '#FF8C00',
  Biceps: '#FFB347',
  Legs: '#A855F7',
  Glutes: '#DB2777',
  Shoulders: '#00D4AA',
  Core: '#3B82F6',
  Cardio: '#F59E0B',
  'Full Body': '#E84393',
  Plyometrics: '#EC4899',
  Mobility: '#06B6D4',
};

const CATEGORY_DEFAULTS: Record<RemixCategory, { sets: number; reps: string; minPerExercise: number }> = {
  Chest: { sets: 4, reps: '10', minPerExercise: 7 },
  Triceps: { sets: 4, reps: '10', minPerExercise: 7 },
  Back: { sets: 4, reps: '10', minPerExercise: 7 },
  Biceps: { sets: 4, reps: '10', minPerExercise: 7 },
  Legs: { sets: 4, reps: '12', minPerExercise: 8 },
  Glutes: { sets: 4, reps: '12-15', minPerExercise: 7 },
  Shoulders: { sets: 4, reps: '12', minPerExercise: 7 },
  Core: { sets: 4, reps: '12', minPerExercise: 7 },
  Cardio: { sets: 3, reps: '45s', minPerExercise: 5 },
  'Full Body': { sets: 3, reps: '15', minPerExercise: 6 },
  Plyometrics: { sets: 3, reps: '8', minPerExercise: 5 },
  Mobility: { sets: 1, reps: '30s', minPerExercise: 10 },
};

const BODY_PART_CATEGORY: Record<string, RemixCategory> = {
  chest: 'Chest',
  triceps: 'Triceps',
  back: 'Back',
  biceps: 'Biceps',
  shoulders: 'Shoulders',
  core: 'Core',
  cardio: 'Cardio',
};

const MOBILITY_NAME = /\b(stretch|mobility|yoga|breathing|foam|thoracic|90\/90)\b/i;
const PLYO_NAME = /\b(plyometrics?|plyo|jumps?|jumping|burpees?|bounding|bounds?|hops?)\b/i;
const FULL_BODY_NAME = /\bfull body\b|\bthrusters?\b|\bsnatches?\b|\bclean and\b|\bman makers?\b|\bturkish get-?up\b/i;

const UNTAGGED_CATEGORY: readonly [RegExp, RemixCategory][] = [
  [/\b(glute|hip thrust)\b/i, 'Glutes'],
  [/\b(squat|lunge|hamstring|quad|calf|leg press)\b/i, 'Legs'],
  [/\b(tricep|push-?down|pushdown|skull crusher|kickback)\b/i, 'Triceps'],
  [/\b(bicep|curl|chin-?up)\b/i, 'Biceps'],
  [/\b(chest|bench|flye?s?|push-?up)\b/i, 'Chest'],
  [/\b(shoulder|lateral raise|rear delt|overhead press|military press)\b/i, 'Shoulders'],
  [/\b(pulldowns?|pull-?ups?|rows?|deadlifts?|latissimus|lats?)\b/i, 'Back'],
  [/\b(crunch|plank|sit-?up|oblique|abdominal)\b/i, 'Core'],
  [/\b(sprint|bike|cardio|jump rope)\b/i, 'Cardio'],
];

const REMIX_SPLIT_PREFIX = 'remix:';

export function getRemixDefaultsForCategory(category: string): { sets: number; reps: string; minPerExercise: number } {
  if (isRemixCategory(category)) return CATEGORY_DEFAULTS[category];
  return { sets: 4, reps: '10', minPerExercise: 7 };
}

export function isRemixCategory(category: string): category is RemixCategory {
  return (REMIX_CATEGORIES as readonly string[]).includes(category);
}

export function remixCategoryOf(exercise: CatalogExercise): RemixCategory | null {
  if (exercise.targetMuscle.trim().toLowerCase() === 'glutes') return 'Glutes';
  if (exercise.bodyPart === 'legs') return 'Legs';
  const mapped = BODY_PART_CATEGORY[exercise.bodyPart];
  if (mapped) return mapped;
  if (exercise.bodyPart !== 'other' && exercise.bodyPart !== '') return null;
  if (MOBILITY_NAME.test(exercise.name)) return 'Mobility';
  if (PLYO_NAME.test(exercise.name)) return 'Plyometrics';
  if (FULL_BODY_NAME.test(exercise.name)) return 'Full Body';
  for (const [pattern, category] of UNTAGGED_CATEGORY) {
    if (pattern.test(exercise.name)) return category;
  }
  return null;
}

export function exerciseMatchesRemixCategory(exercise: CatalogExercise, category: string): boolean {
  return remixCategoryOf(exercise) === category;
}

export function normalizeRemixSliderWeights(raw: readonly number[]): number[] {
  const positives = raw.map((weight) => Math.max(0, Number(weight) || 0));
  const sum = positives.reduce((total, weight) => total + weight, 0);
  if (raw.length === 0) return [];
  if (sum <= 0) return raw.map(() => 1 / raw.length);
  return positives.map((weight) => weight / sum);
}

export function remixExerciseCount(categories: readonly string[], duration: number): number {
  if (!categories.length) return 0;
  const minutes = categories.reduce((total, category) => total + getRemixDefaultsForCategory(category).minPerExercise, 0);
  const average = minutes / categories.length;
  return Math.max(3, Math.round(duration / average));
}

export function buildRemixWorkoutLabel(categories: readonly string[], duration: number): string {
  if (categories.length === 0) return 'Remix';
  const suffix = Number.isFinite(duration) && duration > 0 ? ` · ${duration}m` : '';
  return `${categories.join(' · ')}${suffix}`;
}

export function encodeRemixSplit(categories: readonly string[], weights: readonly number[]): string {
  const parts = categories.map((category, index) => `${category}=${Math.max(1, Math.round(weights[index] ?? 100))}`);
  return `${REMIX_SPLIT_PREFIX}${parts.join('|')}`;
}

export function parseRemixSplit(splitId: string | null | undefined): { categories: string[]; weights: number[] } | null {
  if (!splitId?.startsWith(REMIX_SPLIT_PREFIX)) return null;
  const categories: string[] = [];
  const weights: number[] = [];
  for (const part of splitId.slice(REMIX_SPLIT_PREFIX.length).split('|')) {
    if (!part) continue;
    const eq = part.lastIndexOf('=');
    if (eq <= 0) return null;
    const category = part.slice(0, eq);
    const weight = Number(part.slice(eq + 1));
    if (!isRemixCategory(category) || !Number.isFinite(weight) || weight <= 0) return null;
    categories.push(category);
    weights.push(weight);
  }
  return categories.length ? { categories, weights } : null;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = copy[i];
    const swap = copy[j];
    if (current === undefined || swap === undefined) continue;
    copy[i] = swap;
    copy[j] = current;
  }
  return copy;
}

function weightedSampleWithoutReplacement<T>(
  pool: readonly T[],
  count: number,
  random: () => number,
): T[] {
  if (count <= 0 || pool.length === 0) return [];
  const work = shuffle(pool, random).map((item) => ({
    item,
    w: 0.78 + random() * 0.44,
  }));
  const out: T[] = [];
  for (let k = 0; k < count && work.length > 0; k += 1) {
    const totalW = work.reduce((sum, entry) => sum + entry.w, 0);
    let cursor = random() * totalW;
    let idx = 0;
    for (let i = 0; i < work.length; i += 1) {
      const entry = work[i];
      if (!entry) break;
      cursor -= entry.w;
      idx = i;
      if (cursor <= 0) break;
    }
    const picked = work[idx];
    if (!picked) break;
    out.push(picked.item);
    work.splice(idx, 1);
  }
  return out;
}

function allocateCountsLargestRemainder(total: number, normalizedWeights: readonly number[]): number[] {
  if (!normalizedWeights.length) return [];
  const sum = normalizedWeights.reduce((totalWeight, weight) => totalWeight + weight, 0);
  const safe = sum > 0 ? normalizedWeights : normalizedWeights.map(() => 1 / normalizedWeights.length);
  const raw = safe.map((weight) => total * weight);
  const counts = raw.map((value) => Math.floor(value));
  let diff = total - counts.reduce((totalCount, count) => totalCount + count, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  let step = 0;
  while (diff > 0 && order.length > 0) {
    const slot = order[step % order.length];
    if (!slot) break;
    counts[slot.index] = (counts[slot.index] ?? 0) + 1;
    diff -= 1;
    step += 1;
  }
  return counts;
}

function interleavePicks(buckets: RemixPick[][], weights: readonly number[], total: number, random: () => number): RemixPick[] {
  if (!buckets.length) return [];
  const order = weights
    .map((pct, index) => ({ index, pct, tie: random() }))
    .sort((a, b) => b.pct - a.pct || a.tie - b.tie)
    .map((entry) => entry.index);
  const iterators = order.map((index) => ({ exercises: [...(buckets[index] ?? [])], idx: 0 }));
  const result: RemixPick[] = [];
  let safety = 0;
  while (result.length < total && safety < total * (buckets.length + 5)) {
    let progressed = false;
    for (const iterator of iterators) {
      const next = iterator.exercises[iterator.idx];
      if (next && result.length < total) {
        result.push(next);
        iterator.idx += 1;
        progressed = true;
      }
    }
    if (!progressed) break;
    safety += 1;
  }
  return result;
}

function pickExercisesForCategory(
  category: string,
  count: number,
  pool: readonly CatalogExercise[],
  random: () => number,
): RemixPick[] {
  const defaults = getRemixDefaultsForCategory(category);
  if (count <= 0) return [];
  const filtered = pool.filter((exercise) => exerciseMatchesRemixCategory(exercise, category));
  return weightedSampleWithoutReplacement(filtered, Math.min(count, filtered.length), random).map((exercise) => ({
    exerciseId: exercise.id,
    name: exercise.name,
    targetSets: defaults.sets,
    targetReps: defaults.reps,
  }));
}

export function generateFromCategoryMix(
  categories: readonly string[],
  sliderRaw: readonly number[],
  duration: number,
  pool: readonly CatalogExercise[],
  random: () => number = Math.random,
): RemixPick[] {
  if (!categories.length) return [];
  const norm = normalizeRemixSliderWeights(categories.map((_, index) => sliderRaw[index] ?? 0));
  const total = remixExerciseCount(categories, duration);
  const counts = allocateCountsLargestRemainder(total, norm);
  const buckets = categories.map((category, index) => pickExercisesForCategory(category, counts[index] ?? 0, pool, random));
  return interleavePicks(buckets, norm, total, random);
}

export function swapSimilarExercises(
  current: readonly RemixPick[],
  pool: readonly CatalogExercise[],
  random: () => number = Math.random,
): { exercises: RemixPick[]; changed: number; kept: number } {
  const byId = new Map(pool.map((exercise) => [exercise.id, exercise]));
  const used = new Set<string>();
  let changed = 0;
  let kept = 0;
  const exercises = current.map((exercise) => {
    const source = byId.get(exercise.exerciseId);
    const category = source ? remixCategoryOf(source) : null;
    const candidates = category
      ? pool.filter(
          (item) =>
            exerciseMatchesRemixCategory(item, category) &&
            !used.has(item.id) &&
            item.id !== exercise.exerciseId,
        )
      : [];
    const pick = weightedSampleWithoutReplacement(candidates, 1, random)[0];
    if (!pick) {
      if (exercise.exerciseId) used.add(exercise.exerciseId);
      kept += 1;
      return exercise;
    }
    used.add(pick.id);
    changed += 1;
    return {
      exerciseId: pick.id,
      name: pick.name,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
    };
  });
  return { exercises, changed, kept };
}

/** Pick a different exercise in the same category, using unseen ones before any repeat. */
export function nextSimilarExercise(
  currentId: string,
  pool: readonly CatalogExercise[],
  offeredIds: readonly string[],
  takenIds: readonly string[],
  random: () => number = Math.random,
): { exercise: CatalogExercise; offeredIds: string[] } | null {
  const source = pool.find((exercise) => exercise.id === currentId);
  const category = source ? remixCategoryOf(source) : null;
  if (!category) return null;
  const taken = new Set(takenIds);
  const similar = pool.filter(
    (exercise) => exerciseMatchesRemixCategory(exercise, category) && !taken.has(exercise.id),
  );
  if (similar.length === 0) return null;
  const seen = new Set(offeredIds.length > 0 ? offeredIds : [currentId]);
  seen.add(currentId);
  const fresh = similar.filter((exercise) => !seen.has(exercise.id));
  if (fresh.length > 0) {
    const exercise = fresh[Math.floor(random() * fresh.length) % fresh.length];
    if (!exercise) return null;
    return { exercise, offeredIds: [...seen, exercise.id] };
  }
  const again = similar.filter((exercise) => exercise.id !== currentId);
  if (again.length === 0) return null;
  const exercise = again[Math.floor(random() * again.length) % again.length];
  if (!exercise) return null;
  return { exercise, offeredIds: [currentId, exercise.id] };
}
