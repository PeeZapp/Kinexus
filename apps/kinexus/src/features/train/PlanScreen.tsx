import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  TRAIN_SESSION_TYPES,
  addDaysIso,
  buildIntentWeekDays,
  mondayWeekStart,
  type Day,
  type TrainVisibility,
} from '@kinexus/domain';

import { useCreator } from '@/src/features/creators/use-creator';
import { Sheet } from '@/src/features/meals/meals-kit';
import { disableEntityShare, enableEntityShare, resetEntityShare, sharePreview } from '@/src/features/share/link-share';
import { LinkShareSheet } from '@/src/features/share/LinkShareSheet';
import { buildShareUrl } from '@/src/features/share/share-url';
import {
  addTrainingPlanDay,
  addTrainingPlanDayToCalendar,
  addTrainingPlanToCalendar,
  applyGeneratedTrainingPlan,
  attachWorkoutToPlanDay,
  deleteTrainingPlan,
  downloadTrainingPlanIcs,
  duplicateTrainingPlanToNextWeek,
  ensurePlanDayWorkout,
  fillPlanDayFromLibrary,
  listTrainingPlansByWeek,
  loadGeneratePrefs,
  loadLibrary,
  loadWorkoutById,
  loadWorkouts,
  regenerateRemainingTrainingDays,
  setTrainingPlanCalendarAutoSync,
  setTrainingPlanDayStatus,
  trainTogetherOnPlanDay,
  updateTrainingPlanDaySchedule,
  updateTrainingPlanVisibility,
  type LibraryExercise,
  type TrainingPlanWeekRow,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { loadTrainBuddies } from '@/src/features/train/buddies-api';
import {
  DEFAULT_TRAIN_GENERATE_PREFS,
  parseGeneratePrefs,
  type TrainGeneratePrefs,
} from '@/src/features/train/generate/types';
import { PlanDesktop } from '@/src/features/train/plan/PlanDesktop';
import { PlanMobile } from '@/src/features/train/plan/PlanMobile';
import type { PlanAudienceRow, PlanDayCardModel } from '@/src/features/train/plan/types';
import { TextAction, TrainPage } from '@/src/features/train/ui';
import { LoadingState } from '@/src/features/shell/states';
import { colors } from '@/src/features/shell/theme';
import { todayDay } from '@/src/features/meals/week-labels';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const PLAN_SESSION_TYPES = TRAIN_SESSION_TYPES.filter((row) => row.kind !== 'other');

function cardsForPlan(
  plan: TrainingPlanWeekRow,
  defaultTimeDayIds: string[],
  workoutNames: ReadonlyMap<string, string>,
): PlanDayCardModel[] {
  return plan.days.map((day) => ({
    id: day.id,
    planId: plan.id,
    day: day.day,
    restDay: day.restDay,
    focus: day.focus,
    scheduledTime: day.scheduledTime,
    durationMin: day.durationMin,
    status: day.status,
    workoutId: day.workoutId,
    workoutName: day.workoutId ? workoutNames.get(day.workoutId) ?? null : null,
    sessionId: day.sessionId,
    usedDefaultTime: defaultTimeDayIds.includes(day.id),
  }));
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

  const [weekStart, setWeekStart] = useState(() => mondayWeekStart());
  const [selectedDay, setSelectedDay] = useState<Day>(() => todayDay());
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
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [profile, setProfile] = useState<TrainGeneratePrefs>(DEFAULT_TRAIN_GENERATE_PREFS);
  const [typeCard, setTypeCard] = useState<PlanDayCardModel | null>(null);
  const [savedCard, setSavedCard] = useState<PlanDayCardModel | null>(null);
  const [menuCard, setMenuCard] = useState<PlanDayCardModel | null>(null);

  const peopleOptions = useMemo(
    () => people.map((person) => ({ id: person.id, name: person.name, userId: person.userId })),
    [people],
  );

  const refresh = useCallback(async () => {
    if (!userId || !activeHousehold) {
      setPlans([]);
      setBuddies([]);
      return;
    }
    const [rows, buddyRows, workoutRows, prefs] = await Promise.all([
      listTrainingPlansByWeek(activeHousehold.id, weekStart, userId),
      loadTrainBuddies(userId),
      loadWorkouts(activeHousehold.id),
      loadGeneratePrefs(userId),
    ]);
    setPlans(rows);
    setWorkouts(workoutRows);
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

  const workoutNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const workout of workouts) map.set(workout.id, workout.name);
    return map;
  }, [workouts]);

  const rows: PlanAudienceRow[] = useMemo(
    () =>
      plans.map((plan) => ({
        label: audienceLabel(plan, userId, peopleOptions),
        plan,
        cards: cardsForPlan(plan, defaultTimeDayIds, workoutNames),
        sharedWithMe: Boolean(userId && plan.ownerId !== userId),
      })),
    [defaultTimeDayIds, peopleOptions, plans, userId, workoutNames],
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

  async function onBlankWeek() {
    if (!userId || !activeHousehold || busy) return;
    setBusy(true);
    setError(null);
    try {
      const trainingDays =
        profile.days.length > 0 ? profile.days : (['monday', 'wednesday', 'friday'] as Day[]);
      const days = buildIntentWeekDays({
        trainingDays,
        durationMin: profile.durationMin,
        goal: profile.goal,
        splitStyle: profile.splitStyle,
        customFocusByDay: profile.customFocusByDay,
      });
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
          days: trainingDays,
        },
        days,
        replaceExisting: true,
      });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create blank week');
    } finally {
      setBusy(false);
    }
  }

  function onClearWeek(plan: TrainingPlanWeekRow) {
    if (!userId || busy) return;
    Alert.alert('Clear this week?', 'Removes the plan for this week.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void (async () => {
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
          })();
        },
      },
    ]);
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
      setWeekStart(result.weekStart);
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

  async function ensureWorkoutForCard(
    card: PlanDayCardModel,
    opts?: { fillFromFocus?: boolean },
  ): Promise<string | null> {
    if (!userId || !activeHousehold || card.restDay) return null;

    if (opts?.fillFromFocus && card.focus.length > 0) {
      let needsFill = !card.workoutId;
      if (card.workoutId) {
        const existing = await loadWorkoutById(card.workoutId);
        needsFill = !existing || existing.exercises.length === 0;
      }
      if (needsFill) {
        try {
          const catalogue = library.length > 0 ? library : await loadLibrary();
          if (library.length === 0) setLibrary(catalogue);
          const filled = await fillPlanDayFromLibrary({
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
          return filled.workoutId;
        } catch {
          // Fall through to empty shell when library can't fill this focus.
        }
      }
    }

    if (card.workoutId) return card.workoutId;
    const name = card.focus[0] ? `${card.focus[0]}` : 'Train';
    return ensurePlanDayWorkout({
      householdId: activeHousehold.id,
      userId,
      dayId: card.id,
      name,
      durationMin: card.durationMin,
      existingWorkoutId: card.workoutId,
    });
  }

  async function onStart(card: PlanDayCardModel) {
    if (!userId || !activeHousehold || busy || card.restDay) return;
    setBusy(true);
    setError(null);
    try {
      const workoutId = await ensureWorkoutForCard(card, { fillFromFocus: true });
      if (!workoutId) return;
      await refresh();
      router.push(`/train/session/${workoutId}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start workout');
    } finally {
      setBusy(false);
    }
  }

  async function onBuild(card: PlanDayCardModel) {
    if (!userId || !activeHousehold || busy || card.restDay) return;
    setBusy(true);
    setError(null);
    try {
      const workoutId = await ensureWorkoutForCard(card, { fillFromFocus: true });
      if (!workoutId) return;
      await refresh();
      router.push(`/train/${workoutId}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open workout');
    } finally {
      setBusy(false);
    }
  }

  async function onFill(card: PlanDayCardModel) {
    if (!userId || !activeHousehold || busy || card.restDay) return;
    if (card.focus.length === 0) {
      setError('Set a session type first');
      setMenuCard(null);
      setTypeCard(card);
      return;
    }
    setBusy(true);
    setError(null);
    setMenuCard(null);
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
      setError(err instanceof Error ? err.message : 'Could not fill workout');
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
    onPrevWeek: () => setWeekStart((current) => addDaysIso(current, -7)),
    onNextWeek: () => setWeekStart((current) => addDaysIso(current, 7)),
    onThisWeek: () => setWeekStart(mondayWeekStart()),
    ownedRows,
    sharedRows,
    today,
    busy,
    error,
    regenPreview,
    buddies,
    isApprovedCreator: creator.isApprovedCreator,
    onGenerate: () => router.push('/train/plan/generate' as Href),
    onBlankWeek: () => void onBlankWeek(),
    onClearWeek: (plan: TrainingPlanWeekRow) => onClearWeek(plan),
    onAddToDay: (plan: TrainingPlanWeekRow, day: Day) => void onAddToDay(plan, day),
    onDuplicate,
    onRegenerate: (plan: TrainingPlanWeekRow) => void onRegenerate(plan),
    onConfirmRegen: () => void onConfirmRegen(),
    onCancelRegen: () => setRegenPreview(null),
    onStart: (card: PlanDayCardModel) => void onStart(card),
    onOpenWorkoutMenu: (card: PlanDayCardModel) => {
      if (card.restDay) setTypeCard(card);
      else setMenuCard(card);
    },
    onFillRemaining: (plan: TrainingPlanWeekRow) => void onFillRemaining(plan),
    onTrainTogether: (plan: TrainingPlanWeekRow, card: PlanDayCardModel) => void onTrainTogether(plan, card),
    onMarkDone: (card: PlanDayCardModel) => void mutateStatus(card, 'done'),
    onMarkSkipped: (card: PlanDayCardModel) => void mutateStatus(card, 'skipped'),
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
      <Sheet visible={Boolean(menuCard)} title="Workout" onClose={() => setMenuCard(null)}>
        <View style={styles.menuList}>
          <TextAction
            label="Fill from library"
            tone="accent"
            onPress={() => menuCard && void onFill(menuCard)}
          />
          <TextAction
            label={menuCard?.workoutId ? 'Edit workout' : 'Build workout'}
            onPress={() => {
              if (!menuCard) return;
              setMenuCard(null);
              void onBuild(menuCard);
            }}
          />
          <TextAction
            label="Change type"
            onPress={() => {
              if (!menuCard) return;
              setMenuCard(null);
              setTypeCard(menuCard);
            }}
          />
          <TextAction
            label="Attach saved"
            onPress={() => {
              if (!menuCard) return;
              setMenuCard(null);
              setSavedCard(menuCard);
            }}
          />
          {menuCard?.workoutId ? (
            <TextAction
              label="Clear workout"
              onPress={() => menuCard && void onAttachSaved(menuCard, null)}
            />
          ) : null}
        </View>
      </Sheet>
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
      <Sheet visible={Boolean(savedCard)} title="Saved workout" onClose={() => setSavedCard(null)}>
        <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
          {savedCard?.workoutId ? (
            <TextAction label="Clear workout" onPress={() => savedCard && void onAttachSaved(savedCard, null)} />
          ) : null}
          {workouts.map((workout) => (
            <Pressable
              key={workout.id}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => savedCard && void onAttachSaved(savedCard, workout.id)}
              style={styles.sheetRow}>
              <Text style={styles.sheetName}>{workout.name}</Text>
              <Text style={styles.sheetMeta}>
                {workout.durationMin != null ? `${workout.durationMin}m` : 'Workout'}
              </Text>
            </Pressable>
          ))}
          {workouts.length === 0 ? <Text style={styles.sheetMeta}>No saved workouts yet</Text> : null}
        </ScrollView>
      </Sheet>
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
