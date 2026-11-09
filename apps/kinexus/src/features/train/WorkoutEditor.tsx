import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { canCopySharedWorkout, canEditShared, defaultTrainBuddyPermissions } from '@kinexus/domain';

import { ListExportSheet } from '@/src/features/lists/ListExportSheet';
import { workoutExportInput } from '@/src/features/lists/list-io-adapters';
import { buildShareUrl } from '@/src/features/share/share-url';
import { disableEntityShare, enableEntityShare, resetEntityShare, sharePreview } from '@/src/features/share/link-share';
import {
  copyWorkoutToMyLibrary,
  deleteWorkout,
  loadWorkoutById,
  loadWorkouts,
  saveWorkout,
  saveWorkoutUserNotes,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { loadTrainBuddies } from '@/src/features/train/buddies-api';
import { WorkoutBuilder, type WorkoutBuilderResult } from '@/src/features/train/WorkoutBuilder';
import { TrainButton, TrainPage } from '@/src/features/train/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useUnits } from '@/src/lib/use-units';

export function WorkoutEditor({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold, people, role } = useHousehold();
  const { weightUnit } = useUnits();
  const [workout, setWorkout] = useState<WorkoutDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [buddies, setBuddies] = useState<{ id: string; name: string }[]>([]);
  const [buddyCopyOk, setBuddyCopyOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const userId = user && !user.isDevBypass ? user.id : null;
  const personId = people.find((person) => person.userId === userId)?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setWorkout(null);
    setError(null);
    async function load() {
      const byId = await loadWorkoutById(workoutId);
      if (cancelled) return;
      if (byId) {
        setWorkout(byId);
        return;
      }
      if (!activeHousehold) {
        setError('Could not open workout');
        return;
      }
      const rows = await loadWorkouts(activeHousehold.id);
      if (cancelled) return;
      const match = rows.find((row) => row.id === workoutId) ?? null;
      setWorkout(match);
      if (!match) setError('Could not open workout');
    }
    load().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open workout');
    });
    return () => {
      cancelled = true;
    };
  }, [activeHousehold, workoutId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadTrainBuddies(userId)
      .then((rows) => {
        if (cancelled) return;
        const accepted = rows.filter((row) => row.status === 'accepted');
        setBuddies(
          accepted.map((row) => ({
            id: row.otherUserId,
            name: row.profile.username || row.profile.globalHandle || 'Buddy',
          })),
        );
        if (workout?.createdBy && workout.createdBy !== userId) {
          const link = accepted.find((row) => row.otherUserId === workout.createdBy);
          setBuddyCopyOk(
            canCopySharedWorkout({
              buddyStatus: link?.status ?? null,
              buddyPermissions: link?.permissions ?? defaultTrainBuddyPermissions(),
            }),
          );
        } else {
          setBuddyCopyOk(false);
        }
      })
      .catch(() => {
        if (!cancelled) setBuddies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, workout?.createdBy]);

  const editable = workout
    ? canEditShared({
        role,
        userId,
        personId,
        createdBy: workout.createdBy,
        visibility: workout.visibility,
        personIds: workout.personIds,
      })
    : false;

  const preview = useMemo(() => {
    if (!workout) return '';
    const owner = user?.displayName?.trim() || 'Workout';
    return sharePreview([
      `${owner}'s ${workout.name}`,
      `${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'}`,
      workout.durationMin ? `${workout.durationMin} min` : null,
    ]);
  }, [user?.displayName, workout]);

  async function confirmDelete() {
    if (!workout) return;
    const confirmed =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(`Delete ${workout.name}?`)
        : await new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (value: boolean) => {
              if (settled) return;
              settled = true;
              resolve(value);
            };
            Alert.alert(
              'Delete this workout?',
              workout.name,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => settle(false) },
                { text: 'Delete', style: 'destructive', onPress: () => settle(true) },
              ],
              { cancelable: true, onDismiss: () => settle(false) },
            );
          });
    if (!confirmed) return;
    await deleteWorkout(workout.id);
    router.replace('/train' as Href);
  }

  async function submit(result: WorkoutBuilderResult) {
    if (!workout || !activeHousehold) return;
    if (editable) {
      await saveWorkout(workout.id, activeHousehold.id, {
        name: result.name,
        visibility: result.visibility,
        splitId: result.splitId,
        durationMin: result.durationMin,
        level: result.level,
        goal: result.goal,
        equipment: result.equipment,
        personIds: result.personIds,
        buddyUserIds: result.buddyUserIds,
        exercises: result.exercises,
      });
    }
    if (result.start) router.push(`/train/session/${workout.id}` as Href);
  }

  async function copyShared() {
    if (!workout || !activeHousehold || !userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { workoutId, needsReplacement } = await copyWorkoutToMyLibrary({
        source: workout,
        householdId: activeHousehold.id,
        userId,
      });
      if (needsReplacement.length > 0) {
        setError(
          `Copied with free-text names for ${needsReplacement.length} unavailable exercise${needsReplacement.length === 1 ? '' : 's'}`,
        );
      }
      router.push(`/train/${workoutId}` as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not copy workout');
    } finally {
      setBusy(false);
    }
  }

  async function refreshWorkout() {
    const byId = await loadWorkoutById(workoutId);
    if (byId) {
      setWorkout(byId);
      return;
    }
    if (!activeHousehold) return;
    const rows = await loadWorkouts(activeHousehold.id);
    const match = rows.find((row) => row.id === workoutId) ?? null;
    if (match) setWorkout(match);
  }

  if (!workout) {
    return (
      <TrainPage>
        <ErrorBanner message={error} />
        {!error ? <LoadingState label="Opening workout" /> : <TrainButton label="Back" tone="ghost" onPress={() => router.replace('/train' as Href)} />}
      </TrainPage>
    );
  }

  return (
    <>
      <WorkoutBuilder
        key={workout.id}
        presentation="page"
        seed={{
          name: workout.name,
          visibility: workout.visibility,
          personIds: workout.personIds,
          buddyUserIds: workout.buddyUserIds,
          level: workout.level,
          goal: workout.goal,
          equipment: workout.equipment,
          splitId: workout.splitId,
          durationMin: workout.durationMin,
          exercises: workout.exercises,
          notes: workout.notes,
        }}
        people={people}
        buddies={buddies}
        editable={editable}
        onClose={() => router.replace('/train' as Href)}
        onPersonalNotes={
          editable && userId && activeHousehold
            ? async (notes) => {
                await saveWorkoutUserNotes({
                  workoutId: workout.id,
                  userId,
                  householdId: activeHousehold.id,
                  notes,
                });
              }
            : undefined
        }
        onDelete={editable ? confirmDelete : undefined}
        onShare={editable ? () => setShareOpen(true) : undefined}
        onCopy={!editable && buddyCopyOk ? copyShared : undefined}
        onSubmit={submit}
      />
      <ListExportSheet
        visible={shareOpen}
        input={workoutExportInput(workout, weightUnit)}
        linkShare={{
          preview,
          state: {
            isShared: workout.isShared,
            shareToken: workout.shareToken,
            url: workout.isShared && workout.shareToken ? buildShareUrl('workout', workout.shareToken) : null,
          },
          busy: shareBusy,
          error: shareError,
          onToggle: async (enabled) => {
            setShareBusy(true);
            setShareError(null);
            try {
              const url = enabled
                ? await enableEntityShare('workout', workout.id, workout.shareToken)
                : await disableEntityShare('workout', workout.id);
              await refreshWorkout();
              return url;
            } catch (err) {
              setShareError(err instanceof Error ? err.message : 'Could not update share link');
              throw err;
            } finally {
              setShareBusy(false);
            }
          },
          onReset: async () => {
            setShareBusy(true);
            setShareError(null);
            try {
              const url = await resetEntityShare('workout', workout.id);
              await refreshWorkout();
              return url;
            } catch (err) {
              setShareError(err instanceof Error ? err.message : 'Could not reset share link');
              throw err;
            } finally {
              setShareBusy(false);
            }
          },
        }}
        onClose={() => {
          setShareOpen(false);
          setShareError(null);
        }}
      />
    </>
  );
}
