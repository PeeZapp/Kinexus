import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  crosswordSolved,
  crosswordWrong,
  dailyCrossword,
  type CrosswordDirection,
  type CrosswordPuzzle,
} from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';

import { useGameKeys } from './keys';
import { usePuzzleState } from './use-puzzle-state';

type BoardState = { entries: string[]; checked: boolean };

function blank(puzzle: CrosswordPuzzle): BoardState {
  return { entries: puzzle.cells.map((cell) => (cell ? '' : '#')), checked: false };
}

function revive(puzzle: CrosswordPuzzle, raw: unknown): BoardState | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { entries?: unknown; checked?: unknown };
  const stored = Array.isArray(row.entries) ? row.entries : null;
  if (!stored || stored.length !== puzzle.cells.length) return null;
  const entries = puzzle.cells.map((cell, index) => {
    if (!cell) return '#';
    const letter = String(stored[index] ?? '').toLowerCase();
    return /^[a-z]$/.test(letter) ? letter : '';
  });
  return { entries, checked: row.checked === true };
}

function wordAt(puzzle: CrosswordPuzzle, index: number, direction: CrosswordDirection) {
  return puzzle.clues.find((clue) => clue.direction === direction && clue.cells.includes(index)) ?? null;
}

function move(puzzle: CrosswordPuzzle, index: number, direction: CrosswordDirection, delta: 1 | -1): number {
  const word = wordAt(puzzle, index, direction);
  if (!word) return index;
  const place = word.cells.indexOf(index);
  const next = word.cells[place + delta];
  return next ?? index;
}

export function CrosswordGame({ date }: { date: string }) {
  const puzzle = useMemo(() => dailyCrossword(date), [date]);
  const fallback = useMemo(() => blank(puzzle), [puzzle]);
  const { value, commit, ready } = usePuzzleState('crossword', date, fallback, (raw) => revive(puzzle, raw));
  const [cursor, setCursor] = useState(() => puzzle.cells.findIndex((cell) => cell) );
  const [direction, setDirection] = useState<CrosswordDirection>('across');
  const active = wordAt(puzzle, cursor, direction);
  const wrong = value.checked ? crosswordWrong(puzzle, value.entries) : [];
  const won = crosswordSolved(puzzle, value.entries);

  const typeAt = (index: number, letter: string) => {
    if (won || !puzzle.cells[index]) return;
    const entries = value.entries.slice();
    entries[index] = letter;
    commit({ entries, checked: value.checked });
    setCursor(move(puzzle, index, direction, 1));
  };

  const eraseAt = (index: number) => {
    if (won) return;
    const entries = value.entries.slice();
    if (entries[index]) {
      entries[index] = '';
      commit({ entries, checked: value.checked });
      return;
    }
    const previous = move(puzzle, index, direction, -1);
    if (previous === index) return;
    entries[previous] = '';
    commit({ entries, checked: value.checked });
    setCursor(previous);
  };

  useGameKeys(ready && !won, (key, event) => {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      setDirection('across');
      setCursor((current) => move(puzzle, current, 'across', key === 'ArrowLeft' ? -1 : 1));
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      setDirection('down');
      setCursor((current) => move(puzzle, current, 'down', key === 'ArrowUp' ? -1 : 1));
    } else if (key === 'Backspace') {
      event.preventDefault();
      eraseAt(cursor);
    } else if (/^[a-zA-Z]$/.test(key)) {
      event.preventDefault();
      typeAt(cursor, key.toLowerCase());
    } else if (key === 'Tab') {
      event.preventDefault();
      setDirection((current) => (current === 'across' ? 'down' : 'across'));
    }
  });

  const fillCells = (cells: number[], letterFor: (index: number) => string) => {
    const entries = value.entries.slice();
    for (const index of cells) entries[index] = letterFor(index);
    commit({ entries, checked: false });
  };

  if (!ready) return <Text style={styles.note}>Opening today’s crossword…</Text>;

  const cellSize = puzzle.size <= 3 ? 64 : 46;
  const gap = 3;

  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>
        {won
          ? 'Solved. Every entry crosses.'
          : `${active ? `${active.number} ${active.direction}. ${active.clue}` : 'Tap a square and type.'} Arrow keys move. Tab switches direction.`}
      </Text>
      <View style={[styles.grid, { width: puzzle.size * cellSize + (puzzle.size - 1) * gap }]}>
        {puzzle.cells.map((cell, index) => {
          if (!cell) return <View key={index} style={[styles.block, { width: cellSize, height: cellSize }]} />;
          const inWord = active?.cells.includes(index);
          return (
            <Pressable
              key={index}
              accessibilityLabel={cell.number ? `Square ${cell.number}` : 'Square'}
              onPress={() => {
                if (cursor === index) setDirection((current) => (current === 'across' ? 'down' : 'across'));
                else setCursor(index);
              }}
              style={[
                styles.cell,
                { width: cellSize, height: cellSize },
                inWord && styles.cellWord,
                cursor === index && styles.cellOn,
                wrong[index] && styles.cellWrong,
              ]}>
              {cell.number ? <Text style={styles.number}>{cell.number}</Text> : null}
              <Text style={styles.letter}>{value.entries[index]?.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Btn label="Check" variant="secondary" disabled={won} onPress={() => commit({ ...value, checked: true })} />
        <Btn
          label="Reveal letter"
          variant="ghost"
          disabled={won || !puzzle.cells[cursor]}
          onPress={() => fillCells([cursor], (index) => puzzle.cells[index]?.letter ?? '')}
        />
        <Btn
          label="Reveal word"
          variant="ghost"
          disabled={won || !active}
          onPress={() => fillCells(active?.cells ?? [], (index) => puzzle.cells[index]?.letter ?? '')}
        />
      </View>
      <View style={styles.clues}>
        {(['across', 'down'] as const).map((side) => (
          <View key={side} style={styles.clueCol}>
            <Text style={styles.clueHead}>{side === 'across' ? 'Across' : 'Down'}</Text>
            {puzzle.clues
              .filter((clue) => clue.direction === side)
              .map((clue) => {
                const done = clue.cells.every((index) => value.entries[index] === puzzle.cells[index]?.letter);
                const on = active?.direction === clue.direction && active.number === clue.number;
                return (
                  <Pressable
                    key={`${clue.direction}-${clue.number}`}
                    onPress={() => {
                      setDirection(clue.direction);
                      setCursor(clue.cells.find((index) => value.entries[index] !== puzzle.cells[index]?.letter) ?? clue.cells[0] ?? 0);
                    }}>
                    <Text style={[styles.clue, on && styles.clueOn, done && styles.clueDone]}>
                      {clue.number}. {clue.clue}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', gap: 3 },
  block: { backgroundColor: 'transparent' },
  cell: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWord: { backgroundColor: colors.accentSoft },
  cellOn: { borderColor: colors.accent, borderWidth: 2 },
  cellWrong: { backgroundColor: colors.dangerBg },
  number: { position: 'absolute', top: 2, left: 3, color: colors.textDim, fontSize: 9, fontWeight: '700' },
  letter: { color: colors.text, fontSize: 20, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clues: { flexDirection: 'row', gap: 16 },
  clueCol: { flex: 1, gap: 6, minWidth: 140 },
  clueHead: { color: colors.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  clue: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  clueOn: { color: colors.accent },
  clueDone: { textDecorationLine: 'line-through', color: colors.textDim },
});
