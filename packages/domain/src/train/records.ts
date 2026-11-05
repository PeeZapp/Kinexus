import type { ExerciseRecord, LoggedSet, RecordUpdate } from './types';

/** Parse a weight field. Non-numeric text returns null (never a bogus 0). */
export function parseWeight(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function applyLoggedSets(current: ExerciseRecord | null, sets: readonly LoggedSet[]): RecordUpdate | null {
  const done = sets.filter((set) => set.done && (set.weight.trim() || set.reps.trim()));
  const last = done.at(-1);
  if (!last) return null;
  let bestWeight = current?.bestWeight ?? '';
  let bestReps = current?.bestReps ?? '';
  let isPr = false;
  for (const set of done) {
    const next = parseWeight(set.weight);
    if (next == null || next <= 0) continue;
    const currentBest = parseWeight(bestWeight) ?? 0;
    if (next > currentBest) {
      bestWeight = set.weight.trim();
      bestReps = set.reps.trim();
      isPr = true;
    }
  }
  return {
    lastWeight: last.weight.trim(),
    lastReps: last.reps.trim(),
    bestWeight,
    bestReps,
    isPr,
  };
}
