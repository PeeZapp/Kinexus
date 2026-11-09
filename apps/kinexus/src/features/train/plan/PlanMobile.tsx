import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlanBoard } from '@/src/features/train/plan/PlanBoard';
import type { TrainPlanViewProps } from '@/src/features/train/plan/PlanDesktop';
import { space } from '@/src/features/shell/theme';

export function PlanMobile(props: TrainPlanViewProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <PlanBoard {...props} compact />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: space.md, padding: space.md },
});
