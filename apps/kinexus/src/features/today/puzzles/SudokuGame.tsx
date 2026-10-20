import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dailySudoku, sudokuConflicts, sudokuPeers, sudokuSolved } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';

import { useGameKeys } from './keys';
import { usePuzzleState } from './use-puzzle-state';

type SudokuState = { values: number[]; notes: number[] };
type Snapshot = SudokuState;

function emptyNotes() {
  return Array.from({ length: 81 }, () => 0);
}

function revive(raw: unknown, puzzle: readonly number[]): SudokuState | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { values?: unknown; notes?: unknown };
  const stored = Array.isArray(row.values) ? row.values : null;
  if (!stored || stored.length !== 81) return null;
  const notes = Array.isArray(row.notes) && row.notes.length === 81 ? row.notes : emptyNotes();
  return {
    values: puzzle.map((given, index) => {
      if (given) return given;
      const value = Number(stored[index] ?? 0);
      return value >= 1 && value <= 9 ? value : 0;
    }),
    notes: notes.map((note, index) => (puzzle[index] ? 0 : Number(note) || 0)),
  };
}

export function SudokuGame({ date }: { date: string }) {
  const puzzle = useMemo(() => dailySudoku(date), [date]);
  const fallback = useMemo<SudokuState>(() => ({ values: puzzle.puzzle.slice(), notes: emptyNotes() }), [puzzle]);
  const { value, commit, ready } = usePuzzleState('sudoku', date, fallback, (raw) => revive(raw, puzzle.puzzle));
  const [cursor, setCursor] = useState(0);
  const [notesOn, setNotesOn] = useState(false);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const conflicts = sudokuConflicts(value.values);
  const won = sudokuSolved(value.values, puzzle.solution);
  const peers = useMemo(() => new Set(sudokuPeers(cursor)), [cursor]);

  const apply = (next: SudokuState) => {
    setUndo((stack) => [...stack.slice(-79), { values: value.values.slice(), notes: value.notes.slice() }]);
    commit(next);
  };

  const write = (digit: number) => {
    if (won || puzzle.puzzle[cursor]) return;
    if (notesOn) {
      const notes = value.notes.slice();
      const bit = 1 << (digit - 1);
      notes[cursor] = (notes[cursor] ?? 0) ^ bit;
      apply({ values: value.values, notes });
      return;
    }
    const values = value.values.slice();
    const notes = value.notes.slice();
    values[cursor] = values[cursor] === digit ? 0 : digit;
    notes[cursor] = 0;
    apply({ values, notes });
  };

  const erase = () => {
    if (won || puzzle.puzzle[cursor]) return;
    const values = value.values.slice();
    const notes = value.notes.slice();
    values[cursor] = 0;
    notes[cursor] = 0;
    apply({ values, notes });
  };

  useGameKeys(ready && !won, (key, event) => {
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      setCursor((current) => {
        const row = Math.floor(current / 9);
        const col = current % 9;
        if (key === 'ArrowLeft') return row * 9 + (col + 8) % 9;
        if (key === 'ArrowRight') return row * 9 + (col + 1) % 9;
        if (key === 'ArrowUp') return ((row + 8) % 9) * 9 + col;
        return ((row + 1) % 9) * 9 + col;
      });
    } else if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      write(Number(key));
    } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
      event.preventDefault();
      erase();
    } else if (key === 'n' || key === 'N') {
      setNotesOn((on) => !on);
    } else if ((key === 'z' || key === 'Z') && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setUndo((stack) => {
        const previous = stack[stack.length - 1];
        if (previous) commit(previous);
        return stack.slice(0, -1);
      });
    }
  });

  if (!ready) return <Text style={styles.note}>Opening today’s sudoku…</Text>;

  const counts = Array.from({ length: 9 }, (_, digit) => value.values.filter((value) => value === digit + 1).length);

  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>
        {won
          ? 'Solved. Each row, column, and box holds 1–9 once.'
          : 'Type 1–9, or use the pad. N toggles notes. Arrows move.'}
      </Text>
      <View style={styles.grid}>
        {value.values.map((digit, index) => {
          const given = puzzle.puzzle[index] !== 0;
          const row = Math.floor(index / 9);
          const col = index % 9;
          const same = digit > 0 && digit === value.values[cursor];
          return (
            <Pressable
              key={index}
              onPress={() => setCursor(index)}
              style={[
                styles.cell,
                row % 3 === 0 && styles.edgeTop,
                col % 3 === 0 && styles.edgeLeft,
                row === 8 && styles.edgeBottom,
                col === 8 && styles.edgeRight,
                peers.has(index) && styles.peer,
                same && styles.same,
                cursor === index && styles.on,
                conflicts[index] && styles.bad,
              ]}>
              {digit ? (
                <Text style={[styles.digit, given && styles.given, conflicts[index] && styles.badText]}>{digit}</Text>
              ) : (
                <View style={styles.noteGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((note) => (
                    <Text key={note} style={styles.noteDigit}>
                      {(value.notes[index] ?? 0) & (1 << (note - 1)) ? note : ''}
                    </Text>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.pad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <Pressable key={digit} onPress={() => write(digit)} style={[styles.key, counts[digit - 1] === 9 && styles.keyDone]}>
            <Text style={styles.keyDigit}>{digit}</Text>
            <Text style={styles.keyCount}>{9 - (counts[digit - 1] ?? 0)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.actions}>
        <Btn label={notesOn ? 'Notes on' : 'Notes'} variant={notesOn ? 'primary' : 'secondary'} onPress={() => setNotesOn((on) => !on)} />
        <Btn label="Erase" variant="secondary" disabled={won} onPress={erase} />
        <Btn
          label="Undo"
          variant="ghost"
          disabled={undo.length === 0}
          onPress={() =>
            setUndo((stack) => {
              const previous = stack[stack.length - 1];
              if (previous) commit(previous);
              return stack.slice(0, -1);
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 324, alignSelf: 'flex-start', backgroundColor: colors.bg },
  cell: {
    width: 36,
    height: 36,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  edgeTop: { borderTopWidth: 2, borderTopColor: colors.textDim },
  edgeLeft: { borderLeftWidth: 2, borderLeftColor: colors.textDim },
  edgeBottom: { borderBottomWidth: 2, borderBottomColor: colors.textDim },
  edgeRight: { borderRightWidth: 2, borderRightColor: colors.textDim },
  peer: { backgroundColor: colors.bgHover },
  same: { backgroundColor: colors.accentSoft },
  on: { backgroundColor: 'rgba(62, 207, 191, 0.28)' },
  bad: { backgroundColor: colors.dangerBg },
  digit: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  given: { color: colors.text },
  badText: { color: colors.danger },
  noteGrid: { width: 30, height: 30, flexDirection: 'row', flexWrap: 'wrap' },
  noteDigit: { width: 10, height: 10, textAlign: 'center', color: colors.textDim, fontSize: 8, lineHeight: 10 },
  pad: { flexDirection: 'row', gap: 4, width: 324, alignSelf: 'flex-start' },
  key: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDone: { opacity: 0.35 },
  keyDigit: { color: colors.text, fontSize: 16, fontWeight: '700' },
  keyCount: { color: colors.textDim, fontSize: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
