import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import { useAiStatus } from '@/src/lib/ai-status-context';
import { useHousehold } from '@/src/lib/household';

export function AiBlockedBanner({ dismissible = true }: { dismissible?: boolean }) {
  const { blocked, bannerDismissed, dismissBanner, goFixKey } = useAiStatus();
  const { canManageHousehold } = useHousehold();

  if (!blocked) return null;
  if (dismissible && bannerDismissed) return null;

  const copy =
    blocked === 'no_access'
      ? 'AI features are off for you in this household'
      : "AI is paused: your household's AI key isn't working";

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{copy}</Text>
      <View style={styles.actions}>
        {blocked === 'key_paused' && canManageHousehold ? (
          <Pressable onPress={goFixKey} hitSlop={8}>
            <Text style={styles.action}>Fix</Text>
          </Pressable>
        ) : null}
        {dismissible ? (
          <Pressable onPress={dismissBanner} hitSlop={8}>
            <Text style={styles.dismiss}>Dismiss</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    marginBottom: space.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  text: { color: colors.text, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  action: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  dismiss: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
