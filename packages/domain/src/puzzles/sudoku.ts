import { rngFor, shuffle } from './rng';

export type SudokuPuzzle = {
  puzzle: number[];
  solution: number[];
};

const cache = new Map<string, SudokuPuzzle>();

function boxIndex(index: number): number {
  const row = Math.floor(index / 9);
  const col = index % 9;
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

export function sudokuConflicts(values: readonly number[]): boolean[] {
  const conflicts = Array.from({ length: 81 }, () => false);
  const mark = (indexes: number[]) => {
    const seen = new Map<number, number[]>();
    for (const index of indexes) {
      const value = values[index] ?? 0;
      if (!value) continue;
      const list = seen.get(value) ?? [];
      list.push(index);
      seen.set(value, list);
    }
    for (const list of seen.values()) {
      if (list.length < 2) continue;
      for (const index of list) conflicts[index] = true;
    }
  };
  for (let row = 0; row < 9; row += 1) mark(Array.from({ length: 9 }, (_, col) => row * 9 + col));
  for (let col = 0; col < 9; col += 1) mark(Array.from({ length: 9 }, (_, row) => row * 9 + col));
  for (let box = 0; box < 9; box += 1) {
    const startRow = Math.floor(box / 3) * 3;
    const startCol = (box % 3) * 3;
    const indexes: number[] = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) indexes.push((startRow + row) * 9 + startCol + col);
    }
    mark(indexes);
  }
  return conflicts;
}

function solutionCount(source: readonly number[], limit: number): number {
  const cells = source.slice();
  const rows = Array.from({ length: 9 }, () => 0);
  const cols = Array.from({ length: 9 }, () => 0);
  const boxes = Array.from({ length: 9 }, () => 0);
  const empty: number[] = [];
  for (let index = 0; index < 81; index += 1) {
    const value = cells[index] ?? 0;
    if (!value) {
      empty.push(index);
      continue;
    }
    const bit = 1 << value;
    rows[Math.floor(index / 9)] = (rows[Math.floor(index / 9)] ?? 0) | bit;
    cols[index % 9] = (cols[index % 9] ?? 0) | bit;
    const box = boxIndex(index);
    boxes[box] = (boxes[box] ?? 0) | bit;
  }

  let count = 0;
  const visit = (cursor: number) => {
    if (count >= limit) return;
    if (cursor === empty.length) {
      count += 1;
      return;
    }
    let best = cursor;
    let bestCount = 10;
    for (let look = cursor; look < empty.length; look += 1) {
      const index = empty[look]!;
      const row = Math.floor(index / 9);
      const col = index % 9;
      const mask = (rows[row] ?? 0) | (cols[col] ?? 0) | (boxes[boxIndex(index)] ?? 0);
      let available = 0;
      for (let digit = 1; digit <= 9; digit += 1) if ((mask & (1 << digit)) === 0) available += 1;
      if (available < bestCount) {
        bestCount = available;
        best = look;
        if (available === 0) break;
      }
    }
    if (bestCount === 0) return;
    const chosen = empty[best]!;
    empty[best] = empty[cursor]!;
    empty[cursor] = chosen;
    const index = empty[cursor]!;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = boxIndex(index);
    const mask = (rows[row] ?? 0) | (cols[col] ?? 0) | (boxes[box] ?? 0);
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = 1 << digit;
      if (mask & bit) continue;
      rows[row] = (rows[row] ?? 0) | bit;
      cols[col] = (cols[col] ?? 0) | bit;
      boxes[box] = (boxes[box] ?? 0) | bit;
      cells[index] = digit;
      visit(cursor + 1);
      rows[row] = (rows[row] ?? 0) ^ bit;
      cols[col] = (cols[col] ?? 0) ^ bit;
      boxes[box] = (boxes[box] ?? 0) ^ bit;
      cells[index] = 0;
      if (count >= limit) break;
    }
    empty[cursor] = empty[best]!;
    empty[best] = chosen;
  };
  visit(0);
  return count;
}

function completeGrid(rng: () => number): number[] {
  const grid = Array.from({ length: 81 }, () => 0);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const fillAt = (cursor: number): boolean => {
    if (cursor === 81) return true;
    let index = -1;
    for (let look = 0; look < 81; look += 1) {
      if (grid[look] === 0) {
        index = look;
        break;
      }
    }
    if (index < 0) return true;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = boxIndex(index);
    for (const digit of shuffle(rng, digits)) {
      const bit = 1 << digit;
      let used = false;
      for (let peer = 0; peer < 9; peer += 1) {
        if (grid[row * 9 + peer] === digit || grid[peer * 9 + col] === digit) used = true;
      }
      const startRow = Math.floor(box / 3) * 3;
      const startCol = (box % 3) * 3;
      for (let y = 0; y < 3; y += 1) {
        for (let x = 0; x < 3; x += 1) if (grid[(startRow + y) * 9 + startCol + x] === digit) used = true;
      }
      if (used || bit === 0) continue;
      grid[index] = digit;
      if (fillAt(cursor + 1)) return true;
      grid[index] = 0;
    }
    return false;
  };
  if (!fillAt(0)) throw new Error('Could not fill a sudoku');
  return grid;
}

function carve(date: string): SudokuPuzzle {
  const rng = rngFor(`sudoku:${date}`);
  const solution = completeGrid(rng);
  const puzzle = solution.slice();
  let givens = 81;
  for (const index of shuffle(rng, Array.from({ length: 81 }, (_, cell) => cell))) {
    if (givens <= 36) break;
    const saved = puzzle[index] ?? 0;
    puzzle[index] = 0;
    if (solutionCount(puzzle, 2) === 1) givens -= 1;
    else puzzle[index] = saved;
  }
  return { puzzle, solution };
}

export function dailySudoku(date: string): SudokuPuzzle {
  const cached = cache.get(date);
  if (cached) return cached;
  const puzzle = carve(date);
  cache.set(date, puzzle);
  return puzzle;
}

export function sudokuSolved(values: readonly number[], solution: readonly number[]): boolean {
  return solution.every((digit, index) => values[index] === digit);
}

export function sudokuPeers(index: number): number[] {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const peers = new Set<number>();
  for (let peer = 0; peer < 9; peer += 1) {
    peers.add(row * 9 + peer);
    peers.add(peer * 9 + col);
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) peers.add((startRow + y) * 9 + startCol + x);
  }
  peers.delete(index);
  return [...peers];
}
