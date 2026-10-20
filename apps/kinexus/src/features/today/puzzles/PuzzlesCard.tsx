import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PUZZLE_GAMES, localPuzzleDate, type PuzzleGameId } from '@kinexus/domain';

import { colors, radius, space } from '@/src/features/shell/theme';

import { CrosswordGame } from './CrosswordGame';
import { GroupsGame } from './GroupsGame';
import { LogicGame } from './LogicGame';
import { MemoryGame } from './MemoryGame';
import { PatternGame } from './PatternGame';
import { SudokuGame } from './SudokuGame';

const EXTRA_GAMES = PUZZLE_GAMES.filter((game) => game.id !== 'sudoku');

export function SudokuCard() {
  const date = localPuzzleDate();
  const game = PUZZLE_GAMES.find((item) => item.id === 'sudoku');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sudoku</Text>
      <Text style={styles.blurb}>{game?.blurb}</Text>
      <SudokuGame date={date} />
    </View>
  );
}

export function MorePuzzles() {
  const date = localPuzzleDate();
  const [open, setOpen] = useState(false);
  const [game, setGame] = useState<Exclude<PuzzleGameId, 'sudoku'>>('crossword');
  const current = EXTRA_GAMES.find((item) => item.id === game) ?? EXTRA_GAMES[0];

  return (
    <View style={styles.more}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={[styles.moreBtn, open && styles.moreBtnOn]}>
        <Text style={[styles.moreLabel, open && styles.moreLabelOn]}>{open ? 'Hide puzzles' : 'More puzzles'}</Text>
      </Pressable>
      {open && current ? (
        <View style={styles.card}>
          <View style={styles.tabs}>
            {EXTRA_GAMES.map((item) => {
              const on = item.id === current.id;
              return (
                <Pressable key={item.id} onPress={() => setGame(item.id)} style={[styles.tab, on && styles.tabOn]}>
                  <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.blurb}>{current.blurb}</Text>
          {current.id === 'crossword' ? <CrosswordGame date={date} /> : null}
          {current.id === 'groups' ? <GroupsGame date={date} /> : null}
          {current.id === 'memory' ? <MemoryGame date={date} /> : null}
          {current.id === 'logic' ? <LogicGame date={date} /> : null}
          {current.id === 'pattern' ? <PatternGame date={date} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  more: { gap: 12, alignItems: 'flex-start' },
  moreBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  moreLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  moreLabelOn: { color: colors.bg },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  blurb: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  tabOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tabLabelOn: { color: colors.bg },
});
