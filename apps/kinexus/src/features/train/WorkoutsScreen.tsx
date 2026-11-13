import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  canCreateShared,
  clusterExercises,
  estimateWorkout,
  EXERCISE_SOURCE_BADGE_LABEL,
  exerciseSearchScore,
  filterHiddenWorkouts,
  filterTrainGlobalLibrary,
  formatTrackingTarget,
  resolveDefaultWorkoutVisibility,
  sortWorkoutsOpenFirst,
  trainGlobalCreatorLabel,
  type RemixCategory,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { ListExportSheet } from '@/src/features/lists/ListExportSheet';
import { workoutExportInput } from '@/src/features/lists/list-io-adapters';
import { buildShareUrl } from '@/src/features/share/share-url';
import { disableEntityShare, enableEntityShare, resetEntityShare, sharePreview } from '@/src/features/share/link-share';
import {
  clearOpenSession,
  copyGlobalWorkoutToMine,
  createWorkout,
  hideWorkout,
  loadGlobalWorkouts,
  loadHiddenWorkoutIds,
  loadLibrary,
  loadOpenWorkoutIds,
  loadOutOfLibraryGroupWorkouts,
  loadTrainPrefs,
  loadYoursWorkouts,
  rateGlobalWorkout,
  saveWorkoutRating,
  unhideWorkout,
  type GlobalWorkoutCard,
  type LibraryExercise,
  type OutOfLibraryGroupWorkout,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { loadTrainBuddies } from '@/src/features/train/buddies-api';
import { BodyMap } from '@/src/features/train/plan/BodyMap';
import { ShareGlyph } from '@/src/features/train/plan/PlanVisibilityBar';
import { EMPTY_WORKOUT_SEED, WorkoutBuilder, type WorkoutBuilderResult } from '@/src/features/train/WorkoutBuilder';
import { CreatorSearchHits } from '@/src/features/creators/CreatorSearchHits';
import { publicPrimaryName, PublicName } from '@/src/features/shell/PublicName';
import {
  ExerciseSteps,
  MediaGallery,
  Pill,
  SearchField,
  Segmented,
  TrainButton,
  TrainPage,
} from '@/src/features/train/ui';
import { exerciseFacts, exerciseTitle } from '@/src/features/train/format';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useCreator } from '@/src/features/creators/use-creator';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';
import { useUnits } from '@/src/lib/use-units';

const SHOWN_EXERCISES = 5;

type LengthFilter = 'any' | 'short' | 'medium' | 'long';
type Pane = 'yours' | 'official' | 'creators';
type VisibilityFilter = 'visible' | 'hidden';
type AddedByFilter = 'any' | string;
type SelectedWorkout =
  | { kind: 'yours'; workout: WorkoutDraft }
  | { kind: 'global'; workout: GlobalWorkoutCard };

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

/** Who put this workout under Yours. */
function yoursAddedById(workout: WorkoutDraft): string | null {
  return workout.addedBy ?? workout.createdBy;
}

function yoursOriginLabel(
  workout: WorkoutDraft,
  viewerId: string | null,
  resolveName: (userId: string) => string,
): string | null {
  const adderId = yoursAddedById(workout);
  const mine = Boolean(viewerId && adderId === viewerId);

  if (workout.groupWorkoutId) {
    return mine || !adderId ? 'Group' : `Group · ${resolveName(adderId)}`;
  }
  if (!adderId) return workout.sourceWorkoutId ? 'Saved' : null;
  if (mine) return 'You';
  return resolveName(adderId);
}

