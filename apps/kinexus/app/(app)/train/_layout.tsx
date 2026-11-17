import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AiChatConnectNudge } from '@/src/features/connectors/AiChatConnectNudge';
import { TrainSubnav } from '@/src/features/train/TrainSubnav';
import { TrainWeekProvider } from '@/src/features/train/TrainWeekContext';
import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { colors } from '@/src/features/shell/theme';

export default function TrainLayout() {
  return (
    <HouseholdGate module="Train">
      <TrainWeekProvider>
        <View style={styles.root}>
          <TrainSubnav />
          <AiChatConnectNudge section="train" />
          <View style={styles.body}>
            <Slot />
          </View>
        </View>
      </TrainWeekProvider>
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
