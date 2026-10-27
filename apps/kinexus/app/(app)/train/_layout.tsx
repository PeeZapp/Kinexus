import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TrainSubnav } from '@/src/features/train/TrainSubnav';
import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { colors } from '@/src/features/shell/theme';

export default function TrainLayout() {
  return (
    <HouseholdGate module="Train">
      <View style={styles.root}>
        <TrainSubnav />
        <View style={styles.body}>
          <Slot />
        </View>
      </View>
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
