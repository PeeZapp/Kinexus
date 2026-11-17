import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SettingsSubnav } from '@/src/features/household/SettingsSubnav';
import { colors } from '@/src/features/shell/theme';

export default function SettingsLayout() {
  return (
    <View style={styles.root}>
      <SettingsSubnav />
      <View style={styles.body}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
