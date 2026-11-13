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

export function RespondJointSessionModal({
  visible,
  session,
  workoutNames,
  busy,
  onClose,
  onRespond,
}: {
  visible: boolean;
  session: JointSessionRow | null;
  workoutNames: Record<string, string>;
  busy?: boolean;
  onClose: () => void;
  onRespond: (input: {
    accept: boolean;
    sessionTypeId: string | null;
    workoutId: string | null;
  }) => Promise<void> | void;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const [sessionTypeId, setSessionTypeId] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !session) return;
    setSessionTypeId(null);
    setWorkoutId(null);
  }, [visible, session]);

  if (!session) return null;

  const when = new Date(session.scheduledAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <AppModal visible={visible} transparent animationType={desktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => undefined} style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile]}>
          <View style={styles.head}>
            <Text style={styles.title}>Train invite</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>{when}</Text>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.label}>Session type (optional)</Text>
            <View style={styles.picks}>
              {session.offeredSessionTypeIds.map((id) => (
                <Choice
                  key={id}
                  label={sessionTypeLabel(id)}
                  active={sessionTypeId === id}
                  onPress={() => setSessionTypeId((current) => (current === id ? null : id))}
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
            <Text style={styles.hint}>Accept with no picks to let the invitor decide.</Text>
          </ScrollView>
          <View style={styles.actions}>
            <TrainButton
              label="Decline"
              tone="ghost"
              disabled={busy}
              onPress={() => void onRespond({ accept: false, sessionTypeId: null, workoutId: null })}
            />
            <TrainButton
              label="Accept"
              disabled={busy}
              onPress={() =>
                void onRespond({
                  accept: true,
                  sessionTypeId,
                  workoutId,
                })
              }
            />
          </View>
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
  hint: { color: colors.textDim, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
});
