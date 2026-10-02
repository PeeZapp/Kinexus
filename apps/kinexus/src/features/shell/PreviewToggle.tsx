import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import type { PreviewSurface } from '@/src/lib/pwa';

const SURFACES: { id: PreviewSurface; label: string }[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'phone', label: 'Phone' },
];

export function PreviewToggle() {
  const { previewEnabled, previewSurface, setPreview } = useExperienceMode();

  if (!previewEnabled) return null;

  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {SURFACES.map((surface) => {
        const selected = previewSurface === surface.id;
        const framed = surface.id !== 'desktop';
        return (
          <Pressable
            key={surface.id}
            onPress={() => setPreview(surface.id)}
            style={[styles.segment, selected && (framed ? styles.segmentOn : styles.segmentLive)]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}>
            <Text style={[styles.label, selected && styles.labelOn]}>{surface.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 3,
    gap: 2,
  },
  segment: {
    borderRadius: radius.xl,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  segmentLive: {
    backgroundColor: colors.bgHover,
  },
  segmentOn: {
    backgroundColor: colors.warningBg,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  labelOn: {
    color: colors.text,
  },
});
