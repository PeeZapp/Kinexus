import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/src/features/household/ui';
import { EmptyState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

type Props = {
  title: string;
  description: string;
  kicker?: string;
  planned: string[];
  later: string;
};

export function ModuleScreen({ title, description, kicker = 'Coming later', planned, later }: Props) {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';

  return (
    <View style={[styles.root, desktop && styles.rootDesktop]}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
      <Text style={styles.lede}>{description}</Text>
      <View style={desktop ? styles.cols : styles.stack}>
        <View style={styles.col}>
          <EmptyState kicker="On the roadmap" title="What this module will do" body={later}>
            <View style={styles.list}>
              {planned.map((item) => (
                <View key={item} style={styles.row}>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.item}>{item}</Text>
                </View>
              ))}
            </View>
          </EmptyState>
        </View>
        <View style={styles.col}>
          <EmptyState
            kicker="Live now"
            title="Meals is ready"
            body="Plan the week, generate from the catalog, shop, and import recipes. Lists and Money are live; Nutrition and Train stay shells until those phases start.">
            <Btn label="Open Meals" onPress={() => router.push('/meals')} />
          </EmptyState>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    gap: 12,
  },
  rootDesktop: {
    paddingHorizontal: 48,
    paddingTop: 48,
    maxWidth: 1100,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  titleDesktop: {
    fontSize: 40,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 640,
  },
  cols: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  col: {
    flex: 1,
    minWidth: 280,
  },
  stack: {
    gap: 12,
  },
  list: {
    gap: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  dot: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 22,
  },
  item: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
});
