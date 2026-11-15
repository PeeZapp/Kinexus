import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { ALERT_SEGMENTS, alertSegmentLabel, type AlertSegment } from '@/src/features/alerts/segments';
import { fetchDisabledAlertSegments, setAlertSegmentEnabled } from '@/src/features/alerts/alerts-api';
import { useAlertsUnreadCount } from '@/src/features/alerts/use-alerts';
import { Card, ErrorText } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

function prefsKey(householdId: string) {
  return ['alerts', 'prefs', householdId] as const;
}

export function AlertSettingsPanel() {
  const { activeHousehold } = useHousehold();
  const { user } = useAuth();
  const userId = user && !user.isDevBypass ? user.id : null;
  const householdId = activeHousehold?.id ?? null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const unread = useAlertsUnreadCount();

  const query = useQuery({
    queryKey: householdId ? prefsKey(householdId) : ['alerts', 'prefs', 'none'],
    enabled: Boolean(householdId && userId),
    queryFn: () => fetchDisabledAlertSegments(householdId!),
  });

  const [error, setError] = useState<string | null>(null);
  const disabled = query.data ?? new Set<string>();

  const toggles = useMemo(
    () =>
      ALERT_SEGMENTS.map((segment) => ({
        segment,
        label: alertSegmentLabel(segment),
        enabled: !disabled.has(segment),
      })),
    [disabled],
  );

  useEffect(() => {
    setError(null);
  }, [householdId]);

  const toggle = async (segment: AlertSegment, enabled: boolean) => {
    if (!householdId || !userId) return;
    setError(null);
    try {
      await setAlertSegmentEnabled(householdId, segment, enabled, userId);
      await queryClient.invalidateQueries({ queryKey: prefsKey(householdId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update alert settings');
    }
  };

  if (!householdId || !userId) return null;

  const unreadCount = unread.data ?? 0;

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.title}>Alerts</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/alerts')}
          style={({ pressed }) => [styles.inboxBtn, pressed && styles.pressed]}>
          <Text style={styles.inboxLabel}>Inbox</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ErrorText message={error ?? (query.error instanceof Error ? query.error.message : null)} />

      <View style={styles.list}>
        {toggles.map((row) => (
          <View key={row.segment} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Switch
              value={row.enabled}
              onValueChange={(next) => void toggle(row.segment, next)}
              thumbColor={row.enabled ? colors.bg : undefined}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  inboxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.84 },
  inboxLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  badgeLabel: { color: colors.bg, fontSize: 11, fontWeight: '900' },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 4,
  },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
});

