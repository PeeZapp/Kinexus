import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/src/features/shell/theme';

/** Bottom toast above the mobile tab bar (~56px + safe area). */
const TAB_BAR_OFFSET = 56;

export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  visible,
  durationMs = 5000,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  visible: boolean;
  durationMs?: number;
}) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onDismiss?.(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss, visible]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: TAB_BAR_OFFSET + Math.max(insets.bottom, 10) + space.sm }]}>
      <View style={styles.toast}>
        <Text style={styles.message}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    zIndex: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  action: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
