import type { ExerciseRecord, LoggedSet, RecordUpdate } from './types';

export function parseWeight(value: string): number {
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
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
    if (next <= 0) continue;
    if (next > parseWeight(bestWeight)) {
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
