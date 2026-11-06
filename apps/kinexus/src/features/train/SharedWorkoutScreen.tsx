import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { effortLevelFrom } from '@kinexus/domain';

import { fetchSharedWorkout, type SharedWorkoutResponse } from '@/src/features/share/share-api';
import { createWorkout } from '@/src/features/train/api';
import { EffortBadge, MediaGallery, TrainButton, TrainPage } from '@/src/features/train/ui';
import { EmptyState, ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

function clusterExercises(exercises: SharedWorkoutResponse['exercises']) {
  const clusters: SharedWorkoutResponse['exercises'][] = [];
  const seen = new Set<number>();
  exercises.forEach((exercise, index) => {
    if (seen.has(index)) return;
    if (!exercise.supersetId) {
      clusters.push([exercise]);
      seen.add(index);
      return;
    }
    const group = exercises
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => item.supersetId === exercise.supersetId);
    clusters.push(group.map(({ item }) => item));
    group.forEach(({ itemIndex }) => seen.add(itemIndex));
  });
  return clusters;
}

export function SharedWorkoutScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const [data, setData] = useState<SharedWorkoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const signedIn = Boolean(user && !user.isDevBypass && activeHousehold);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token.trim()) {
        setError('Missing share link');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next = await fetchSharedWorkout(token);
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const clusters = useMemo(() => (data ? clusterExercises(data.exercises) : []), [data]);

  async function saveCopy() {
    if (!data || !user || user.isDevBypass || !activeHousehold || busy) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const id = await createWorkout({
        householdId: activeHousehold.id,
        userId: user.id,
        name: data.name,
        visibility: 'private',
        splitId: null,
        durationMin: data.durationMin,
        personIds: [],
        exercises: data.exercises.map((exercise) => ({
          exerciseId: null,
          name: exercise.name,
          targetSets: exercise.sets,
          targetReps: exercise.reps,
          targetEffort: effortLevelFrom(exercise.effort),
          targetRpe: exercise.rpe,
          note: exercise.note,
          supersetId: exercise.supersetId,
        })),
      });
      setStatus('Saved to your workouts');
      router.push(`/train/${id}` as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save a copy');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <TrainPage>
        <LoadingState label="Loading shared workout" />
      </TrainPage>
    );
  }

  if (error && !data) {
    return (
      <TrainPage>
        <Text style={styles.brand}>Kinexus</Text>
        <ErrorBanner message={error} />
        <EmptyState title="Workout not found" body="This share link is invalid or the workout is no longer shared." />
      </TrainPage>
    );
  }

  if (!data) {
    return (
      <TrainPage>
        <EmptyState title="Workout not found" body="This share link is invalid or the workout is no longer shared." />
      </TrainPage>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Kinexus</Text>
      <Text style={styles.title}>{data.name}</Text>
      <Text style={styles.meta}>
        {data.exercises.length} exercise{data.exercises.length === 1 ? '' : 's'}
        {data.durationMin ? ` · ${data.durationMin} min` : ''}
      </Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <ErrorBanner message={error} />
      {signedIn ? (
        <TrainButton label="Save a copy to my workouts" fill disabled={busy} onPress={() => void saveCopy()} />
      ) : null}

      {data.exercises.length === 0 ? (
        <EmptyState title="This workout is empty" body="Nothing has been added yet." />
      ) : (
        <View style={styles.stack}>
          {clusters.map((group, clusterIndex) => {
            const body = group.map((exercise, index) => {
              const effort = effortLevelFrom(exercise.effort);
              return (
                <View key={`${clusterIndex}-${index}-${exercise.name}`} style={styles.card}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.plan}>
                    {exercise.sets} × {exercise.reps}
                    {exercise.rpe != null ? ` · RPE ${exercise.rpe}` : ''}
                  </Text>
                  {effort ? <EffortBadge effort={effort} /> : null}
                  {exercise.note ? <Text style={styles.note}>{exercise.note}</Text> : null}
                  <MediaGallery urls={exercise.mediaUrls} />
                </View>
              );
            });
            if (group.length > 1) {
              return (
                <View key={`superset-${clusterIndex}`} style={styles.superset}>
                  <Text style={styles.supersetLabel}>Superset</Text>
                  {body}
                </View>
              );
            }
            return <View key={`solo-${clusterIndex}`}>{body}</View>;
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: 14, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 15 },
  status: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  stack: { gap: 12 },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 8,
  },
  exerciseName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  plan: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  note: { color: colors.textDim, fontSize: 13 },
  superset: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  supersetLabel: { color: colors.accent, fontSize: 12, fontWeight: '800', paddingHorizontal: 4 },
});
