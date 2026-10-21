import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  crosswordSolved,
  crosswordWrong,
  dailyCrossword,
  type CrosswordDirection,
  type CrosswordPuzzle,
} from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

import { useGameKeys } from './keys';
import { usePuzzleState } from './use-puzzle-state';

const LETTER_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const;

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

function useTouchEntry(): boolean {
  const { mode, isNative } = useExperienceMode();
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isNative || mode === 'mobile' || coarse;
}

export function CrosswordGame({ date }: { date: string }) {
  const puzzle = useMemo(() => dailyCrossword(date), [date]);
  const fallback = useMemo(() => blank(puzzle), [puzzle]);
  const { value, commit, ready } = usePuzzleState('crossword', date, fallback, (raw) => revive(puzzle, raw));
  const [cursor, setCursor] = useState(() => puzzle.cells.findIndex((cell) => cell));
  const [direction, setDirection] = useState<CrosswordDirection>('across');
  const [draft, setDraft] = useState('');
  const touch = useTouchEntry();
  const inputRef = useRef<TextInput>(null);
  const typedRef = useRef('');
  const boardRef = useRef(value);
  const cursorRef = useRef(cursor);
  const directionRef = useRef(direction);
  boardRef.current = value;
  cursorRef.current = cursor;
  directionRef.current = direction;
  const active = wordAt(puzzle, cursor, direction);
  const wrong = value.checked ? crosswordWrong(puzzle, value.entries) : [];
  const won = crosswordSolved(puzzle, value.entries);
  const wonRef = useRef(won);
  wonRef.current = won;

  const focusEntry = () => {
    if (wonRef.current) return;
    const node = inputRef.current as (TextInput & { focus?: (opts?: { preventScroll?: boolean }) => void }) | null;
    node?.focus?.({ preventScroll: true });
  };

  const typeLetters = (letters: string) => {
    if (wonRef.current || !letters) return;
    const entries = boardRef.current.entries.slice();
    let index = cursorRef.current;
    for (const letter of letters) {
      if (!/^[a-z]$/.test(letter) || !puzzle.cells[index]) break;
      entries[index] = letter;
      const next = move(puzzle, index, directionRef.current, 1);
      if (next === index) break;
      index = next;
    }
    const nextState = { entries, checked: boardRef.current.checked };
    boardRef.current = nextState;
    cursorRef.current = index;
    commit(nextState);
    setCursor(index);
  };

  const eraseAt = (index: number) => {
    if (wonRef.current) return;
    const entries = boardRef.current.entries.slice();
    if (entries[index]) {
      entries[index] = '';
      const nextState = { entries, checked: boardRef.current.checked };
      boardRef.current = nextState;
      commit(nextState);
      return;
    }
    const previous = move(puzzle, index, directionRef.current, -1);
    if (previous === index) return;
    entries[previous] = '';
    const nextState = { entries, checked: boardRef.current.checked };
    boardRef.current = nextState;
    cursorRef.current = previous;
    commit(nextState);
    setCursor(previous);
  };

  const onDraft = (text: string) => {
    const letters = text.toLowerCase().replace(/[^a-z]/g, '');
    if (!letters) {
      typedRef.current = '';
      setDraft('');
      return;
    }
    const previous = typedRef.current;
    const added = previous && letters.startsWith(previous) ? letters.slice(previous.length) : letters.slice(-1);
    typedRef.current = letters;
    if (added) typeLetters(added);
    setDraft('');
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
      typeLetters(key.toLowerCase());
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
          : touch
            ? `${active ? `${active.number} ${active.direction}. ${active.clue}` : 'Tap a square.'} Use the letters below, or tap a square and type. Tap a selected square to switch direction.`
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
                focusEntry();
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
      {won ? null : (
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={onDraft}
          onKeyPress={(event) => {
            const key = event.nativeEvent.key;
            if (key === 'Backspace' || key === 'Delete') eraseAt(cursorRef.current);
            else if (key === 'ArrowLeft' || key === 'ArrowRight') {
              setDirection('across');
              setCursor((current) => move(puzzle, current, 'across', key === 'ArrowLeft' ? -1 : 1));
            } else if (key === 'ArrowUp' || key === 'ArrowDown') {
              setDirection('down');
              setCursor((current) => move(puzzle, current, 'down', key === 'ArrowUp' ? -1 : 1));
            }
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          caretHidden
          blurOnSubmit={false}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={styles.capture}
        />
      )}
      {touch && !won ? (
        <View style={styles.pad}>
          <View style={styles.dirRow}>
            {(['across', 'down'] as const).map((side) => {
              const on = direction === side;
              return (
                <Pressable
                  key={side}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setDirection(side)}
                  style={[styles.dir, on && styles.dirOn]}>
                  <Text style={[styles.dirLabel, on && styles.dirLabelOn]}>{side === 'across' ? 'Across' : 'Down'}</Text>
                </Pressable>
              );
            })}
          </View>
          {LETTER_ROWS.map((row) => (
            <View key={row} style={styles.padRow}>
              {row === 'zxcvbnm' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Delete" onPress={() => eraseAt(cursor)} style={[styles.padKey, styles.padWide]}>
                  <Text style={styles.padWideLabel}>Del</Text>
                </Pressable>
              ) : null}
              {row.split('').map((letter) => (
                <Pressable
                  key={letter}
                  accessibilityRole="button"
                  accessibilityLabel={letter.toUpperCase()}
                  onPress={() => typeLetters(letter)}
                  style={styles.padKey}>
                  <Text style={styles.padLabel}>{letter.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      ) : null}
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
                      focusEntry();
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
  capture: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    fontSize: 16,
  },
  pad: { alignSelf: 'stretch', gap: 6 },
  dirRow: { flexDirection: 'row', gap: 8 },
  dir: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dirLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  dirLabelOn: { color: colors.bg },
  padRow: { flexDirection: 'row', gap: 4 },
  padKey: {
    flexGrow: 1,
    flexBasis: 0,
    height: 42,
    borderRadius: 6,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padWide: { flexGrow: 1.4 },
  padLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  padWideLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clues: { flexDirection: 'row', gap: 16 },
  clueCol: { flex: 1, gap: 6, minWidth: 140 },
  clueHead: { color: colors.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  clue: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  clueOn: { color: colors.accent },
  clueDone: { textDecorationLine: 'line-through', color: colors.textDim },
});
