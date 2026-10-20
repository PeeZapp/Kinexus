import { describe, expect, it } from 'vitest';

import { isRecentPuzzleDate, puzzleIndex, scoreWordleGuess, wordleKeyboard, wordlePuzzleNumber, wordleStatus } from './index';

describe('wordle scoring', () => {
  it('marks greens before yellows so repeated letters are not double-counted', () => {
    expect(scoreWordleGuess('babes', 'abbey')).toEqual(['present', 'present', 'correct', 'correct', 'absent']);
    expect(scoreWordleGuess('ooooo', 'robot')).toEqual(['absent', 'correct', 'absent', 'correct', 'absent']);
    expect(scoreWordleGuess('crane', 'crane')).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('ends after a solve or six guesses', () => {
    expect(wordleStatus(['crane'], 'crane')).toBe('won');
    expect(wordleStatus(['aaaaa', 'bbbbb', 'ccccc', 'ddddd', 'eeeee', 'fffff'], 'crane')).toBe('lost');
    expect(wordleStatus(['slate'], 'crane')).toBe('playing');
  });

  it('keeps the strongest keyboard mark for a letter', () => {
    const marks = wordleKeyboard([
      { guess: 'slate', tiles: ['absent', 'present', 'absent', 'absent', 'present'] },
      { guess: 'crane', tiles: ['correct', 'absent', 'correct', 'correct', 'correct'] },
    ]);
    expect(marks.e).toBe('correct');
    expect(marks.s).toBe('absent');
    expect(marks.a).toBe('correct');
  });

  it('picks a stable word for a calendar day and rejects far-off dates', () => {
    expect(puzzleIndex('2026-10-17', 10)).toBe(puzzleIndex('2026-10-17', 10));
    expect(wordlePuzzleNumber('2021-06-19')).toBe(0);
    expect(wordlePuzzleNumber('2026-10-18')).toBe(1947);
    expect(isRecentPuzzleDate('2026-10-17', new Date('2026-10-17T12:00:00Z'))).toBe(true);
    expect(isRecentPuzzleDate('2026-10-10', new Date('2026-10-17T12:00:00Z'))).toBe(false);
  });
});
