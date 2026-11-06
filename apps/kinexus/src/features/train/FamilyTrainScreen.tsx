import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { loadFamilyTrainOverview, type FamilyTrainMember } from '@/src/features/train/api';
import { TrainSettingsPanel } from '@/src/features/train/TrainSettingsPanel';
import { TextAction, TrainPage } from '@/src/features/train/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useHousehold } from '@/src/lib/household';

export function FamilyTrainScreen() {
  const router = useRouter();
  const { activeHousehold } = useHousehold();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyTrainMember[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!activeHousehold) {
        setMembers([]);
        setReady(true);
        return;
      }
      let cancelled = false;
      setError(null);
      loadFamilyTrainOverview(activeHousehold.id)
        .then((rows) => {
          if (!cancelled) setMembers(rows);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load family training');
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      return () => {
        cancelled = true;
      };
    }, [activeHousehold]),
  );

  if (!ready) {
    return (
      <TrainPage>
        <LoadingState label="Loading family" />
      </TrainPage>
    );
  }

  return (
    <TrainPage>
      <ScrollView contentContainerStyle={styles.content}>
        <ErrorBanner message={error} />
        <TrainSettingsPanel />
        <Text style={styles.heading}>Family</Text>
        {members.length === 0 ? <Text style={styles.empty}>No family training shared yet.</Text> : null}
        {members.map((member) => (
          <View key={member.userId} style={styles.card}>
            <Text style={styles.name}>{member.displayName}</Text>
            <Text style={styles.meta}>
              {member.familyPlanShare === 'off'
                ? 'Not sharing'
                : member.familyPlanShare === 'plan'
                  ? 'Plan only'
                  : 'Plan + activity'}
            </Text>
            {member.planName ? <Text style={styles.plan}>{member.planName}</Text> : null}
            {member.todayWorkoutName ? (
              <View style={styles.row}>
                <Text style={styles.today}>Today · {member.todayWorkoutName}</Text>
                {member.todayWorkoutId ? (
                  <TextAction label="Open" onPress={() => router.push(`/train/${member.todayWorkoutId}` as Href)} />
                ) : null}
              </View>
            ) : null}
            {member.recentCompletions.length > 0 ? (
              <View style={styles.completions}>
                {member.recentCompletions.map((session) => (
                  <Text key={session.sessionId || session.name} style={styles.completion}>
                    {session.name}
                    {session.sets.length > 0
                      ? ` · ${session.sets
                          .slice(0, 3)
                          .map((set) =>
                            set.weight != null && set.weight !== ''
                              ? `${set.exerciseName} ${set.weight}×${set.reps}`
                              : `${set.exerciseName} ×${set.reps}`,
                          )
                          .join(', ')}`
                      : ''}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </TrainPage>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingBottom: space.lg },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 14 },
  card: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: space.md,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  plan: { color: colors.text, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  today: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  completions: { gap: 4, marginTop: 4 },
  completion: { color: colors.textMuted, fontSize: 13 },
});
