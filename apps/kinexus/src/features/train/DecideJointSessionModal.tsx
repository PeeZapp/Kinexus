import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius, space } from '@/src/features/shell/theme';
import {
  sessionTypeLabel,
  type JointSessionRow,
} from '@/src/features/train/joint-sessions-api';
import { Choice, TrainButton } from '@/src/features/train/ui';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function DecideJointSessionModal({
  visible,
  session,
  workoutNames,
  busy,
  onClose,
  onDecide,
}: {
  visible: boolean;
  session: JointSessionRow | null;
  workoutNames: Record<string, string>;
  busy?: boolean;
  onClose: () => void;
  onDecide: (input: { sessionTypeId: string; workoutId: string | null }) => Promise<void> | void;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const [sessionTypeId, setSessionTypeId] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !session) return;
    setSessionTypeId(session.inviterSessionTypeId);
    setWorkoutId(session.inviterWorkoutId);
    setError(null);
  }, [visible, session]);

  if (!session) return null;

  return (
    <AppModal visible={visible} transparent animationType={desktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => undefined} style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile]}>
          <View style={styles.head}>
            <Text style={styles.title}>Lock in session</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>
            {session.decisionReason === 'tie'
              ? 'Votes tied — pick the session.'
              : 'Accepted with no clear picks — choose what you’ll train.'}
          </Text>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.label}>Session type</Text>
            <View style={styles.picks}>
              {session.offeredSessionTypeIds.map((id) => (
                <Choice
                  key={id}
                  label={sessionTypeLabel(id)}
                  active={sessionTypeId === id}
                  onPress={() => setSessionTypeId(id)}
                />
              ))}
            </View>
            {session.offeredWorkoutIds.length > 0 ? (
              <>
                <Text style={styles.label}>Workout (optional)</Text>
                <View style={styles.picks}>
                  {session.offeredWorkoutIds.map((id) => (
                    <Choice
                      key={id}
                      label={workoutNames[id] ?? 'Workout'}
                      active={workoutId === id}
                      onPress={() => setWorkoutId((current) => (current === id ? null : id))}
                    />
                  ))}
                </View>
              </>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <TrainButton
            label="Save"
            disabled={busy}
            fill
            onPress={() => {
              if (!sessionTypeId) {
                setError('Pick a session type');
                return;
              }
              void onDecide({ sessionTypeId, workoutId });
            }}
          />
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 14, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    gap: space.md,
    padding: space.lg,
    maxHeight: '86%',
  },
  cardMobile: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: space.xl,
  },
  cardDesktop: {
    maxWidth: 440,
    marginBottom: 48,
    borderRadius: radius.xl,
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  close: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 13 },
  body: { gap: space.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: colors.danger, fontSize: 13 },
});
