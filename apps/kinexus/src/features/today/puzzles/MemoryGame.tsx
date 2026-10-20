import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MEMORY_GOAL, MEMORY_LIMIT, MEMORY_LIVES, dailyMemorySequence, memoryWon } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { colors, radius } from '@/src/features/shell/theme';

import { usePuzzleState } from './use-puzzle-state';

const TILES = ['#3d8f6e', '#4a90b8', '#b07cc6', '#c9b458', '#d17a55', '#6a8caf', '#8f6b4a', '#5e9a86', '#a35d6a'];
const LETTERS = 'ABCDEFGHI';

type MemoryState = { step: number; mistakes: number; best: number; won: boolean; over: boolean };

const START: MemoryState = { step: 1, mistakes: 0, best: 0, won: false, over: false };

export function MemoryGame({ date }: { date: string }) {
  const sequence = useMemo(() => dailyMemorySequence(date), [date]);
  const { value, commit, ready } = usePuzzleState('memory', date, START, (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Partial<MemoryState>;
    if (typeof row.step !== 'number' || typeof row.mistakes !== 'number') return null;
    const step = Math.max(1, Math.min(MEMORY_LIMIT, Math.round(row.step)));
    const mistakes = Math.max(0, Math.min(MEMORY_LIVES, Math.round(row.mistakes)));
    const best = Math.max(0, Math.min(MEMORY_LIMIT, Math.round(row.best ?? 0)));
    return { step, mistakes, best, won: memoryWon(best), over: row.over === true || mistakes >= MEMORY_LIVES || best >= MEMORY_LIMIT };
  });
  const [phase, setPhase] = useState<'ready' | 'watch' | 'input'>('ready');
  const [lit, setLit] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('Watch the tiles, then tap them in order.');

  useEffect(() => {
    if (!ready || phase !== 'watch') return;
    const seq = sequence.slice(0, value.step);
    let tick = 0;
    const timer = setInterval(() => {
      const place = Math.floor(tick / 2);
      if (place >= seq.length) {
        setLit(null);
        setProgress(0);
        setPhase('input');
        setNote(`Your turn. ${value.step} step${value.step === 1 ? '' : 's'}.`);
        clearInterval(timer);
        return;
      }
      setLit(tick % 2 === 0 ? (seq[place] ?? null) : null);
      tick += 1;
    }, 340);
    return () => clearInterval(timer);
  }, [phase, ready, sequence, value.step]);

  if (!ready) return <Text style={styles.note}>Opening today’s memory sequence…</Text>;

  const lives = MEMORY_LIVES - value.mistakes;

  const press = (tile: number) => {
    if (phase !== 'input' || value.over) return;
    const expected = sequence[progress];
    if (tile !== expected) {
      const mistakes = value.mistakes + 1;
      const over = mistakes >= MEMORY_LIVES;
      commit({ ...value, mistakes, over, won: memoryWon(value.best) });
      setPhase('ready');
      setLit(null);
      setProgress(0);
      setNote(over ? 'Three misses. Today’s run is over.' : 'Not quite. Watch the same sequence again.');
      return;
    }
    const next = progress + 1;
    setLit(tile);
    if (next < value.step) {
      setProgress(next);
      return;
    }
    const best = Math.max(value.best, value.step);
    const won = memoryWon(best);
    const finished = value.step >= MEMORY_LIMIT;
    commit({
      step: finished ? value.step : value.step + 1,
      mistakes: value.mistakes,
      best,
      won,
      over: finished,
    });
    setPhase('ready');
    setLit(null);
    setProgress(0);
    setNote(finished ? 'Sequence complete, through all 12.' : won ? `Length ${value.step} locked in. The daily goal is met. Keep going if you want.` : `Length ${value.step} locked in.`);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.note}>{note}</Text>
      <Text style={styles.meta}>
        Length {value.over && value.best >= MEMORY_LIMIT ? MEMORY_LIMIT : value.step} · best {value.best} · goal {MEMORY_GOAL} · {lives} life
        {lives === 1 ? '' : 's'}
      </Text>
      <View style={styles.grid}>
        {TILES.map((color, index) => {
          const on = lit === index;
          return (
            <Pressable
              key={color}
              disabled={phase !== 'input'}
              onPress={() => press(index)}
              style={[styles.tile, { backgroundColor: on ? color : colors.bgHover }, on && styles.tileOn]}>
              <Text style={[styles.letter, { color: on ? '#121213' : color }]}>{LETTERS[index]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.pips}>
        {Array.from({ length: value.step }, (_, index) => (
          <View key={index} style={[styles.pip, index < progress && phase === 'input' && styles.pipOn]} />
        ))}
      </View>
      {!value.over ? (
        <Btn
          label={phase === 'watch' ? 'Watching…' : phase === 'input' ? 'Listening…' : value.best ? 'Next sequence' : 'Start'}
          disabled={phase !== 'ready'}
          onPress={() => {
            setNote('Watch.');
            setProgress(0);
            setPhase('watch');
          }}
        />
      ) : (
        <Text style={styles.note}>{value.won ? 'Daily goal reached.' : 'Come back tomorrow for a new sequence.'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: 280 },
  tile: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileOn: { transform: [{ scale: 1.04 }] },
  letter: { fontSize: 22, fontWeight: '800' },
  pips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 10 },
  pip: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  pipOn: { backgroundColor: colors.accent },
});
