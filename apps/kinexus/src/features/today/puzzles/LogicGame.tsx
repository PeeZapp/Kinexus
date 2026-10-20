import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cycleLogicMark, dailyLogic, logicCellIndex, logicContradictions, logicSolved } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { colors, radius } from '@/src/features/shell/theme';

import { usePuzzleState } from './use-puzzle-state';

type LogicState = { marks: number[]; hints: number; checked: boolean };

const HINT_LIMIT = 3;

export function LogicGame({ date }: { date: string }) {
  const puzzle = useMemo(() => dailyLogic(date), [date]);
  const fallback = useMemo<LogicState>(() => ({ marks: Array.from({ length: 18 }, () => 0), hints: 0, checked: false }), []);
  const { value, commit, ready } = usePuzzleState('logic', date, fallback, (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Partial<LogicState>;
    if (!Array.isArray(row.marks) || row.marks.length !== 18) return null;
    return {
      marks: row.marks.map((mark) => (mark === 1 || mark === 2 ? mark : 0)),
      hints: Math.max(0, Math.min(HINT_LIMIT, Number(row.hints) || 0)),
      checked: row.checked === true,
    };
  });

  if (!ready) return <Text style={styles.note}>Opening today’s logic grid…</Text>;

  const won = logicSolved(puzzle, value.marks);
  const bad = value.checked ? logicContradictions(puzzle, value.marks) : [];

  const hint = () => {
    if (won || value.hints >= HINT_LIMIT) return;
    let marks = value.marks.slice();
    for (let person = 0; person < 3; person += 1) {
      for (let group = 0; group < 2; group += 1) {
        const valueIndex = puzzle.solution[person]?.[group] ?? 0;
        const index = logicCellIndex(person, group, valueIndex);
        if (marks[index] === 1) continue;
        if (marks[index] === 2) marks = cycleLogicMark(marks, index);
        marks = cycleLogicMark(marks, index);
        commit({ marks, hints: value.hints + 1, checked: false });
        return;
      }
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>
        {won
          ? 'Solved. Every person has one match in each category.'
          : 'Tap a cell to cycle blank, yes, and no. A yes clears the other options in that row and column.'}
      </Text>
      <View style={styles.clues}>
        {puzzle.clues.map((clue) => (
          <Text key={clue.text} style={styles.clue}>
            {clue.text}
          </Text>
        ))}
      </View>
      {puzzle.groups.map((group, groupIndex) => (
        <View key={group.name} style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.head, styles.person]}>{group.name}</Text>
            {group.values.map((label) => (
              <Text key={label} style={styles.head}>
                {label}
              </Text>
            ))}
          </View>
          {puzzle.people.map((person, personIndex) => (
            <View key={person} style={styles.row}>
              <Text style={[styles.person, styles.personName]}>{person}</Text>
              {group.values.map((label, valueIndex) => {
                const index = logicCellIndex(personIndex, groupIndex, valueIndex);
                const mark = value.marks[index] ?? 0;
                return (
                  <Pressable
                    key={label}
                    disabled={won}
                    onPress={() => commit({ ...value, checked: false, marks: cycleLogicMark(value.marks, index) })}
                    style={[styles.cell, mark === 1 && styles.yes, bad[index] && styles.bad]}>
                    <Text style={[styles.mark, mark === 1 && styles.markYes]}>{mark === 1 ? 'Yes' : mark === 2 ? 'No' : ''}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
      <View style={styles.actions}>
        <Btn label="Check" variant="secondary" disabled={won} onPress={() => commit({ ...value, checked: true })} />
        <Btn label={value.hints >= HINT_LIMIT ? 'No hints left' : `Hint ${value.hints}/${HINT_LIMIT}`} variant="ghost" disabled={won || value.hints >= HINT_LIMIT} onPress={hint} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  clues: { gap: 6 },
  clue: { color: colors.text, fontSize: 14, lineHeight: 20 },
  table: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  head: { flex: 1, color: colors.textDim, fontSize: 12, fontWeight: '700', textAlign: 'center', textTransform: 'capitalize' },
  person: { width: 64, flex: 0 },
  personName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cell: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yes: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  bad: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mark: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  markYes: { color: colors.accent },
});
