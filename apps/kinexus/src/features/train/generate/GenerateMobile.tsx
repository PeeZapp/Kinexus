import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink, Btn } from '@/src/features/household/ui';
import {
  TrainGenerateAudiencePicker,
  TrainGenerateControls,
} from '@/src/features/train/generate/controls';
import {
  GeneratePreviewApply,
  GeneratePreviewDays,
} from '@/src/features/train/generate/GeneratePreview';
import type { TrainGenerateViewProps } from '@/src/features/train/generate/GenerateDesktop';
import { colors, space } from '@/src/features/shell/theme';

export function GenerateMobile(props: TrainGenerateViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <BackLink label="Plan" onPress={props.onBack} />
        <Text style={styles.title}>Generate</Text>
      </View>
      <TrainGenerateAudiencePicker
        audience={props.prefs.audience}
        onChangeAudience={(audience) => props.onChangePrefs({ audience })}
      />
      <TrainGenerateControls
        prefs={props.prefs}
        onChange={props.onChangePrefs}
        onApplyPreset={props.onApplyPreset}
      />
      <Btn label="Generate week" onPress={props.onGenerate} />

      {props.preview ? (
        <View style={styles.preview}>
          <Text style={styles.summaryMeta}>{props.totalTimeMin} min planned</Text>
          <GeneratePreviewDays
            preview={props.preview}
            workouts={props.workouts}
            onViewDay={props.onViewDay}
            onOpenDayMenu={props.onOpenDayMenu}
          />
          <GeneratePreviewApply applying={props.applying} onApply={props.onApply} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.md, gap: space.sm },
  header: { gap: 4 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  preview: { gap: space.sm, marginTop: space.md },
  summaryMeta: { color: colors.textMuted, fontSize: 13 },
});
