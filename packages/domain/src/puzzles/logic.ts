import { rngFor, shuffle } from './rng';

export type LogicClue =
  | { kind: 'is'; person: number; group: number; value: number; text: string }
  | { kind: 'not'; person: number; group: number; value: number; text: string }
  | { kind: 'link'; left: number; leftValue: number; right: number; rightValue: number; text: string }
  | { kind: 'unlink'; left: number; leftValue: number; right: number; rightValue: number; text: string };

export type LogicGroup = { name: string; values: readonly [string, string, string] };

export type LogicPuzzle = {
  people: readonly [string, string, string];
  groups: readonly [LogicGroup, LogicGroup];
  clues: LogicClue[];
  solution: readonly [readonly [number, number], readonly [number, number], readonly [number, number]];
};

const PEOPLE = ['Ava', 'Ben', 'Cam', 'Dee', 'Eli', 'Fay', 'Gil', 'Hoa', 'Ian', 'Joy'] as const;

const TRAITS: readonly { name: string; values: readonly [string, string, string, string, string, string] }[] = [
  { name: 'pet', values: ['cat', 'dog', 'bird', 'fish', 'horse', 'rabbit'] },
  { name: 'color', values: ['red', 'blue', 'green', 'gold', 'pink', 'navy'] },
  { name: 'drink', values: ['tea', 'milk', 'cocoa', 'juice', 'soda', 'water'] },
  { name: 'seat', values: ['window', 'aisle', 'middle', 'front', 'back', 'exit'] },
];

type Row = [Set<number>, Set<number>];

function fresh(): Row[] {
  return [0, 1, 2].map(() => [new Set([0, 1, 2]), new Set([0, 1, 2])]);
}

function clone(state: Row[]): Row[] {
  return state.map((row) => [new Set(row[0]), new Set(row[1])]);
}

function propagate(state: Row[]): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of [0, 1] as const) {
      for (let person = 0; person < 3; person += 1) {
        const options = state[person]![group];
        if (options.size === 0) return false;
        if (options.size !== 1) continue;
        const only = [...options][0]!;
        for (let other = 0; other < 3; other += 1) {
          if (other !== person && state[other]![group].delete(only)) changed = true;
        }
      }
      for (let value = 0; value < 3; value += 1) {
        const owners = [0, 1, 2].filter((person) => state[person]![group].has(value));
        if (owners.length === 0) return false;
        if (owners.length === 1 && state[owners[0]!]![group].size !== 1) {
          state[owners[0]!]![group] = new Set([value]);
          changed = true;
        }
      }
    }
  }
  return true;
}

function relate(state: Row[], clue: Extract<LogicClue, { kind: 'link' | 'unlink' }>): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (let person = 0; person < 3; person += 1) {
      const left = state[person]![clue.left];
      const right = state[person]![clue.right];
      const hasLeft = left.has(clue.leftValue);
      const hasRight = right.has(clue.rightValue);
      if (clue.kind === 'link') {
        if (!hasLeft && hasRight) {
          if (!right.delete(clue.rightValue)) return false;
          changed = true;
        } else if (hasLeft && !hasRight) {
          if (!left.delete(clue.leftValue)) return false;
          changed = true;
        } else if (left.size === 1 && hasLeft && right.size !== 1) {
          right.clear();
          right.add(clue.rightValue);
          changed = true;
        } else if (right.size === 1 && hasRight && left.size !== 1) {
          left.clear();
          left.add(clue.leftValue);
          changed = true;
        }
      } else if (left.size === 1 && hasLeft && hasRight) {
        if (!right.delete(clue.rightValue)) return false;
        changed = true;
      } else if (right.size === 1 && hasRight && hasLeft) {
        if (!left.delete(clue.leftValue)) return false;
        changed = true;
      }
    }
    if (!propagate(state)) return false;
  }
  return true;
}

function applyClue(state: Row[], clue: LogicClue): boolean {
  if (clue.kind === 'is') state[clue.person]![clue.group] = new Set([clue.value]);
  else if (clue.kind === 'not') state[clue.person]![clue.group].delete(clue.value);
  else if (!relate(state, clue)) return false;
  return propagate(state);
}

function isSolved(state: Row[]): boolean {
  return state.every((row) => row[0].size === 1 && row[1].size === 1);
}

function matches(state: Row[], solution: LogicPuzzle['solution']): boolean {
  return solution.every((row, person) => state[person]![0].has(row[0]) && state[person]![1].has(row[1]));
}

export function logicSolvable(puzzle: LogicPuzzle): boolean {
  const state = fresh();
  for (const clue of puzzle.clues) {
    if (!applyClue(state, clue)) return false;
  }
  return isSolved(state) && matches(state, puzzle.solution);
}

function phrase(group: string, value: string): string {
  if (group === 'color') return `the color ${value}`;
  if (group === 'drink') return `${value}`;
  if (group === 'seat') return `the ${value} seat`;
  return `the ${value}`;
}

function owns(person: string, group: string, value: string, negative: boolean): string {
  const item = phrase(group, value);
  if (group === 'drink') {
    return negative ? `${person} does not drink ${item}.` : `${person} drinks ${item}.`;
  }
  if (group === 'seat') {
    return negative ? `${person} does not sit in ${item}.` : `${person} sits in ${item}.`;
  }
  if (group === 'color') {
    return negative ? `${person}'s color is not ${value}.` : `${person}'s color is ${value}.`;
  }
  return negative ? `${person} does not have ${item}.` : `${person} has ${item}.`;
}