export function WorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { mode } = useExperienceMode();
  const { activeHousehold, people, members, role } = useHousehold();
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const [pane, setPane] = useState<Pane>('yours');
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [globalRows, setGlobalRows] = useState<GlobalWorkoutCard[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [groupCopies, setGroupCopies] = useState<OutOfLibraryGroupWorkout[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<RemixCategory | ''>('');
  const [length, setLength] = useState<LengthFilter>('any');
  const [visibility, setVisibility] = useState<VisibilityFilter>('visible');
  const [addedBy, setAddedBy] = useState<AddedByFilter>('any');
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedWorkout | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<LibraryExercise | { name: string; note?: string } | null>(
    null,
  );
  const [libraryById, setLibraryById] = useState<Map<string, LibraryExercise>>(new Map());
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
    const rows = await loadYoursWorkouts(activeHousehold.id);
    setWorkouts(rows);
    setExportWorkout((current) => (current ? rows.find((row) => row.id === current.id) ?? current : null));
    if (userId) {
      const [copies, hidden, globals] = await Promise.all([
        loadOutOfLibraryGroupWorkouts(activeHousehold.id, userId),
        loadHiddenWorkoutIds(userId),
        loadGlobalWorkouts(userId),
      ]);
      setGroupCopies(copies);
      setHiddenIds(new Set(hidden));
      setGlobalRows(globals);
    } else {
      setGroupCopies([]);
      setHiddenIds(new Set());
      setGlobalRows([]);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!activeHousehold) return;
      let cancelled = false;
      const householdId = activeHousehold.id;
      Promise.all([
        loadYoursWorkouts(householdId),
        userId ? loadOutOfLibraryGroupWorkouts(householdId, userId) : Promise.resolve([]),
        userId ? loadHiddenWorkoutIds(userId) : Promise.resolve([]),
        userId ? loadGlobalWorkouts(userId) : Promise.resolve([]),
        userId ? loadTrainPrefs(userId) : Promise.resolve(null),
        userId ? loadTrainBuddies(userId) : Promise.resolve([]),
        loadLibrary(),
      ])
        .then(([rows, copies, hidden, globals, prefs, buddyRows, library]) => {
          if (cancelled) return;
          setWorkouts(rows);
          setGroupCopies(copies);
          setHiddenIds(new Set(hidden));
          setGlobalRows(globals);
          setLibraryById(new Map(library.map((exercise) => [exercise.id, exercise])));
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

  const globalPlans = useMemo(() => {
    const byId = new Map<string, ReturnType<typeof estimateWorkout>>();
    for (const workout of globalRows) {
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
  }, [globalRows]);

  const focusOptions = useMemo(() => {
    const seen = new Set<RemixCategory>();
    const source =
      pane === 'yours'
        ? plans.values()
        : [...globalPlans.entries()]
            .filter(([id]) => {
              const row = globalRows.find((item) => item.id === id);
              if (!row) return false;
              return pane === 'official' ? row.isSystem : !row.isSystem;
            })
            .map(([, plan]) => plan)
            .values();
    for (const plan of source) {
      for (const item of plan.focuses) seen.add(item);
    }
    return [{ value: '' as const, label: 'Any focus' }, ...[...seen].map((item) => ({ value: item, label: item }))];
  }, [globalPlans, globalRows, pane, plans]);

  function nameFor(id: string) {
    return (
      people.find((person) => person.userId === id)?.name ||
      members.find((member) => member.userId === id)?.profile.displayName ||
      buddies.find((buddy) => buddy.id === id)?.name ||
      'Someone'
    );
  }

  const addedByOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const workout of workouts) {
      const id = yoursAddedById(workout);
      if (id) ids.add(id);
    }
    const options: { value: AddedByFilter; label: string }[] = [{ value: 'any', label: 'Anyone' }];
    const rest = [...ids].sort((a, b) => {
      if (userId && a === userId) return -1;
      if (userId && b === userId) return 1;
      return nameFor(a).localeCompare(nameFor(b));
    });
    for (const id of rest) {
      options.push({ value: id, label: userId && id === userId ? 'You' : nameFor(id) });
    }
    return options;
  }, [buddies, members, people, userId, workouts]);

  const visibleYours = useMemo(() => {
    const pool =
      visibility === 'hidden'
        ? workouts.filter((workout) => hiddenIds.has(workout.id))
        : filterHiddenWorkouts(workouts, hiddenIds);
    const ranked: { workout: WorkoutDraft; score: number }[] = [];
    for (const workout of pool) {
      const plan = plans.get(workout.id);
      if (focus && !plan?.focuses.includes(focus)) continue;
      if (length !== 'any' && lengthBucket(plan?.minutes ?? workout.durationMin ?? 0) !== length) continue;
      if (addedBy !== 'any' && yoursAddedById(workout) !== addedBy) continue;
      const haystack = [workout.name, ...workout.exercises.map((exercise) => exercise.name), ...(plan?.focuses ?? [])].join(' ');
      const score = exerciseSearchScore(query, haystack);
      if (score === null) continue;
      ranked.push({ workout, score });
    }
    ranked.sort((a, b) => a.score - b.score);
    return sortWorkoutsOpenFirst(
      ranked.map((item) => item.workout),
      openIds,
    );
  }, [addedBy, focus, hiddenIds, length, openIds, plans, query, visibility, workouts]);

  const visibleGlobal = useMemo(() => {
    const scoped = globalRows.filter((row) => (pane === 'official' ? row.isSystem : !row.isSystem));
    const pool =
      visibility === 'hidden'
        ? scoped.filter((row) => hiddenIds.has(row.id))
        : filterHiddenWorkouts(scoped, hiddenIds);
    const filtered = filterTrainGlobalLibrary(
      pool.map((row) => ({
        id: row.id,
        name: row.name,
        level: row.level,
        goal: row.goal,
        equipment: row.equipment,
        durationMin: row.durationMin,
        updatedAt: row.updatedAt,
        avgScore: row.avgScore,
        ratingCount: row.ratingCount,
        creatorId: row.createdBy,
        isSystem: row.isSystem,
        creatorLabel:
          trainGlobalCreatorLabel(row) ??
          (row.creator
            ? [publicPrimaryName(row.creator), row.creator.globalHandle].filter(Boolean).join(' ')
            : null),
      })),
      { query },
    )
      .map((item) => pool.find((row) => row.id === item.id))
      .filter((row): row is GlobalWorkoutCard => Boolean(row))
      .filter((row) => {
        const plan = globalPlans.get(row.id);
        if (focus && !plan?.focuses.includes(focus)) return false;
        if (length !== 'any' && lengthBucket(plan?.minutes ?? row.durationMin ?? 0) !== length) return false;
        return true;
      });
    return filtered;
  }, [focus, globalPlans, globalRows, hiddenIds, length, pane, query, visibility]);

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
    await refreshWorkouts();
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
    const ratings =
      nextScore === null
        ? previous.filter((rating) => rating.userId !== userId)
        : [...previous.filter((rating) => rating.userId !== userId), { userId, score: nextScore }];
    setWorkouts((current) => current.map((item) => (item.id === workout.id ? { ...item, ratings } : item)));
    setRatingId(null);
    try {
      await saveWorkoutRating({ workoutId: workout.id, userId, householdId: activeHousehold.id, score: nextScore });
    } catch (err: unknown) {
      setWorkouts((current) => current.map((item) => (item.id === workout.id ? { ...item, ratings: previous } : item)));
      setError(err instanceof Error ? err.message : 'Could not save the score');
    }
  }

  async function rateGlobal(workout: GlobalWorkoutCard, score: number) {
    if (!userId) return;
    const nextScore = workout.myScore === score ? null : score;
    setBusyId(workout.id);
    setRatingId(null);
    setError(null);
    try {
      await rateGlobalWorkout({ workoutId: workout.id, userId, score: nextScore });
      const next = await loadGlobalWorkouts(userId);
      setGlobalRows(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the score');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleHide(workoutId: string) {
    if (!userId || busyId) return;
    setBusyId(workoutId);
    setError(null);
    const isHidden = hiddenIds.has(workoutId);
    try {
      if (isHidden) await unhideWorkout({ workoutId, userId });
      else await hideWorkout({ workoutId, userId });
      setHiddenIds((current) => {
        const next = new Set(current);
        if (isHidden) next.delete(workoutId);
        else next.add(workoutId);
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update workout visibility');
    } finally {
      setBusyId(null);
    }
  }

  async function ensureGlobalCopy(workout: GlobalWorkoutCard): Promise<string> {
    if (!userId || !activeHousehold) throw new Error('Sign in to save a workout');
    const existing = workouts.find((row) => row.sourceWorkoutId === workout.id);
    if (existing) return existing.id;
    const { workoutId } = await copyGlobalWorkoutToMine({
      workout,
      householdId: activeHousehold.id,
      userId,
    });
    await refreshWorkouts();
    return workoutId;
  }

  async function startGlobal(workout: GlobalWorkoutCard) {
    if (!userId || !activeHousehold || busyId) return;
    setBusyId(workout.id);
    setError(null);
    try {
      const workoutId = await ensureGlobalCopy(workout);
      setSelected(null);
      router.push(`/train/session/${workoutId}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start workout');
    } finally {
      setBusyId(null);
    }
  }

  async function editGlobal(workout: GlobalWorkoutCard) {
    if (!userId || !activeHousehold || busyId) return;
    setBusyId(workout.id);
    setError(null);
    try {
      const workoutId = await ensureGlobalCopy(workout);
      setSelected(null);
      setPane('yours');
      router.push(`/train/${workoutId}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open workout for editing');
    } finally {
      setBusyId(null);
    }
  }

  async function shareGlobal(workout: GlobalWorkoutCard) {
    if (!userId || !activeHousehold || busyId) return;
    setBusyId(workout.id);
    setError(null);
    try {
      const workoutId = await ensureGlobalCopy(workout);
      const rows = await loadYoursWorkouts(activeHousehold.id);
      setWorkouts(rows);
      const copy = rows.find((row) => row.id === workoutId) ?? null;
      if (!copy) throw new Error('Could not prepare workout for sharing');
      setSelected(null);
      setPane('yours');
      setExportWorkout(copy);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not share workout');
    } finally {
      setBusyId(null);
    }
  }

  const selectedYoursOrigin =
    selected?.kind === 'yours' ? yoursOriginLabel(selected.workout, userId, nameFor) : null;

  return (
    <>
      <TrainPage>
        <Segmented
          value={pane}
          options={[
            { value: 'yours', label: 'Yours' },
            { value: 'official', label: 'Official' },
            { value: 'creators', label: 'Creators' },
          ]}
          onChange={(next) => {
            setPane(next);
            setFocus('');
            setAddedBy('any');
          }}
        />
        <View style={styles.toolbar}>
          <View style={styles.search}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={pane === 'creators' ? 'Search workouts or creators' : 'Search workouts'}
            />
            {pane === 'creators' ? <CreatorSearchHits query={query} /> : null}
          </View>
          {pane === 'yours' && canCreate ? <TrainButton label="New workout" onPress={() => setBuilderOpen(true)} /> : null}
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
            <FilterDropdown
              id="visibility"
              label="Show"
              value={visibility}
              valueLabel={visibility === 'visible' ? 'Visible' : 'Hidden'}
              open={openMenu === 'visibility'}
              options={[
                { value: 'visible', label: 'Visible' },
                { value: 'hidden', label: 'Hidden' },
              ]}
              active={visibility !== 'visible'}
              onToggle={toggleMenu}
              onSelect={pick(setVisibility)}
            />
            {pane === 'yours' && addedByOptions.length > 2 ? (
              <FilterDropdown
                id="addedBy"
                label="Added by"
                value={addedBy}
                valueLabel={addedByOptions.find((option) => option.value === addedBy)?.label ?? 'Anyone'}
                open={openMenu === 'addedBy'}
                options={addedByOptions}
                active={addedBy !== 'any'}
                onToggle={toggleMenu}
                onSelect={pick(setAddedBy)}
              />
            ) : null}
          </FilterBar>
        </View>
        <ErrorBanner message={error} />
        {!ready && !error ? (
          <LoadingState label="Loading workouts" />
        ) : pane === 'yours' ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {groupCopies.length > 0 && visibility === 'visible' ? (
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
            {ready && visibleYours.length === 0 && (visibility === 'hidden' || groupCopies.length === 0) ? (
              <Text style={styles.empty}>
                {visibility === 'hidden'
                  ? 'No hidden workouts'
                  : workouts.length === 0
                    ? 'No workouts yet'
                    : 'No matches'}
              </Text>
            ) : null}
            <View style={styles.grid}>
              {visibleYours.map((workout) => {
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
                const openDetail = () => setSelected({ kind: 'yours', workout });
                const origin = yoursOriginLabel(workout, userId, nameFor);
                return (
                  <View key={workout.id} style={[styles.card, open && styles.cardOpen, wide && styles.cardWide]}>
                    {open ? <Text style={styles.inProgress}>In progress</Text> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Share ${workout.name}`}
                      onPress={() => setExportWorkout(workout)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}>
                      <ShareGlyph />
                    </Pressable>

                    <View style={styles.cardBody}>
                      <Pressable accessibilityRole="button" onPress={openDetail} style={styles.cardHit}>
                        <BodyMap muscleGroups={focuses} />
                        <View style={styles.cardCopy}>
                          <Text style={styles.name} numberOfLines={2}>
                            {workout.name}
                          </Text>
                          {origin ? (
                            <View style={styles.originRow}>
                              <Pill label={origin} />
                            </View>
                          ) : null}
                          {minutes > 0 ? <Text style={styles.meta}>{minutes} min</Text> : null}
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
                        </View>
                      </Pressable>
                      {userId ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setRatingId((current) => (current === workout.id ? null : workout.id))}
                          hitSlop={6}
                          style={styles.scoreHitOutside}>
                          <Text style={styles.scoreLine} numberOfLines={1}>
                            {ratingLabel}
                          </Text>
                        </Pressable>
                      ) : null}
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
                      {userId ? (
                        <TrainButton
                          label={hiddenIds.has(workout.id) ? 'Unhide' : 'Hide'}
                          tone="ghost"
                          disabled={busyId === workout.id}
                          onPress={() => void toggleHide(workout.id)}
                          compact
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {visibleGlobal.length === 0 ? (
              <Text style={styles.empty}>
                {visibility === 'hidden'
                  ? 'No hidden workouts'
                  : query.trim()
                    ? 'No matches'
                    : pane === 'official'
                      ? 'No official workouts'
                      : 'No creator workouts'}
              </Text>
            ) : (
              <View style={styles.grid}>
                {visibleGlobal.map((workout) => {
                  const plan = globalPlans.get(workout.id);
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
                  const systemLabel = trainGlobalCreatorLabel(workout);
                  const ratingLabel =
                    workout.myScore != null
                      ? `You ${workout.myScore}/10`
                      : workout.avgScore != null
                        ? `${workout.avgScore}/10`
                        : 'Rate';
                  return (
                    <View key={workout.id} style={[styles.card, wide && styles.cardWide]}>
                      {userId && activeHousehold ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Share ${workout.name}`}
                          onPress={() => void shareGlobal(workout)}
                          hitSlop={6}
                          style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}>
                          <ShareGlyph />
                        </Pressable>
                      ) : null}
                      <View style={styles.cardBody}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setSelected({ kind: 'global', workout })}
                          style={styles.cardHit}>
                          <BodyMap muscleGroups={focuses} />
                          <View style={styles.cardCopy}>
                            <Text style={styles.name} numberOfLines={2}>
                              {workout.name}
                            </Text>
                            {systemLabel ? (
                              <View style={styles.systemCreator}>
                                <Text style={styles.creatorName}>{systemLabel}</Text>
                                <Text style={styles.officialBadge}>Official</Text>
                              </View>
                            ) : workout.creator ? (
                              <PublicName user={workout.creator} primaryStyle={styles.creatorName} />
                            ) : null}
                            {minutes > 0 ? <Text style={styles.meta}>{minutes} min</Text> : null}
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
                          </View>
                        </Pressable>
                        {userId ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setRatingId((current) => (current === workout.id ? null : workout.id))}
                            hitSlop={6}
                            style={styles.scoreHitOutside}>
                            <Text style={styles.scoreLine} numberOfLines={1}>
                              {ratingLabel}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {userId && ratingId === workout.id ? (
                        <View style={styles.scores}>
                          {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                            <Pressable
                              key={score}
                              accessibilityRole="button"
                              accessibilityLabel={`Score ${score}`}
                              onPress={() => void rateGlobal(workout, score)}
                              style={[styles.score, workout.myScore === score && styles.scoreOn]}>
                              <Text style={[styles.scoreLabel, workout.myScore === score && styles.scoreLabelOn]}>
                                {score}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}

                      <View style={styles.actions}>
                        {userId && activeHousehold ? (
                          <TrainButton
                            label={busyId === workout.id ? 'Starting…' : 'Start'}
                            onPress={() => void startGlobal(workout)}
                            fill
                            compact
                          />
                        ) : null}
                        {userId && activeHousehold ? (
                          <TrainButton
                            label="Edit"
                            tone="ghost"
                            disabled={busyId === workout.id}
                            onPress={() => void editGlobal(workout)}
                            compact
                          />
                        ) : null}
                        {userId ? (
                          <TrainButton
                            label={hiddenIds.has(workout.id) ? 'Unhide' : 'Hide'}
                            tone="ghost"
                            disabled={busyId === workout.id}
                            onPress={() => void toggleHide(workout.id)}
                            compact
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </TrainPage>
      <Sheet
        visible={selected !== null}
        title={selected?.workout.name ?? ''}
        wide
        onClose={() => {
          setSelectedExercise(null);
          setSelected(null);
        }}>
        {selected ? (
          <WorkoutDetailBody
            name={selected.workout.name}
            description={selected.kind === 'global' ? selected.workout.description : null}
            minutes={
              (selected.kind === 'yours'
                ? plans.get(selected.workout.id)?.minutes
                : globalPlans.get(selected.workout.id)?.minutes) ||
              selected.workout.durationMin ||
              0
            }
            focuses={
              (selected.kind === 'yours'
                ? plans.get(selected.workout.id)?.focuses
                : globalPlans.get(selected.workout.id)?.focuses) ?? []
            }
            creator={
              selected.kind === 'global' ? (
                trainGlobalCreatorLabel(selected.workout) ? (
                  <View style={styles.systemCreator}>
                    <Text style={styles.creatorName}>{trainGlobalCreatorLabel(selected.workout)}</Text>
                    <Text style={styles.officialBadge}>Official</Text>
                  </View>
                ) : selected.workout.creator ? (
                  <PublicName user={selected.workout.creator} link />
                ) : null
              ) : selectedYoursOrigin ? (
                <Pill label={selectedYoursOrigin} />
              ) : null
            }
            exercises={selected.workout.exercises}
            onExercisePress={(exercise) => {
              const catalog = exercise.exerciseId ? libraryById.get(exercise.exerciseId) : null;
              setSelectedExercise(catalog ?? { name: exercise.name, note: exercise.note });
            }}
            actions={
              <View style={styles.detailActions}>
                {selected.kind === 'yours' ? (
                  <>
                    <TrainButton
                      label={openIds.has(selected.workout.id) ? 'Resume' : 'Start'}
                      fill
                      onPress={() => {
                        const id = selected.workout.id;
                        setSelected(null);
                        router.push(`/train/session/${id}` as Href);
                      }}
                    />
                    {openIds.has(selected.workout.id) ? (
                      <TrainButton
                        label="Clear"
                        tone="ghost"
                        disabled={clearingId === selected.workout.id}
                        onPress={() => void clearWorkout(selected.workout.id)}
                      />
                    ) : null}
                    <TrainButton
                      label="Edit"
                      tone="ghost"
                      onPress={() => {
                        const id = selected.workout.id;
                        setSelected(null);
                        router.push(`/train/${id}` as Href);
                      }}
                    />
                  </>
                ) : userId && activeHousehold ? (
                  <>
                    <TrainButton
                      label={busyId === selected.workout.id ? 'Starting…' : 'Start'}
                      fill
                      onPress={() => void startGlobal(selected.workout)}
                    />
                    <TrainButton
                      label="Edit"
                      tone="ghost"
                      disabled={busyId === selected.workout.id}
                      onPress={() => void editGlobal(selected.workout)}
                    />
                    <TrainButton
                      label="Share"
                      tone="ghost"
                      disabled={busyId === selected.workout.id}
                      onPress={() => void shareGlobal(selected.workout)}
                    />
                  </>
                ) : null}
                {userId ? (
                  <TrainButton
                    label={hiddenIds.has(selected.workout.id) ? 'Unhide' : 'Hide'}
                    tone="ghost"
                    disabled={busyId === selected.workout.id}
                    onPress={() => void toggleHide(selected.workout.id)}
                  />
                ) : null}
              </View>
            }
          />
        ) : null}
      </Sheet>
      <Sheet
        visible={selectedExercise !== null}
        title={selectedExercise ? exerciseTitle(selectedExercise.name) : ''}
        wide
        onClose={() => setSelectedExercise(null)}>
        {selectedExercise ? (
          <ExerciseDetailBody exercise={selectedExercise} />
        ) : null}
      </Sheet>
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
    </>
  );
}

function WorkoutDetailBody({
  minutes,
  focuses,
  creator,
  description,
  exercises,
  onExercisePress,
  actions,
}: {
  name: string;
  minutes: number;
  focuses: readonly string[];
  creator: ReactNode;
  description: string | null;
  exercises: readonly {
    id?: string;
    exerciseId?: string | null;
    name: string;
    tracking?: string;
    targetUnit?: string;
    targetSets: number;
    targetReps: string;
    targetDurationSec?: number | null;
    targetDistanceKm?: number | null;
    note?: string;
    supersetId?: string | null;
  }[];
  onExercisePress: (exercise: {
    exerciseId?: string | null;
    name: string;
    note?: string;
  }) => void;
  actions: ReactNode;
}) {
  const meta = [minutes > 0 ? `${minutes} min` : null, focuses.slice(0, 4).join(' · ') || null]
    .filter(Boolean)
    .join(' · ');
  const clusters = clusterExercises(
    exercises.map((exercise) => ({ ...exercise, supersetId: exercise.supersetId ?? null })),
  );

  function renderRow(exercise: (typeof exercises)[number], index: number, inSuperset: boolean) {
    const target = formatTrackingTarget({
      tracking: exercise.tracking,
      targetUnit: exercise.targetUnit,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      targetDurationSec: exercise.targetDurationSec,
      targetDistanceKm: exercise.targetDistanceKm,
    });
    return (
      <Pressable
        key={exercise.id ?? `${exercise.name}-${index}`}
        accessibilityRole="button"
        onPress={() =>
          onExercisePress({
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            note: exercise.note,
          })
        }
        style={({ pressed }) => [
          styles.detailRow,
          inSuperset && styles.detailRowInSuperset,
          pressed && styles.detailRowPressed,
        ]}>
        <Text style={styles.detailIndex}>{index + 1}</Text>
        <View style={styles.detailRowCopy}>
          <Text style={styles.detailExercise}>{exerciseTitle(exercise.name)}</Text>
          {exercise.note ? <Text style={styles.detailNote}>{exercise.note}</Text> : null}
        </View>
        {target ? <Text style={styles.detailTarget}>{target}</Text> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.detail}>
      <View style={styles.detailHero}>
        <BodyMap muscleGroups={focuses} />
        <View style={styles.detailHeroCopy}>
          {meta ? <Text style={styles.detailMeta}>{meta}</Text> : null}
          {creator}
          {description ? <Text style={styles.detailDescription}>{description}</Text> : null}
        </View>
      </View>

      <View style={styles.detailList}>
        {clusters.map((cluster, clusterIndex) => {
          const rows = cluster.indices.map((index) =>
            renderRow(exercises[index]!, index, cluster.type === 'superset'),
          );
          if (cluster.type === 'superset') {
            return (
              <View key={`superset-${clusterIndex}`} style={styles.detailSuperset}>
                <Text style={styles.detailSupersetLabel}>Superset</Text>
                {rows}
              </View>
            );
          }
          return <View key={`solo-${clusterIndex}`}>{rows}</View>;
        })}
      </View>

      {actions}
    </View>
  );
}

function ExerciseDetailBody({
  exercise,
}: {
  exercise: LibraryExercise | { name: string; note?: string };
}) {
  if (!('sourceBadge' in exercise)) {
    return (
      <View style={styles.exerciseDetail}>
        <Text style={styles.detailExercise}>{exerciseTitle(exercise.name)}</Text>
        {exercise.note ? <Text style={styles.detailNote}>{exercise.note}</Text> : null}
      </View>
    );
  }

  const facts = exerciseFacts(exercise);
  return (
    <View style={styles.exerciseDetail}>
      {exercise.mediaUrls.length > 0 ? <MediaGallery urls={exercise.mediaUrls} name={exercise.name} /> : null}
      <View style={styles.exercisePills}>
        <Pill label={EXERCISE_SOURCE_BADGE_LABEL[exercise.sourceBadge]} />
        {facts.map((fact) => (
          <Pill key={fact} label={fact} />
        ))}
      </View>
      {exercise.sourceBadge === 'creator' && exercise.owner ? (
        <PublicName user={exercise.owner} link />
      ) : null}
      <ExerciseSteps instructions={exercise.instructions} />
    </View>
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
  cardOpen: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  cardWide: { flexBasis: 320, maxWidth: 480 },
  inProgress: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
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
    gap: 6,
    paddingRight: 28,
  },
  cardHit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardCopy: { flex: 1, gap: 2, minWidth: 0 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  originRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  scoreHitOutside: { alignSelf: 'flex-start', marginLeft: 0 },
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
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' },
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
  systemCreator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  creatorName: { fontSize: 13, fontWeight: '600', color: colors.text },
  officialBadge: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detail: { gap: space.md, paddingTop: 4, paddingBottom: space.lg },
  detailHero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  detailHeroCopy: { flex: 1, gap: 6, minWidth: 0, paddingTop: 2 },
  detailMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  detailDescription: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  detailList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailSuperset: {
    gap: 0,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingBottom: 2,
    paddingTop: 6,
  },
  detailSupersetLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailRowInSuperset: {
    borderBottomColor: 'rgba(62, 207, 191, 0.18)',
  },
  detailRowPressed: { backgroundColor: colors.bgHover },
  exerciseDetail: { gap: space.md, paddingTop: 4, paddingBottom: space.lg },
  exercisePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailIndex: {
    width: 22,
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingTop: 1,
  },
  detailRowCopy: { flex: 1, gap: 3, minWidth: 0 },
  detailExercise: { color: colors.text, fontSize: 15, fontWeight: '600' },
  detailNote: { color: colors.textDim, fontSize: 12, lineHeight: 16 },
  detailTarget: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingTop: 1,
  },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
