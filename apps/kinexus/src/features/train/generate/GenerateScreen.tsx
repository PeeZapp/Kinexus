import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import {
  defaultTargetFor,
  fillWorkoutFromSessionType,
  generateTrainPlan,
  mondayWeekStart,
  sessionTypeIdFromFocus,
  type Day,
  type GeneratedTrainDay,
  type SavedWorkoutCandidate,
  type TrainVisibility,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { Toast } from '@/src/features/meals/Toast';
import { GenerateDesktop } from '@/src/features/train/generate/GenerateDesktop';
import { GenerateMobile } from '@/src/features/train/generate/GenerateMobile';
import { dayIsFilled } from '@/src/features/train/generate/GeneratePreview';
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
import {
  EMPTY_WORKOUT_SEED,
  WorkoutBuilder,
  type WorkoutBuilderResult,
} from '@/src/features/train/WorkoutBuilder';
import { TextAction } from '@/src/features/train/ui';
import { colors, space } from '@/src/features/shell/theme';
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
  workouts: WorkoutDraft[],
): PreviewDay[] {
  return days.map((day, index) => {
    let exercises = day.exercises;
    if (prefs.intensityRpe != null && !day.restDay) {
      exercises = exercises.map((ex) => ({ ...ex, targetRpe: prefs.intensityRpe! }));
    }
    if (prefs.cardioAddon === 'finisher' && !day.restDay && exercises.length > 0) {
      const finisher = defaultTargetFor({
        name: 'Cardio finisher',
        category: 'Cardio',
        targetUnit: 'min',
        targetSets: 1,
        targetDurationSec: 9 * 60,
        targetReps: '9 min',
      });
      exercises = [
        ...exercises,
        {
          exerciseId: `finisher-${day.day}`,
          name: 'Cardio finisher',
          tracking: finisher.tracking,
          targetUnit: finisher.targetUnit,
          targetSets: finisher.targetSets,
          targetReps: finisher.targetReps,
          targetDurationSec: finisher.targetDurationSec,
          targetDistanceKm: finisher.targetDistanceKm,
          targetRpe: Math.min(prefs.intensityRpe ?? 7, 7),
          category: 'Cardio',
        },
      ];
    }
    const saved = day.workoutId ? workouts.find((item) => item.id === day.workoutId) : null;
    return {
      ...day,
      exercises,
      scheduledTime: prefs.dayTimes[day.day] ?? null,
      seed: seed + index,
      workoutName: saved?.name ?? (exercises.length > 0 ? day.focus[0] ?? 'Workout' : null),
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

function seedFromPreviewDay(row: PreviewDay, workouts: WorkoutDraft[]): {
  seed: typeof EMPTY_WORKOUT_SEED;
  key: string;
} {
  if (row.workoutId && row.exercises.length === 0) {
    const saved = workouts.find((item) => item.id === row.workoutId);
    if (saved) {
      return {
        key: `saved-${saved.id}`,
        seed: {
          name: saved.name,
          visibility: 'private',
          personIds: [],
          splitId: saved.splitId,
          durationMin: saved.durationMin,
          exercises: saved.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            tracking: ex.tracking,
            targetUnit: ex.targetUnit,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            targetDurationSec: ex.targetDurationSec,
            targetDistanceKm: ex.targetDistanceKm,
            targetWeight: ex.targetWeight,
            targetEffort: ex.targetEffort,
            targetRpe: ex.targetRpe,
            note: ex.note,
            supersetId: ex.supersetId,
          })),
        },
      };
    }
  }
  return {
    key: `draft-${row.day}-${row.seed}-${row.exercises.length}`,
    seed: {
      ...EMPTY_WORKOUT_SEED,
      name: row.workoutName?.trim() || row.focus[0] || 'Workout',
      durationMin: row.durationMin || null,
      visibility: 'private',
      exercises: row.exercises.map((ex) => ({
        exerciseId: /^[0-9a-f-]{36}$/i.test(ex.exerciseId) ? ex.exerciseId : null,
        name: ex.name,
        tracking: ex.tracking,
        targetUnit: ex.targetUnit,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetDurationSec: ex.targetDurationSec,
        targetDistanceKm: ex.targetDistanceKm,
        targetRpe: ex.targetRpe,
      })),
    },
  };
}

export function GenerateScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold, people } = useHousehold();
  const userId = user && !user.isDevBypass ? user.id : null;

  const [prefs, setPrefs] = useState<TrainGeneratePrefs>(DEFAULT_TRAIN_GENERATE_PREFS);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [buddies, setBuddies] = useState<{ id: string; name: string }[]>([]);
  const [preview, setPreview] = useState<PreviewDay[] | null>(null);
  const [viewDay, setViewDay] = useState<Day | null>(null);
  const [editDay, setEditDay] = useState<Day | null>(null);
  const [menuDay, setMenuDay] = useState<Day | null>(null);
  const [swapDay, setSwapDay] = useState<Day | null>(null);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
        if (!cancelled) setToast(err instanceof Error ? err.message : 'Could not load generate prefs');
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
    setViewDay(null);
    setEditDay(null);
    setMenuDay(null);
    setSwapDay(null);
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
    setToast(null);
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

    let next = applyPostProcess(generated, prefs, seed, workouts);
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
                workoutName: walkExercises.length > 0 ? 'Walk' : null,
              }
            : day,
        );
      }
    }
    if (!prefs.fillWorkouts) {
      next = next.map((day) =>
        day.restDay || day.workoutId
          ? day
          : { ...day, exercises: [], workoutId: null, workoutName: null },
      );
    }
    setPreview(next);
    setViewDay(null);
    setEditDay(null);
    setMenuDay(null);
    setSwapDay(null);
  }

  function updateDay(day: Day, updater: (row: PreviewDay) => PreviewDay) {
    setPreview((current) => (current ? current.map((row) => (row.day === day ? updater(row) : row)) : current));
  }

  function onClearDay(day: Day) {
    updateDay(day, (row) => ({
      ...row,
      exercises: [],
      workoutId: null,
      workoutName: null,
      explanation: row.focus[0] ?? 'Train',
    }));
  }

  function onSwapSavedWorkout(day: Day, workoutId: string) {
    const workout = workouts.find((item) => item.id === workoutId);
    if (!workout) {
      setToast('Workout not found');
      return;
    }
    updateDay(day, (row) => ({
      ...row,
      restDay: false,
      workoutId,
      durationMin: workout.durationMin ?? row.durationMin,
      exercises: [],
      workoutName: workout.name,
      explanation: `${row.focus[0] ?? 'Train'} · saved workout`,
    }));
  }

  function onSuggestDay(day: Day) {
    const row = preview?.find((item) => item.day === day);
    if (!row || row.restDay) return;
    const focus = row.focus[0];
    if (!focus) {
      setToast('Set a session type first');
      return;
    }
    const sessionTypeId = sessionTypeIdFromFocus(focus);
    if (!sessionTypeId) {
      setToast('No template for this session type');
      return;
    }
    const filled = fillWorkoutFromSessionType({
      sessionTypeId,
      durationMin: row.durationMin || prefs.durationMin,
      catalogue,
      goal: prefs.goal,
      level: prefs.level,
      seed: (Date.now() + day.length) % 1_000_000,
    });
    if (filled.length === 0) {
      setToast('No matching exercises');
      return;
    }
    updateDay(day, (current) => ({
      ...current,
      workoutId: null,
      exercises: filled.map((ex) => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        tracking: ex.tracking,
        targetUnit: ex.targetUnit,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetDurationSec: ex.targetDurationSec,
        targetDistanceKm: ex.targetDistanceKm,
        targetRpe: ex.targetRpe,
        category: ex.category ?? null,
      })),
      workoutName: focus,
      explanation: `${focus} · suggested`,
    }));
  }

  async function submitEdit(result: WorkoutBuilderResult) {
    if (!editDay) return;
    const exercises = result.exercises.flatMap((ex) =>
      ex.exerciseId
        ? [
            {
              exerciseId: ex.exerciseId,
              name: ex.name,
              tracking: ex.tracking,
              targetUnit: ex.targetUnit,
              targetSets: ex.targetSets,
              targetDurationSec: ex.targetDurationSec,
              targetDistanceKm: ex.targetDistanceKm,
              targetReps: ex.targetReps,
              targetRpe: ex.targetRpe ?? 7,
              category: null,
            },
          ]
        : [],
    );
    if (exercises.length === 0) {
      setToast('Add at least one exercise');
      throw new Error('Add at least one exercise');
    }
    updateDay(editDay, (row) => ({
      ...row,
      restDay: false,
      workoutId: null,
      exercises,
      durationMin: result.durationMin ?? row.durationMin,
      workoutName: result.name.trim() || row.focus[0] || 'Workout',
      explanation: row.focus[0] ?? 'Train',
    }));
    setEditDay(null);
    setViewDay(editDay);
  }

  const totalTimeMin = useMemo(
    () => (preview ?? []).reduce((sum, day) => sum + (day.restDay ? 0 : day.durationMin), 0),
    [preview],
  );

  async function apply() {
    if (!preview || !userId || !activeHousehold || applying) return;
    setApplying(true);
    setToast(null);
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
      router.push('/train' as Href);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not apply plan');
    } finally {
      setApplying(false);
    }
  }

  const activeViewDay = viewDay ? preview?.find((row) => row.day === viewDay) ?? null : null;
  const activeEditDay = editDay ? preview?.find((row) => row.day === editDay) ?? null : null;
  const viewSeed = activeViewDay ? seedFromPreviewDay(activeViewDay, workouts) : null;
  const editSeed = activeEditDay ? seedFromPreviewDay(activeEditDay, workouts) : null;

  const viewProps = {
    prefs,
    onChangePrefs: changePrefs,
    onApplyPreset: applyPreset,
    equipmentOptions,
    bodyParts,
    buddies,
    workouts: workouts.map((item) => ({
      id: item.id,
      name: item.name,
      durationMin: item.durationMin,
      exerciseCount: item.exercises.length,
    })),
    onGenerate: () => runGenerate(),
    preview,
    totalTimeMin,
    onViewDay: (day: Day) => {
      const row = preview?.find((item) => item.day === day);
      if (!row || !dayIsFilled(row)) return;
      setViewDay(day);
    },
    onOpenDayMenu: (day: Day) => setMenuDay(day),
    onApply: () => void apply(),
    applying,
    onBack: () => router.push('/train' as Href),
  };

  return (
    <>
      {desktop ? <GenerateDesktop {...viewProps} /> : <GenerateMobile {...viewProps} />}

      {viewSeed && activeViewDay && !editDay ? (
        <WorkoutBuilder
          key={`view-${viewSeed.key}`}
          presentation="modal"
          seed={viewSeed.seed}
          people={people}
          buddies={buddies}
          editable={false}
          onClose={() => setViewDay(null)}
          onEdit={() => {
            setEditDay(activeViewDay.day);
            setViewDay(null);
          }}
          onSubmit={async () => undefined}
        />
      ) : null}

      {editSeed && activeEditDay ? (
        <WorkoutBuilder
          key={`edit-${editSeed.key}`}
          presentation="modal"
          seed={editSeed.seed}
          people={people}
          buddies={buddies}
          editable
          onClose={() => {
            setEditDay(null);
            setViewDay(activeEditDay.day);
          }}
          onSubmit={submitEdit}
        />
      ) : null}

      <Sheet visible={Boolean(menuDay)} title="Day" onClose={() => setMenuDay(null)}>
        <View style={styles.menuList}>
          <TextAction
            label="Swap"
            onPress={() => {
              if (!menuDay) return;
              setSwapDay(menuDay);
              setMenuDay(null);
            }}
          />
          <TextAction
            label="Clear"
            onPress={() => {
              if (!menuDay) return;
              onClearDay(menuDay);
              setMenuDay(null);
            }}
          />
        </View>
      </Sheet>

      <Sheet visible={Boolean(swapDay)} title="Swap" onClose={() => setSwapDay(null)}>
        <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
          <TextAction
            label="Suggest one"
            tone="accent"
            onPress={() => {
              if (!swapDay) return;
              onSuggestDay(swapDay);
              setSwapDay(null);
            }}
          />
          {workouts.map((workout) => (
            <Pressable
              key={workout.id}
              accessibilityRole="button"
              onPress={() => {
                if (!swapDay) return;
                onSwapSavedWorkout(swapDay, workout.id);
                setSwapDay(null);
              }}
              style={styles.sheetRow}>
              <Text style={styles.sheetName}>{workout.name}</Text>
              <Text style={styles.sheetMeta}>
                {workout.exercises.length} · {workout.durationMin ?? '—'}m
              </Text>
            </Pressable>
          ))}
          {workouts.length === 0 ? <Text style={styles.sheetEmpty}>No saved workouts</Text> : null}
        </ScrollView>
      </Sheet>

      <Toast message={toast ?? ''} visible={Boolean(toast)} onDismiss={() => setToast(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  menuList: { gap: space.sm, paddingBottom: space.sm },
  sheetList: { maxHeight: 360 },
  sheetRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  sheetName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sheetMeta: { color: colors.textMuted, fontSize: 12 },
  sheetEmpty: { color: colors.textMuted, fontSize: 13, paddingVertical: 12 },
});
