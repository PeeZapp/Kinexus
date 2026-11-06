import { exerciseSearchScore } from '../train/search';
import { classifyMatchConfidence, MATCH_AUTO_ACCEPT, MATCH_NEEDS_CONFIRM } from './match-confidence';
import type { ExerciseMatchCandidate, ImportRowStatus, WorkoutImportExercise } from './types';

export type ExerciseCatalogEntry = {
  id: string;
  name: string;
};

/** Deterministic normalize for exercise titles (equipment suffixes, casing, punctuation). */
export function normalizeExerciseName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(barbell|dumbbell|cable|machine|smith|ez|kettlebell|band|bodyweight)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert catalogue search cost (lower is better) into a 0–1 confidence.
 * Exact token match → ~0.98; soft fuzzy → confirm band; miss → 0.
 */
export function exerciseMatchConfidence(query: string, candidateName: string): number {
  const qNorm = normalizeExerciseName(query);
  const cNorm = normalizeExerciseName(candidateName);
  if (!qNorm || !cNorm) return 0;
  if (qNorm === cNorm) return 0.98;

  const cost = exerciseSearchScore(qNorm, cNorm);
  if (cost === null) {
    // Also try raw names in case equipment tokens matter.
    const rawCost = exerciseSearchScore(query, candidateName);
    if (rawCost === null) return 0;
    return costToConfidence(rawCost, query, candidateName);
  }
  if (cost === 0 && (cNorm.startsWith(qNorm) || qNorm.startsWith(cNorm))) return 0.95;
  if (cost === 0) return 0.92;
  return costToConfidence(cost, query, candidateName);
}

function costToConfidence(cost: number, query: string, candidateName: string): number {
  // Soften with Jaccard on normalized tokens so partial overlaps land in confirm.
  const qTokens = new Set(normalizeExerciseName(query).split(' ').filter(Boolean));
  const cTokens = new Set(normalizeExerciseName(candidateName).split(' ').filter(Boolean));
  let overlap = 0;
  for (const token of qTokens) if (cTokens.has(token)) overlap += 1;
  const jaccard =
    qTokens.size === 0 || cTokens.size === 0 ? 0 : overlap / (qTokens.size + cTokens.size - overlap);

  const fromCost = Math.max(0, 1 - cost / 12);
  const blended = fromCost * 0.55 + jaccard * 0.45;
  return Math.round(Math.min(0.94, blended) * 1000) / 1000;
}

export function rankExerciseMatches(
  query: string,
  catalog: readonly ExerciseCatalogEntry[],
  limit = 5,
): ExerciseMatchCandidate[] {
  const scored: ExerciseMatchCandidate[] = [];
  for (const entry of catalog) {
    const confidence = exerciseMatchConfidence(query, entry.name);
    if (confidence < MATCH_NEEDS_CONFIRM - 0.15) continue;
    scored.push({ exerciseId: entry.id, name: entry.name, confidence });
  }
  scored.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}

export function applyExerciseMatch(
  exercise: WorkoutImportExercise,
  candidates: readonly ExerciseMatchCandidate[],
): WorkoutImportExercise {
  const best = candidates[0] ?? null;
  if (!best) {
    return {
      ...exercise,
      exerciseId: null,
      matchConfidence: 0,
      candidates: null,
      status: 'needsMatch',
      note: 'Unmatched — keep free-text name',
    };
  }
  const band = classifyMatchConfidence(best.confidence);
  if (band === 'auto') {
    return {
      ...exercise,
      name: best.name,
      exerciseId: best.exerciseId,
      matchConfidence: best.confidence,
      candidates: null,
      status: 'ready',
      note: null,
    };
  }
  if (band === 'confirm') {
    return {
      ...exercise,
      matchConfidence: best.confidence,
      candidates: [...candidates],
      status: 'needsMatch',
      note: 'Needs confirmation',
    };
  }
  return {
    ...exercise,
    exerciseId: null,
    matchConfidence: best.confidence,
    candidates: candidates.length > 0 ? [...candidates] : null,
    status: 'needsMatch',
    note: 'Unmatched — keep free-text name',
  };
}

export function matchWorkoutExercises(
  exercises: readonly WorkoutImportExercise[],
  catalog: readonly ExerciseCatalogEntry[],
): WorkoutImportExercise[] {
  return exercises.map((exercise) => {
    if (!exercise.name.trim()) {
      return { ...exercise, status: 'invalid' as ImportRowStatus, note: 'Missing exercise name' };
    }
    const candidates = rankExerciseMatches(exercise.name, catalog);
    return applyExerciseMatch(exercise, candidates);
  });
}

export { MATCH_AUTO_ACCEPT, MATCH_NEEDS_CONFIRM, classifyMatchConfidence };
