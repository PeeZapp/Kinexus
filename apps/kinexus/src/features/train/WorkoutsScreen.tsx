import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { canCreateShared, estimateWorkout, exerciseSearchScore, type RemixCategory } from '@kinexus/domain';

import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { clearOpenSession, createWorkout, loadOpenWorkoutIds, loadWorkouts, saveWorkoutRating, type WorkoutDraft } from '@/src/features/train/api';
import { EMPTY_WORKOUT_SEED, WorkoutBuilder, type WorkoutBuilderResult } from '@/src/features/train/WorkoutBuilder';
import { SearchField, TrainButton, TrainPage } from '@/src/features/train/ui';
import { exerciseTitle } from '@/src/features/train/format';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const SHOWN_EXERCISES = 4;

type LengthFilter = 'any' | 'short' | 'medium' | 'long';

const LENGTHS: { value: LengthFilter; label: string }[] = [
  { value: 'any', label: 'Any length' },
  { value: 'short', label: 'Under 30 min' },
  { value: 'medium', label: '30–45 min' },
  { value: 'long', label: 'Over 45 min' },
];

function lengthBucket(minutes: number): LengthFilter {
  if (minutes < 30) return 'short';
  if (minutes <= 45) return 'medium';
  return 'long';
}

export function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { mode } = useExperienceMode();
  const { activeHousehold, people, members, role } = useHousehold();
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<RemixCategory | ''>('');
  const [length, setLength] = useState<LengthFilter>('any');
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [clearingId, setClearingId] = useState<string | null>(null);
  const userId = user && !user.isDevBypass ? user.id : null;
  const canCreate = canCreateShared(role);
  const wide = mode === 'desktop';

  useFocusEffect(
    useCallback(() => {
      if (!activeHousehold) return;
      let cancelled = false;
      const householdId = activeHousehold.id;
      loadWorkouts(householdId)
        .then((rows) => {
          if (!cancelled) setWorkouts(rows);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load workouts');
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      if (userId) {
        loadOpenWorkoutIds(userId, householdId)
          .then((ids) => {
            if (!cancelled) setOpenIds(new Set(ids));
          })
          .catch((err: unknown) => {
            if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load workouts');
          });
      } else if (!cancelled) {
        setOpenIds(new Set());
      }
      return () => {
        cancelled = true;
      };
    }, [activeHousehold, userId]),
  );

  const plans = useMemo(() => {
    const byId = new Map<string, ReturnType<typeof estimateWorkout>>();
    for (const workout of workouts) {
      byId.set(
        workout.id,
        estimateWorkout(
          workout.exercises.map((exercise) => ({
            name: exercise.name,
            targetSets: exercise.targetSets,
            supersetId: exercise.supersetId,
          })),
        ),
      );
    }
    return byId;
  }, [workouts]);

  const focusOptions = useMemo(() => {
    const seen = new Set<RemixCategory>();
    for (const plan of plans.values()) {
      for (const item of plan.focuses) seen.add(item);
    }
    return [{ value: '' as const, label: 'Any focus' }, ...[...seen].map((item) => ({ value: item, label: item }))];
  }, [plans]);

  function nameFor(id: string) {
    return people.find((person) => person.userId === id)?.name || members.find((member) => member.userId === id)?.profile.displayName || 'Someone';
  }

  const visible = useMemo(() => {
    const ranked: { workout: WorkoutDraft; score: number }[] = [];
    for (const workout of workouts) {
      const plan = plans.get(workout.id);
      if (focus && !plan?.focuses.includes(focus)) continue;
      if (length !== 'any' && lengthBucket(plan?.minutes ?? workout.durationMin ?? 0) !== length) continue;
      const haystack = [workout.name, ...workout.exercises.map((exercise) => exercise.name), ...(plan?.focuses ?? [])].join(' ');
      const score = exerciseSearchScore(query, haystack);
      if (score === null) continue;
      ranked.push({ workout, score });
    }
    ranked.sort((a, b) => a.score - b.score);
    return ranked.map((item) => item.workout);
  }, [focus, length, plans, query, workouts]);

  async function submitNew(result: WorkoutBuilderResult) {
    if (!activeHousehold || !userId) throw new Error('Sign in to save a workout');
    const id = await createWorkout({
      householdId: activeHousehold.id,
      userId,
      name: result.name,
      visibility: result.visibility,
      splitId: result.splitId,
      durationMin: result.durationMin,
      personIds: result.personIds,
      exercises: result.exercises.flatMap((exercise) =>
        exercise.exerciseId
          ? [
              {
                exerciseId: exercise.exerciseId,
                name: exercise.name,
                targetSets: exercise.targetSets,
                targetReps: exercise.targetReps,
                targetWeight: exercise.targetWeight,
                note: exercise.note,
                supersetId: exercise.supersetId,
              },
            ]
          : [],
      ),
    });
    const rows = await loadWorkouts(activeHousehold.id);
    setWorkouts(rows);
    setBuilderOpen(false);
    if (result.start) router.push(`/train/session/${id}` as Href);
  }

  async function clearWorkout(workoutId: string) {
    if (!userId || clearingId) return;
    const previous = openIds;
    setOpenIds((current) => {
      const next = new Set(current);
      next.delete(workoutId);
      return next;
    });
    setClearingId(workoutId);
    try {
      await clearOpenSession(userId, workoutId);
    } catch (err: unknown) {
      setOpenIds(previous);
      setError(err instanceof Error ? err.message : 'Could not clear the workout');
    } finally {
      setClearingId(null);
    }
  }

  async function rate(workout: WorkoutDraft, score: number) {
    if (!activeHousehold || !userId) return;
    const previous = workout.ratings;
    const nextScore = previous.find((rating) => rating.userId === userId)?.score === score ? null : score;
    const ratings = nextScore === null ? previous.filter((rating) => rating.userId !== userId) : [...previous.filter((rating) => rating.userId !== userId), { userId, score: nextScore }];
    setWorkouts((current) => current.map((item) => (item.id === workout.id ? { ...item, ratings } : item)));
    setRatingId(null);
    try {
      await saveWorkoutRating({ workoutId: workout.id, userId, householdId: activeHousehold.id, score: nextScore });
    } catch (err: unknown) {
      setWorkouts((current) => current.map((item) => (item.id === workout.id ? { ...item, ratings: previous } : item)));
      setError(err instanceof Error ? err.message : 'Could not save the score');
    }
  }

  return (
    <>
      <TrainPage>
        <View style={styles.toolbar}>
          <View style={styles.search}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search workouts" />
          </View>
          {canCreate ? <TrainButton label="New workout" onPress={() => setBuilderOpen(true)} /> : null}
        </View>
        <View style={styles.filters}>
          <FilterBar>
            <FilterDropdown
              id="focus"
              label="Focus"
              value={focus}
              valueLabel={focusOptions.find((option) => option.value === focus)?.label ?? 'Any focus'}
              open={openMenu === 'focus'}
              options={focusOptions}
              active={focus !== ''}
              onToggle={toggleMenu}
              onSelect={pick(setFocus)}
            />
            <FilterDropdown
              id="length"
              label="Length"
              value={length}
              valueLabel={LENGTHS.find((option) => option.value === length)?.label ?? 'Any length'}
              open={openMenu === 'length'}
              options={LENGTHS}
              active={length !== 'any'}
              onToggle={toggleMenu}
              onSelect={pick(setLength)}
            />
          </FilterBar>
        </View>
        <ErrorBanner message={error} />
        {!ready && !error ? (
          <LoadingState label="Loading workouts" />
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {ready && visible.length === 0 ? <Text style={styles.empty}>{workouts.length === 0 ? 'No workouts yet' : 'No matches'}</Text> : null}
            <View style={styles.grid}>
              {visible.map((workout) => {
                const plan = plans.get(workout.id);
                const minutes = plan?.minutes || workout.durationMin || 0;
                const calories = plan?.calories ?? 0;
                const names = workout.exercises.map((exercise) => exercise.name);
                const extra = Math.max(0, names.length - SHOWN_EXERCISES);
                const scores = [...workout.ratings].sort((a, b) => (a.userId === userId ? -1 : b.userId === userId ? 1 : 0));
                const mine = userId ? workout.ratings.find((rating) => rating.userId === userId)?.score : undefined;
                const open = openIds.has(workout.id);
                return (
                  <View key={workout.id} style={[styles.card, wide && styles.cardWide]}>
                    <View style={styles.head}>
                      <Pressable accessibilityRole="button" onPress={() => router.push(`/train/${workout.id}` as Href)} style={styles.copy}>
                        <Text style={styles.name} numberOfLines={2}>
                          {workout.name}
                        </Text>
                        {plan && plan.focuses.length > 0 ? (
                          <Text style={styles.focus} numberOfLines={1}>
                            {plan.focuses.join(' · ')}
                          </Text>
                        ) : null}
                      </Pressable>
                      <View style={styles.actions}>
                        {open ? (
                          <TrainButton label="Clear" tone="ghost" disabled={clearingId === workout.id} onPress={() => void clearWorkout(workout.id)} />
                        ) : null}
                        <TrainButton label={open ? 'Resume' : 'Start'} onPress={() => router.push(`/train/session/${workout.id}` as Href)} />
                      </View>
                    </View>
                    <Pressable accessibilityRole="button" onPress={() => router.push(`/train/${workout.id}` as Href)} style={styles.body}>
                      {minutes > 0 ? (
                        <Text style={styles.meta}>
                          {minutes} min{calories > 0 ? ` · ~${calories} kcal` : ''}
                        </Text>
                      ) : null}
                      {names.slice(0, SHOWN_EXERCISES).map((name, index) => (
                        <Text key={`${name}-${index}`} style={styles.exercise} numberOfLines={1}>
                          {exerciseTitle(name)}
                        </Text>
                      ))}
                      {extra > 0 ? <Text style={styles.more}>+{extra}</Text> : null}
                    </Pressable>
                    {userId ? (
                      <View style={styles.scoreBlock}>
                        <Pressable accessibilityRole="button" onPress={() => setRatingId((current) => (current === workout.id ? null : workout.id))} hitSlop={6}>
                          <Text style={styles.scoreLine} numberOfLines={2}>
                            {scores.length > 0 ? scores.map((rating) => `${rating.userId === userId ? 'You' : nameFor(rating.userId)} ${rating.score}/10`).join(' · ') : 'Rate'}
                          </Text>
                        </Pressable>
                        {ratingId === workout.id ? (
                          <View style={styles.scores}>
                            {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                              <Pressable
                                key={score}
                                accessibilityRole="button"
                                accessibilityLabel={`Score ${score}`}
                                onPress={() => void rate(workout, score)}
                                style={[styles.score, mine === score && styles.scoreOn]}>
                                <Text style={[styles.scoreLabel, mine === score && styles.scoreLabelOn]}>{score}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </TrainPage>
      {builderOpen ? (
        <WorkoutBuilder
          presentation="modal"
          seed={EMPTY_WORKOUT_SEED}
          people={people}
          editable
          onClose={() => setBuilderOpen(false)}
          onSubmit={submitNew}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, minWidth: 0 },
  filters: { zIndex: 20 },
  list: { flex: 1 },
  listContent: { paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexGrow: 1,
    flexBasis: '100%',
    minWidth: 0,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 8,
  },
  cardWide: { flexBasis: 320, maxWidth: 480 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, fontSize: 18, fontWeight: '800' },
  focus: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  body: { gap: 2 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  exercise: { color: colors.text, fontSize: 14 },
  more: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  scoreBlock: { gap: 8 },
  scoreLine: { color: colors.text, fontSize: 13, fontWeight: '700' },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  score: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  scoreOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  scoreLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  scoreLabelOn: { color: colors.accent },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: 24 },
});
