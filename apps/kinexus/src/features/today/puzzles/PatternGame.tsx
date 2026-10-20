import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dailyPatterns, type PatternCell } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { colors, radius } from '@/src/features/shell/theme';

import { usePuzzleState } from './use-puzzle-state';

type PatternState = { round: number; score: number; choice: number | null; shown: boolean; done: boolean };

const START: PatternState = { round: 0, score: 0, choice: null, shown: false, done: false };
const INK = '#3ECFBF';

function Shape({ cell, size }: { cell: PatternCell; size: number }) {
  const solid = cell.fill === 'solid';
  const half = cell.fill === 'half';
  if (cell.shape === 'triangle') {
    return (
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size / 2,
          borderRightWidth: size / 2,
          borderBottomWidth: size,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: solid || half ? INK : 'transparent',
          opacity: solid ? 1 : 0.45,
        }}
      />
    );
  }
  const box = (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 2,
        borderColor: INK,
        borderRadius: cell.shape === 'circle' ? size : 3,
        backgroundColor: solid ? INK : 'transparent',
        overflow: 'hidden',
        transform: cell.shape === 'diamond' ? [{ rotate: '45deg' }, { scale: 0.72 }] : undefined,
      }}>
      {half ? <View style={{ width: '50%', height: '100%', backgroundColor: INK }} /> : null}
    </View>
  );
  return box;
}

function Glyph({ cell, size }: { cell: PatternCell; size: number }) {
  const piece = Math.max(12, Math.floor(size / (cell.count === 1 ? 1.4 : cell.count)));
  return (
    <View style={styles.glyph}>
      {Array.from({ length: cell.count }, (_, index) => (
        <Shape key={index} cell={cell} size={piece} />
      ))}
    </View>
  );
}

export function PatternGame({ date }: { date: string }) {
  const rounds = useMemo(() => dailyPatterns(date), [date]);
  const { value, commit, ready } = usePuzzleState('pattern', date, START, (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Partial<PatternState>;
    if (typeof row.round !== 'number' || typeof row.score !== 'number') return null;
    const round = Math.max(0, Math.min(rounds.length, Math.round(row.round)));
    return {
      round,
      score: Math.max(0, Math.min(rounds.length, Math.round(row.score))),
      choice: typeof row.choice === 'number' && row.choice >= 0 && row.choice < 4 ? row.choice : null,
      shown: row.shown === true,
      done: row.done === true || round >= rounds.length,
    };
  });

  if (!ready) return <Text style={styles.note}>Opening today’s patterns…</Text>;

  if (value.done || value.round >= rounds.length) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.note}>
          Five grids finished. {value.score} of {rounds.length} matched the rule.
        </Text>
      </View>
    );
  }

  const round = rounds[value.round];
  if (!round) return null;
  const correct = value.choice === round.answer;

  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>
        Grid {value.round + 1} of {rounds.length}. {round.prompt}
      </Text>
      <View style={styles.matrix}>
        {round.matrix.flatMap((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <View key={`${rowIndex}-${colIndex}`} style={styles.matrixCell}>
              {cell ? <Glyph cell={cell} size={28} /> : <Text style={styles.ask}>?</Text>}
            </View>
          )),
        )}
      </View>
      <View style={styles.options}>
        {round.options.map((cell, index) => {
          const picked = value.choice === index;
          const reveal = value.shown && index === round.answer;
          const miss = value.shown && picked && !correct;
          return (
            <Pressable
              key={index}
              disabled={value.shown}
              onPress={() => commit({ ...value, choice: index })}
              style={[styles.option, picked && styles.optionOn, reveal && styles.optionYes, miss && styles.optionNo]}>
              <Glyph cell={cell} size={26} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        {!value.shown ? (
          <Btn
            label="Check"
            disabled={value.choice == null}
            onPress={() =>
              commit({
                ...value,
                shown: true,
                score: value.choice === round.answer ? value.score + 1 : value.score,
              })
            }
          />
        ) : (
          <Btn
            label={value.round === rounds.length - 1 ? 'Finish' : 'Next grid'}
            onPress={() =>
              commit({
                round: value.round + 1,
                score: value.score,
                choice: null,
                shown: false,
                done: value.round + 1 >= rounds.length,
              })
            }
          />
        )}
        <Text style={styles.score}>
          {value.shown ? (correct ? 'That cell follows the rule.' : 'The highlighted cell follows the rule.') : `${value.score} correct so far`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  matrix: { flexDirection: 'row', flexWrap: 'wrap', width: 208, gap: 8 },
  matrixCell: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ask: { color: colors.accent, fontSize: 22, fontWeight: '800' },
  glyph: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    width: 86,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionOn: { borderColor: colors.accent },
  optionYes: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionNo: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  score: { color: colors.textDim, fontSize: 13 },
});
