import { describe, expect, it, vi } from 'vitest';

import { answerForDate, resolveWordleAnswer, scoreWordleRound } from './wordle.js';
import { WORDLE_ANSWERS, WORDLE_GUESSES } from './wordle-words.js';

describe('daily wordle', () => {
  it('uses the New York Times solution order and guess list', () => {
    expect(WORDLE_ANSWERS[0]).toBe('cigar');
    expect(answerForDate('2021-06-19')).toBe('cigar');
    expect(answerForDate('2026-10-16')).toBe('shady');
    expect(answerForDate('2026-10-17')).toBe('gaffe');
    expect(answerForDate('2026-10-18')).toBe('adorn');
    expect(WORDLE_GUESSES.has('aahed')).toBe(true);
    expect(WORDLE_GUESSES.has('adorn')).toBe(true);
    for (const word of WORDLE_ANSWERS) {
      expect(word).toMatch(/^[a-z]{5}$/);
      expect(WORDLE_GUESSES.has(word)).toBe(true);
    }
  });

  it('rejects a guess that is not a word and reveals the answer only when the day is over', () => {
    const answer = answerForDate('2026-10-17');
    expect(answer).toBe('gaffe');
    if (!answer) throw new Error('missing answer');
    const rejected = scoreWordleRound('2026-10-17', ['zzzzz'], answer);
    expect(rejected.rejected).toBe('Not in word list');
    expect(rejected.answer).toBeUndefined();

    const playing = scoreWordleRound('2026-10-17', ['aahed'], answer);
    expect(playing.rows).toHaveLength(1);
    expect(playing.rows[0]?.tiles).toHaveLength(5);
    expect(playing.status).toBe('playing');
    expect(playing.answer).toBeUndefined();
  });

  it('uses the same answer for the same calendar day', () => {
    const answer = answerForDate('2026-10-17') ?? '';
    const wrong = ['aahed', 'cigar', 'rebut', 'sissy', 'humph', 'awake'];
    const first = scoreWordleRound('2026-10-17', wrong, answer);
    const second = scoreWordleRound('2026-10-17', wrong, answer);
    expect(first.status).toBe('lost');
    expect(first.answer).toBe('gaffe');
    expect(second.answer).toBe(first.answer);
  });

  it('loads a later official solution when the bundled list has not caught up', async () => {
    const date = '2030-06-19';
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ solution: 'quart', print_date: date }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveWordleAnswer(date)).resolves.toBe('quart');
    await expect(resolveWordleAnswer(date)).resolves.toBe('quart');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});