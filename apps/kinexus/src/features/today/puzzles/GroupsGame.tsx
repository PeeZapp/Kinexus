import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GROUP_LIVES, dailyGroups, groupWords, judgeGroup } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { colors, radius } from '@/src/features/shell/theme';

import { usePuzzleState } from './use-puzzle-state';

const BANDS = ['#c9b458', '#6aaa64', '#4a90b8', '#b07cc6'];

type GroupsState = {
  found: number[];
  mistakes: number;
  selected: string[];
  order: string[];
  over: boolean;
  note: string;
};

function mix(words: string[]): string[] {
  const copy = words.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swap]!;
    copy[swap] = current;
  }
  return copy;
}

export function GroupsGame({ date }: { date: string }) {
  const puzzle = useMemo(() => dailyGroups(date), [date]);
  const words = useMemo(() => groupWords(puzzle), [puzzle]);
  const fallback = useMemo<GroupsState>(
    () => ({ found: [], mistakes: 0, selected: [], order: mix(words), over: false, note: 'Find four words that belong together.' }),
    [words],
  );
  const { value, commit, ready } = usePuzzleState('groups', date, fallback, (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Partial<GroupsState>;
    if (!Array.isArray(row.order) || !Array.isArray(row.found) || typeof row.mistakes !== 'number') return null;
    const known = new Set(words);
    const order = row.order.map(String).filter((word) => known.has(word));
    if (order.length !== words.length) return null;
    return {
      found: row.found.filter((index) => Number.isInteger(index) && index >= 0 && index < 4),
      mistakes: Math.max(0, Math.min(GROUP_LIVES, row.mistakes)),
      selected: Array.isArray(row.selected) ? row.selected.map(String).filter((word) => known.has(word)).slice(0, 4) : [],
      order,
      over: row.over === true || row.mistakes >= GROUP_LIVES,
      note: typeof row.note === 'string' ? row.note : fallback.note,
    };
  });

  if (!ready) return <Text style={styles.note}>Opening today’s groups…</Text>;

  const solved = new Set(value.found.flatMap((index) => puzzle.categories[index]?.words ?? []));
  const remaining = value.order.filter((word) => !solved.has(word));
  const lives = GROUP_LIVES - value.mistakes;
  const finished = value.over || value.found.length === 4;

  const toggle = (word: string) => {
    if (finished || solved.has(word)) return;
    const selected = value.selected.includes(word)
      ? value.selected.filter((item) => item !== word)
      : value.selected.length >= 4
        ? value.selected
        : [...value.selected, word];
    commit({ ...value, selected, note: selected.length === 4 ? 'Submit these four, or tap one to change it.' : value.note });
  };

  const submit = () => {
    if (value.selected.length !== 4 || finished) return;
    const judged = judgeGroup(puzzle, value.selected);
    if (judged.result === 'correct' && judged.title) {
      const index = puzzle.categories.findIndex((group) => group.title === judged.title);
      const found = value.found.includes(index) ? value.found : [...value.found, index];
      commit({
        ...value,
        found,
        selected: [],
        over: false,
        note: found.length === 4 ? 'All four groups found.' : `${judged.title}.`,
      });
      return;
    }
    const mistakes = value.mistakes + 1;
    const over = mistakes >= GROUP_LIVES;
    commit({
      ...value,
      mistakes,
      over,
      selected: over ? [] : value.selected,
      note: over
        ? 'Four misses. The remaining groups are shown.'
        : judged.result === 'one-away'
          ? 'One away.'
          : 'Those four are not a group.',
    });
  };

  const reveal = value.over ? puzzle.categories.map((_, index) => index).filter((index) => !value.found.includes(index)) : [];

  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>{value.note}</Text>
      <Text style={styles.lives}>{finished && !value.over ? 'Solved' : `${lives} miss${lives === 1 ? '' : 'es'} left`}</Text>
      <View style={styles.stack}>
        {[...value.found, ...reveal].map((index) => {
          const group = puzzle.categories[index];
          if (!group) return null;
          return (
            <View key={group.title} style={[styles.band, { backgroundColor: BANDS[group.difficulty] ?? BANDS[0] }]}>
              <Text style={styles.bandTitle}>{group.title}</Text>
              <Text style={styles.bandWords}>{group.words.join(' · ')}</Text>
            </View>
          );
        })}
      </View>
      {remaining.length > 0 && !value.over ? (
        <View style={styles.grid}>
          {remaining.map((word) => {
            const on = value.selected.includes(word);
            return (
              <Pressable key={word} onPress={() => toggle(word)} style={[styles.tile, on && styles.tileOn]}>
                <Text style={[styles.word, on && styles.wordOn]}>{word}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {!finished ? (
        <View style={styles.actions}>
          <Btn label="Submit" disabled={value.selected.length !== 4} onPress={submit} />
          <Btn
            label="Shuffle"
            variant="secondary"
            onPress={() => commit({ ...value, order: [...value.order.filter((word) => solved.has(word)), ...mix(remaining)] })}
          />
          <Btn label="Clear" variant="ghost" disabled={value.selected.length === 0} onPress={() => commit({ ...value, selected: [] })} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  lives: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  stack: { gap: 8 },
  band: { borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  bandTitle: { color: '#121213', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  bandWords: { color: '#121213', fontSize: 13, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '22%',
    minWidth: 72,
    flexGrow: 1,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  tileOn: { backgroundColor: colors.accent },
  word: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  wordOn: { color: colors.bg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
