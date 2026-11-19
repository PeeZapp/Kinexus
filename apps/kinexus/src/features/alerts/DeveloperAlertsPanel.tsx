import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import {
  clearAllAlerts,
  clearReadAlerts,
  deleteAlert,
  markAlertRead,
  markAllAlertsRead,
} from '@/src/features/alerts/alerts-api';
import { useAlertsInbox, useAlertsUnreadCount } from '@/src/features/alerts/use-alerts';
import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { confirmAction } from '@/src/lib/confirm';

export function DeveloperAlertsPanel() {
  const inbox = useAlertsInbox(40, 'staff', true);
  const unread = useAlertsUnreadCount('staff', true);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = inbox.data ?? [];
  const unreadCount = unread.data ?? 0;
  const readCount = useMemo(() => items.filter((item) => item.readAt).length, [items]);

  const refresh = async () => {
    await Promise.all([
      inbox.refetch(),
      unread.refetch(),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    ]);
  };

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fail);
    } finally {
      setBusy(false);
    }
  };

  const onOpen = async (item: (typeof items)[number]) => {
    setError(null);
    try {
      await markAlertRead(item.id);
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch {
      // Non-blocking: still navigate.
    }
    if (item.href) router.push(item.href as never);
    else await refresh();
  };

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.title}>Developer alerts</Text>
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
          </View>
        ) : null}
      </View>

      <ErrorText
        message={
          error ??
          (inbox.error instanceof Error ? inbox.error.message : inbox.isError ? 'Could not load alerts.' : null)
        }
      />

      <View style={styles.actions}>
        <Btn
          label={unreadCount > 0 ? 'Mark all read' : 'Up to date'}
          variant="secondary"
          disabled={unreadCount === 0}
          busy={busy}
          onPress={() => void run(() => markAllAlertsRead('staff'), 'Could not mark alerts read')}
        />
        <Btn
          label="Clear read"
          variant="ghost"
          disabled={readCount === 0}
          busy={busy}
          onPress={() =>
            void (async () => {
              const ok = await confirmAction('Clear read developer alerts?', 'Removes alerts you’ve already opened.');
              if (!ok) return;
              await run(() => clearReadAlerts('staff'), 'Could not clear read alerts');
            })()
          }
        />
        <Btn
          label="Clear all"
          variant="danger"
          disabled={items.length === 0}
          busy={busy}
          onPress={() =>
            void (async () => {
              const ok = await confirmAction('Clear all developer alerts?', 'Removes every staff alert in your inbox.');
              if (!ok) return;
              await run(() => clearAllAlerts('staff'), 'Could not clear alerts');
            })()
          }
        />
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>No developer alerts</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const unreadRow = !item.readAt;
            return (
              <View key={item.id} style={[styles.row, unreadRow && styles.rowUnread]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onOpen(item)}
                  style={({ pressed }) => [styles.rowHit, pressed && styles.pressed]}>
                  <Text style={[styles.rowTitle, unreadRow && styles.rowTitleUnread]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
                  {item.body ? (
                    <Text style={styles.body} numberOfLines={2}>
                      {item.body}
                    </Text>
                  ) : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete alert"
                  disabled={busy}
                  onPress={() => void run(() => deleteAlert(item.id), 'Could not delete alert')}
                  hitSlop={8}
                  style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
                  <Text style={styles.deleteLabel}>Delete</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  list: { gap: 8 },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgHover,
    padding: space.md,
    gap: 10,
  },
  rowUnread: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
  },
  rowHit: { gap: 6 },
  pressed: { opacity: 0.86 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowTitleUnread: { color: colors.accent },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  body: { color: colors.text, fontSize: 13, lineHeight: 18 },
  deleteBtn: { alignSelf: 'flex-start' },
  deleteLabel: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
