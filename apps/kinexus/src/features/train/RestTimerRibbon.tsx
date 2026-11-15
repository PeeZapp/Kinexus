import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';

import { clock } from '@/src/features/train/format';
import { useRestTimer } from '@/src/features/train/rest-timer-context';
import { colors, radius, space } from '@/src/features/shell/theme';

export function RestTimerRibbon() {
  const router = useRouter();
  const pathname = usePathname();
  const rest = useRestTimer();

  const awayFromSession = useMemo(() => {
    if (!rest.sessionPath) return false;
    return !pathname.startsWith(rest.sessionPath);
  }, [pathname, rest.sessionPath]);

  const visible = rest.active && (rest.minimized || awayFromSession);
  if (!visible) return null;

  const label = rest.label && rest.label !== 'Rest' ? rest.label : 'Rest';
  const time = clock(rest.remainingSec);

  function goToSession() {
    rest.expand();
    if (rest.sessionHref && awayFromSession) {
      router.push(rest.sessionHref as Href);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.ribbon}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rest timer ${time}, expand`}
          onPress={goToSession}
          style={({ pressed }) => [styles.copy, pressed && styles.pressed]}>
          <Text style={styles.time} numberOfLines={1}>
            {time}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand rest timer"
            onPress={goToSession}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.action}>Expand</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End rest"
            onPress={rest.dismiss}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.actionDanger}>Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  ribbon: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  pressed: { opacity: 0.9 },
  copy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  time: { color: colors.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { flex: 1, minWidth: 0, color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 0 },
  action: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  actionDanger: { color: colors.danger, fontSize: 13, fontWeight: '800' },
});
