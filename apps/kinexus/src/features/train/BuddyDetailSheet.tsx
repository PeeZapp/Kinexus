import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { Sheet } from '@/src/features/meals/meals-kit';
import { PublicName, publicPrimaryName } from '@/src/features/shell/PublicName';
import { colors, space } from '@/src/features/shell/theme';
import {
  loadBuddyHubDetail,
  type BuddyHubDetail,
  type TrainBuddyConnection,
} from '@/src/features/train/buddies-api';
import { copyWorkoutToMyLibrary } from '@/src/features/train/api';
import { Badge, Pill, TextAction, TrainButton } from '@/src/features/train/ui';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function BuddyDetailSheet({
  buddy,
  onClose,
  onOpenPermissions,
}: {
  buddy: TrainBuddyConnection | null;
  onClose: () => void;
  onOpenPermissions: () => void;
}) {
  useExperienceMode();
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const viewerId = user && !user.isDevBypass ? user.id : null;

  const [detail, setDetail] = useState<BuddyHubDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!buddy || !viewerId) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    void loadBuddyHubDetail({
      buddyUserId: buddy.otherUserId,
      viewerId,
      buddyStatus: buddy.status,
    })
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load buddy');
      });
    return () => {
      cancelled = true;
    };
  }, [buddy, viewerId]);

  async function copyWorkout(workoutId: string) {
    if (!detail || !activeHousehold || !viewerId || busy) return;
    const workout = detail.workouts.find((row) => row.id === workoutId);
    if (!workout) return;
    setBusy(true);
    setError(null);
    try {
      const id = await copyWorkoutToMyLibrary({
        source: workout,
        householdId: activeHousehold.id,
        userId: viewerId,
      });
      router.push(`/train/${id}` as Href);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy workout');
    } finally {
      setBusy(false);
    }
  }

  const title = buddy ? publicPrimaryName(buddy.profile) : 'Buddy';

  return (
    <Sheet visible={Boolean(buddy)} title={title} onClose={onClose} wide>
      {buddy ? (
        <View style={styles.stack}>
          <PublicName user={buddy.profile} primaryStyle={styles.primary} secondaryStyle={styles.handle} />
          <View style={styles.actions}>
            <TrainButton label="Permissions" tone="ghost" onPress={onOpenPermissions} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!detail ? <Text style={styles.muted}>Loading…</Text> : null}

          {detail?.visibility.plan ? (
            <View style={styles.section}>
              <Text style={styles.kicker}>Plan</Text>
              {detail.plan ? (
                <>
                  <Text style={styles.planName}>{detail.plan.name}</Text>
                  {detail.plan.days.map((day) => (
                    <Text key={`${day.weekday}-${day.workoutId ?? day.label}`} style={styles.meta}>
                      {WEEKDAYS[day.weekday]} · {day.label || 'Rest'}
                    </Text>
                  ))}
                </>
              ) : (
                <Text style={styles.muted}>No plan shared.</Text>
              )}
            </View>
          ) : null}

          {detail?.visibility.workouts ? (
            <View style={styles.section}>
              <Text style={styles.kicker}>Workouts</Text>
              {detail.workouts.length === 0 ? <Text style={styles.muted}>Nothing shared yet.</Text> : null}
              {detail.workouts.map((workout) => (
                <View key={workout.id} style={styles.row}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{workout.name}</Text>
                    <Pill label={workout.visibility} />
                  </View>
                  <View style={styles.rowActions}>
                    <TextAction
                      label="Open"
                      onPress={() => {
                        router.push(`/train/${workout.id}` as Href);
                        onClose();
                      }}
                    />
                    <TextAction
                      label="Start"
                      tone="accent"
                      onPress={() => {
                        router.push(`/train/session/${workout.id}` as Href);
                        onClose();
                      }}
                    />
                    {detail.visibility.copyWorkouts ? (
                      <TextAction
                        label="Copy"
                        onPress={() => void copyWorkout(workout.id)}
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {detail?.visibility.sessions ? (
            <View style={styles.section}>
              <Text style={styles.kicker}>Recent sessions</Text>
              {detail.sessions.length === 0 ? <Text style={styles.muted}>No sessions yet.</Text> : null}
              {detail.sessions.map((session) => (
                <View key={session.id} style={styles.row}>
                  <Text style={styles.rowTitle}>{session.name}</Text>
                  <Text style={styles.meta}>
                    {session.finishedAt ? new Date(session.finishedAt).toLocaleString() : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {detail?.visibility.prs ? (
            <View style={styles.section}>
              <Text style={styles.kicker}>PRs</Text>
              {detail.prs.length === 0 ? <Text style={styles.muted}>No PRs yet.</Text> : null}
              {detail.prs.map((pr) => (
                <View key={pr.exerciseId} style={styles.row}>
                  <Text style={styles.rowTitle}>{pr.exerciseName}</Text>
                  <Badge
                    label={[pr.bestWeight, pr.bestReps ? `×${pr.bestReps}` : ''].filter(Boolean).join(' ')}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {detail &&
          !detail.visibility.plan &&
          !detail.visibility.workouts &&
          !detail.visibility.sessions &&
          !detail.visibility.prs ? (
            <Text style={styles.muted}>They have not shared training with you yet.</Text>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  primary: { color: colors.text, fontSize: 20, fontWeight: '700' },
  handle: { color: colors.textMuted, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  section: { gap: space.sm },
  kicker: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  planName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  row: { gap: 6 },
  rowCopy: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  meta: { color: colors.textDim, fontSize: 12 },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
