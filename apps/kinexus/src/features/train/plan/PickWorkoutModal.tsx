import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius, space } from '@/src/features/shell/theme';
import {
  filterWorkoutsForSessionTypes,
  sessionTypeLabel,
} from '@/src/features/train/joint-sessions-api';
import {
  SessionTypePickerList,
  WorkoutPickerList,
  sessionWorkoutPickerStyles,
  sortWorkoutPickerRows,
  type WorkoutPickerRow,
} from '@/src/features/train/SessionWorkoutPickers';
import { useExperienceMode } from '@/src/lib/experience-mode';

export type PickWorkoutItem = WorkoutPickerRow;

const CLEAR_KEY = '__clear__';

type Step = 'session' | 'workouts';

export function PickWorkoutModal({
  visible,
  workouts,
  initialSessionTypeId,
  canClear,
  onClose,
  onPick,
  onClear,
}: {
  visible: boolean;
  workouts: readonly PickWorkoutItem[];
  /** When the plan day already has a session type, open on matching workouts. */
  initialSessionTypeId?: string | null;
  canClear?: boolean;
  onClose: () => void;
  onPick: (workoutId: string, sessionTypeId: string) => void;
  onClear?: () => void;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const [step, setStep] = useState<Step>('session');
  const [sessionTypeId, setSessionTypeId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSessionTypeId(initialSessionTypeId ?? null);
    setStep('session');
  }, [visible, initialSessionTypeId]);

  const filteredWorkouts = useMemo(() => {
    if (!sessionTypeId) return [];
    return sortWorkoutPickerRows(filterWorkoutsForSessionTypes(workouts, [sessionTypeId]));
  }, [sessionTypeId, workouts]);

  function close() {
    onClose();
  }

  function pickSessionType(id: string) {
    setSessionTypeId(id);
    setStep('workouts');
  }

  function backToSessionTypes() {
    setStep('session');
  }

  const title =
    step === 'session'
      ? 'Session type'
      : sessionTypeId
        ? sessionTypeLabel(sessionTypeId)
        : 'Workouts';

  return (
    <AppModal
      visible={visible}
      transparent
      animationType={desktop ? 'fade' : 'slide'}
      onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close">
        <Pressable
          onPress={() => undefined}
          accessibilityViewIsModal
          style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile, styles.pickerCard]}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headActions}>
              {step === 'workouts' ? (
                <Pressable onPress={backToSessionTypes} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.close}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.pickerScroll}
            contentContainerStyle={sessionWorkoutPickerStyles.pickerList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {step === 'session' ? (
              <SessionTypePickerList
                selectedIds={sessionTypeId ? [sessionTypeId] : []}
                onToggle={pickSessionType}
              />
            ) : null}

            {step === 'workouts' && visible ? (
              <>
                {canClear ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onClear?.()}
                    style={({ pressed }) => [styles.clearRow, pressed && styles.clearRowPressed]}>
                    <Text style={styles.clearLabel}>Clear</Text>
                    <Text style={styles.clearDetail}>Remove from this day</Text>
                  </Pressable>
                ) : null}
                <WorkoutPickerList
                  key={sessionTypeId ?? CLEAR_KEY}
                  workouts={filteredWorkouts}
                  selectedIds={[]}
                  selectionMode="single"
                  emptyLabel="No matching workouts"
                  onToggle={(workoutId) => {
                    if (!sessionTypeId) return;
                    onPick(workoutId, sessionTypeId);
                  }}
                />
              </>
            ) : null}
          </ScrollView>
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
    maxHeight: '90%',
  },
  cardMobile: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: space.xl,
  },
  cardDesktop: {
    maxWidth: 460,
    marginBottom: 48,
    borderRadius: radius.xl,
    alignSelf: 'center',
  },
  pickerCard: { maxHeight: '86%' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', flexShrink: 1 },
  close: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  pickerScroll: { flexGrow: 1, minHeight: 0 },
  clearRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  clearRowPressed: { opacity: 0.88 },
  clearLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  clearDetail: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});
