import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { canEditShared } from '@kinexus/domain';

import { deleteWorkout, loadWorkouts, saveWorkout, saveWorkoutUserNotes, type WorkoutDraft } from '@/src/features/train/api';
import { WorkoutBuilder, type WorkoutBuilderResult } from '@/src/features/train/WorkoutBuilder';
import { TrainButton, TrainPage } from '@/src/features/train/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

export function WorkoutEditor({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold, people, role } = useHousehold();
  const [workout, setWorkout] = useState<WorkoutDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = user && !user.isDevBypass ? user.id : null;
  const personId = people.find((person) => person.userId === userId)?.id ?? null;

  useEffect(() => {
    if (!activeHousehold) return;
    let cancelled = false;
    setWorkout(null);
    setError(null);
    loadWorkouts(activeHousehold.id)
      .then((rows) => {
        if (cancelled) return;
        const match = rows.find((row) => row.id === workoutId) ?? null;
        setWorkout(match);
        if (!match) setError('Could not open workout');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open workout');
      });
    return () => {
      cancelled = true;
    };
  }, [activeHousehold, workoutId]);

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
        personIds: result.personIds,
        exercises: result.exercises,
      });
    }
    if (result.start) router.push(`/train/session/${workout.id}` as Href);
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
    <WorkoutBuilder
      key={workout.id}
      presentation="page"
      seed={{
        name: workout.name,
        visibility: workout.visibility,
        personIds: workout.personIds,
        splitId: workout.splitId,
        durationMin: workout.durationMin,
        exercises: workout.exercises,
        notes: workout.notes,
      }}
      people={people}
      editable={editable}
      onClose={() => router.replace('/train' as Href)}
      onPersonalNotes={
        userId && activeHousehold
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
      onSubmit={submit}
    />
  );
}
