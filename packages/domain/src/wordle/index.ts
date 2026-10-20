export const WORDLE_LENGTH = 5;
export const WORDLE_GUESSES = 6;

export type WordleTile = 'correct' | 'present' | 'absent';
export type WordleStatus = 'playing' | 'won' | 'lost';

export type WordleRow = {
  guess: string;
  tiles: WordleTile[];
};

export type WordleRound = {
  date: string;
  rows: WordleRow[];
  status: WordleStatus;
  answer?: string;
  rejected?: string;
};

const TILE_RANK: Record<WordleTile, number> = { absent: 1, present: 2, correct: 3 };

export function scoreWordleGuess(guess: string, answer: string): WordleTile[] {
  const attempt = guess.toLowerCase();
  const target = answer.toLowerCase();
  const tiles: WordleTile[] = Array.from({ length: WORDLE_LENGTH }, () => 'absent');
  const remaining = new Map<string, number>();
  for (const letter of target) remaining.set(letter, (remaining.get(letter) ?? 0) + 1);

  for (let index = 0; index < WORDLE_LENGTH; index += 1) {
    if (attempt[index] !== target[index]) continue;
    tiles[index] = 'correct';
    const letter = attempt[index] ?? '';
    remaining.set(letter, (remaining.get(letter) ?? 0) - 1);
  }

  for (let index = 0; index < WORDLE_LENGTH; index += 1) {
    if (tiles[index] === 'correct') continue;
    const letter = attempt[index] ?? '';
    const left = remaining.get(letter) ?? 0;
    if (left <= 0) continue;
    tiles[index] = 'present';
    remaining.set(letter, left - 1);
  }

  return tiles;
}

export function wordleStatus(guesses: readonly string[], answer: string): WordleStatus {
  if (guesses.some((guess) => guess.toLowerCase() === answer.toLowerCase())) return 'won';
  if (guesses.length >= WORDLE_GUESSES) return 'lost';
  return 'playing';
}

export function wordleKeyboard(rows: readonly WordleRow[]): Record<string, WordleTile> {
  const marks: Record<string, WordleTile> = {};
  for (const row of rows) {
    row.guess.split('').forEach((letter, index) => {
      const tile = row.tiles[index];
      if (!tile) return;
      const key = letter.toLowerCase();
      const previous = marks[key];
      if (!previous || TILE_RANK[tile] > TILE_RANK[previous]) marks[key] = tile;
    });
  }
  return marks;
}

export function puzzleIndex(dateIso: string, length: number): number {
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day || length <= 0) return 0;
  const days = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return ((days % length) + length) % length;
}

/** Days since the first New York Times Wordle, 2021-06-19, which is puzzle 0. */
export function wordlePuzzleNumber(dateIso: string): number {
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day) return -1;
  const days = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const launch = Math.floor(Date.UTC(2021, 5, 19) / 86_400_000);
  return days - launch;
}

export function isRecentPuzzleDate(dateIso: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day) return false;
  const requested = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const delta = Math.round((requested - today) / 86_400_000);
  return delta >= -1 && delta <= 1;
}

export function localPuzzleDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
