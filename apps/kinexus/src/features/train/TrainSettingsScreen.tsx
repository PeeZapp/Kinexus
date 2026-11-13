import { ScrollView, StyleSheet } from 'react-native';

import { TrainSettingsPanel } from '@/src/features/train/TrainSettingsPanel';
import { TrainPage } from '@/src/features/train/ui';
import { space } from '@/src/features/shell/theme';

export function TrainSettingsScreen() {
  return (
    <TrainPage>
      <ScrollView contentContainerStyle={styles.content}>
        <TrainSettingsPanel />
      </ScrollView>
    </TrainPage>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingBottom: space.lg },
});
