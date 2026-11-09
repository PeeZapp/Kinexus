import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAY_LABELS, DAYS, type Day } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import {
  TrainGenerateAudiencePicker,
  TrainGenerateControls,
} from '@/src/features/train/generate/controls';
import type { PreviewDay, TrainGeneratePrefs } from '@/src/features/train/generate/types';
import { colors, radius, space } from '@/src/features/shell/theme';
import { TextAction, TrainButton } from '@/src/features/train/ui';

export type TrainGenerateViewProps = {
  prefs: TrainGeneratePrefs;
  onChangePrefs: (patch: Partial<TrainGeneratePrefs>) => void;
  onApplyPreset: (id: string) => void;
  equipmentOptions: readonly string[];
  bodyParts: readonly string[];
  buddies: readonly { id: string; name: string }[];
  workouts: readonly { id: string; name: string }[];
  onGenerate: () => void;
  preview: PreviewDay[] | null;
  volumeBars: { label: string; sets: number; target: number }[];
  totalTimeMin: number;
  balanceWarning: string | null;
  onSwapExercise: (day: Day) => void;
  onRerollDay: (day: Day) => void;
  onSwapSavedWorkout: (day: Day, workoutId: string | null) => void;
  onMoveDay: (day: Day, direction: -1 | 1) => void;
  onToggleRest: (day: Day) => void;
  onChangeTime: (day: Day) => void;
  onApply: () => void;
  applying: boolean;
  error: string | null;
  pickingWorkoutDay: Day | null;
  onPickWorkoutDay: (day: Day | null) => void;
};

export function GenerateDesktop(props: TrainGenerateViewProps) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Generate</Text>
      <View style={styles.layout}>
        <View style={styles.controls}>
          <TrainGenerateAudiencePicker
            audience={props.prefs.audience}
            buddies={props.buddies}
            buddyUserIds={props.prefs.buddyUserIds}
            onChangeAudience={(audience) => props.onChangePrefs({ audience })}
            onChangeBuddies={(buddyUserIds) => props.onChangePrefs({ buddyUserIds })}
          />
          <TrainGenerateControls
            prefs={props.prefs}
            equipmentOptions={props.equipmentOptions}
            bodyParts={props.bodyParts}
            onChange={props.onChangePrefs}
            onApplyPreset={props.onApplyPreset}
          />
          <Btn label="Generate week" onPress={props.onGenerate} />
          <ErrorText message={props.error} />
        </View>

        <View style={styles.preview}>
          {props.preview ? (
            <>
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Week</Text>
                <Text style={styles.summaryMeta}>{props.totalTimeMin} min planned</Text>
              </View>

              <View style={styles.grid}>
                {DAYS.map((day) => {
                  const row = props.preview?.find((item) => item.day === day);
                  if (!row) return null;
                  const exerciseSummary = row.workoutId
                    ? props.workouts.find((item) => item.id === row.workoutId)?.name ?? 'Saved workout'
                    : row.exercises.map((ex) => ex.name).slice(0, 4).join(' · ');
                  return (
                    <View key={day} style={styles.card}>
                      <View style={styles.cardHead}>
                        <Text style={styles.cardDay}>{DAY_LABELS[day].slice(0, 3)}</Text>
                        <Text style={styles.cardFocus}>
                          {row.restDay ? 'Rest' : row.focus[0] ?? 'Train'}
                          {!row.restDay && row.durationMin ? ` · ${row.durationMin}m` : ''}
                        </Text>
                      </View>
                      {!row.restDay ? (
                        <Text style={styles.cardMeta} numberOfLines={2}>
                          {exerciseSummary || 'Intent only'}
                        </Text>
                      ) : null}
                      <View style={styles.actions}>
                        <TextAction
                          label={row.restDay ? 'Train' : 'Rest'}
                          onPress={() => props.onToggleRest(day)}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>

              <TrainButton
                label={props.applying ? 'Saving…' : 'Apply plan'}
                onPress={props.onApply}
                disabled={props.applying}
                fill
              />
            </>
          ) : (
            <Text style={styles.empty}>Generate a week to preview days, volume, and swaps.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  layout: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  controls: { flex: 1, minWidth: 280, maxWidth: 420, gap: space.sm },
  preview: { flex: 1.4, gap: space.md },
  summary: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.md,
  },
  summaryTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  summaryMeta: { color: colors.textMuted, fontSize: 13 },
  warn: { color: colors.warning, fontSize: 13 },
  bars: { gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 64, color: colors.textDim, fontSize: 11, textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  barValue: { width: 48, color: colors.textMuted, fontSize: 11, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    minWidth: 220,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    padding: space.md,
  },
  cardHead: { gap: 2 },
  cardDay: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cardFocus: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: colors.textDim, fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickList: { gap: 6 },
  empty: { color: colors.textMuted, fontSize: 14 },
});
