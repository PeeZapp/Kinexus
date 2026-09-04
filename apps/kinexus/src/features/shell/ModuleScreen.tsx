import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

type Props = {
  title: string;
  description: string;
  kicker?: string;
};

export function ModuleScreen({ title, description, kicker = 'Coming later' }: Props) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';

  return (
    <View style={[styles.root, desktop && styles.rootDesktop]}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>{title}</Text>
      <View style={[styles.card, desktop && styles.cardDesktop]}>
        <Text style={styles.body}>{description}</Text>
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
  },
  rootDesktop: {
    paddingHorizontal: 48,
    paddingTop: 48,
    maxWidth: 880,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: space.md,
  },
  titleDesktop: {
    fontSize: 40,
    marginBottom: space.lg,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  cardDesktop: {
    padding: space.lg,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
});
