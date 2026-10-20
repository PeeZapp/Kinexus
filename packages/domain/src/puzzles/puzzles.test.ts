import { describe, expect, it } from 'vitest';

import { crosswordSolved, crosswordWrong, dailyCrossword } from './crossword';
import { dailyGroups, groupBank, groupWords, judgeGroup } from './groups';
import { dailyLogic, logicSolvable } from './logic';
import { MEMORY_LIMIT, dailyMemorySequence } from './memory';
import { dailyPatterns } from './pattern';
import { dailySudoku, sudokuConflicts, sudokuSolved } from './sudoku';

describe('daily puzzles', () => {
  it('builds a stable mini crossword whose entries cross', () => {
    const first = dailyCrossword('2026-10-18');
    const second = dailyCrossword('2026-10-18');
    expect(second.clues.map((clue) => clue.answer)).toEqual(first.clues.map((clue) => clue.answer));
    expect(first.clues.length).toBeGreaterThanOrEqual(6);
    for (const clue of first.clues) {
      const word = clue.cells.map((cell) => first.cells[cell]?.letter).join('');
      expect(word).toBe(clue.answer);
      expect(clue.clue.toLowerCase()).not.toBe(clue.answer);
    }
    const letters = first.cells.map((cell) => cell?.letter ?? '');
    expect(crosswordSolved(first, letters)).toBe(true);
    const wrong = letters.slice();
    const open = first.cells.findIndex((cell) => cell);
    wrong[open] = wrong[open] === 'a' ? 'b' : 'a';
    expect(crosswordWrong(first, wrong)[open]).toBe(true);
    expect(dailyCrossword('2026-10-19').clues.map((clue) => clue.answer).join()).not.toBe(
      first.clues.map((clue) => clue.answer).join(),
    );
    for (let offset = 0; offset < 22; offset += 1) {
      const puzzle = dailyCrossword(`2026-10-${String(offset + 1).padStart(2, '0')}`);
      expect(puzzle.clues.length).toBeGreaterThanOrEqual(6);
      for (const clue of puzzle.clues) {
        expect(clue.clue.toLowerCase()).not.toBe(clue.answer);
        expect(clue.cells.map((cell) => puzzle.cells[cell]?.letter).join('')).toBe(clue.answer);
      }
    }
  });

  it('gives four disjoint groups and knows a one-away guess', () => {
    const words = groupBank().flatMap((group) => group.words);
    expect(new Set(words).size).toBe(words.length);
    const puzzle = dailyGroups('2026-10-18');
    expect(new Set(puzzle.categories.map((group) => group.difficulty))).toEqual(new Set([0, 1, 2, 3]));
    expect(new Set(groupWords(puzzle)).size).toBe(16);
    expect(dailyGroups('2026-10-18').categories.map((group) => group.title)).toEqual(
      puzzle.categories.map((group) => group.title),
    );
    const correct = puzzle.categories[0]!.words;
    expect(judgeGroup(puzzle, correct).result).toBe('correct');
    expect(judgeGroup(puzzle, [correct[0]!, correct[1]!, correct[2]!, puzzle.categories[1]!.words[0]!]).result).toBe('one-away');
  });

  it('builds one valid sudoku for the day', () => {
    const puzzle = dailySudoku('2026-10-18');
    expect(puzzle.solution).toHaveLength(81);
    expect(puzzle.puzzle.filter((digit) => digit === 0).length).toBeGreaterThan(20);
    expect(sudokuConflicts(puzzle.solution).some(Boolean)).toBe(false);
    expect(sudokuSolved(puzzle.puzzle, puzzle.solution)).toBe(false);
    expect(sudokuSolved(puzzle.solution, puzzle.solution)).toBe(true);
    expect(dailySudoku('2026-10-18').puzzle).toEqual(puzzle.puzzle);
  });

  it('deals a memory sequence that does not stutter', () => {
    const sequence = dailyMemorySequence('2026-10-18');
    expect(sequence).toHaveLength(MEMORY_LIMIT);
    expect(sequence.every((tile, index) => tile !== sequence[index - 1])).toBe(true);
    expect(dailyMemorySequence('2026-10-18')).toEqual(sequence);
  });

  it('builds a logic puzzle the clues actually solve', () => {
    const puzzle = dailyLogic('2026-10-18');
    expect(puzzle.clues.length).toBeGreaterThanOrEqual(4);
    expect(logicSolvable(puzzle)).toBe(true);
    expect(dailyLogic('2026-10-18').clues.map((clue) => clue.text)).toEqual(puzzle.clues.map((clue) => clue.text));
  });

  it('asks for the cell the pattern rule produces', () => {
    const rounds = dailyPatterns('2026-10-18');
    expect(rounds).toHaveLength(5);
    for (const round of rounds) {
      expect(round.matrix[2]?.[2]).toBeNull();
      expect(round.options).toHaveLength(4);
      expect(round.answer).toBeGreaterThanOrEqual(0);
      expect(new Set(round.options.map((cell) => `${cell.shape}:${cell.fill}:${cell.count}`)).size).toBe(4);
    }
    expect(dailyPatterns('2026-10-18')[0]?.answer).toBe(rounds[0]?.answer);
  });
});
