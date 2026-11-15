import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';
import { useAlertsUnreadCount } from '@/src/features/alerts/use-alerts';

export function AlertsBell({ compact }: { compact?: boolean }) {
  const unread = useAlertsUnreadCount();
  const count = unread.data ?? 0;
  const label = count > 99 ? '99+' : String(count);

  return (
    <Link href="/alerts" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `Alerts, ${count} unread` : 'Alerts'}
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <View style={styles.glyphWrap}>
          <Text style={styles.glyph}>🔔</Text>
          {count > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ) : null}
        </View>
        {compact ? null : <Text style={styles.text}>Alerts</Text>}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.82 },
  glyphWrap: { position: 'relative', width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 16, lineHeight: 18 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.bgSidebar,
  },
  badgeLabel: { color: colors.bg, fontSize: 10, fontWeight: '800', paddingHorizontal: 1 },
  text: { color: colors.text, fontSize: 13, fontWeight: '700' },
});

