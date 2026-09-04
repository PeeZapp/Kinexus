import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { MealsSubnav } from '@/src/features/meals/MealsSubnav';
import { MealsWeekProvider } from '@/src/features/meals/MealsWeekContext';
import { colors } from '@/src/features/shell/theme';

export default function MealsLayout() {
  return (
    <HouseholdGate module="Meals">
      <MealsWeekProvider>
        <View style={styles.root}>
          <MealsSubnav />
          <View style={styles.body}>
            <Slot />
          </View>
        </View>
      </MealsWeekProvider>
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
