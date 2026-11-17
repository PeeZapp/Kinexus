import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import {
  disconnectGoogleCalendar,
  loadGoogleCalendarStatus,
  startGoogleCalendarConnect,
  type GoogleAccountStatus,
} from '@/src/features/calendar/google-sync';
import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';
import { useHousehold } from '@/src/lib/household';

function canConnectGoogle(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'adult';
}

function AccountBlock({
  account,
  busy,
  onBusy,
  onError,
  onNote,
  onReconnect,
}: {
  account: GoogleAccountStatus;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (value: string | null) => void;
  onNote: (value: string | null) => void;
  onReconnect: () => void;
}) {
  const queryClient = useQueryClient();
  const needsReauth = Boolean(account.needsReauth);

  async function onDisconnect() {
    onError(null);
    onNote(null);
    onBusy(true);
    try {
      await disconnectGoogleCalendar(account.id);
      await queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      await queryClient.invalidateQueries({ queryKey: ['today-personal-google'] });
      await queryClient.invalidateQueries({ queryKey: ['calendar-personal-google'] });
      onNote(`Disconnected ${account.email || 'Google account'}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not disconnect');
    } finally {
      onBusy(false);
    }
  }

  return (
    <View style={styles.account}>
      <View style={styles.accountHead}>
        <Text style={styles.accountEmail} numberOfLines={1}>
          {account.email || 'Google account'}
        </Text>
        <View style={styles.accountActions}>
          {needsReauth ? <Btn label="Reconnect" onPress={onReconnect} busy={busy} /> : null}
          <Btn
            label="Disconnect"
            variant="secondary"
            onPress={() => void onDisconnect()}
            busy={busy}
          />
        </View>
      </View>
      {needsReauth ? (
        <ErrorText
          message={
            account.authError ||
            account.calendarsError ||
            'Google access expired. Reconnect to restore sync.'
          }
        />
      ) : null}
    </View>
  );
}

export function GoogleCalendarPanel() {
  const { role, activeHousehold } = useHousehold();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['google-calendar-status'],
    queryFn: loadGoogleCalendarStatus,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    if (!google) return;
    if (google === 'connected') {
      setNote('Connected. Your calendars sync both ways.');
      void queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      void queryClient.invalidateQueries({ queryKey: ['today-personal-google'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar-personal-google'] });
    } else if (google === 'error') {
      const reason = params.get('reason') || 'Google connect failed';
      setError(
        reason === 'missing_calendar_scope'
          ? 'Google did not grant Calendar access. On the Google screen, leave Calendar checked, then connect again.'
          : reason,
      );
    }
    params.delete('google');
    params.delete('reason');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  }, [queryClient]);

  if (!activeHousehold || !canConnectGoogle(role)) return null;

  const accounts = status.data?.accounts ?? [];
  const configured = status.data?.configured !== false;

  async function onConnect() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const url = await startGoogleCalendarConnect();
      if (Platform.OS === 'web') {
        window.location.assign(url);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(url, undefined);
      if (result.type === 'success') {
        await queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
        await queryClient.invalidateQueries({ queryKey: ['today-personal-google'] });
        await queryClient.invalidateQueries({ queryKey: ['calendar-personal-google'] });
        setNote('Connected. Your calendars sync both ways.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google connect');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.cardFill}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Google Calendar</Text>
      </View>
      {!configured ? (
        <Text style={styles.meta}>
          Server needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Redirect URI{' '}
          <Text style={styles.mono}>/calendar/google/callback</Text>
        </Text>
      ) : null}
      {status.isLoading ? <Text style={styles.meta}>Checking connection…</Text> : null}
      {accounts.map((account) => (
        <AccountBlock
          key={account.id}
          account={account}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onNote={setNote}
          onReconnect={() => void onConnect()}
        />
      ))}
      {note ? <Text style={styles.meta}>{note}</Text> : null}
      <ErrorText message={error || (status.error instanceof Error ? status.error.message : null)} />
      <View style={styles.footerSpacer} />
      <Btn
        label={accounts.length > 0 ? 'Connect another account' : 'Connect'}
        onPress={() => void onConnect()}
        busy={busy}
        disabled={!configured}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  cardFill: {
    flex: 1,
  },
  footerSpacer: {
    flexGrow: 1,
    minHeight: 0,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  heading: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  meta: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
  mono: {
    fontFamily: Platform.select({ web: 'ui-monospace, monospace', default: 'monospace' }),
    color: colors.text,
  },
  account: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  accountHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  accountEmail: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  accountActions: {
    flexDirection: 'row',
    flexShrink: 0,
    alignItems: 'center',
    gap: 8,
  },
});
