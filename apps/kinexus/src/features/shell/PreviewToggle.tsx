import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function PreviewToggle() {
  const { previewEnabled, isPreview, setPreview } = useExperienceMode();

  if (!previewEnabled) return null;

  return (
    <Pressable
      onPress={() => setPreview(!isPreview)}
      style={[styles.pill, isPreview && styles.pillOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: isPreview }}>
      <View style={[styles.dot, isPreview && styles.dotOn]} />
      <Text style={styles.label}>{isPreview ? 'Desktop layout' : 'Mobile preview'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pillOn: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textDim,
  },
  dotOn: {
    backgroundColor: colors.warning,
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
