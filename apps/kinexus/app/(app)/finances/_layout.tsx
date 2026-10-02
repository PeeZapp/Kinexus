import { canViewFinances } from '@kinexus/domain';
import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { FinancesSubnav } from '@/src/features/finances/FinancesSubnav';
import { EmptyState } from '@/src/features/shell/states';
import { colors } from '@/src/features/shell/theme';
import { useHousehold } from '@/src/lib/household';

export default function FinancesLayout() {
  const { role } = useHousehold();
  return (
    <HouseholdGate module="Money">
      {canViewFinances(role) ? (
      <View style={styles.root}>
        <FinancesSubnav />
        <View style={styles.body}>
          <Slot />
        </View>
      </View>
      ) : (
        <EmptyState title="Money is hidden" body="Teens and children cannot open the household budget or accounts." />
      )}
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
