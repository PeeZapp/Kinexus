import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  TRAIN_SESSION_TYPES,
  buildIntentWeekDays,
  mondayWeekStart,
  remixCategoryOf,
  sessionTypeIdFromFocus,
  trainSessionTypeById,
  type Day,
  type TrainVisibility,
} from '@kinexus/domain';

import { useCreator } from '@/src/features/creators/use-creator';
import { Sheet } from '@/src/features/meals/meals-kit';
import { disableEntityShare, enableEntityShare, resetEntityShare, sharePreview } from '@/src/features/share/link-share';
import { LinkShareSheet } from '@/src/features/share/LinkShareSheet';
import { buildShareUrl } from '@/src/features/share/share-url';
import {
  abandonEmptyOpenSessions,
  abandonWorkoutSession,
  addTrainingPlanDay,
  addTrainingPlanDayToCalendar,
  addTrainingPlanToCalendar,
  applyGeneratedTrainingPlan,
  attachWorkoutToPlanDay,
  createWorkout,
  deleteTrainingPlan,
  downloadTrainingPlanIcs,
  duplicateTrainingPlanToNextWeek,
  fillPlanDayFromLibrary,
  listTrainingPlansByWeek,
  loadCompletedWorkoutIds,
  loadGeneratePrefs,
  loadLibrary,
  loadWorkouts,
  prepareToStartWorkout,
  regenerateRemainingTrainingDays,
  setTrainingPlanCalendarAutoSync,
  setTrainingPlanDayStatus,
  startEmptyLiveSession,
  trainTogetherOnPlanDay,
  updateTrainingPlanDaySchedule,
  updateTrainingPlanVisibility,
  type LibraryExercise,
  type TrainingPlanWeekRow,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { chooseResumeOrStartNew, confirmAction } from '@/src/features/train/confirm';
import { EMPTY_WORKOUT_SEED, WorkoutBuilder, type WorkoutBuilderResult } from '@/src/features/train/WorkoutBuilder';
import { loadTrainBuddies } from '@/src/features/train/buddies-api';
import {
  DEFAULT_TRAIN_GENERATE_PREFS,
  parseGeneratePrefs,
  type TrainGeneratePrefs,
} from '@/src/features/train/generate/types';
import { BuildWorkoutModal } from '@/src/features/train/plan/BuildWorkoutModal';
import { PickWorkoutModal } from '@/src/features/train/plan/PickWorkoutModal';
import { PlanDesktop } from '@/src/features/train/plan/PlanDesktop';
import { PlanMobile } from '@/src/features/train/plan/PlanMobile';
import type { PlanAudienceRow, PlanDayCardModel } from '@/src/features/train/plan/types';
import { useTrainWeek } from '@/src/features/train/TrainWeekContext';
import { TextAction, TrainPage } from '@/src/features/train/ui';
import { LoadingState } from '@/src/features/shell/states';
import { colors } from '@/src/features/shell/theme';
import { todayDay } from '@/src/features/meals/week-labels';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const PLAN_SESSION_TYPES = TRAIN_SESSION_TYPES.filter((row) => row.kind !== 'other');

const EXERCISE_NAME_CATEGORY: readonly [RegExp, string][] = [
  [/\b(glute|hip thrust)\b/i, 'Glutes'],
  [/\b(squat|lunge|hamstring|quad|calf|leg press|deadlift)\b/i, 'Legs'],
  [/\b(tricep|push-?down|pushdown|skull crusher|kickback)\b/i, 'Triceps'],
  [/\b(bicep|curl|chin-?up)\b/i, 'Biceps'],
  [/\b(chest|bench|flye?s?|push-?up)\b/i, 'Chest'],
  [/\b(shoulder|lateral raise|rear delt|overhead press|military press)\b/i, 'Shoulders'],
  [/\b(pulldowns?|pull-?ups?|rows?|latissimus|lats?)\b/i, 'Back'],
  [/\b(crunch|plank|sit-?up|oblique|abdominal)\b/i, 'Core'],
  [/\b(sprint|bike|cardio|jump rope|treadmill|elliptical|stair|row(ing|er)?|swim)\b/i, 'Cardio'],
];

function pushGroup(groups: string[], category: string | null | undefined) {
  if (!category || groups.includes(category)) return;
  groups.push(category);
}

function muscleGroupsForFocus(focus: string[]): string[] {
  const groups: string[] = [];
  for (const label of focus) {
    const id = sessionTypeIdFromFocus(label);
    const session = id ? trainSessionTypeById(id) : null;
    for (const category of session?.categories ?? []) pushGroup(groups, category);
  }
  return groups;
}

function muscleGroupsForCard(
  focus: string[],
  workout: WorkoutDraft | null,
  libraryById: ReadonlyMap<string, LibraryExercise>,
): string[] {
  const groups = muscleGroupsForFocus(focus);
  if (!workout) return groups;
  for (const exercise of workout.exercises) {
    if (exercise.exerciseId) {
      const lib = libraryById.get(exercise.exerciseId);
      if (lib) pushGroup(groups, remixCategoryOf(lib));
    }
    for (const [pattern, category] of EXERCISE_NAME_CATEGORY) {
      if (pattern.test(exercise.name)) {
        pushGroup(groups, category);
        break;
      }
    }
  }
  return groups;
}

function cardsForPlan(
  plan: TrainingPlanWeekRow,
  defaultTimeDayIds: string[],
  workoutsById: ReadonlyMap<string, WorkoutDraft>,
  libraryById: ReadonlyMap<string, LibraryExercise>,
): PlanDayCardModel[] {
  return plan.days.map((day) => {
    const workout = day.workoutId ? workoutsById.get(day.workoutId) ?? null : null;
    const exerciseNames = (workout?.exercises ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((exercise) => exercise.name)
      .filter(Boolean);
    return {
      id: day.id,
      planId: plan.id,
      day: day.day,
      restDay: day.restDay,
      focus: day.focus,
      scheduledTime: day.scheduledTime,
      durationMin: day.durationMin ?? workout?.durationMin ?? null,
      status: day.status,
      workoutId: day.workoutId,
      workoutName: workout?.name ?? null,
      sessionId: day.sessionId,
      exerciseNames,
      muscleGroups: muscleGroupsForCard(day.focus, workout, libraryById),
      usedDefaultTime: defaultTimeDayIds.includes(day.id),
    };
  });
}

function audienceLabel(
  plan: TrainingPlanWeekRow,
  userId: string | null,
  people: { id: string; name: string; userId: string | null }[],
): string {
  if (plan.ownerId === userId) return 'You';
  const linked = people.find((person) => person.userId === plan.ownerId);
  if (linked) return linked.name;
  if (plan.audiencePersonIds.length > 0) {
    const names = plan.audiencePersonIds
      .map((id) => people.find((person) => person.id === id)?.name)
      .filter(Boolean);
    if (names.length) return names.join(', ');
  }
  return plan.name || 'Plan';
}

export function PlanScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold, people } = useHousehold();
  const creator = useCreator();
  const userId = user && !user.isDevBypass ? user.id : null;
  const { weekStart, setWeek, shiftWeek } = useTrainWeek();

  const [selectedDay, setSelectedDay] = useState<Day>(() =>
    weekStart === mondayWeekStart() ? todayDay() : 'monday',
  );
  const [plans, setPlans] = useState<TrainingPlanWeekRow[]>([]);
  const [buddies, setBuddies] = useState<{ id: string; name: string }[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenPreview, setRegenPreview] = useState<{
    planId: string;
    summary: string;
  } | null>(null);
  const [defaultTimeDayIds, setDefaultTimeDayIds] = useState<string[]>([]);
  const [sharePlan, setSharePlan] = useState<TrainingPlanWeekRow | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>([]);
  const [completedWorkoutIds, setCompletedWorkoutIds] = useState<ReadonlySet<string>>(new Set());
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [profile, setProfile] = useState<TrainGeneratePrefs>(DEFAULT_TRAIN_GENERATE_PREFS);
  const [typeCard, setTypeCard] = useState<PlanDayCardModel | null>(null);
  const [savedCard, setSavedCard] = useState<PlanDayCardModel | null>(null);
  const [menuCard, setMenuCard] = useState<PlanDayCardModel | null>(null);
  const [buildChoiceCard, setBuildChoiceCard] = useState<PlanDayCardModel | null>(null);
  const [buildCard, setBuildCard] = useState<PlanDayCardModel | null>(null);

  useEffect(() => {
    setSelectedDay(weekStart === mondayWeekStart() ? todayDay() : 'monday');
  }, [weekStart]);

  const peopleOptions = useMemo(
    () => people.map((person) => ({ id: person.id, name: person.name, userId: person.userId })),
    [people],
  );

  const refresh = useCallback(async () => {
    if (!userId || !activeHousehold) {
      setPlans([]);
      setBuddies([]);
      setCompletedWorkoutIds(new Set());
      return;
    }
    const [rows, buddyRows, workoutRows, prefs, completedIds] = await Promise.all([
      listTrainingPlansByWeek(activeHousehold.id, weekStart, userId),
      loadTrainBuddies(userId),
      loadWorkouts(activeHousehold.id, { includePlanOnly: true }),
      loadGeneratePrefs(userId),
      loadCompletedWorkoutIds(userId, activeHousehold.id),
    ]);
    setPlans(rows);
    setWorkouts(workoutRows);
    setCompletedWorkoutIds(new Set(completedIds));
    setProfile(parseGeneratePrefs(prefs));
    setBuddies(
      buddyRows
        .filter((row) => row.status === 'accepted')
        .map((row) => ({
          id: row.otherUserId,
          name: row.profile.username || row.profile.globalHandle || 'Buddy',
        })),
    );
  }, [activeHousehold, userId, weekStart]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadLibrary()
        .then((rows) => {
          if (!cancelled) setLibrary(rows);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      refresh()
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load plan');
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      return () => {
        cancelled = true;
      };
    }, [refresh]),
  );

  const workoutsById = useMemo(() => {
    const map = new Map<string, WorkoutDraft>();
    for (const workout of workouts) map.set(workout.id, workout);
    return map;
  }, [workouts]);

  const libraryById = useMemo(() => {
    const map = new Map<string, LibraryExercise>();
    for (const exercise of library) map.set(exercise.id, exercise);
    return map;
  }, [library]);

  const rows: PlanAudienceRow[] = useMemo(
    () =>
      plans.map((plan) => ({
        label: audienceLabel(plan, userId, peopleOptions),
        plan,
        cards: cardsForPlan(plan, defaultTimeDayIds, workoutsById, libraryById),
        sharedWithMe: Boolean(userId && plan.ownerId !== userId),
      })),
    [defaultTimeDayIds, libraryById, peopleOptions, plans, userId, workoutsById],
  );

  const ownedRows = useMemo(() => rows.filter((row) => !row.sharedWithMe), [rows]);
  const sharedRows = useMemo(() => rows.filter((row) => row.sharedWithMe), [rows]);

  const today: Day | null = weekStart === mondayWeekStart() ? todayDay() : null;

  function canManagePlan(plan: TrainingPlanWeekRow) {
    return Boolean(userId && plan.ownerId === userId);
  }

  async function mutateStatus(card: PlanDayCardModel, status: 'planned' | 'done' | 'skipped') {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setTrainingPlanDayStatus({
        userId,
        dayId: card.id,
        status,
        sessionId: status === 'done' ? card.sessionId : null,
      });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update day');
    } finally {
      setBusy(false);
    }
  }

  async function onClearWeek(plan: TrainingPlanWeekRow) {
    if (!userId || busy) return;
    const confirmed = await confirmAction('Clear this week?', 'Removes the plan for this week.');
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTrainingPlan(userId, plan.id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not clear week');
    } finally {
      setBusy(false);
    }
  }

  async function onAddToDay(plan: TrainingPlanWeekRow, day: Day) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addTrainingPlanDay({
        userId,
        planId: plan.id,
        day,
        durationMin: profile.durationMin,
      });
      await refresh();
      setTypeCard({
        id: created.id,
        planId: plan.id,
        day: created.day,
        restDay: false,
        focus: created.focus,
        scheduledTime: null,
        durationMin: created.durationMin,
        status: 'planned',
        workoutId: null,
        workoutName: null,
        sessionId: null,
        exerciseNames: [],
        muscleGroups: muscleGroupsForFocus(created.focus),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add to day');
    } finally {
      setBusy(false);
    }
  }

  async function onDuplicate(plan: TrainingPlanWeekRow) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await duplicateTrainingPlanToNextWeek(userId, plan.id);
      setWeek(result.weekStart);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not duplicate plan');
    } finally {
      setBusy(false);
    }
  }

  async function onRegenerate(plan: TrainingPlanWeekRow) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const [library, workouts] = await Promise.all([
        loadLibrary(),
        activeHousehold ? loadWorkouts(activeHousehold.id) : Promise.resolve([]),
      ]);
      const preview = await regenerateRemainingTrainingDays({
        userId,
        planId: plan.id,
        catalogue: library,
        savedWorkouts: workouts.map((workout) => ({
          id: workout.id,
          name: workout.name,
          focus: [],
          durationMin: workout.durationMin,
          exerciseIds: workout.exercises.flatMap((exercise) => (exercise.exerciseId ? [exercise.exerciseId] : [])),
        })),
        confirm: false,
      });
      const focusBits = preview.preview
        .filter((day) => !day.restDay)
        .map((day) => `${day.day}: ${(day.focus[0] ?? 'Train').toLowerCase()}`)
        .join(', ');
      setRegenPreview({
        planId: plan.id,
        summary:
          preview.remainingDays.length === 0
            ? 'No remaining planned days to regenerate.'
            : `Will replace ${preview.remainingDays.length} day(s) (${focusBits || 'rest'}). Done, skipped, and past days stay put.`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not preview regenerate');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmRegen() {
    if (!userId || !regenPreview || busy) return;
    setBusy(true);
    setError(null);
    try {
      const [library, workouts] = await Promise.all([
        loadLibrary(),
        activeHousehold ? loadWorkouts(activeHousehold.id) : Promise.resolve([]),
      ]);
      await regenerateRemainingTrainingDays({
        userId,
        planId: regenPreview.planId,
        catalogue: library,
        savedWorkouts: workouts.map((workout) => ({
          id: workout.id,
          name: workout.name,
          focus: [],
          durationMin: workout.durationMin,
          exerciseIds: workout.exercises.flatMap((exercise) => (exercise.exerciseId ? [exercise.exerciseId] : [])),
        })),
        confirm: true,
      });
      setRegenPreview(null);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not regenerate');
    } finally {
      setBusy(false);
    }
  }

  async function beginWorkoutStart(): Promise<'proceed' | 'cancel'> {
    if (!userId) return 'cancel';
    const { resume } = await prepareToStartWorkout(userId);
    if (!resume) {
      await abandonEmptyOpenSessions(userId);
      return 'proceed';
    }
    const choice = await chooseResumeOrStartNew();
    if (choice === 'cancel') return 'cancel';
    if (choice === 'resume') {
      router.push(`/train/session/live/${resume.id}` as Href);
      return 'cancel';
    }
    await abandonWorkoutSession(resume.id);
    await abandonEmptyOpenSessions(userId);
    return 'proceed';
  }

  async function onStart(card: PlanDayCardModel) {
    if (!userId || !activeHousehold || busy || card.restDay || !card.workoutId) return;
    setBusy(true);
    setError(null);
    try {
      const gate = await beginWorkoutStart();
      if (gate !== 'proceed') return;
      router.push(`/train/session/${card.workoutId}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start workout');
    } finally {
      setBusy(false);
    }
  }

  async function onStartBlank(card: PlanDayCardModel) {
    if (!userId || !activeHousehold || busy || card.restDay) return;
    setBusy(true);
    setError(null);
    try {
      const gate = await beginWorkoutStart();
      if (gate !== 'proceed') return;
      const name = card.focus[0]?.trim() || 'Train';
      const sessionId = await startEmptyLiveSession({
        householdId: activeHousehold.id,
        name,
        durationMin: card.durationMin,
      });
      router.push(`/train/session/live/${sessionId}?dayId=${encodeURIComponent(card.id)}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start workout');
    } finally {
      setBusy(false);
    }
  }

  function onPickWorkout(card: PlanDayCardModel) {
    if (busy || card.restDay) return;
    setSavedCard(card);
  }

  function onBuildWorkout(card: PlanDayCardModel) {
    if (!userId || !activeHousehold || busy || card.restDay) return;
    setBuildChoiceCard(card);
  }

  async function ensureDayCard(day: Day): Promise<PlanDayCardModel> {
    if (!userId || !activeHousehold) throw new Error('Sign in to plan a workout');

    const ownedPlan = plans.find((plan) => plan.ownerId === userId) ?? null;
    const existing = ownedPlan?.days.find((row) => row.day === day) ?? null;
    if (existing && !existing.restDay) {
      return cardsForPlan(ownedPlan!, defaultTimeDayIds, workoutsById, libraryById).find(
        (card) => card.id === existing.id,
      )!;
    }

    if (existing?.restDay) {
      await updateTrainingPlanDaySchedule({
        userId,
        dayId: existing.id,
        focus: existing.focus.length > 0 ? existing.focus : ['Train'],
        restDay: false,
        durationMin: existing.durationMin ?? profile.durationMin ?? 40,
      });
      await refresh();
      const refreshed = (await listTrainingPlansByWeek(activeHousehold.id, weekStart, userId)).find(
        (plan) => plan.ownerId === userId,
      );
      const dayRow = refreshed?.days.find((row) => row.id === existing.id);
      if (!refreshed || !dayRow) throw new Error('Could not open this day');
      return cardsForPlan(refreshed, defaultTimeDayIds, workoutsById, libraryById).find(
        (card) => card.id === dayRow.id,
      )!;
    }

    if (ownedPlan) {
      const created = await addTrainingPlanDay({
        userId,
        planId: ownedPlan.id,
        day,
        focus: ['Train'],
        durationMin: profile.durationMin,
      });
      await refresh();
      return {
        id: created.id,
        planId: ownedPlan.id,
        day: created.day,
        restDay: false,
        focus: created.focus,
        scheduledTime: null,
        durationMin: created.durationMin,
        status: 'planned',
        workoutId: null,
        workoutName: null,
        sessionId: null,
        exerciseNames: [],
        muscleGroups: muscleGroupsForFocus(created.focus),
      };
    }

    await applyGeneratedTrainingPlan({
      householdId: activeHousehold.id,
      userId,
      name: 'Training plan',
      weekStart,
      visibility: 'private',
      prefs: {
        source: 'blank',
        goal: profile.goal,
        level: profile.level,
        durationMin: profile.durationMin,
        splitStyle: profile.splitStyle,
        days: [day],
      },
      days: buildIntentWeekDays({
        trainingDays: [day],
        durationMin: profile.durationMin,
        goal: profile.goal,
        splitStyle: profile.splitStyle,
        customFocusByDay: { [day]: 'Train' },
      }),
      replaceExisting: true,
    });
    const rows = await listTrainingPlansByWeek(activeHousehold.id, weekStart, userId);
    setPlans(rows);
    const createdPlan = rows.find((plan) => plan.ownerId === userId);
    const dayRow = createdPlan?.days.find((row) => row.day === day && !row.restDay);
    if (!createdPlan || !dayRow) throw new Error('Could not create a plan day');
    return cardsForPlan(createdPlan, defaultTimeDayIds, workoutsById, libraryById).find(
      (card) => card.id === dayRow.id,
    )!;
  }

  async function onStartBlankDay(day: Day) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const card = await ensureDayCard(day);
      setBusy(false);
      await onStartBlank(card);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start workout');
      setBusy(false);
    }
  }

  async function onPickForDay(day: Day) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const card = await ensureDayCard(day);
      setBusy(false);
      onPickWorkout(card);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open workout picker');
      setBusy(false);
    }
  }

  async function onBuildForDay(day: Day) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const card = await ensureDayCard(day);
      setBusy(false);
      onBuildWorkout(card);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open builder');
      setBusy(false);
    }
  }

  async function submitBuild(result: WorkoutBuilderResult) {
    if (!userId || !activeHousehold || !buildCard) throw new Error('Sign in to save a workout');
    if (result.exercises.every((exercise) => !exercise.exerciseId)) {
      throw new Error('Add at least one exercise');
    }
    const workoutId = await createWorkout({
      householdId: activeHousehold.id,
      userId,
      name: result.name.trim() || buildCard.focus[0] || 'Train',
      visibility: result.visibility,
      splitId: result.splitId,
      durationMin: result.durationMin,
      level: result.level,
      goal: result.goal,
      equipment: result.equipment,
      planOnly: true,
      personIds: result.personIds,
      buddyUserIds: result.buddyUserIds,
      exercises: result.exercises.flatMap((exercise) =>
        exercise.exerciseId
          ? [
              {
                exerciseId: exercise.exerciseId,
                name: exercise.name,
                targetSets: exercise.targetSets,
                targetReps: exercise.targetReps,
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
    await attachWorkoutToPlanDay({ userId, dayId: buildCard.id, workoutId });
    setBuildCard(null);
    await refresh();
    if (result.start) router.push(`/train/session/${workoutId}` as Href);
  }

  async function onSuggestWorkout(card: PlanDayCardModel) {
    if (!userId || !activeHousehold || busy || card.restDay) return;
    if (card.focus.length === 0) {
      setError('Set a session type first');
      setTypeCard(card);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const catalogue = library.length > 0 ? library : await loadLibrary();
      if (library.length === 0) setLibrary(catalogue);
      await fillPlanDayFromLibrary({
        householdId: activeHousehold.id,
        userId,
        dayId: card.id,
        focus: card.focus,
        durationMin: card.durationMin ?? profile.durationMin,
        existingWorkoutId: card.workoutId,
        goal: profile.goal,
        level: profile.level,
        equipment: profile.equipment,
        catalogue,
      });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No matching exercises');
    } finally {
      setBusy(false);
    }
  }

  async function onFillRemaining(plan: TrainingPlanWeekRow) {
    if (!userId || !activeHousehold || busy) return;
    const targets = plan.days.filter(
      (day) => !day.restDay && day.status === 'planned' && !day.workoutId && day.focus.length > 0,
    );
    if (targets.length === 0) {
      setError('No open intent days to fill');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const catalogue = library.length > 0 ? library : await loadLibrary();
      if (library.length === 0) setLibrary(catalogue);
      const failures: string[] = [];
      for (const day of targets) {
        try {
          await fillPlanDayFromLibrary({
            householdId: activeHousehold.id,
            userId,
            dayId: day.id,
            focus: day.focus,
            durationMin: day.durationMin ?? profile.durationMin,
            existingWorkoutId: null,
            goal: profile.goal,
            level: profile.level,
            equipment: profile.equipment,
            catalogue,
          });
        } catch (err: unknown) {
          failures.push(
            `${day.focus[0] ?? day.day}: ${err instanceof Error ? err.message : 'failed'}`,
          );
        }
      }
      await refresh();
      if (failures.length > 0) {
        setError(
          failures.length === targets.length
            ? failures[0] ?? 'Could not fill remaining days'
            : `Filled ${targets.length - failures.length}/${targets.length}. ${failures[0]}`,
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not fill remaining days');
    } finally {
      setBusy(false);
    }
  }

  async function onSetSessionType(card: PlanDayCardModel, label: string) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateTrainingPlanDaySchedule({
        userId,
        dayId: card.id,
        focus: [label],
        restDay: false,
        durationMin: card.durationMin ?? 40,
      });
      setTypeCard(null);
      setMenuCard(null);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update session type');
    } finally {
      setBusy(false);
    }
  }

  async function onAttachSaved(card: PlanDayCardModel, workoutId: string | null) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await attachWorkoutToPlanDay({ userId, dayId: card.id, workoutId });
      if (workoutId) {
        const workout = workouts.find((row) => row.id === workoutId);
        if (workout && card.focus.length === 0) {
          await updateTrainingPlanDaySchedule({
            userId,
            dayId: card.id,
            focus: [workout.name],
            restDay: false,
            durationMin: workout.durationMin ?? card.durationMin ?? 40,
          });
        }
      }
      setSavedCard(null);
      setMenuCard(null);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not attach workout');
    } finally {
      setBusy(false);
    }
  }

  async function onTrainTogether(plan: TrainingPlanWeekRow, card: PlanDayCardModel) {
    if (!userId || !activeHousehold || busy || !card.workoutId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await trainTogetherOnPlanDay({
        householdId: activeHousehold.id,
        userId,
        ownerId: plan.ownerId,
        workoutId: card.workoutId,
      });
      router.push(`/train/session/${result.workoutId}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start train together');
    } finally {
      setBusy(false);
    }
  }

  async function onChangeVisibility(plan: TrainingPlanWeekRow, visibility: TrainVisibility) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateTrainingPlanVisibility({
        userId,
        planId: plan.id,
        visibility,
        audiencePersonIds: plan.audiencePersonIds,
        buddyUserIds: visibility === 'buddies_selected' ? plan.buddyUserIds : [],
      });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update visibility');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleBuddy(plan: TrainingPlanWeekRow, buddyId: string) {
    if (!userId || busy) return;
    const next = plan.buddyUserIds.includes(buddyId)
      ? plan.buddyUserIds.filter((id) => id !== buddyId)
      : [...plan.buddyUserIds, buddyId];
    setBusy(true);
    setError(null);
    try {
      await updateTrainingPlanVisibility({
        userId,
        planId: plan.id,
        visibility: 'buddies_selected',
        buddyUserIds: next,
      });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update buddy shares');
    } finally {
      setBusy(false);
    }
  }

  async function onAddPlanToCalendar(plan: TrainingPlanWeekRow) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await addTrainingPlanToCalendar(userId, plan.id);
      setDefaultTimeDayIds((current) => [...new Set([...current, ...result.usedDefaultTimeDays])]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add plan to calendar');
    } finally {
      setBusy(false);
    }
  }

  async function onAddDayToCalendar(card: PlanDayCardModel) {
    if (!userId || busy || card.restDay) return;
    setBusy(true);
    setError(null);
    try {
      const result = await addTrainingPlanDayToCalendar(userId, card.id);
      if (result.usedDefaultTime) {
        setDefaultTimeDayIds((current) => [...new Set([...current, card.id])]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add day to calendar');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleAutoSync(plan: TrainingPlanWeekRow) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setTrainingPlanCalendarAutoSync(userId, plan.id, !plan.calendarAutoSync);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update auto-sync');
    } finally {
      setBusy(false);
    }
  }

  async function onExportPlanIcs(plan: TrainingPlanWeekRow) {
    setError(null);
    try {
      await downloadTrainingPlanIcs(plan);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not export .ics');
    }
  }

  async function onExportDayIcs(plan: TrainingPlanWeekRow, card: PlanDayCardModel) {
    setError(null);
    try {
      await downloadTrainingPlanIcs(plan, [card.id]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not export .ics');
    }
  }

  if (!ready) {
    return (
      <TrainPage>
        <LoadingState label="Loading plan" />
      </TrainPage>
    );
  }

  const viewProps = {
    weekStart,
    selectedDay,
    onSelectDay: setSelectedDay,
    onPrevWeek: () => shiftWeek(-1),
    onNextWeek: () => shiftWeek(1),
    onThisWeek: () => setWeek(mondayWeekStart()),
    onStartBlankDay: (day: Day) => void onStartBlankDay(day),
    onPickForDay: (day: Day) => void onPickForDay(day),
    onBuildForDay: (day: Day) => void onBuildForDay(day),
    ownedRows,
    sharedRows,
    today,
    busy,
    error,
    regenPreview,
    buddies,
    isApprovedCreator: creator.isApprovedCreator,
    onGenerate: () => router.push('/train/plan/generate' as Href),
    onClearWeek: (plan: TrainingPlanWeekRow) => void onClearWeek(plan),
    onAddToDay: (plan: TrainingPlanWeekRow, day: Day) => void onAddToDay(plan, day),
    onDuplicate,
    onRegenerate: (plan: TrainingPlanWeekRow) => void onRegenerate(plan),
    onConfirmRegen: () => void onConfirmRegen(),
    onCancelRegen: () => setRegenPreview(null),
    onStart: (card: PlanDayCardModel) => void onStart(card),
    onStartBlank: (card: PlanDayCardModel) => void onStartBlank(card),
    onPickWorkout: (card: PlanDayCardModel) => onPickWorkout(card),
    onBuildWorkout: (card: PlanDayCardModel) => onBuildWorkout(card),
    onSuggestWorkout: (card: PlanDayCardModel) => void onSuggestWorkout(card),
    onViewWorkout: (card: PlanDayCardModel) => {
      if (!card.workoutId) {
        setError('No workout on this day');
        return;
      }
      router.push(`/train/${card.workoutId}` as Href);
    },
    onOpenWorkoutMenu: (card: PlanDayCardModel) => {
      if (card.restDay) setTypeCard(card);
      else setMenuCard(card);
    },
    onFillRemaining: (plan: TrainingPlanWeekRow) => void onFillRemaining(plan),
    onTrainTogether: (plan: TrainingPlanWeekRow, card: PlanDayCardModel) => void onTrainTogether(plan, card),
    onMarkDone: (card: PlanDayCardModel) => void mutateStatus(card, 'done'),
    onMarkSkipped: (card: PlanDayCardModel) => void mutateStatus(card, 'skipped'),
    onRemoveWorkout: (card: PlanDayCardModel) => {
      void (async () => {
        const confirmed = await confirmAction(
          'Remove workout?',
          'Removes the workout from this day. The workout itself is kept.',
        );
        if (!confirmed) return;
        await onAttachSaved(card, null);
      })();
    },
    onUndo: (card: PlanDayCardModel) => void mutateStatus(card, 'planned'),
    onAddPlanToCalendar: (plan: TrainingPlanWeekRow) => void onAddPlanToCalendar(plan),
    onAddDayToCalendar: (card: PlanDayCardModel) => void onAddDayToCalendar(card),
    onExportPlanIcs: (plan: TrainingPlanWeekRow) => void onExportPlanIcs(plan),
    onExportDayIcs: (plan: TrainingPlanWeekRow, card: PlanDayCardModel) => void onExportDayIcs(plan, card),
    onToggleAutoSync: (plan: TrainingPlanWeekRow) => void onToggleAutoSync(plan),
    onChangeVisibility: (plan: TrainingPlanWeekRow, visibility: TrainVisibility) =>
      void onChangeVisibility(plan, visibility),
    onToggleBuddy: (plan: TrainingPlanWeekRow, buddyId: string) => void onToggleBuddy(plan, buddyId),
    onShareLink: (plan: TrainingPlanWeekRow) => {
      setShareError(null);
      setSharePlan(plan);
    },
    canManagePlan,
  };

  return (
    <TrainPage>
      {desktop ? <PlanDesktop {...viewProps} /> : <PlanMobile {...viewProps} />}
      <Sheet visible={Boolean(menuCard)} title="Day" onClose={() => setMenuCard(null)}>
        <View style={styles.menuList}>
          <TextAction
            label="Change type"
            onPress={() => {
              if (!menuCard) return;
              setMenuCard(null);
              setTypeCard(menuCard);
            }}
          />
          {!menuCard?.workoutId ? (
            <TextAction
              label="Suggest one"
              onPress={() => {
                if (!menuCard) return;
                setMenuCard(null);
                void onSuggestWorkout(menuCard);
              }}
            />
          ) : null}
          {menuCard?.workoutId ? (
            <>
              <TextAction
                label="Edit workout"
                onPress={() => {
                  if (!menuCard?.workoutId) return;
                  setMenuCard(null);
                  router.push(`/train/${menuCard.workoutId}` as Href);
                }}
              />
              <TextAction
                label="Pick workout"
                onPress={() => {
                  if (!menuCard) return;
                  setMenuCard(null);
                  setSavedCard(menuCard);
                }}
              />
              <TextAction
                label="Clear workout"
                onPress={() => {
                  if (!menuCard) return;
                  void (async () => {
                    const confirmed = await confirmAction(
                      'Clear workout?',
                      'Removes the workout from this day. The workout itself is kept.',
                    );
                    if (!confirmed) return;
                    const card = menuCard;
                    setMenuCard(null);
                    await onAttachSaved(card, null);
                  })();
                }}
              />
              <TextAction
                label="Done"
                tone="accent"
                onPress={() => {
                  if (!menuCard) return;
                  setMenuCard(null);
                  void mutateStatus(menuCard, 'done');
                }}
              />
              <TextAction
                label="Skip"
                onPress={() => {
                  if (!menuCard) return;
                  setMenuCard(null);
                  void mutateStatus(menuCard, 'skipped');
                }}
              />
            </>
          ) : null}
        </View>
      </Sheet>
      <BuildWorkoutModal
        visible={Boolean(buildChoiceCard)}
        onClose={() => setBuildChoiceCard(null)}
        onChoose={(choice) => {
          if (choice === 'remix') {
            setBuildChoiceCard(null);
            router.push('/train/remix' as Href);
            return;
          }
          if (!buildChoiceCard) return;
          const card = buildChoiceCard;
          setBuildChoiceCard(null);
          setBuildCard(card);
        }}
      />
      {buildCard ? (
        <WorkoutBuilder
          presentation="modal"
          seed={{
            ...EMPTY_WORKOUT_SEED,
            name: buildCard.focus[0] || 'Train',
            durationMin: buildCard.durationMin,
            visibility: 'private',
          }}
          people={people}
          buddies={buddies}
          editable
          onClose={() => setBuildCard(null)}
          onSubmit={submitBuild}
        />
      ) : null}
      <Sheet visible={Boolean(typeCard)} title="Session type" onClose={() => setTypeCard(null)}>
        <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
          {PLAN_SESSION_TYPES.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => typeCard && void onSetSessionType(typeCard, row.label)}
              style={styles.sheetRow}>
              <Text style={styles.sheetName}>{row.label}</Text>
              <Text style={styles.sheetMeta}>{row.kind}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
      <PickWorkoutModal
        visible={Boolean(savedCard)}
        workouts={workouts
          .filter((workout) => !workout.planOnly)
          .map((workout) => ({
            id: workout.id,
            name: workout.name,
            durationMin: workout.durationMin,
            completed: completedWorkoutIds.has(workout.id),
            myScore: userId
              ? workout.ratings.find((rating) => rating.userId === userId)?.score ?? null
              : null,
          }))}
        canClear={Boolean(savedCard?.workoutId)}
        onClose={() => setSavedCard(null)}
        onPick={(workoutId) => {
          if (!savedCard) return;
          void onAttachSaved(savedCard, workoutId);
        }}
        onClear={() => {
          if (!savedCard) return;
          void onAttachSaved(savedCard, null);
        }}
      />
      <LinkShareSheet
        visible={Boolean(sharePlan)}
        title="Share plan link"
        preview={sharePreview([sharePlan?.name, 'Training plan'])}
        state={{
          isShared: Boolean(sharePlan?.isShared),
          shareToken: sharePlan?.shareToken ?? null,
          url:
            sharePlan?.isShared && sharePlan.shareToken
              ? buildShareUrl('plan', sharePlan.shareToken)
              : null,
        }}
        busy={shareBusy}
        error={shareError}
        onClose={() => setSharePlan(null)}
        onToggle={async (enabled) => {
          if (!sharePlan) return null;
          setShareBusy(true);
          setShareError(null);
          try {
            const url = enabled
              ? await enableEntityShare('plan', sharePlan.id, sharePlan.shareToken)
              : await disableEntityShare('plan', sharePlan.id);
            await refresh();
            const next = (await listTrainingPlansByWeek(
              activeHousehold!.id,
              weekStart,
              userId!,
            )).find((plan) => plan.id === sharePlan.id);
            if (next) setSharePlan(next);
            return url;
          } catch (err) {
            setShareError(err instanceof Error ? err.message : 'Could not update share link');
            throw err;
          } finally {
            setShareBusy(false);
          }
        }}
        onReset={async () => {
          if (!sharePlan) return null;
          setShareBusy(true);
          setShareError(null);
          try {
            const url = await resetEntityShare('plan', sharePlan.id);
            await refresh();
            const next = (await listTrainingPlansByWeek(
              activeHousehold!.id,
              weekStart,
              userId!,
            )).find((plan) => plan.id === sharePlan.id);
            if (next) setSharePlan(next);
            return url;
          } catch (err) {
            setShareError(err instanceof Error ? err.message : 'Could not reset share link');
            throw err;
          } finally {
            setShareBusy(false);
          }
        }}
      />
    </TrainPage>
  );
}

const styles = StyleSheet.create({
  sheetList: { maxHeight: 420 },
  menuList: { gap: 16, paddingVertical: 4 },
  sheetRow: {
    gap: 2,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sheetMeta: { color: colors.textMuted, fontSize: 12, textTransform: 'capitalize' },
});
