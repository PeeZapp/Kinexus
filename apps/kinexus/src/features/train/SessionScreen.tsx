import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import {
  applyLoggedSets,
  canCreateShared,
  clusterExercises,
  generateFromCategoryMix,
  nextSimilarExercise,
  parseRemixSplit,
  shuffledRestQuiz,
  type RestExtra,
} from '@kinexus/domain';

import { useWakeLock } from '@/src/features/cook/use-wake-lock';
import { Sheet } from '@/src/features/meals/meals-kit';
import { AppModal } from '@/src/features/shell/AppModal';
import {
  createWorkout,
  finishSession,
  linkSessionWorkout,
  loadLibrary,
  loadLiveSession,
  loadMyRestScores,
  loadRecords,
  loadRestTops,
  loadWorkouts,
  openSession,
  replaceSessionExercise,
  rewriteSessionExercises,
  saveRestBest,
  saveWorkout,
  saveWorkoutRating,
  saveWorkoutUserNotes,
  updateSet,
  type LibraryExercise,
  type LiveSession,
  type RestGame,
  type RestGameScore,
  type SessionSet,
  type WorkoutDraft,
  type WorkoutExercise,
} from '@/src/features/train/api';
import { clock, exerciseFacts, exerciseTitle } from '@/src/features/train/format';
import { Badge, Choice, ExerciseSteps, Field, MediaGallery, NoteLine, Pill, Segmented, TrainButton, TrainPage } from '@/src/features/train/ui';
import { ErrorBanner } from '@/src/features/shell/states';
import { colors, radius } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const REST_TIMES = [60, 90, 120] as const;

const VISIBILITY = [
  { value: 'private', label: 'Only me' },
  { value: 'household', label: 'Household' },
  { value: 'people', label: 'People' },
] as const;

function templateSignature(workout: WorkoutDraft): string {
  return [...workout.exercises]
    .sort((a, b) => a.position - b.position)
    .map((exercise) => `${exercise.position}:${exercise.exerciseId ?? ''}`)
    .join('|');
}

function exerciseSignature(sets: SessionSet[]): string {
  const ids = new Map<number, string>();
  for (const set of sets) {
    if (!ids.has(set.position)) ids.set(set.position, set.exerciseId ?? '');
  }
  return [...ids.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([position, id]) => `${position}:${id}`)
    .join('|');
}

function findScore(scores: RestGameScore[], game: RestGame, seconds: number): number | undefined {
  return scores.find((item) => item.game === game && item.seconds === seconds)?.score;
}

function scoreBits(best?: number, top?: number): string {
  return [best ? `Best ${best}` : '', top ? `Top ${top}` : ''].filter(Boolean).join(' · ');
}

function draftFromLive(live: LiveSession, userId: string): WorkoutDraft {
  const grouped = new Map<number, SessionSet[]>();
  for (const set of live.sets) {
    const group = grouped.get(set.position) ?? [];
    group.push(set);
    grouped.set(set.position, group);
  }
  return {
    id: '',
    name: live.name,
    visibility: 'private',
    splitId: live.remixSpec,
    durationMin: live.durationMin,
    createdBy: userId,
    personIds: [],
    ratings: [],
    notes: [],
    exercises: [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([position, group]) => ({
        id: group[0]?.id ?? String(position),
        exerciseId: group[0]?.exerciseId ?? null,
        name: group[0]?.exerciseName ?? 'Exercise',
        position,
        targetSets: group.length,
        targetReps: group[0]?.reps || '10',
        targetWeight: '',
        note: '',
        supersetId: null,
      })),
  };
}

