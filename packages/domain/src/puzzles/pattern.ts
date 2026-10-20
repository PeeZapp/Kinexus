import { rngFor, shuffle } from './rng';

export type PatternShape = 'circle' | 'square' | 'triangle' | 'diamond';
export type PatternFill = 'none' | 'solid' | 'half';

export type PatternCell = {
  shape: PatternShape;
  fill: PatternFill;
  count: 1 | 2 | 3;
};

export type PatternPuzzle = {
  prompt: string;
  matrix: (PatternCell | null)[][];
  options: PatternCell[];
  answer: number;
};

const SHAPES: PatternShape[] = ['circle', 'square', 'triangle', 'diamond'];
const FILLS: PatternFill[] = ['none', 'solid', 'half'];

function sameCell(a: PatternCell, b: PatternCell): boolean {
  return a.shape === b.shape && a.fill === b.fill && a.count === b.count;
}

function makePuzzle(date: string, round: number): PatternPuzzle {
  const rng = rngFor(`pattern:${date}:${round}`);
  const rule = round % 3;
  const shapeOrder = shuffle(rng, SHAPES);
  const fillOrder = shuffle(rng, FILLS);
  const cellAt = (row: number, col: number): PatternCell => {
    if (rule === 0) {
      return { shape: shapeOrder[row] ?? 'circle', fill: fillOrder[0] ?? 'solid', count: (col + 1) as 1 | 2 | 3 };
    }
    if (rule === 1) {
      return { shape: shapeOrder[col] ?? 'circle', fill: fillOrder[row] ?? 'none', count: 1 };
    }
    return {
      shape: shapeOrder[(row + col) % shapeOrder.length] ?? 'circle',
      fill: fillOrder[col] ?? 'none',
      count: (row + 1) as 1 | 2 | 3,
    };
  };
  const prompt =
    rule === 0
      ? 'In each row the shape stays the same and the count grows.'
      : rule === 1
        ? 'Each column keeps its shape. Each row keeps its fill.'
        : 'Shape shifts along the diagonal, count grows down the column, and fill follows the column.';
  const matrix: (PatternCell | null)[][] = [0, 1, 2].map((row) =>
    [0, 1, 2].map((col) => (row === 2 && col === 2 ? null : cellAt(row, col))),
  );
  const answerCell = cellAt(2, 2);
  const distractors: PatternCell[] = [];
  const mutations: PatternCell[] = [
    { ...answerCell, count: answerCell.count === 3 ? 1 : ((answerCell.count + 1) as 2 | 3) },
    { ...answerCell, shape: shapeOrder.find((shape) => shape !== answerCell.shape) ?? 'square' },
    { ...answerCell, fill: FILLS.find((fill) => fill !== answerCell.fill) ?? 'none' },
  ];
  for (const mutation of mutations) {
    if (!sameCell(mutation, answerCell) && !distractors.some((cell) => sameCell(cell, mutation))) distractors.push(mutation);
  }
  let guard = 0;
  while (distractors.length < 3 && guard < 12) {
    const extra: PatternCell = {
      shape: shapeOrder[guard % shapeOrder.length] ?? 'diamond',
      fill: fillOrder[guard % fillOrder.length] ?? 'half',
      count: ((guard % 3) + 1) as 1 | 2 | 3,
    };
    guard += 1;
    if (!sameCell(extra, answerCell) && !distractors.some((cell) => sameCell(cell, extra))) distractors.push(extra);
  }
  const options = shuffle(rng, [answerCell, ...distractors.slice(0, 3)]);
  return {
    prompt,
    matrix,
    options,
    answer: options.findIndex((cell) => sameCell(cell, answerCell)),
  };
}

export function dailyPatterns(date: string): PatternPuzzle[] {
  return [0, 1, 2, 3, 4].map((round) => makePuzzle(date, round));
}

export function patternCellsMatch(a: PatternCell, b: PatternCell): boolean {
  return sameCell(a, b);
}