function build(date: string, salt: number): LogicPuzzle | null {
  const rng = rngFor(`logic:${date}:${salt}`);
  const people = shuffle(rng, PEOPLE).slice(0, 3) as unknown as LogicPuzzle['people'];
  const picked = shuffle(rng, TRAITS).slice(0, 2);
  const groups = picked.map((trait) => ({
    name: trait.name,
    values: shuffle(rng, trait.values).slice(0, 3) as unknown as LogicGroup['values'],
  })) as unknown as LogicPuzzle['groups'];
  const solution: [number, number][] = [
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  for (const group of [0, 1] as const) {
    shuffle(rng, [0, 1, 2]).forEach((value, person) => {
      solution[person]![group] = value;
    });
  }
  const valueName = (group: number, value: number) => groups[group]!.values[value]!;
  const candidates: LogicClue[] = [];
  for (let person = 0; person < 3; person += 1) {
    for (const group of [0, 1] as const) {
      const value = solution[person]![group];
      candidates.push({
        kind: 'is',
        person,
        group,
        value,
        text: owns(people[person]!, groups[group]!.name, valueName(group, value), false),
      });
      for (let other = 0; other < 3; other += 1) {
        if (other === value) continue;
        candidates.push({
          kind: 'not',
          person,
          group,
          value: other,
          text: owns(people[person]!, groups[group]!.name, valueName(group, other), true),
        });
      }
    }
  }
  for (let person = 0; person < 3; person += 1) {
    const left = solution[person]![0];
    const right = solution[person]![1];
    const leftText = phrase(groups[0]!.name, valueName(0, left));
    const rightText = phrase(groups[1]!.name, valueName(1, right));
    candidates.push({
      kind: 'link',
      left: 0,
      leftValue: left,
      right: 1,
      rightValue: right,
      text: `Whoever has ${leftText} also has ${rightText}.`,
    });
    for (let other = 0; other < 3; other += 1) {
      if (other === right) continue;
      candidates.push({
        kind: 'unlink',
        left: 0,
        leftValue: left,
        right: 1,
        rightValue: other,
        text: `Whoever has ${leftText} does not have ${phrase(groups[1]!.name, valueName(1, other))}.`,
      });
    }
  }

  const chosen: LogicClue[] = [];
  for (const clue of shuffle(rng, candidates)) {
    const trial = fresh();
    let open = true;
    for (const existing of chosen) {
      if (!applyClue(trial, existing)) open = false;
    }
    if (!open || isSolved(trial)) break;
    const next = clone(trial);
    if (!applyClue(next, clue)) continue;
    chosen.push(clue);
    if (isSolved(next)) break;
  }

  let current = chosen.slice();
  for (const clue of chosen) {
    const trial = fresh();
    let ok = true;
    for (const item of current) {
      if (item === clue) continue;
      if (!applyClue(trial, item)) ok = false;
    }
    if (ok && isSolved(trial)) current = current.filter((item) => item !== clue);
  }
  if (current.length < 4) return null;
  if (!current.some((clue) => clue.kind === 'link' || clue.kind === 'unlink')) return null;
  const puzzle: LogicPuzzle = {
    people,
    groups,
    clues: current,
    solution: solution as unknown as LogicPuzzle['solution'],
  };
  return logicSolvable(puzzle) ? puzzle : null;
}

const cache = new Map<string, LogicPuzzle>();

export function dailyLogic(date: string): LogicPuzzle {
  const cached = cache.get(date);
  if (cached) return cached;
  for (let salt = 0; salt < 30; salt += 1) {
    const puzzle = build(date, salt);
    if (puzzle) {
      cache.set(date, puzzle);
      return puzzle;
    }
  }
  throw new Error(`No logic puzzle for ${date}`);
}

export function logicCellIndex(person: number, group: number, value: number): number {
  return person * 6 + group * 3 + value;
}

export function cycleLogicMark(marks: readonly number[], index: number): number[] {
  const next = marks.slice();
  const current = next[index] ?? 0;
  const person = Math.floor(index / 6);
  const rest = index % 6;
  const group = Math.floor(rest / 3);
  const value = rest % 3;
  const cycled = current === 0 ? 1 : current === 1 ? 2 : 0;
  next[index] = cycled;
  if (cycled === 1) {
    for (let other = 0; other < 3; other += 1) {
      if (other !== value) next[logicCellIndex(person, group, other)] = 2;
      if (other !== person) next[logicCellIndex(other, group, value)] = 2;
    }
  }
  return next;
}

export function logicSolved(puzzle: LogicPuzzle, marks: readonly number[]): boolean {
  return puzzle.solution.every((row, person) => row.every((value, group) => marks[logicCellIndex(person, group, value)] === 1));
}

export function logicContradictions(puzzle: LogicPuzzle, marks: readonly number[]): boolean[] {
  return marks.map((mark, index) => {
    if (mark !== 1) return false;
    const person = Math.floor(index / 6);
    const rest = index % 6;
    return puzzle.solution[person]?.[Math.floor(rest / 3)] !== rest % 3;
  });
}
