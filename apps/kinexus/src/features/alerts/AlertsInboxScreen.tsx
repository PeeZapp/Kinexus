import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import {
  clearAllAlerts,
  clearReadAlerts,
  deleteAlert,
  markAlertRead,
  markAllAlertsRead,
} from '@/src/features/alerts/alerts-api';
import { alertSegmentLabel } from '@/src/features/alerts/segments';
import { useAlertsInbox, useAlertsUnreadCount } from '@/src/features/alerts/use-alerts';
import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { confirmAction } from '@/src/lib/confirm';

export function AlertsInboxScreen() {
  const inbox = useAlertsInbox(80);
  const unread = useAlertsUnreadCount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = inbox.data ?? [];
  const unreadCount = unread.data ?? 0;
  const readCount = useMemo(() => items.filter((item) => item.readAt).length, [items]);

  const rows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        segmentLabel: alertSegmentLabel(item.segment as never),
        unread: !item.readAt,
      })),
    [items],
  );

  const refresh = async () => {
    await Promise.all([inbox.refetch(), unread.refetch(), queryClient.invalidateQueries({ queryKey: ['alerts'] })]);
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

  const onMarkAllRead = () => void run(markAllAlertsRead, 'Could not mark alerts read');

  const onClearRead = async () => {
    const ok = await confirmAction('Clear read alerts?', 'Removes alerts you’ve already opened.');
    if (!ok) return;
    await run(clearReadAlerts, 'Could not clear read alerts');
  };

  const onClearAll = async () => {
    const ok = await confirmAction('Clear all alerts?', 'Removes every alert in your inbox.');
    if (!ok) return;
    await run(clearAllAlerts, 'Could not clear alerts');
  };

  const onDelete = (id: string) => void run(() => deleteAlert(id), 'Could not delete alert');

  const onOpen = async (id: string, href: string | null) => {
    setError(null);
    try {
      await markAlertRead(id);
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch {
      // Non-blocking: still navigate.
    }
    if (href) router.push(href as never);
    else await refresh();
  };

  if (inbox.isLoading) {
    return (
      <View style={styles.loading}>
        <LoadingState label="Opening alerts…" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={styles.title}>Alerts</Text>
        <View style={styles.headActions}>
          <Btn
            label={unreadCount > 0 ? 'Mark all read' : 'Up to date'}
            variant="secondary"
            disabled={unreadCount === 0}
            busy={busy}
            onPress={onMarkAllRead}
          />
          <Btn
            label="Clear read"
            variant="ghost"
            disabled={readCount === 0}
            busy={busy}
            onPress={() => void onClearRead()}
          />
          <Btn
            label="Clear all"
            variant="danger"
            disabled={items.length === 0}
            busy={busy}
            onPress={() => void onClearAll()}
          />
        </View>
      </View>

      <ErrorText
        message={
          error ??
          (inbox.error instanceof Error ? inbox.error.message : inbox.isError ? 'Could not load alerts.' : null)
        }
      />

      {rows.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No alerts</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {rows.map((item) => (
            <View
              key={item.id}
              style={[styles.row, item.unread && styles.rowUnread]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void onOpen(item.id, item.href)}
                style={({ pressed }) => [styles.rowHit, pressed && styles.rowPressed]}>
                <Text style={[styles.rowTitle, item.unread && styles.rowTitleUnread]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.segmentLabel}
                  </Text>
                  <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
                </View>
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
                onPress={() => onDelete(item.id)}
                hitSlop={8}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.rowPressed]}>
                <Text style={styles.deleteLabel}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.md,
    paddingBottom: space.xl,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    gap: space.md,
  },
  loading: { flex: 1, backgroundColor: colors.bg, padding: space.md },
  head: { gap: space.sm },
  headActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  list: { gap: 8 },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    padding: space.md,
    gap: 10,
  },
  rowUnread: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
  },
  rowHit: { gap: 6 },
  rowPressed: { opacity: 0.86 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  rowTitleUnread: { color: colors.accent },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  body: { color: colors.text, fontSize: 13, lineHeight: 18 },
  deleteBtn: { alignSelf: 'flex-start' },
  deleteLabel: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  emptyTitle: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
});
