import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { localPuzzleDate, wordleKeyboard, wordlePuzzleNumber, type WordleRound, type WordleTile } from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { colors, radius } from '@/src/features/shell/theme';
import { scoreWordle } from '@/src/features/today/api';
import { loadWordleGuesses, saveWordleGuesses } from '@/src/features/today/wordle-store';
import { useAuth } from '@/src/lib/auth';

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const;
const WIN_LABEL = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'];

const NYT = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
  key: '#818384',
  emptyBorder: '#3a3a3c',
  filledBorder: '#565758',
  board: '#121213',
  text: '#ffffff',
  toast: '#ffffff',
  toastText: '#121213',
};

if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('kinexus-wordle-motion')) {
  const style = document.createElement('style');
  style.id = 'kinexus-wordle-motion';
  style.textContent = [
    '@keyframes kinexus-wordle-flip{0%{transform:rotateX(0)}49%{transform:rotateX(-90deg)}50%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}',
    '@keyframes kinexus-wordle-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}',
  ].join('');
  document.head.appendChild(style);
}

export function WordleCard() {
  const { user } = useAuth();
  const date = localPuzzleDate();
  const inputRef = useRef<TextInput>(null);
  const draftRef = useRef('');
  const busyRef = useRef(false);
  const [round, setRound] = useState<WordleRound | null>(null);
  const [draft, setDraftState] = useState('');
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [pop, setPop] = useState<{ index: number; id: number } | null>(null);
  const [freshGuess, setFreshGuess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const playing = round?.status === 'playing';
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const roundRef = useRef(round);
  roundRef.current = round;

  const setDraft = (next: string) => {
    const clean = next.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
    if (clean.length > draftRef.current.length) setPop({ index: clean.length - 1, id: Date.now() });
    draftRef.current = clean;
    setDraftState(clean);
  };

  const showToast = (text: string) => setToast({ text, id: Date.now() });

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    setBusy(true);
    void loadWordleGuesses(user, date)
      .then((guesses) => scoreWordle(date, guesses))
      .then((next) => {
        if (!cancel) setRound(next);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Wordle is unavailable right now.');
      })
      .finally(() => {
        if (!cancel) setBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, [user, date]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(timer);
  }, [toast]);

  const focusBoard = () => {
    focusedRef.current = true;
    setFocused(true);
    const node = inputRef.current as (TextInput & { focus?: (opts?: { preventScroll?: boolean }) => void }) | null;
    node?.focus?.({ preventScroll: true });
  };

  const submit = () => {
    const current = roundRef.current;
    if (!user || !current || current.status !== 'playing' || busyRef.current) return;
    const guess = draftRef.current;
    if (guess.length !== 5) {
      showToast('Not enough letters');
      setShake((value) => value + 1);
      return;
    }
    const guesses = current.rows.map((row) => row.guess);
    busyRef.current = true;
    setBusy(true);
    void scoreWordle(date, [...guesses, guess])
      .then(async (next) => {
        setRound(next);
        if (next.rejected) {
          showToast(next.rejected);
          setShake((value) => value + 1);
          return;
        }
        setFreshGuess(guess);
        setDraft('');
        await saveWordleGuesses(user, date, next.rows.map((row) => row.guess));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not check that word.');
      })
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
        if (focusedRef.current) focusBoard();
      });
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const marks = wordleKeyboard(round?.rows ?? []);
  const emptyRows = Math.max(0, 6 - (round?.rows.length ?? 0) - (playing ? 1 : 0));
  const puzzle = wordlePuzzleNumber(date);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Wordle</Text>
      <Text style={styles.title}>No. {puzzle >= 0 ? puzzle : ''}</Text>
      {busy && !round ? <Text style={styles.body}>Opening today’s word…</Text> : null}
      <ErrorText message={error} />
      <View style={styles.game}>
        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        ) : null}
        <View style={styles.board}>
          {round?.rows.map((row) => (
            <View key={row.guess + row.tiles.join('')} style={styles.row}>
              {row.guess.split('').map((letter, index) => (
                <FlipTile
                  key={`${row.guess}-${index}`}
                  letter={letter}
                  color={NYT[row.tiles[index] ?? 'absent']}
                  delay={index * 300}
                  active={row.guess === freshGuess}
                />
              ))}
            </View>
          ))}
          {playing ? (
            <ShakeRow shake={shake}>
              {Array.from({ length: 5 }, (_, index) => {
                const letter = draft[index] ?? '';
                return (
                  <PopTile
                    key={index}
                    pop={pop?.index === index ? pop.id : 0}
                    filled={letter.length > 0}
                    current={focused && index === Math.min(draft.length, 4)}>
                    <Text style={styles.tileLetter}>{letter.toUpperCase()}</Text>
                  </PopTile>
                );
              })}
            </ShakeRow>
          ) : null}
          {Array.from({ length: emptyRows }, (_, index) => (
            <View key={`empty-${index}`} style={styles.row}>
              {Array.from({ length: 5 }, (_, cell) => (
                <View key={cell} style={[styles.tile, styles.tileEmpty]} />
              ))}
            </View>
          ))}
          {playing ? (
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => submitRef.current()}
              onKeyPress={(event) => {
                if (event.nativeEvent.key === 'Enter') submitRef.current();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              maxLength={5}
              caretHidden
              blurOnSubmit={false}
              onFocus={() => {
                focusedRef.current = true;
                setFocused(true);
              }}
              onBlur={() => {
                focusedRef.current = false;
                setFocused(false);
              }}
              accessibilityLabel="Type your guess"
              style={styles.hiddenInput}
            />
          ) : null}
        </View>
        {round?.status === 'won' ? (
          <Text style={styles.result}>{WIN_LABEL[round.rows.length - 1] ?? 'Phew'}</Text>
        ) : null}
        {round?.status === 'lost' ? <Text style={styles.result}>{round.answer?.toUpperCase()}</Text> : null}
        {playing ? (
          <View style={styles.keys}>
            {KEY_ROWS.map((row, rowIndex) => (
              <View key={row} style={[styles.keyRow, rowIndex === 1 ? styles.keyRowMid : null]}>
                {rowIndex === 2 ? (
                  <Pressable
                    onPress={() => submitRef.current()}
                    style={({ pressed }) => [styles.key, styles.keyWide, pressed ? styles.keyPressed : null]}>
                    <Text style={styles.keyWideText}>ENTER</Text>
                  </Pressable>
                ) : null}
                {row.split('').map((letter) => {
                  const mark = marks[letter];
                  return (
                    <Pressable
                      key={letter}
                      onPress={() => {
                        if (draftRef.current.length >= 5) return;
                        setDraft(draftRef.current + letter);
                        focusBoard();
                      }}
                      style={({ pressed }) => [
                        styles.key,
                        { backgroundColor: mark ? NYT[mark] : NYT.key },
                        pressed ? styles.keyPressed : null,
                      ]}>
                      <Text style={styles.keyText}>{letter.toUpperCase()}</Text>
                    </Pressable>
                  );
                })}
                {rowIndex === 2 ? (
                  <Pressable
                    onPress={() => {
                      setDraft(draftRef.current.slice(0, -1));
                      focusBoard();
                    }}
                    style={({ pressed }) => [styles.key, styles.keyWide, pressed ? styles.keyPressed : null]}>
                    <Text style={styles.keyText}>⌫</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ShakeRow({ shake, children }: { shake: number; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!shake) return;
    const steps = [10, -10, 8, -8, 4, -4, 0];
    Animated.sequence(
      steps.map((toValue) => Animated.timing(x, { toValue, duration: 45, useNativeDriver: true })),
    ).start();
  }, [shake, x]);
  return <Animated.View style={[styles.row, { transform: [{ translateX: x }] }]}>{children}</Animated.View>;
}

function PopTile({
  pop,
  filled,
  current,
  children,
}: {
  pop: number;
  filled: boolean;
  current: boolean;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pop) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.12, duration: 60, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [pop, scale]);
  return (
    <Animated.View
      style={[styles.tile, filled ? styles.tileFilled : styles.tileEmpty, current && styles.tileCurrent, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

function FlipTile({ letter, color, delay, active }: { letter: string; color: string; delay: number; active: boolean }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!active || Platform.OS !== 'web') return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node?.style) return;
    node.style.animation = `kinexus-wordle-flip 500ms ease-in ${delay}ms both`;
  }, [active, delay]);
  return (
    <View ref={ref} style={[styles.tile, styles.tileRevealed, { backgroundColor: color }]}>
      <Text style={styles.tileLetter}>{letter.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  game: {
    backgroundColor: NYT.board,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 16,
    alignItems: 'center',
    position: 'relative',
  },
  toast: {
    position: 'absolute',
    top: 8,
    zIndex: 2,
    backgroundColor: NYT.toast,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    color: NYT.toastText,
    fontSize: 14,
    fontWeight: '700',
  },
  board: {
    width: '100%',
    maxWidth: 350,
    gap: 5,
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  tile: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmpty: {
    backgroundColor: NYT.board,
    borderWidth: 2,
    borderColor: NYT.emptyBorder,
  },
  tileFilled: {
    backgroundColor: NYT.board,
    borderWidth: 2,
    borderColor: NYT.filledBorder,
  },
  tileCurrent: {
    borderColor: NYT.text,
  },
  tileRevealed: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileLetter: {
    color: NYT.text,
    fontSize: 28,
    fontWeight: '700',
  },
  result: {
    color: NYT.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
    color: 'transparent',
    zIndex: 1,
  },
  keys: {
    width: '100%',
    maxWidth: 500,
    gap: 8,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    justifyContent: 'center',
  },
  keyRowMid: {
    paddingHorizontal: 14,
  },
  key: {
    flexGrow: 1,
    flexBasis: 0,
    height: 58,
    borderRadius: 4,
    backgroundColor: NYT.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: {
    flexGrow: 1.5,
  },
  keyPressed: {
    opacity: 0.7,
  },
  keyText: {
    color: NYT.text,
    fontSize: 18,
    fontWeight: '700',
  },
  keyWideText: {
    color: NYT.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
