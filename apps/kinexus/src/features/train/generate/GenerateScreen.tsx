import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';

import {
  DAYS,
  fillWorkoutFromSessionType,
  generateTrainPlan,
  mondayWeekStart,
  swapSimilarExercises,
  WEEKLY_VOLUME_TARGET,
  weeklyVolumeByGroup,
  type Day,
  type GeneratedTrainDay,
  type SavedWorkoutCandidate,
  type TrainVisibility,
} from '@kinexus/domain';

import { GenerateDesktop } from '@/src/features/train/generate/GenerateDesktop';
import { GenerateMobile } from '@/src/features/train/generate/GenerateMobile';
import { TRAIN_GENERATE_PRESETS } from '@/src/features/train/generate/presets';
import {
  DEFAULT_TRAIN_GENERATE_PREFS,
  parseGeneratePrefs,
  type PreviewDay,
  type TrainGeneratePrefs,
} from '@/src/features/train/generate/types';
import {
  applyGeneratedTrainingPlan,
  loadGeneratePrefs,
  loadLibrary,
  loadWorkouts,
  saveGeneratePrefs,
  type LibraryExercise,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { loadTrainBuddies } from '@/src/features/train/buddies-api';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

function daysForSplit(prefs: TrainGeneratePrefs): Day[] {
  if (prefs.days.length > 0) return prefs.days;
  const n = Math.max(2, Math.min(7, prefs.daysPerWeek));
  if (prefs.splitStyle === 'full_body') return (['monday', 'wednesday', 'friday'] as Day[]).slice(0, n);
  if (prefs.splitStyle === 'upper_lower') return (['monday', 'tuesday', 'thursday', 'friday'] as Day[]).slice(0, Math.max(4, n));
  if (prefs.splitStyle === 'ppl')
    return (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as Day[]).slice(0, Math.max(6, n));
  if (prefs.splitStyle === 'bro')
    return (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as Day[]).slice(0, Math.max(5, n));
  return prefs.days;
}

function applyPostProcess(
  days: GeneratedTrainDay[],
  prefs: TrainGeneratePrefs,
  seed: number,
): PreviewDay[] {
  return days.map((day, index) => {
    let exercises = day.exercises;
    if (prefs.intensityRpe != null && !day.restDay) {
      exercises = exercises.map((ex) => ({ ...ex, targetRpe: prefs.intensityRpe! }));
    }
    if (prefs.cardioAddon === 'finisher' && !day.restDay && exercises.length > 0) {
      exercises = [
        ...exercises,
        {
          exerciseId: `finisher-${day.day}`,
          name: 'Cardio finisher',
          targetSets: 1,
          targetReps: '8-10 min',
          targetRpe: Math.min(prefs.intensityRpe ?? 7, 7),
          category: 'Cardio',
        },
      ];
    }
    return {
      ...day,
      exercises,
      scheduledTime: prefs.dayTimes[day.day] ?? null,
      seed: seed + index,
    };
  });
}

function visibilityFor(prefs: TrainGeneratePrefs): TrainVisibility {
  if (prefs.audience === 'household') return 'household';
  if (prefs.audience === 'buddies') {
    return prefs.buddyUserIds.length > 0 ? 'buddies_selected' : 'buddies';
  }
  return 'private';
}

export function GenerateScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const userId = user && !user.isDevBypass ? user.id : null;

  const [prefs, setPrefs] = useState<TrainGeneratePrefs>(DEFAULT_TRAIN_GENERATE_PREFS);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [buddies, setBuddies] = useState<{ id: string; name: string }[]>([]);
  const [preview, setPreview] = useState<PreviewDay[] | null>(null);
  const [pickingWorkoutDay, setPickingWorkoutDay] = useState<Day | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefsLoaded = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then((rows) => {
        if (!cancelled) setLibrary(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId || !activeHousehold) return;
    let cancelled = false;
    Promise.all([
      loadGeneratePrefs(userId),
      loadWorkouts(activeHousehold.id),
      loadTrainBuddies(userId),
    ])
      .then(([saved, workoutRows, buddyRows]) => {
        if (cancelled) return;
        if (!prefsLoaded.current) {
          setPrefs(parseGeneratePrefs(saved));
          prefsLoaded.current = true;
        }
        setWorkouts(workoutRows);
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load generate prefs');
      });
    return () => {
      cancelled = true;
    };
  }, [activeHousehold, userId]);

  function changePrefs(patch: Partial<TrainGeneratePrefs>) {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      if (userId) {
        if (persistTimer.current) clearTimeout(persistTimer.current);
        persistTimer.current = setTimeout(() => {
          void saveGeneratePrefs(userId, next as unknown as Record<string, unknown>).catch(() => undefined);
        }, 400);
      }
      return next;
    });
    setPreview(null);
  }

  function applyPreset(id: string) {
    const preset = TRAIN_GENERATE_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    changePrefs(preset.prefs);
  }

  const equipmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ex of library) {
      const value = (ex.equipment || '').trim();
      if (value) set.add(value);
    }
    for (const item of [...prefs.gymProfiles.home, ...prefs.gymProfiles.work, ...prefs.equipment]) {
      if (item) set.add(item);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [library, prefs.equipment, prefs.gymProfiles.home, prefs.gymProfiles.work]);

  const bodyParts = useMemo(() => {
    const set = new Set<string>();
    for (const ex of library) {
      if (ex.bodyPart) set.add(ex.bodyPart);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [library]);

  const savedCandidates = useMemo<SavedWorkoutCandidate[]>(
    () =>
      workouts.map((workout) => ({
        id: workout.id,
        name: workout.name,
        focus: [],
        durationMin: workout.durationMin,
        exerciseIds: workout.exercises.map((ex) => ex.exerciseId).filter((id): id is string => Boolean(id)),
      })),
    [workouts],
  );

  const catalogue = useMemo(() => {
    return library.filter((ex) => {
      if (ex.status !== 'active' || ex.mergedInto) return false;
      if (prefs.avoidExerciseIds.includes(ex.id)) return false;
      if (prefs.avoidBodyParts.length === 0) return true;
      return !prefs.avoidBodyParts.includes(ex.bodyPart);
    });
  }, [library, prefs.avoidBodyParts, prefs.avoidExerciseIds]);

  function runGenerate(seed = Date.now() % 1_000_000) {
    setError(null);
    const days = daysForSplit(prefs);
    const generated = generateTrainPlan({
      daysPerWeek: days.length,
      days,
      goal: prefs.goal,
      level: prefs.level,
      durationMin: prefs.durationMin,
      splitStyle: prefs.splitStyle,
      focusByDay: prefs.customFocusByDay,
      equipment: prefs.equipment.length > 0 ? prefs.equipment : undefined,
      avoidExerciseIds: prefs.avoidExerciseIds,
      preferSavedWorkouts: prefs.preferSavedWorkouts,
      savedWorkouts: savedCandidates,
      catalogue,
      seed,
    });

    let next = applyPostProcess(generated, prefs, seed);
    if (prefs.cardioAddon === 'separate_days') {
      const rest = next.find((day) => day.restDay);
      if (rest) {
        const walkDuration = Math.min(prefs.durationMin, 30);
        const walkExercises = prefs.fillWorkouts
          ? fillWorkoutFromSessionType({
              sessionTypeId: 'walk',
              durationMin: walkDuration,
              catalogue,
              goal: prefs.goal,
              level: prefs.level,
              seed: seed + 99,
            })
          : [];
        next = next.map((day) =>
          day.day === rest.day
            ? {
                ...day,
                restDay: false,
                focus: ['Walk'],
                durationMin: walkDuration,
                exercises: walkExercises,
                explanation: 'Walk day',
                seed: seed + 99,
              }
            : day,
        );
      }
    }
    if (!prefs.fillWorkouts) {
      next = next.map((day) => (day.restDay ? day : { ...day, exercises: [], workoutId: null }));
    }
    setPreview(next);
  }

  function updateDay(day: Day, updater: (row: PreviewDay) => PreviewDay) {
    setPreview((current) => (current ? current.map((row) => (row.day === day ? updater(row) : row)) : current));
  }

  function onSwapExercise(day: Day) {
    updateDay(day, (row) => {
      if (row.restDay || row.exercises.length === 0) return row;
      const swapped = swapSimilarExercises(
        row.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
        })),
        catalogue,
      );
      return {
        ...row,
        workoutId: null,
        exercises: swapped.exercises.map((ex, index) => ({
          ...row.exercises[index]!,
          exerciseId: ex.exerciseId,
          name: ex.name,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
        })),
      };
    });
  }

  function onRerollDay(day: Day) {
    const seed = (Date.now() + day.length) % 1_000_000;
    const regenerated = generateTrainPlan({
      daysPerWeek: 1,
      days: [day],
      goal: prefs.goal,
      level: prefs.level,
      durationMin: prefs.durationMin,
      splitStyle: prefs.splitStyle,
      focusByDay: prefs.customFocusByDay,
      equipment: prefs.equipment.length > 0 ? prefs.equipment : undefined,
      avoidExerciseIds: prefs.avoidExerciseIds,
      preferSavedWorkouts: prefs.preferSavedWorkouts,
      savedWorkouts: savedCandidates,
      catalogue,
      seed,
    });
    const match = applyPostProcess(regenerated, prefs, seed).find((row) => row.day === day);
    if (!match) return;
    updateDay(day, () => match);
  }

  function onSwapSavedWorkout(day: Day, workoutId: string | null) {
    updateDay(day, (row) => {
      if (!workoutId) {
        return { ...row, workoutId: null };
      }
      const workout = workouts.find((item) => item.id === workoutId);
      if (!workout) return row;
      return {
        ...row,
        restDay: false,
        workoutId,
        durationMin: workout.durationMin ?? row.durationMin,
        exercises: [],
        explanation: `${row.focus[0] ?? 'Train'} · saved workout`,
      };
    });
  }

  function onMoveDay(day: Day, direction: -1 | 1) {
    setPreview((current) => {
      if (!current) return current;
      const index = current.findIndex((row) => row.day === day);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const a = next[index]!;
      const b = next[target]!;
      next[index] = { ...b, day: a.day, scheduledTime: a.scheduledTime, seed: a.seed };
      next[target] = { ...a, day: b.day, scheduledTime: b.scheduledTime, seed: b.seed };
      return next;
    });
  }

  function onToggleRest(day: Day) {
    updateDay(day, (row) =>
      row.restDay
        ? {
            ...row,
            restDay: false,
            focus: row.focus.length ? row.focus : ['Full Body'],
            durationMin: prefs.durationMin,
            explanation: row.focus[0] ?? 'Full Body',
          }
        : {
            ...row,
            restDay: true,
            focus: [],
            durationMin: 0,
            exercises: [],
            workoutId: null,
            explanation: 'Rest',
          },
    );
  }

  function onChangeTime(day: Day) {
    const cycle = [null, '06:30', '07:00', '12:00', '17:30', '19:00'] as const;
    updateDay(day, (row) => {
      const index = cycle.findIndex((value) => value === row.scheduledTime);
      const scheduledTime = cycle[(index + 1) % cycle.length] ?? null;
      return { ...row, scheduledTime };
    });
    const current = prefs.dayTimes[day];
    const index = cycle.findIndex((value) => value === current);
    const next = cycle[(index + 1) % cycle.length];
    const dayTimes = { ...prefs.dayTimes };
    if (!next) delete dayTimes[day];
    else dayTimes[day] = next;
    setPrefs((prev) => ({ ...prev, dayTimes }));
  }

  const volumeBars = useMemo(() => {
    if (!preview) return [];
    const totals = weeklyVolumeByGroup(preview);
    const target = WEEKLY_VOLUME_TARGET[prefs.level];
    const labels = ['push', 'pull', 'legs', 'core', 'cardio', 'mobility', 'other'];
    return labels
      .map((label) => ({ label, sets: totals.get(label) ?? 0, target }))
      .filter((bar) => bar.sets > 0 || ['push', 'pull', 'legs'].includes(bar.label));
  }, [prefs.level, preview]);

  const totalTimeMin = useMemo(
    () => (preview ?? []).reduce((sum, day) => sum + (day.restDay ? 0 : day.durationMin), 0),
    [preview],
  );

  const balanceWarning = useMemo(() => {
    if (!preview) return null;
    const target = WEEKLY_VOLUME_TARGET[prefs.level];
    const totals = weeklyVolumeByGroup(preview);
    const push = totals.get('push') ?? 0;
    const pull = totals.get('pull') ?? 0;
    const legs = totals.get('legs') ?? 0;
    if (push > 0 && pull > 0 && Math.abs(push - pull) >= Math.max(4, target / 2)) {
      return 'Push/pull volume is uneven this week.';
    }
    if (legs === 0 && (push > 0 || pull > 0)) return 'No leg volume this week.';
    return null;
  }, [prefs.level, preview]);

  async function apply() {
    if (!preview || !userId || !activeHousehold || applying) return;
    setApplying(true);
    setError(null);
    try {
      await saveGeneratePrefs(userId, prefs as unknown as Record<string, unknown>);
      await applyGeneratedTrainingPlan({
        householdId: activeHousehold.id,
        userId,
        weekStart: mondayWeekStart(),
        visibility: visibilityFor(prefs),
        buddyUserIds: prefs.audience === 'buddies' ? prefs.buddyUserIds : [],
        prefs: prefs as unknown as Record<string, unknown>,
        days: preview,
      });
      router.push('/train/plan' as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply plan');
    } finally {
      setApplying(false);
    }
  }

  const viewProps = {
    prefs,
    onChangePrefs: changePrefs,
    onApplyPreset: applyPreset,
    equipmentOptions,
    bodyParts,
    buddies,
    workouts: workouts.map((item) => ({ id: item.id, name: item.name })),
    onGenerate: () => runGenerate(),
    preview,
    volumeBars,
    totalTimeMin,
    balanceWarning,
    onSwapExercise,
    onRerollDay,
    onSwapSavedWorkout,
    onMoveDay,
    onToggleRest,
    onChangeTime,
    onApply: () => void apply(),
    applying,
    error,
    pickingWorkoutDay,
    onPickWorkoutDay: setPickingWorkoutDay,
  };

  return desktop ? <GenerateDesktop {...viewProps} /> : <GenerateMobile {...viewProps} />;
}
