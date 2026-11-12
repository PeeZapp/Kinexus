import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  canCreateShared,
  estimateWorkout,
  exerciseSearchScore,
  formatTrackingTarget,
  resolveDefaultWorkoutVisibility,
  type RemixCategory,
} from '@kinexus/domain';

import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { ListExportSheet } from '@/src/features/lists/ListExportSheet';
import { ListImportWizard } from '@/src/features/lists/ListImportWizard';
import {
  workoutExportInput,
  workoutWeightToKg,
  type ListImportWriters,
} from '@/src/features/lists/list-io-adapters';
import { buildShareUrl } from '@/src/features/share/share-url';
import { disableEntityShare, enableEntityShare, resetEntityShare, sharePreview } from '@/src/features/share/link-share';
import {
  clearOpenSession,
  createWorkout,
  importFinishedSession,
  loadHistoryDedupeKeys,
  loadLibrary,
  loadOpenWorkoutIds,
  loadOutOfLibraryGroupWorkouts,
  loadTrainPrefs,
  loadWorkouts,
  saveWorkout,
  saveWorkoutRating,
  type OutOfLibraryGroupWorkout,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { loadTrainBuddies } from '@/src/features/train/buddies-api';
import { createCustomExercise } from '@/src/features/train/custom-exercises-api';
import { BodyMap } from '@/src/features/train/plan/BodyMap';
import { ShareGlyph } from '@/src/features/train/plan/PlanVisibilityBar';
import { EMPTY_WORKOUT_SEED, WorkoutBuilder, type WorkoutBuilderResult } from '@/src/features/train/WorkoutBuilder';
import { CreatorSearchHits } from '@/src/features/creators/CreatorSearchHits';
import { SearchField, TrainButton, TrainPage } from '@/src/features/train/ui';
import { exerciseTitle } from '@/src/features/train/format';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useCreator } from '@/src/features/creators/use-creator';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';
import { useUnits } from '@/src/lib/use-units';

