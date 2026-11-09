import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAY_LABELS, DAYS } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import {
  TrainGenerateAudiencePicker,
  TrainGenerateControls,
} from '@/src/features/train/generate/controls';
import type { TrainGenerateViewProps } from '@/src/features/train/generate/GenerateDesktop';
import { colors, radius, space } from '@/src/features/shell/theme';
import { TextAction, TrainButton } from '@/src/features/train/ui';

export function GenerateMobile(props: TrainGenerateViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Generate</Text>
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

      {props.preview ? (
        <View style={styles.preview}>
          <Text style={styles.summaryMeta}>{props.totalTimeMin} min planned</Text>
          {DAYS.map((day) => {
            const row = props.preview?.find((item) => item.day === day);
            if (!row) return null;
            const exerciseSummary = row.workoutId
              ? props.workouts.find((item) => item.id === row.workoutId)?.name ?? 'Saved workout'
              : row.exercises.map((ex) => ex.name).slice(0, 4).join(' · ');
            return (
              <View key={day} style={styles.card}>
                <Text style={styles.cardDay}>{DAY_LABELS[day].slice(0, 3)}</Text>
                <Text style={styles.cardFocus}>
                  {row.restDay ? 'Rest' : row.focus[0] ?? 'Train'}
                  {!row.restDay && row.durationMin ? ` · ${row.durationMin}m` : ''}
                </Text>
                {!row.restDay ? (
                  <Text style={styles.cardMeta} numberOfLines={2}>
                    {exerciseSummary || 'Intent only'}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <TextAction label={row.restDay ? 'Train' : 'Rest'} onPress={() => props.onToggleRest(day)} />
                </View>
              </View>
            );
          })}
          <TrainButton
            label={props.applying ? 'Saving…' : 'Apply plan'}
            onPress={props.onApply}
            disabled={props.applying}
            fill
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.md, gap: space.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  preview: { gap: space.sm, marginTop: space.md },
  summaryMeta: { color: colors.textMuted, fontSize: 13 },
  warn: { color: colors.warning, fontSize: 13 },
  bars: { gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 64, color: colors.textDim, fontSize: 11, textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  barValue: { width: 48, color: colors.textMuted, fontSize: 11, textAlign: 'right' },
  card: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    padding: space.md,
  },
  cardDay: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  cardFocus: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: colors.textDim, fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickList: { gap: 6 },
});