export function SessionScreen({ workoutId, liveSessionId }: { workoutId?: string; liveSessionId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold, people, role } = useHousehold();
  const userId = user && !user.isDevBypass ? user.id : null;
  const canSave = canCreateShared(role);
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workout, setWorkout] = useState<WorkoutDraft | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [restGame, setRestGame] = useState<RestExtra>('off');
  const [restSeconds, setRestSeconds] = useState<number>(90);
  const [restOpen, setRestOpen] = useState(false);
  const [setPrompt, setSetPrompt] = useState(false);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [offered, setOffered] = useState<Record<number, string[]>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [mode, setMode] = useState<'full' | 'compact'>('full');
  const [scoreOpen, setScoreOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveVisibility, setSaveVisibility] = useState<WorkoutDraft['visibility']>('private');
  const [savePeople, setSavePeople] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof loadRecords>>>({});
  const [myScores, setMyScores] = useState<RestGameScore[]>([]);
  const [topScores, setTopScores] = useState<RestGameScore[]>([]);
  const [shownScore, setShownScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const liveScore = useRef(0);
  const remixingRef = useRef(false);
  const finishRestRef = useRef<() => void>(() => undefined);
  const scoresRef = useRef({ mine: myScores, tops: topScores });
  scoresRef.current = { mine: myScores, tops: topScores };

  const remaining = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  const resting = restUntil !== null;
  useWakeLock(resting, 'kinexus-rest');

  useEffect(() => {
    if (!userId) return;
    void Promise.all([loadMyRestScores(userId), loadRestTops()])
      .then(([mine, tops]) => {
        setMyScores(mine);
        setTopScores(tops);
      })
      .catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (!activeHousehold || !userId) return;
    const householdId = activeHousehold.id;
    let cancelled = false;
    void (async () => {
      try {
        if (liveSessionId) {
          const live = await loadLiveSession(liveSessionId);
          if (cancelled) return;
          if (!live || live.finishedAt) {
            setError(live?.finishedAt ? 'This workout is already finished' : 'Workout is not available');
            return;
          }
          const ids = [...new Set(live.sets.flatMap((set) => (set.exerciseId ? [set.exerciseId] : [])))];
          const nextRecords = await loadRecords(userId, ids);
          if (cancelled) return;
          setRecords(nextRecords);
          setSessionId(live.id);
          setSets(live.sets);
          if (live.workoutId) {
            const workouts = await loadWorkouts(householdId);
            const found = workouts.find((item) => item.id === live.workoutId);
            if (found) {
              setWorkout(found);
              setSavedSignature(templateSignature(found));
              void loadLibrary().then(setLibrary).catch(() => undefined);
              return;
            }
          }
          setWorkout(draftFromLive(live, userId));
          setSavedSignature(null);
          void loadLibrary().then(setLibrary).catch(() => undefined);
          return;
        }
        if (!workoutId) return;
        const workouts = await loadWorkouts(householdId);
        const found = workouts.find((item) => item.id === workoutId);
        if (!found) {
          setError('Workout is not available');
          return;
        }
        const ids = found.exercises.flatMap((exercise) => (exercise.exerciseId ? [exercise.exerciseId] : []));
        const nextRecords = await loadRecords(userId, ids);
        const opened = await openSession({ householdId, userId, workout: found, records: nextRecords });
        if (cancelled) return;
        setRecords(nextRecords);
        setWorkout(found);
        setSavedSignature(templateSignature(found));
        setSessionId(opened.sessionId);
        setSets(opened.sets);
        void loadLibrary().then(setLibrary).catch(() => undefined);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not start');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeHousehold, userId, workoutId, liveSessionId]);

  useEffect(() => {
    if (!restUntil) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [restUntil]);

  useEffect(() => {
    if (!restUntil || remaining > 0) return;
    Vibration.vibrate(200);
    finishRestRef.current();
  }, [remaining, restUntil]);

  const groups = useMemo(() => {
    const map = new Map<number, SessionSet[]>();
    for (const set of sets) {
      const group = map.get(set.position) ?? [];
      group.push(set);
      map.set(set.position, group);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [sets]);

  const remix = parseRemixSplit(workout?.splitId);
  const remixDirty = Boolean(remix) && savedSignature !== exerciseSignature(sets);

  async function rememberScore(uid: string, game: RestGame, seconds: number, score: number) {
    const previousMine = scoresRef.current.mine;
    const previousTops = scoresRef.current.tops;
    const prev = findScore(previousMine, game, seconds) ?? 0;
    if (score <= prev) return;
    const nextMine = [...previousMine.filter((item) => item.game !== game || item.seconds !== seconds), { game, seconds, score }];
    const prevTop = findScore(previousTops, game, seconds) ?? 0;
    const nextTops = score > prevTop ? [...previousTops.filter((item) => item.game !== game || item.seconds !== seconds), { game, seconds, score }] : previousTops;
    scoresRef.current = { mine: nextMine, tops: nextTops };
    setMyScores(nextMine);
    if (nextTops !== previousTops) setTopScores(nextTops);
    try {
      await saveRestBest(uid, { game, seconds, score });
    } catch (err: unknown) {
      scoresRef.current = { mine: previousMine, tops: previousTops };
      setMyScores(previousMine);
      setTopScores(previousTops);
      setError(err instanceof Error ? err.message : 'Could not save the score');
    }
  }

  finishRestRef.current = () => {
    const score = liveScore.current;
    const game = restGame;
    const seconds = restSeconds;
    liveScore.current = 0;
    setShownScore(0);
    setRestUntil(null);
    if (userId && (game === 'quiz' || game === 'memory') && score > 0) void rememberScore(userId, game, seconds, score);
  };

  async function patch(set: SessionSet, next: Partial<SessionSet>) {
    const updated = { ...set, ...next };
    setSets((current) => current.map((item) => (item.id === set.id ? updated : item)));
    await updateSet(set.id, { weight: updated.weight, reps: updated.reps, done: updated.done });
  }

  async function markExercise(group: SessionSet[], done: boolean) {
    const ids = new Set(group.map((set) => set.id));
    setSets((current) => current.map((item) => (ids.has(item.id) ? { ...item, done } : item)));
    await Promise.all(group.filter((set) => set.done !== done).map((set) => updateSet(set.id, { done })));
  }

  function beginRest(game: RestExtra) {
    liveScore.current = 0;
    setShownScore(0);
    setRestGame(game);
    setRestOpen(false);
    setSetPrompt(false);
    const until = Date.now() + restSeconds * 1000;
    requestAnimationFrame(() => {
      setRestUntil(until);
      setNow(Date.now());
    });
  }

  function onGameScore(score: number) {
    const next = Math.max(liveScore.current, score);
    liveScore.current = next;
    setShownScore(next);
  }

  function confirmRemix() {
    if (!remix || remixingRef.current) return;
    void rerollMix(remix);
  }

  async function catalogForRemix() {
    const catalog = library.length ? library : await loadLibrary();
    setLibrary(catalog);
    return catalog;
  }

  async function rerollMix(spec: { categories: string[]; weights: number[] }) {
    if (!workout || !sessionId || !activeHousehold || !userId || remixingRef.current) return;
    remixingRef.current = true;
    setRemixing(true);
    setError(null);
    try {
      const catalog = await catalogForRemix();
      const duration = workout.durationMin ?? 40;
      const currentIds = new Set(sets.flatMap((set) => (set.exerciseId ? [set.exerciseId] : [])));
      const fresh = catalog.filter((exercise) => !currentIds.has(exercise.id));
      let picks = generateFromCategoryMix(spec.categories, spec.weights, duration, fresh);
      if (picks.length < 3) picks = generateFromCategoryMix(spec.categories, spec.weights, duration, catalog);
      if (picks.length < 3) {
        setError('Not enough exercises for this mix.');
        return;
      }
      const nextRecords = await loadRecords(
        userId,
        picks.map((pick) => pick.exerciseId),
      );
      const merged = { ...records, ...nextRecords };
      setRecords(merged);
      const nextSets = await rewriteSessionExercises({
        sessionId,
        householdId: activeHousehold.id,
        userId,
        exercises: picks.map((pick) => ({
          exerciseId: pick.exerciseId,
          name: pick.name,
          targetSets: pick.targetSets,
          targetReps: pick.targetReps,
        })),
        records: merged,
      });
      setSets(nextSets);
      setOffered({});
      setDetailId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remix');
    } finally {
      remixingRef.current = false;
      setRemixing(false);
    }
  }

  async function ensureLibrary() {
    if (library.length > 0) return library;
    const catalog = await loadLibrary();
    setLibrary(catalog);
    return catalog;
  }

  async function swapSlot(position: number, group: SessionSet[]) {
    const currentId = group[0]?.exerciseId;
    if (!currentId || !sessionId || !userId) return;
    const catalog = await ensureLibrary();
    const taken = groups.flatMap(([slot, slotGroup]) => {
      const id = slotGroup[0]?.exerciseId;
      return slot !== position && id ? [id] : [];
    });
    const result = nextSimilarExercise(currentId, catalog, offered[position] ?? [currentId], taken);
    if (!result) {
      setError('No similar exercise');
      return;
    }
    const loaded = records[result.exercise.id] ? records : { ...records, ...(await loadRecords(userId, [result.exercise.id])) };
    if (loaded !== records) setRecords(loaded);
    const lastWeight = loaded[result.exercise.id]?.lastWeight ?? '';
    await replaceSessionExercise({
      sessionId,
      position,
      exerciseId: result.exercise.id,
      name: result.exercise.name,
      lastWeight,
    });
    setOffered((current) => ({ ...current, [position]: result.offeredIds }));
    setSets((existing) =>
      existing.map((set) =>
        set.position === position
          ? { ...set, exerciseId: result.exercise.id, exerciseName: result.exercise.name, weight: lastWeight, done: false }
          : set,
      ),
    );
    setDetailId((current) => (current === currentId ? result.exercise.id : current));
    setError(null);
  }

  function savedPlan(position: number, exerciseId: string | null | undefined) {
    if (!workout?.id || !exerciseId) return undefined;
    return workout.exercises.find((item) => item.position === position && item.exerciseId === exerciseId);
  }

  async function savePersonalNote(position: number, body: string) {
    if (!workout?.id || !userId || !activeHousehold) return;
    const previous = workout.notes;
    const notes = [...previous.filter((note) => note.position !== position), { position, body }];
    setWorkout({ ...workout, notes });
    try {
      await saveWorkoutUserNotes({ workoutId: workout.id, userId, householdId: activeHousehold.id, notes });
    } catch (err: unknown) {
      setWorkout({ ...workout, notes: previous });
      setError(err instanceof Error ? err.message : 'Could not save your note');
    }
  }

  function openSave() {
    const owns = Boolean(workout?.id && workout.createdBy === userId);
    setSaveName(workout?.name ?? '');
    setSaveVisibility(owns && workout ? workout.visibility : 'private');
    setSavePeople(owns && workout ? workout.personIds : []);
    setSaveError(null);
    setSaveOpen(true);
  }

  async function saveRemix() {
    if (!workout || !sessionId || !activeHousehold || !userId || saving || !workout.splitId) return;
    const name = saveName.trim();
    if (!name) return;
    const exercises: WorkoutExercise[] = groups.flatMap(([position, group]) => {
      const exerciseId = group[0]?.exerciseId;
      if (!exerciseId) return [];
      return [
        {
          id: group[0]?.id ?? String(position),
          exerciseId,
          name: group[0]?.exerciseName ?? 'Exercise',
          position,
          targetSets: group.length,
          targetReps: group[0]?.reps || '10',
          targetWeight: '',
          note: '',
          supersetId: null,
        },
      ];
    });
    const personIds = saveVisibility === 'people' ? savePeople : [];
    const payload = exercises.flatMap((exercise) =>
      exercise.exerciseId
        ? [
            {
              exerciseId: exercise.exerciseId,
              name: exercise.name,
              targetSets: exercise.targetSets,
              targetReps: exercise.targetReps,
            },
          ]
        : [],
    );
    const owns = Boolean(workout.id && workout.createdBy === userId);
    setSaving(true);
    setSaveError(null);
    try {
      const id = owns ? workout.id : await createWorkout({
        householdId: activeHousehold.id,
        userId,
        name,
        visibility: saveVisibility,
        splitId: workout.splitId,
        durationMin: workout.durationMin,
        personIds,
        exercises: payload,
      });
      if (owns) {
        await saveWorkout(workout.id, activeHousehold.id, {
          name,
          visibility: saveVisibility,
          splitId: workout.splitId,
          durationMin: workout.durationMin,
          personIds,
          exercises: payload,
        });
      }
      await linkSessionWorkout(sessionId, id, name);
      setWorkout({
        ...workout,
        id,
        name,
        visibility: saveVisibility,
        personIds,
        exercises,
        notes: owns ? workout.notes : [],
        ratings: owns ? workout.ratings : [],
      });
      setSavedSignature(exerciseSignature(sets));
      setSaveOpen(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the workout');
    } finally {
      setSaving(false);
    }
  }

  async function complete(score: number | null) {
    if (!sessionId || !userId || finishing) return;
    setFinishing(true);
    setError(null);
    try {
      await finishSession({ sessionId, userId, sets, records });
      if (score !== null && activeHousehold && workout?.id) {
        await saveWorkoutRating({ workoutId: workout.id, userId, householdId: activeHousehold.id, score });
      }
      router.replace('/train' as Href);
    } catch (err: unknown) {
      setScoreOpen(false);
      setError(err instanceof Error ? err.message : 'Could not finish the workout');
      setFinishing(false);
    }
  }

  function askFinish() {
    if (!sessionId || finishing) return;
    if (workout?.id) {
      setScoreOpen(true);
      return;
    }
    Alert.alert('Finish', 'End this workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', onPress: () => void complete(null) },
    ]);
  }

  const activeBest = restGame === 'quiz' || restGame === 'memory' ? findScore(myScores, restGame, restSeconds) : undefined;
  const activeTop = restGame === 'quiz' || restGame === 'memory' ? findScore(topScores, restGame, restSeconds) : undefined;

  return (
    <TrainPage>
      <View style={styles.pageHead}>
        <Text style={styles.pageTitle} numberOfLines={1}>
          {workout?.name || 'Workout'}
        </Text>
        <View style={styles.pageActions}>
          {canSave && remixDirty ? (
            <Pressable onPress={openSave} hitSlop={8} accessibilityRole="button" accessibilityLabel="Save workout">
              <Text style={styles.pageBack}>Save</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.replace('/train' as Href)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to workouts">
            <Text style={styles.pageBack}>Back</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        <Segmented
          value={mode}
          options={[
            { value: 'full', label: 'Full' },
            { value: 'compact', label: 'Compact' },
          ]}
          onChange={setMode}
        />
        {mode === 'full' && userId && workout?.id ? (
          <NoteLine
            label="Mine"
            value={workout.notes.find((note) => note.position === -1)?.body ?? ''}
            editable
            maxLength={280}
            onSave={(body) => void savePersonalNote(-1, body)}
          />
        ) : null}
        {clusterExercises(
          groups.map(([, group]) => ({
            supersetId: savedPlan(group[0]?.position ?? -1, group[0]?.exerciseId)?.supersetId ?? null,
          })),
        ).map((cluster, clusterIndex) => {
          const cards = cluster.indices.map((slot) => {
            const entry = groups[slot];
            if (!entry) return null;
            const [position, group] = entry;
            const name = group[0]?.exerciseName ?? 'Exercise';
            const exerciseId = group[0]?.exerciseId;
            const record = exerciseId ? records[exerciseId] : undefined;
            const progress = applyLoggedSets(record ?? null, group);
            const doneCount = group.filter((set) => set.done).length;
            const targetReps = group[0]?.reps || '';
            const plan = savedPlan(position, exerciseId);
            const part = cluster.type === 'superset' ? `Part ${cluster.indices.indexOf(slot) + 1}` : '';
            if (mode === 'compact') {
              const exerciseDone = group.length > 0 && doneCount === group.length;
              return (
                <View key={position} style={[styles.compactRow, exerciseDone && styles.compactRowDone]}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (exerciseId) setDetailId(exerciseId);
                    }}
                    style={styles.compactCopy}>
                    <Text style={styles.compactName} numberOfLines={1}>
                      {exerciseTitle(name)}
                    </Text>
                    <Text style={styles.compactMeta}>
                      {group.length} × {targetReps || '–'}
                    </Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Swap ${exerciseTitle(name)}`} onPress={() => void swapSlot(position, group)} hitSlop={8}>
                    <Text style={styles.swap}>Swap</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: exerciseDone }}
                    accessibilityLabel={exerciseDone ? `${exerciseTitle(name)} done` : `Check off ${exerciseTitle(name)}`}
                    onPress={() => {
                      const done = !exerciseDone;
                      void markExercise(group, done);
                      if (done) setSetPrompt(true);
                    }}
                    hitSlop={8}
                    style={[styles.setCheck, exerciseDone && styles.setCheckOn]}>
                    <Text style={[styles.setCheckMark, exerciseDone && styles.setCheckMarkOn]}>{exerciseDone ? '✓' : ''}</Text>
                  </Pressable>
                </View>
              );
            }
            const meta = [part, `${doneCount}/${group.length}`, plan?.targetWeight ? `${plan.targetWeight} kg` : '', record?.lastWeight ? `Last ${record.lastWeight}` : '']
              .filter(Boolean)
              .join(' · ');
            return (
              <View key={position} style={styles.exercise}>
                <View style={styles.exerciseHead}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (exerciseId) setDetailId(exerciseId);
                    }}
                    style={styles.exerciseCopy}>
                    <Text style={styles.exerciseName}>{exerciseTitle(name)}</Text>
                    <Text style={styles.exerciseMeta}>{meta}</Text>
                  </Pressable>
                  {progress?.isPr ? <Badge label="PR" /> : null}
                  <Pressable accessibilityRole="button" onPress={() => void swapSlot(position, group)} hitSlop={8}>
                    <Text style={styles.swap}>Swap</Text>
                  </Pressable>
                </View>
                {plan?.note ? <NoteLine label="Note" value={plan.note} editable={false} onSave={() => undefined} /> : null}
                {userId && plan ? (
                  <NoteLine
                    label="Mine"
                    value={workout?.notes.find((item) => item.position === position)?.body ?? ''}
                    editable
                    maxLength={280}
                    onSave={(body) => void savePersonalNote(position, body)}
                  />
                ) : null}
                <View style={styles.sets}>
                  {group.map((set, index) => (
                    <View key={set.id} style={[styles.setRow, set.done && styles.setRowDone]}>
                      <Text style={styles.setIndex}>{index + 1}</Text>
                      <View style={styles.setField}>
                        <Text style={styles.setFieldLabel}>kg</Text>
                        <TextInput
                          value={set.weight}
                          keyboardType="decimal-pad"
                          onChangeText={(weight) => void patch(set, { weight })}
                          style={styles.setInput}
                        />
                      </View>
                      <View style={styles.setField}>
                        <Text style={styles.setFieldLabel}>Reps</Text>
                        <TextInput value={set.reps} onChangeText={(reps) => void patch(set, { reps })} style={styles.setInput} />
                      </View>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: set.done }}
                        accessibilityLabel={set.done ? `Set ${index + 1} done` : `Check off set ${index + 1}`}
                        onPress={() => {
                          const done = !set.done;
                          void patch(set, { done });
                          if (done) setSetPrompt(true);
                        }}
                        hitSlop={8}
                        style={[styles.setCheck, set.done && styles.setCheckOn]}>
                        <Text style={[styles.setCheckMark, set.done && styles.setCheckMarkOn]}>{set.done ? '✓' : ''}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            );
          });
          if (cluster.type === 'single') return cards;
          return (
            <View key={`superset-${clusterIndex}`} style={styles.superset}>
              <Text style={styles.supersetLabel}>Superset</Text>
              {cards}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.dock}>
        <TrainButton label="Rest" tone="ghost" fill onPress={() => setRestOpen(true)} />
        {remix ? <TrainButton label="Remix" tone="ghost" fill disabled={remixing || !sessionId} onPress={confirmRemix} /> : null}
        <TrainButton label="Finish" fill disabled={finishing || !sessionId} onPress={askFinish} />
      </View>
      <Sheet visible={restOpen} title="Rest" onClose={() => setRestOpen(false)}>
        <View style={styles.restPicker}>
          <View style={styles.durations}>
            {REST_TIMES.map((seconds) => (
              <TrainButton
                key={seconds}
                label={clock(seconds)}
                tone={seconds === restSeconds ? 'accent' : 'ghost'}
                fill
                onPress={() => setRestSeconds(seconds)}
              />
            ))}
          </View>
          <ModeButton label="Rest" detail="" onPress={() => beginRest('off')} />
          <ModeButton label="Quiz" detail={scoreBits(findScore(myScores, 'quiz', restSeconds), findScore(topScores, 'quiz', restSeconds))} onPress={() => beginRest('quiz')} />
          <ModeButton
            label="Memory"
            detail={scoreBits(findScore(myScores, 'memory', restSeconds), findScore(topScores, 'memory', restSeconds))}
            onPress={() => beginRest('memory')}
          />
        </View>
      </Sheet>
      <AppModal visible={resting} transparent animationType="fade" onRequestClose={() => finishRestRef.current()}>
        <View style={styles.restBackdrop}>
          <View style={styles.restCard}>
            <Text style={styles.timer}>{clock(remaining)}</Text>
            {restGame === 'quiz' || restGame === 'memory' ? (
              <Text style={styles.liveScore}>
                {['Score ' + shownScore, activeBest ? `Best ${activeBest}` : '', activeTop ? `Top ${activeTop}` : ''].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {resting && restGame === 'quiz' ? <RestQuiz key={restUntil ?? 0} onScore={onGameScore} /> : null}
            {resting && restGame === 'memory' ? <RestMemory key={restUntil ?? 0} onScore={onGameScore} /> : null}
            <TrainButton label="Skip" tone="ghost" onPress={() => finishRestRef.current()} />
          </View>
        </View>
      </AppModal>
      <AppModal visible={setPrompt} transparent animationType="fade" onRequestClose={() => setSetPrompt(false)}>
        <Pressable style={styles.promptBackdrop} onPress={() => setSetPrompt(false)}>
          <Pressable style={styles.promptCard} onPress={() => undefined}>
            <TrainButton
              label="Rest"
              fill
              onPress={() => {
                setSetPrompt(false);
                requestAnimationFrame(() => setRestOpen(true));
              }}
            />
            <TrainButton label="Close" tone="ghost" fill onPress={() => setSetPrompt(false)} />
          </Pressable>
        </Pressable>
      </AppModal>
      <Sheet visible={scoreOpen} title="Score" onClose={() => setScoreOpen(false)}>
        <View style={styles.scoreBlock}>
          <View style={styles.scores}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
              <Pressable
                key={score}
                accessibilityRole="button"
                accessibilityLabel={`Score ${score}`}
                disabled={finishing}
                onPress={() => void complete(score)}
                style={styles.score}>
                <Text style={styles.scoreValue}>{score}</Text>
              </Pressable>
            ))}
          </View>
          <TrainButton label="Skip" tone="ghost" disabled={finishing} onPress={() => void complete(null)} />
        </View>
      </Sheet>
      <Sheet visible={saveOpen} title="Save" onClose={() => setSaveOpen(false)}>
        <View style={styles.saveForm}>
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
          <Field value={saveName} onChangeText={setSaveName} placeholder="Workout name" editable={!saving} />
          <Segmented
            value={saveVisibility}
            options={VISIBILITY.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(next) => {
              if (!saving) setSaveVisibility(next);
            }}
          />
          {saveVisibility === 'people' ? (
            <View style={styles.people}>
              {people.map((person) => {
                const on = savePeople.includes(person.id);
                return (
                  <Choice
                    key={person.id}
                    label={person.name}
                    active={on}
                    onPress={() => {
                      if (saving) return;
                      setSavePeople((current) => (on ? current.filter((id) => id !== person.id) : [...current, person.id]));
                    }}
                  />
                );
              })}
            </View>
          ) : null}
          <TrainButton label={saving ? 'Saving' : 'Save'} fill disabled={saving || saveName.trim().length === 0} onPress={() => void saveRemix()} />
        </View>
      </Sheet>
      <ExerciseDetail exerciseId={detailId} library={library} onClose={() => setDetailId(null)} />
    </TrainPage>
  );
}

function ModeButton({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.modeButton}>
      <Text style={styles.modeLabel}>{label}</Text>
      {detail ? <Text style={styles.modeDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

function RestQuiz({ onScore }: { onScore: (score: number) => void }) {
  const deck = useMemo(() => shuffledRestQuiz(Date.now()), []);
  const [cursor, setCursor] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quiz = deck[cursor] ?? deck[0];

  useEffect(
    () => () => {
      if (wait.current) clearTimeout(wait.current);
    },
    [],
  );

  if (!quiz) return null;

  function choose(index: number) {
    if (pick !== null || !quiz) return;
    setPick(index);
    if (index === quiz.answer) {
      const next = correct + 1;
      setCorrect(next);
      onScore(next);
    }
    wait.current = setTimeout(() => {
      setCursor((current) => (current + 1) % deck.length);
      setPick(null);
    }, 700);
  }

  return (
    <View style={styles.quiz}>
      <Text style={styles.quizPrompt}>{quiz.prompt}</Text>
      <View style={styles.quizChoices}>
        {quiz.choices.map((choice, index) => {
          const wrong = pick === index && index !== quiz.answer;
          const right = pick !== null && index === quiz.answer;
          return (
            <Pressable
              key={`${quiz.id}-${choice}`}
              disabled={pick !== null}
              onPress={() => choose(index)}
              style={[styles.quizChoice, right && styles.quizChoiceOn, wrong && styles.quizChoiceNo]}>
              <Text style={styles.quizChoiceLabel}>{choice}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const MEMORY_TILES = ['#3d8f6e', '#4a90b8', '#b07cc6', '#c9b458', '#d17a55', '#6a8caf', '#8f6b4a', '#5e9a86', '#a35d6a'];
const MEMORY_LETTERS = 'ABCDEFGHI';

function RestMemory({ onScore }: { onScore: (score: number) => void }) {
  const sequence = useMemo(() => {
    let n = (Date.now() % 2147483646) + 1;
    return Array.from({ length: 12 }, () => {
      n = (n * 48271) % 2147483647;
      return n % MEMORY_TILES.length;
    });
  }, []);
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<'ready' | 'watch' | 'input'>('watch');
  const [lit, setLit] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [mark, setMark] = useState<'right' | 'wrong' | null>(null);

  useEffect(() => {
    if (phase !== 'watch') return undefined;
    const seq = sequence.slice(0, step);
    let tick = 0;
    const timer = setInterval(() => {
      const place = Math.floor(tick / 2);
      if (place >= seq.length) {
        setLit(null);
        setProgress(0);
        setPhase('input');
        clearInterval(timer);
        return;
      }
      setLit(tick % 2 === 0 ? (seq[place] ?? null) : null);
      tick += 1;
    }, 340);
    return () => clearInterval(timer);
  }, [phase, sequence, step]);

  function press(tile: number) {
    if (phase !== 'input') return;
    if (tile !== sequence[progress]) {
      setLit(null);
      setProgress(0);
      setMark('wrong');
      setPhase('ready');
      return;
    }
    const next = progress + 1;
    setLit(tile);
    if (next < step) {
      setProgress(next);
      return;
    }
    setLit(null);
    setProgress(0);
    setMark('right');
    onScore(step);
    setStep((current) => (current >= sequence.length ? 1 : current + 1));
    setPhase('ready');
  }

  const patternLabel = phase === 'watch' ? 'Watching…' : phase === 'input' ? 'Your turn' : 'Show pattern';

  return (
    <View style={styles.memory}>
      <View style={styles.memoryHead}>
        {mark === 'right' ? <Text style={styles.memoryRight}>Right</Text> : null}
        {mark === 'wrong' ? <Text style={styles.memoryWrong}>Wrong</Text> : null}
        <TrainButton
          label={patternLabel}
          tone="ghost"
          fill
          disabled={phase !== 'ready'}
          onPress={() => {
            setMark(null);
            setProgress(0);
            setPhase('watch');
          }}
        />
      </View>
      <View style={styles.memoryGrid}>
        {MEMORY_TILES.map((color, index) => {
          const on = lit === index;
          const letter = MEMORY_LETTERS[index] ?? '';
          return (
            <Pressable
              key={color}
              disabled={phase !== 'input'}
              onPress={() => press(index)}
              accessibilityRole="button"
              accessibilityLabel={`Square ${letter}`}
              style={[styles.tile, { backgroundColor: on ? color : colors.bgHover }, on && styles.tileOn]}>
              <Text style={[styles.tileLetter, { color: on ? '#121213' : color }]}>{letter}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.pips}>
        {Array.from({ length: step }, (_, index) => (
          <View key={index} style={[styles.pip, index < progress && phase === 'input' && styles.pipOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700' },
  pageActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pageBack: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { gap: 10, paddingBottom: 12 },
  superset: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: 8,
  },
  supersetLabel: { color: colors.accent, fontSize: 12, fontWeight: '800', paddingHorizontal: 4 },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  compactRowDone: { backgroundColor: colors.accentSoft },
  compactCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  compactMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  exercise: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseCopy: { flex: 1, gap: 1 },
  exerciseName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  exerciseMeta: { color: colors.textMuted, fontSize: 12 },
  swap: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  sets: { gap: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, paddingVertical: 2, paddingHorizontal: 2 },
  setRowDone: { backgroundColor: colors.accentSoft },
  setIndex: { width: 16, color: colors.textDim, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  setField: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
  },
  setFieldLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  setInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15, fontWeight: '700', paddingVertical: 4 },
  setCheck: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  setCheckOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  setCheckMark: { color: 'transparent', fontSize: 16, fontWeight: '800' },
  setCheckMarkOn: { color: colors.bg },
  dock: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  restPicker: { gap: 10, paddingBottom: 8 },
  durations: { flexDirection: 'row', gap: 8 },
  modeButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  modeLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  modeDetail: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  restBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 14, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  restCard: { width: '100%', maxWidth: 560, alignItems: 'center', gap: 16 },
  timer: { color: colors.text, fontSize: 72, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  liveScore: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  promptBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7, 10, 14, 0.55)', padding: 24 },
  promptCard: {
    width: 280,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  quiz: { width: '100%', gap: 10 },
  quizPrompt: { color: colors.text, fontSize: 18, fontWeight: '700' },
  quizChoices: { gap: 8 },
  quizChoice: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quizChoiceOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  quizChoiceNo: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  quizChoiceLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  memory: { width: '100%', gap: 10 },
  memoryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memoryRight: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  memoryWrong: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  memoryGrid: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6 },
  tile: { flex: 1, minWidth: 0, height: 64, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tileOn: { transform: [{ scale: 1.04 }] },
  tileLetter: { fontSize: 16, fontWeight: '800' },
  pips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, minHeight: 8 },
  pip: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  pipOn: { backgroundColor: colors.accent },
  scoreBlock: { gap: 12, paddingBottom: 8 },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  score: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  saveForm: { gap: 12, paddingBottom: 8 },
  saveError: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detail: { gap: 16, paddingTop: 4, paddingBottom: 24 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  credit: { color: colors.textDim, fontSize: 12 },
});

function ExerciseDetail({
  exerciseId,
  library,
  onClose,
}: {
  exerciseId: string | null;
  library: LibraryExercise[];
  onClose: () => void;
}) {
  const exercise = library.find((item) => item.id === exerciseId) ?? null;
  const facts = exercise ? exerciseFacts(exercise) : [];
  const credit = !exercise
    ? ''
    : exercise.source === 'exercisedb'
      ? 'AscendAPI'
      : exercise.source === 'wger'
        ? `CC BY-SA${exercise.licenseAuthor ? ` · ${exercise.licenseAuthor}` : ''}`
        : '';
  return (
    <Sheet visible={exerciseId !== null} title={exercise ? exerciseTitle(exercise.name) : 'Exercise'} wide onClose={onClose}>
      {exercise ? (
        <View style={styles.detail}>
          {exercise.mediaUrls.length > 0 ? <MediaGallery urls={exercise.mediaUrls} /> : null}
          {facts.length > 0 ? (
            <View style={styles.pills}>
              {facts.map((fact) => (
                <Pill key={fact} label={fact} />
              ))}
            </View>
          ) : null}
          <ExerciseSteps instructions={exercise.instructions} />
          {credit ? <Text style={styles.credit}>{credit}</Text> : null}
        </View>
      ) : null}
    </Sheet>
  );
}
