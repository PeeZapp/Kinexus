import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { DAYS, mondayWeekStart, type Day } from '@kinexus/domain';

import { fetchSharedTrainingPlan, type SharedTrainingPlanResponse } from '@/src/features/share/share-api';
import { copySharedTrainingPlan } from '@/src/features/train/api';
import { TrainButton, TrainPage } from '@/src/features/train/ui';
import { EmptyState, ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const DAY_LABEL: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export function SharedPlanScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const [data, setData] = useState<SharedTrainingPlanResponse | null>(null);
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
        const next = await fetchSharedTrainingPlan(token);
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this plan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function copyPlan() {
    if (!data || !user || user.isDevBypass || !activeHousehold || busy) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      await copySharedTrainingPlan({
        householdId: activeHousehold.id,
        userId: user.id,
        name: data.name,
        weekStart: data.weekStart || mondayWeekStart(),
        days: data.days.map((day) => ({
          day: day.day as Day,
          restDay: day.restDay,
          focus: day.focus,
          durationMin: day.durationMin,
          exercises: day.exercises,
        })),
      });
      setStatus('Copied to your plans');
      router.push('/train/plan' as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy this plan');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <TrainPage>
        <LoadingState label="Loading shared plan" />
      </TrainPage>
    );
  }

  if (error && !data) {
    return (
      <TrainPage>
        <Text style={styles.brand}>Kinexus</Text>
        <ErrorBanner message={error} />
      </TrainPage>
    );
  }

  if (!data) {
    return (
      <TrainPage>
        <EmptyState title="Plan not found" body="This share link is invalid or was turned off." />
      </TrainPage>
    );
  }

  const byDay = new Map(data.days.map((day) => [day.day, day]));

  return (
    <TrainPage>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>Kinexus</Text>
        <Text style={styles.title}>{data.name}</Text>
        {error ? <ErrorBanner message={error} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <View style={styles.grid}>
          {DAYS.map((day) => {
            const card = byDay.get(day);
            return (
              <View key={day} style={styles.card}>
                <Text style={styles.cardDay}>{DAY_LABEL[day]}</Text>
                {!card || card.restDay ? (
                  <Text style={styles.cardRest}>Rest</Text>
                ) : (
                  <>
                    <Text style={styles.cardFocus}>{card.focus.join(' · ') || 'Train'}</Text>
                    {card.durationMin != null ? (
                      <Text style={styles.cardMeta}>{card.durationMin} min</Text>
                    ) : null}
                    {card.exercises.map((exercise, index) => (
                      <Text key={`${exercise.name}-${index}`} style={styles.exercise}>
                        {exercise.name}
                        {exercise.sets ? ` · ${exercise.sets}×${exercise.reps}` : ''}
                      </Text>
                    ))}
                  </>
                )}
              </View>
            );
          })}
        </View>

        {signedIn ? (
          <TrainButton label={busy ? 'Copying…' : 'Copy this plan'} onPress={() => void copyPlan()} disabled={busy} fill />
        ) : (
          <Text style={styles.hint}>Sign in to copy this plan</Text>
        )}
      </ScrollView>
    </TrainPage>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, padding: space.md, paddingBottom: space.xl },
  brand: { color: colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  status: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 13 },
  grid: { gap: space.sm },
  card: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.md,
  },
  cardDay: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cardFocus: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textDim, fontSize: 13 },
  cardRest: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  exercise: { color: colors.textMuted, fontSize: 13 },
});
