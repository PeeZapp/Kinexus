import {
  WORDLE_GUESSES,
  isRecentPuzzleDate,
  scoreWordleGuess,
  wordlePuzzleNumber,
  wordleStatus,
  type WordleRound,
} from '@kinexus/domain';

import { WORDLE_ANSWERS, WORDLE_GUESSES as DICTIONARY } from './wordle-words.js';

const fetchedAnswers = new Map<string, string>();

export function answerForDate(dateIso: string): string | undefined {
  const index = wordlePuzzleNumber(dateIso);
  return WORDLE_ANSWERS[index] ?? fetchedAnswers.get(dateIso);
}

/** Official daily solution. Dates past the bundled list are read from the New York Times puzzle. */
export async function resolveWordleAnswer(dateIso: string): Promise<string | undefined> {
  const known = answerForDate(dateIso);
  if (known) return known;
  try {
    const response = await fetch(`https://www.nytimes.com/svc/wordle/v2/${dateIso}.json`, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { solution?: unknown; print_date?: unknown };
    if (body.print_date !== dateIso || typeof body.solution !== 'string') return undefined;
    const solution = body.solution.toLowerCase();
    if (!/^[a-z]{5}$/.test(solution)) return undefined;
    fetchedAnswers.set(dateIso, solution);
    DICTIONARY.add(solution);
    return solution;
  } catch {
    return undefined;
  }
}

export function scoreWordleRound(date: string, guesses: readonly string[], answer: string): WordleRound {
  const rows: WordleRound['rows'] = [];
  for (const raw of guesses) {
    if (rows.length >= WORDLE_GUESSES) break;
    if (wordleStatus(rows.map((row) => row.guess), answer) !== 'playing') break;
    const guess = raw.toLowerCase();
    if (!/^[a-z]{5}$/.test(guess) || !DICTIONARY.has(guess)) {
      return {
        date,
        rows,
        status: wordleStatus(rows.map((row) => row.guess), answer),
        rejected: 'Not in word list',
      };
    }
    rows.push({ guess, tiles: scoreWordleGuess(guess, answer) });
  }
  const status = wordleStatus(rows.map((row) => row.guess), answer);
  return {
    date,
    rows,
    status,
    answer: status === 'playing' ? undefined : answer,
  };
}

export async function handleOverviewWordle(body: { date?: unknown; guesses?: unknown }, now = new Date()): Promise<{
  status: number;
  body: WordleRound | { error: string };
}> {
  const date = typeof body.date === 'string' ? body.date : '';
  if (!isRecentPuzzleDate(date, now)) {
    return { status: 400, body: { error: 'That puzzle is not available today.' } };
  }
  const answer = await resolveWordleAnswer(date);
  if (!answer) return { status: 400, body: { error: 'That puzzle is not available today.' } };
  const guesses = Array.isArray(body.guesses) ? body.guesses.map((guess) => String(guess)) : [];
  return { status: 200, body: scoreWordleRound(date, guesses, answer) };
}
