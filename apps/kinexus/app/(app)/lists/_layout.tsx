import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AiChatConnectNudge } from '@/src/features/connectors/AiChatConnectNudge';
import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { StashSubnav } from '@/src/features/stash/StashSubnav';
import { colors } from '@/src/features/shell/theme';

export default function ListsLayout() {
  return (
    <HouseholdGate module="Lists">
      <View style={styles.root}>
        <StashSubnav />
        <AiChatConnectNudge section="lists" />
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