const SHOWN_EXERCISES = 5;

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
  const [groupCopies, setGroupCopies] = useState<OutOfLibraryGroupWorkout[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<RemixCategory | ''>('');
  const [length, setLength] = useState<LengthFilter>('any');
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [historyKeys, setHistoryKeys] = useState<{ name: string; startedAt: string }[]>([]);
  const [exportWorkout, setExportWorkout] = useState<WorkoutDraft | null>(null);
  const [linkShareBusy, setLinkShareBusy] = useState(false);
  const [linkShareError, setLinkShareError] = useState<string | null>(null);
  const { weightUnit } = useUnits();
  const creator = useCreator();
  const userId = user && !user.isDevBypass ? user.id : null;
  const canCreate = canCreateShared(role);
  const wide = mode === 'desktop';
  const [defaultVisibility, setDefaultVisibility] = useState(EMPTY_WORKOUT_SEED.visibility);
  const [buddies, setBuddies] = useState<{ id: string; name: string }[]>([]);

  async function refreshWorkouts() {
    if (!activeHousehold) return;
    const rows = await loadWorkouts(activeHousehold.id);
    setWorkouts(rows);
    setExportWorkout((current) => (current ? rows.find((row) => row.id === current.id) ?? current : null));
    if (userId) {
      setGroupCopies(await loadOutOfLibraryGroupWorkouts(activeHousehold.id, userId));
    } else {
      setGroupCopies([]);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!activeHousehold) return;
      let cancelled = false;
      const householdId = activeHousehold.id;
      Promise.all([
        loadWorkouts(householdId),
        userId ? loadOutOfLibraryGroupWorkouts(householdId, userId) : Promise.resolve([]),
        userId ? loadTrainPrefs(userId) : Promise.resolve(null),
        userId ? loadTrainBuddies(userId) : Promise.resolve([]),
      ])
        .then(([rows, copies, prefs, buddyRows]) => {
          if (cancelled) return;
          setWorkouts(rows);
          setGroupCopies(copies);
          if (prefs) {
            setDefaultVisibility(
              resolveDefaultWorkoutVisibility({
                preferred: prefs.defaultWorkoutVisibility,
                isApprovedCreator: creator.isApprovedCreator,
              }),
            );
          }
          setBuddies(
            buddyRows
              .filter((row) => row.status === 'accepted')
              .map((row) => ({
                id: row.otherUserId,
                name: row.profile.username || row.profile.globalHandle || 'Buddy',
              })),
          );
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
    }, [activeHousehold, creator.isApprovedCreator, userId]),
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
      level: result.level,
      goal: result.goal,
      equipment: result.equipment,
      personIds: result.personIds,
      buddyUserIds: result.buddyUserIds,
      exercises: result.exercises.flatMap((exercise) =>
        exercise.exerciseId
          ? [
              {
                exerciseId: exercise.exerciseId,
                name: exercise.name,
                tracking: exercise.tracking,
                targetUnit: exercise.targetUnit,
                targetSets: exercise.targetSets,
                targetReps: exercise.targetReps,
                targetDurationSec: exercise.targetDurationSec,
                targetDistanceKm: exercise.targetDistanceKm,
                targetWeight: exercise.targetWeight,
                targetEffort: exercise.targetEffort,
                targetRpe: exercise.targetRpe,
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
            <CreatorSearchHits query={query} />
          </View>
          {canCreate ? <TrainButton label="New workout" onPress={() => setBuilderOpen(true)} /> : null}
          {canCreate ? (
            <TrainButton
              label="Import"
              tone="ghost"
              onPress={() => {
                if (userId && activeHousehold) {
                  void loadHistoryDedupeKeys(userId, activeHousehold.id)
                    .then(setHistoryKeys)
                    .catch(() => setHistoryKeys([]));
                }
                setImportOpen(true);
              }}
            />
          ) : null}
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
            {groupCopies.length > 0 ? (
              <View style={styles.groupBlock}>
                <Text style={styles.groupTitle}>Group workouts</Text>
                {groupCopies.map((workout) => {
                  const dateLabel = workout.workoutDate
                    ? new Date(`${workout.workoutDate}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : null;
                  return (
                    <View key={workout.id} style={styles.groupRow}>
                      <Pressable
                        accessibilityRole="button"
                        style={styles.groupCopy}
                        onPress={() => {
                          if (workout.groupWorkoutId) {
                            router.push(`/train/group/${workout.groupWorkoutId}` as Href);
                            return;
                          }
                          router.push(`/train/${workout.id}` as Href);
                        }}>
                        <Text style={styles.groupName} numberOfLines={1}>
                          {workout.name}
                        </Text>
                        {dateLabel ? <Text style={styles.groupMeta}>{dateLabel}</Text> : null}
                      </Pressable>
                      <TrainButton
                        label="Start"
                        compact
                        onPress={() => router.push(`/train/session/${workout.id}` as Href)}
                      />
                    </View>
                  );
                })}
              </View>
            ) : null}
            {ready && visible.length === 0 && groupCopies.length === 0 ? (
              <Text style={styles.empty}>{workouts.length === 0 ? 'No workouts yet' : 'No matches'}</Text>
            ) : null}
            <View style={styles.grid}>
              {visible.map((workout) => {
                const plan = plans.get(workout.id);
                const minutes = plan?.minutes || workout.durationMin || 0;
                const focuses = plan?.focuses ?? [];
                const muscles = focuses.slice(0, 4).join(' · ');
                const names = workout.exercises.map((exercise) => {
                  const title = exerciseTitle(exercise.name);
                  const target = formatTrackingTarget({
                    tracking: exercise.tracking,
                    targetUnit: exercise.targetUnit,
                    targetSets: exercise.targetSets,
                    targetReps: exercise.targetReps,
                    targetDurationSec: exercise.targetDurationSec,
                    targetDistanceKm: exercise.targetDistanceKm,
                  });
                  return target ? `${title} · ${target}` : title;
                });
                const listed = names.slice(0, SHOWN_EXERCISES);
                const extra = Math.max(0, names.length - listed.length);
                const scores = [...workout.ratings].sort((a, b) => (a.userId === userId ? -1 : b.userId === userId ? 1 : 0));
                const mine = userId ? workout.ratings.find((rating) => rating.userId === userId)?.score : undefined;
                const open = openIds.has(workout.id);
                const ratingLabel =
                  scores.length > 0
                    ? scores.map((rating) => `${rating.userId === userId ? 'You' : nameFor(rating.userId)} ${rating.score}/10`).join(' · ')
                    : 'Rate';
                const openWorkout = () => router.push(`/train/${workout.id}` as Href);
                return (
                  <View key={workout.id} style={[styles.card, wide && styles.cardWide]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Share ${workout.name}`}
                      onPress={() => setExportWorkout(workout)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}>
                      <ShareGlyph />
                    </Pressable>

                    <View style={styles.cardBody}>
                      <BodyMap muscleGroups={focuses} />
                      <View style={styles.cardCopy}>
                        <Pressable accessibilityRole="button" onPress={openWorkout}>
                          <Text style={styles.name} numberOfLines={2}>
                            {workout.name}
                          </Text>
                        </Pressable>
                        <View style={styles.metaRow}>
                          {minutes > 0 ? (
                            <Pressable accessibilityRole="button" onPress={openWorkout}>
                              <Text style={styles.meta}>{minutes} min</Text>
                            </Pressable>
                          ) : null}
                          {minutes > 0 && userId ? <Text style={styles.meta}> · </Text> : null}
                          {userId ? (
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => setRatingId((current) => (current === workout.id ? null : workout.id))}
                              hitSlop={6}
                              style={styles.scoreHit}>
                              <Text style={styles.scoreLine} numberOfLines={1}>
                                {ratingLabel}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                        <Pressable accessibilityRole="button" onPress={openWorkout}>
                          {muscles ? (
                            <Text style={styles.focus} numberOfLines={1}>
                              {muscles}
                            </Text>
                          ) : null}
                          {listed.length > 0 ? (
                            <View style={styles.exerciseList}>
                              {listed.map((name, index) => (
                                <View key={`${name}-${index}`} style={styles.exerciseRow}>
                                  <Text style={styles.exerciseDot}>•</Text>
                                  <Text style={styles.exercise} numberOfLines={1}>
                                    {name}
                                  </Text>
                                </View>
                              ))}
                              {extra > 0 ? <Text style={styles.more}>+{extra} more</Text> : null}
                            </View>
                          ) : null}
                        </Pressable>
                      </View>
                    </View>

                    {userId && ratingId === workout.id ? (
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

                    <View style={styles.actions}>
                      <TrainButton
                        label={open ? 'Resume' : 'Start'}
                        onPress={() => router.push(`/train/session/${workout.id}` as Href)}
                        fill
                        compact
                      />
                      {open ? (
                        <TrainButton
                          label="Clear"
                          tone="ghost"
                          disabled={clearingId === workout.id}
                          onPress={() => void clearWorkout(workout.id)}
                          fill
                          compact
                        />
                      ) : null}
                    </View>
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
          seed={{ ...EMPTY_WORKOUT_SEED, visibility: defaultVisibility }}
          people={people}
          buddies={buddies}
          editable
          onClose={() => setBuilderOpen(false)}
          onSubmit={submitNew}
        />
      ) : null}
      <ListExportSheet
        visible={Boolean(exportWorkout)}
        input={exportWorkout ? workoutExportInput(exportWorkout, weightUnit) : null}
        linkShare={
          exportWorkout
            ? {
                preview: sharePreview([
                  `${user?.displayName?.trim() || 'Workout'}'s ${exportWorkout.name}`,
                  `${exportWorkout.exercises.length} exercise${exportWorkout.exercises.length === 1 ? '' : 's'}`,
                  exportWorkout.durationMin ? `${exportWorkout.durationMin} min` : null,
                ]),
                state: {
                  isShared: exportWorkout.isShared,
                  shareToken: exportWorkout.shareToken,
                  url:
                    exportWorkout.isShared && exportWorkout.shareToken
                      ? buildShareUrl('workout', exportWorkout.shareToken)
                      : null,
                },
                busy: linkShareBusy,
                error: linkShareError,
                onToggle: async (enabled) => {
                  setLinkShareBusy(true);
                  setLinkShareError(null);
                  try {
                    const url = enabled
                      ? await enableEntityShare('workout', exportWorkout.id, exportWorkout.shareToken)
                      : await disableEntityShare('workout', exportWorkout.id);
                    await refreshWorkouts();
                    return url;
                  } catch (err) {
                    setLinkShareError(err instanceof Error ? err.message : 'Could not update share link');
                    throw err;
                  } finally {
                    setLinkShareBusy(false);
                  }
                },
                onReset: async () => {
                  setLinkShareBusy(true);
                  setLinkShareError(null);
                  try {
                    const url = await resetEntityShare('workout', exportWorkout.id);
                    await refreshWorkouts();
                    return url;
                  } catch (err) {
                    setLinkShareError(err instanceof Error ? err.message : 'Could not reset share link');
                    throw err;
                  } finally {
                    setLinkShareBusy(false);
                  }
                },
              }
            : null
        }
        onClose={() => {
          setExportWorkout(null);
          setLinkShareError(null);
        }}
      />
      <ListImportWizard
        visible={importOpen}
        kind="workout"
        existingLists={workouts.map((workout) => ({ id: workout.id, name: workout.name }))}
        existingItems={workouts.flatMap((workout) => workout.exercises.map((exercise) => ({ title: exercise.name })))}
        existingHistory={historyKeys}
        existingWorkoutFingerprints={workouts.map((workout) => ({
          id: workout.id,
          name: workout.name,
          exerciseNames: workout.exercises.map((exercise) => exercise.name),
        }))}
        weightUnit={weightUnit}
        loadExerciseCatalog={async () =>
          (await loadLibrary()).map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            category: exercise.category,
          }))
        }
        writers={
          {
            ensureTargetList: async (target) => {
              if (!activeHousehold || !userId) throw new Error('Sign in to import workouts');
              if (target.mode === 'existing') return target.listId;
              return createWorkout({
                householdId: activeHousehold.id,
                userId,
                name: target.name,
                visibility: 'private',
                splitId: null,
                durationMin: null,
                personIds: [],
                exercises: [],
              });
            },
            writeRow: async (listId, row) => {
              if (!listId || !activeHousehold) return;
              const current = (await loadWorkouts(activeHousehold.id)).find((workout) => workout.id === listId);
              if (!current) return;
              await saveWorkout(listId, activeHousehold.id, {
                name: current.name,
                visibility: current.visibility,
                splitId: current.splitId,
                durationMin: current.durationMin,
                level: current.level,
                goal: current.goal,
                equipment: current.equipment,
                personIds: current.personIds,
                buddyUserIds: current.buddyUserIds,
                exercises: [
                  ...current.exercises.map((exercise) => ({
                    exerciseId: exercise.exerciseId,
                    name: exercise.name,
                    tracking: exercise.tracking,
                    targetUnit: exercise.targetUnit,
                    targetSets: exercise.targetSets,
                    targetReps: exercise.targetReps,
                    targetDurationSec: exercise.targetDurationSec,
                    targetDistanceKm: exercise.targetDistanceKm,
                    targetWeight: exercise.targetWeight,
                    targetEffort: exercise.targetEffort,
                    targetRpe: exercise.targetRpe,
                    note: exercise.note,
                    supersetId: exercise.supersetId,
                  })),
                  {
                    exerciseId: null,
                    name: row.title,
                    targetSets: row.sets ?? 3,
                    targetReps: row.reps ?? '8',
                    targetWeight: workoutWeightToKg(row.weight, weightUnit),
                    note: row.notes ?? '',
                    supersetId: null,
                  },
                ],
              });
              setWorkouts(await loadWorkouts(activeHousehold.id));
            },
            workoutExport:
              activeHousehold && userId
                ? {
                    createRoutine: async (routine) => {
                      const id = await createWorkout({
                        householdId: activeHousehold.id,
                        userId,
                        name: routine.name,
                        visibility: 'private',
                        splitId: null,
                        durationMin: routine.durationMin,
                        personIds: [],
                        exercises: routine.exercises
                          .filter((exercise) => exercise.status === 'ready' || exercise.status === 'needsMatch')
                          .map((exercise) => ({
                            exerciseId: exercise.exerciseId,
                            name: exercise.name,
                            targetSets: exercise.targetSets,
                            targetReps: exercise.targetReps,
                            targetWeight: exercise.targetWeightKg,
                            targetEffort: exercise.targetEffort ?? null,
                            targetRpe: exercise.targetRpe,
                            note: exercise.note ?? '',
                            supersetId: null,
                          })),
                      });
                      await refreshWorkouts();
                      return id;
                    },
                    findRoutineId: async (name) => {
                      const rows = await loadWorkouts(activeHousehold.id);
                      const hit = rows.find(
                        (workout) => workout.name.trim().toLowerCase() === name.trim().toLowerCase(),
                      );
                      return hit?.id ?? null;
                    },
                    createCustomExercise: async (name) =>
                      createCustomExercise({
                        userId,
                        draft: {
                          name,
                          bodyPart: 'other',
                          equipment: 'body weight',
                          targetMuscle: 'other',
                          secondaryMuscles: [],
                          instructions: [],
                          category: null,
                          difficulty: null,
                          isCompound: null,
                          mediaUrl: null,
                          mediaUrls: [],
                          mediaKind: null,
                          scope: 'private',
                          householdId: null,
                          groupId: null,
                        },
                      }),
                    createHistorySession: async (session, workoutId) => {
                      if (!session.startedAt) return;
                      await importFinishedSession({
                        householdId: activeHousehold.id,
                        userId,
                        workoutId,
                        name: session.name,
                        startedAt: session.startedAt,
                        finishedAt: session.endedAt,
                        durationMin: session.durationMin,
                        exercises: session.exercises.map((exercise) => ({
                          exerciseId: exercise.exerciseId,
                          name: exercise.name,
                          sets: exercise.sets.map((set) => ({
                            weightKg: set.weightKg,
                            reps: set.reps,
                            durationSec: set.durationSec,
                          })),
                        })),
                      });
                      setHistoryKeys(await loadHistoryDedupeKeys(userId, activeHousehold.id));
                    },
                  }
                : undefined,
          } satisfies ListImportWriters
        }
        onOpenExistingWorkout={(workoutId) => {
          setImportOpen(false);
          router.push(`/train/${workoutId}` as Href);
        }}
        onClose={() => setImportOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, minWidth: 0, gap: 8 },
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
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
    position: 'relative',
  },
  cardWide: { flexBasis: 320, maxWidth: 480 },
  shareBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnPressed: { opacity: 0.82 },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 28,
  },
  cardCopy: { flex: 1, gap: 2, minWidth: 0 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  scoreHit: { flexShrink: 1, minWidth: 0 },
  scoreLine: { color: colors.text, fontSize: 12, fontWeight: '700' },
  focus: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  exerciseList: { gap: 1, marginTop: 4 },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  exerciseDot: { color: colors.textDim, fontSize: 12, lineHeight: 16, width: 8 },
  exercise: { color: colors.textDim, fontSize: 12, lineHeight: 16, flex: 1 },
  more: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2, marginLeft: 14 },
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
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: 24 },
  groupBlock: { gap: 8, marginBottom: 12 },
  groupTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  groupCopy: { flex: 1, minWidth: 0, gap: 2 },
  groupName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  groupMeta: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
});
