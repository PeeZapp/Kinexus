import { StyleSheet, View } from 'react-native';

import { colors } from '@/src/features/shell/theme';

type Region = 'shoulders' | 'torso' | 'arms' | 'core' | 'glutes' | 'legs';

const REGION_GROUPS: Record<Region, readonly string[]> = {
  shoulders: ['Shoulders', 'Full Body'],
  torso: ['Chest', 'Back', 'Full Body'],
  arms: ['Biceps', 'Triceps', 'Full Body'],
  core: ['Core', 'Full Body', 'Mobility'],
  glutes: ['Glutes', 'Full Body'],
  legs: ['Legs', 'Glutes', 'Cardio', 'Plyometrics', 'Full Body'],
};

function lit(groups: readonly string[], region: Region) {
  const set = new Set(groups.map((group) => group.toLowerCase()));
  return REGION_GROUPS[region].some((group) => set.has(group.toLowerCase()));
}

export function BodyMap({ muscleGroups }: { muscleGroups: readonly string[] }) {
  const on = (region: Region) => lit(muscleGroups, region);
  const active = muscleGroups.length > 0;

  return (
    <View
      style={[styles.root, active && styles.rootActive]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={[styles.head, styles.dim]} />
      <View style={styles.row}>
        <View style={[styles.arm, on('arms') ? styles.hot : styles.dim]} />
        <View style={styles.torsoCol}>
          <View style={[styles.shoulders, on('shoulders') ? styles.hot : styles.dim]} />
          <View style={[styles.torso, on('torso') ? styles.hot : styles.dim]} />
          <View style={[styles.core, on('core') ? styles.hot : styles.dim]} />
          <View style={[styles.glutes, on('glutes') ? styles.hot : styles.dim]} />
        </View>
        <View style={[styles.arm, on('arms') ? styles.hot : styles.dim]} />
      </View>
      <View style={styles.legRow}>
        <View style={[styles.leg, on('legs') ? styles.hot : styles.dim]} />
        <View style={[styles.leg, on('legs') ? styles.hot : styles.dim]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 48,
    height: 84,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    flexShrink: 0,
  },
  rootActive: {
    opacity: 1,
  },
  head: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
  torsoCol: {
    width: 22,
    gap: 2,
    alignItems: 'center',
  },
  shoulders: {
    width: 26,
    height: 7,
    borderRadius: 3,
  },
  torso: {
    width: 22,
    height: 14,
    borderRadius: 4,
  },
  core: {
    width: 18,
    height: 10,
    borderRadius: 3,
  },
  glutes: {
    width: 20,
    height: 7,
    borderRadius: 3,
  },
  arm: {
    width: 6,
    height: 30,
    borderRadius: 3,
    marginTop: 1,
  },
  legRow: {
    flexDirection: 'row',
    gap: 3,
  },
  leg: {
    width: 9,
    height: 24,
    borderRadius: 4,
  },
  hot: {
    backgroundColor: colors.accent,
  },
  dim: {
    backgroundColor: '#2A3646',
  },
});
