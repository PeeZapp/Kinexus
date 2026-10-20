import { rngFor } from './rng';

export const MEMORY_TILES = 9;
export const MEMORY_GOAL = 8;
export const MEMORY_LIMIT = 12;
export const MEMORY_LIVES = 3;

const sequences = new Map<string, number[]>();

export function dailyMemorySequence(date: string): number[] {
  const cached = sequences.get(date);
  if (cached) return cached;
  const rng = rngFor(`memory:${date}`);
  const sequence: number[] = [];
  let previous = -1;
  while (sequence.length < MEMORY_LIMIT) {
    const next = Math.floor(rng() * MEMORY_TILES);
    if (next === previous) continue;
    sequence.push(next);
    previous = next;
  }
  sequences.set(date, sequence);
  return sequence;
}

export function memoryWon(reached: number): boolean {
  return reached >= MEMORY_GOAL;
}
