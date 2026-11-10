import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Day } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import {
  TrainGenerateAudiencePicker,
  TrainGenerateControls,
} from '@/src/features/train/generate/controls';
import {
  GeneratePreviewApply,
  GeneratePreviewDays,
  type GeneratePreviewWorkoutRef,
} from '@/src/features/train/generate/GeneratePreview';
import type { PreviewDay, TrainGeneratePrefs } from '@/src/features/train/generate/types';
import { colors, radius, space } from '@/src/features/shell/theme';

export type TrainGenerateViewProps = {
  prefs: TrainGeneratePrefs;
  onChangePrefs: (patch: Partial<TrainGeneratePrefs>) => void;
  onApplyPreset: (id: string) => void;
  equipmentOptions: readonly string[];
  bodyParts: readonly string[];
  buddies: readonly { id: string; name: string }[];
  workouts: readonly GeneratePreviewWorkoutRef[];
  onGenerate: () => void;
  preview: PreviewDay[] | null;
  totalTimeMin: number;
  onViewDay: (day: Day) => void;
  onOpenDayMenu: (day: Day) => void;
  onApply: () => void;
  applying: boolean;
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
        </View>

        <View style={styles.preview}>
          {props.preview ? (
            <>
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Week</Text>
                <Text style={styles.summaryMeta}>{props.totalTimeMin} min planned</Text>
              </View>
              <GeneratePreviewDays
                preview={props.preview}
                workouts={props.workouts}
                onViewDay={props.onViewDay}
                onOpenDayMenu={props.onOpenDayMenu}
                cardWidth="48%"
              />
              <GeneratePreviewApply applying={props.applying} onApply={props.onApply} />
            </>
          ) : (
            <Text style={styles.empty}>Generate a week to preview days.</Text>
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
  empty: { color: colors.textMuted, fontSize: 14 },
});
