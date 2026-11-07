import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { addDaysIso, mondayWeekStart, type Day } from '@kinexus/domain';

import {
  addTrainingPlanDayToCalendar,
  addTrainingPlanToCalendar,
  downloadTrainingPlanIcs,
  duplicateTrainingPlanToNextWeek,
  listTrainingPlansByWeek,
  loadLibrary,
  loadWorkouts,
  regenerateRemainingTrainingDays,
  setTrainingPlanCalendarAutoSync,
  setTrainingPlanDayStatus,
  type TrainingPlanWeekRow,
} from '@/src/features/train/api';
import { PlanDesktop } from '@/src/features/train/plan/PlanDesktop';
import { PlanMobile } from '@/src/features/train/plan/PlanMobile';
import type { PlanAudienceRow, PlanDayCardModel } from '@/src/features/train/plan/types';
import { TrainPage } from '@/src/features/train/ui';
import { LoadingState } from '@/src/features/shell/states';
import { todayDay } from '@/src/features/meals/week-labels';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

function cardsForPlan(plan: TrainingPlanWeekRow, defaultTimeDayIds: string[]): PlanDayCardModel[] {
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
  const userId = user && !user.isDevBypass ? user.id : null;

  const [weekStart, setWeekStart] = useState(() => mondayWeekStart());
  const [plans, setPlans] = useState<TrainingPlanWeekRow[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenPreview, setRegenPreview] = useState<{
    planId: string;
    summary: string;
  } | null>(null);
  const [defaultTimeDayIds, setDefaultTimeDayIds] = useState<string[]>([]);

  const peopleOptions = useMemo(
    () => people.map((person) => ({ id: person.id, name: person.name, userId: person.userId })),
    [people],
  );

  const refresh = useCallback(async () => {
    if (!userId || !activeHousehold) {
      setPlans([]);
      return;
    }
    const rows = await listTrainingPlansByWeek(activeHousehold.id, weekStart, userId);
    setPlans(rows);
  }, [activeHousehold, userId, weekStart]);

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

  const rows: PlanAudienceRow[] = useMemo(
    () =>
      plans.map((plan) => ({
        label: audienceLabel(plan, userId, peopleOptions),
        plan,
        cards: cardsForPlan(plan, defaultTimeDayIds),
      })),
    [defaultTimeDayIds, peopleOptions, plans, userId],
  );

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

  function onStart(card: PlanDayCardModel) {
    if (!card.workoutId) return;
    router.push(`/train/session/${card.workoutId}` as Href);
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
    onPrevWeek: () => setWeekStart((current) => addDaysIso(current, -7)),
    onNextWeek: () => setWeekStart((current) => addDaysIso(current, 7)),
    onThisWeek: () => setWeekStart(mondayWeekStart()),
    rows,
    today,
    busy,
    error,
    regenPreview,
    onGenerate: () => router.push('/train/plan/generate' as Href),
    onDuplicate,
    onRegenerate: (plan: TrainingPlanWeekRow) => void onRegenerate(plan),
    onConfirmRegen: () => void onConfirmRegen(),
    onCancelRegen: () => setRegenPreview(null),
    onStart,
    onMarkDone: (card: PlanDayCardModel) => void mutateStatus(card, 'done'),
    onMarkSkipped: (card: PlanDayCardModel) => void mutateStatus(card, 'skipped'),
    onUndo: (card: PlanDayCardModel) => void mutateStatus(card, 'planned'),
    onAddPlanToCalendar: (plan: TrainingPlanWeekRow) => void onAddPlanToCalendar(plan),
    onAddDayToCalendar: (card: PlanDayCardModel) => void onAddDayToCalendar(card),
    onExportPlanIcs: (plan: TrainingPlanWeekRow) => void onExportPlanIcs(plan),
    onExportDayIcs: (plan: TrainingPlanWeekRow, card: PlanDayCardModel) => void onExportDayIcs(plan, card),
    onToggleAutoSync: (plan: TrainingPlanWeekRow) => void onToggleAutoSync(plan),
    canManagePlan,
  };

  return <TrainPage>{desktop ? <PlanDesktop {...viewProps} /> : <PlanMobile {...viewProps} />}</TrainPage>;
}
