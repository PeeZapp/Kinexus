import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { colors } from '@/src/features/shell/theme';

export default function CalendarLayout() {
  return (
    <HouseholdGate module="Calendar">
      <View style={styles.root}>
        <Slot />
      </View>
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
