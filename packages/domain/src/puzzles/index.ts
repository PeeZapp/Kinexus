export { dailyCrossword, crosswordSolved, crosswordWrong } from './crossword';
export type { CrosswordCell, CrosswordClue, CrosswordDirection, CrosswordPuzzle } from './crossword';
export { GROUP_LIVES, dailyGroups, groupBank, groupWords, judgeGroup } from './groups';
export type { GroupGuess, GroupsPuzzle, WordGroup } from './groups';
export { dailyLogic, cycleLogicMark, logicCellIndex, logicContradictions, logicSolvable, logicSolved } from './logic';
export type { LogicClue, LogicGroup, LogicPuzzle } from './logic';
export { MEMORY_GOAL, MEMORY_LIMIT, MEMORY_LIVES, MEMORY_TILES, dailyMemorySequence, memoryWon } from './memory';
export { dailyPatterns, patternCellsMatch } from './pattern';
export type { PatternCell, PatternFill, PatternPuzzle, PatternShape } from './pattern';
export { dailySudoku, sudokuConflicts, sudokuPeers, sudokuSolved } from './sudoku';
export type { SudokuPuzzle } from './sudoku';

export const PUZZLE_GAMES = [
  { id: 'crossword', label: 'Crossword', blurb: 'A fresh mini. Every across and down entry is a real word.' },
  { id: 'groups', label: 'Groups', blurb: 'Sort sixteen words into four groups of four. Four mistakes ends the day.' },
  { id: 'sudoku', label: 'Sudoku', blurb: 'Fill the grid so each row, column, and box contains 1–9 once.' },
  { id: 'memory', label: 'Memory', blurb: 'Watch a sequence, then repeat it. It grows by one each time you are right.' },
  { id: 'logic', label: 'Logic', blurb: 'Read the clues and match each person to both categories.' },
  { id: 'pattern', label: 'Patterns', blurb: 'Five grids. Pick the cell that continues the rule.' },
] as const;

export type PuzzleGameId = (typeof PUZZLE_GAMES)[number]['id'];
