import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { FinancesSubnav } from '@/src/features/finances/FinancesSubnav';
import { colors } from '@/src/features/shell/theme';

export default function FinancesLayout() {
  return (
    <HouseholdGate module="Money">
      <View style={styles.root}>
        <FinancesSubnav />
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
