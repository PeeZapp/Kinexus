import { StyleSheet, View } from 'react-native';

import { AiChatConnectNudge } from '@/src/features/connectors/AiChatConnectNudge';
import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { TodayScreen } from '@/src/features/today/TodayScreen';

export default function TodayRoute() {
  return (
    <HouseholdGate module="Today">
      <View style={styles.root}>
        <AiChatConnectNudge section="today" />
        <TodayScreen />
      </View>
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
