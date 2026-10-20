import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import {
  disconnectGoogleCalendar,
  loadGoogleCalendarStatus,
  loadGoogleCalendars,
  saveGoogleCalendarSettings,
  startGoogleCalendarConnect,
  type GoogleAccountStatus,
  type GoogleCalendarListItem,
} from '@/src/features/calendar/google-sync';
import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
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
}: {
  account: GoogleAccountStatus;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (value: string | null) => void;
  onNote: (value: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [calendars, setCalendars] = useState<GoogleCalendarListItem[]>(account.calendars ?? []);
  const [listError, setListError] = useState<string | null>(account.calendarsError ?? null);
  const [listing, setListing] = useState(false);
  const pullIds = new Set(account.pullCalendarIds ?? []);

  useEffect(() => {
    setCalendars(account.calendars ?? []);
    setListError(account.calendarsError ?? null);
  }, [account.id, account.connectedAt, account.calendars, account.calendarsError]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
    await queryClient.invalidateQueries({ queryKey: ['today-personal-google'] });
    await queryClient.invalidateQueries({ queryKey: ['calendar-personal-google'] });
  }

  async function reloadCalendars() {
    setListing(true);
    setListError(null);
    try {
      const list = await loadGoogleCalendars(account.id);
      setCalendars(list);
      if (list.length === 0) {
        setListError('Google returned no calendars for this account.');
      }
    } catch (err) {
      setCalendars([]);
      setListError(err instanceof Error ? err.message : 'Could not load calendars');
    } finally {
      setListing(false);
    }
  }

  async function onTogglePush(enabled: boolean) {
    onError(null);
    onBusy(true);
    try {
      await saveGoogleCalendarSettings({ connectionId: account.id, pushEnabled: enabled });
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update push setting');
    } finally {
      onBusy(false);
    }
  }

  async function onPickPush(calendarId: string) {
    onError(null);
    onBusy(true);
    try {
      await saveGoogleCalendarSettings({ connectionId: account.id, pushCalendarId: calendarId });
      await refresh();
      onNote(`Family events will push to that calendar on ${account.email || 'Google'}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not set push calendar');
    } finally {
      onBusy(false);
    }
  }

  async function onTogglePull(calendarId: string) {
    onError(null);
    onBusy(true);
    try {
      const next = new Set(pullIds);
      if (next.has(calendarId)) next.delete(calendarId);
      else next.add(calendarId);
      await saveGoogleCalendarSettings({ connectionId: account.id, pullCalendarIds: [...next] });
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update personal calendars');
    } finally {
      onBusy(false);
    }
  }

  async function onPullAll() {
    onError(null);
    onBusy(true);
    try {
      await saveGoogleCalendarSettings({
        connectionId: account.id,
        pullCalendarIds: calendars.map((cal) => cal.id),
      });
      await refresh();
      onNote(`Showing all calendars from ${account.email || 'Google'} in Kinexus.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update personal calendars');
    } finally {
      onBusy(false);
    }
  }

  async function onDisconnect() {
    onError(null);
    onNote(null);
    onBusy(true);
    try {
      await disconnectGoogleCalendar(account.id);
      await refresh();
      onNote(`Disconnected ${account.email || 'Google account'}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not disconnect');
    } finally {
      onBusy(false);
    }
  }

  return (
    <View style={styles.account}>
      <Text style={styles.accountEmail}>{account.email || 'Google account'}</Text>
      <Text style={styles.body}>
        {account.pushEnabled
          ? account.pushCalendarName
            ? `Pushing family events to ${account.pushCalendarName}.`
            : 'Push is on — pick a target calendar below.'
          : 'Push is off. Turn it on to send family events to Google.'}
      </Text>
      <View style={styles.row}>
        <Btn
          label={account.pushEnabled ? 'Push on' : 'Push off'}
          variant="secondary"
          onPress={() => void onTogglePush(!account.pushEnabled)}
          busy={busy}
        />
        <Btn label="Reload calendars" variant="secondary" onPress={() => void reloadCalendars()} busy={listing} />
        <Btn label="Remove" variant="secondary" onPress={() => void onDisconnect()} busy={busy} />
      </View>

      {listing ? <Text style={styles.body}>Loading calendars from Google…</Text> : null}
      {listError ? <ErrorText message={listError} /> : null}

      {calendars.length > 0 ? (
        <>
          <Text style={styles.sub}>Push family events to</Text>
          <View style={styles.wrapRow}>
            {calendars
              .filter((cal) => cal.writable)
              .map((cal) => (
                <Pressable
                  key={`push-${account.id}-${cal.id}`}
                  onPress={busy ? undefined : () => void onPickPush(cal.id)}
                  style={[styles.chip, account.pushCalendarId === cal.id && styles.chipActive]}>
                  <Text
                    style={[styles.chipLabel, account.pushCalendarId === cal.id && styles.chipLabelActive]}
                    numberOfLines={1}>
                    {cal.name}
                  </Text>
                </Pressable>
              ))}
          </View>
          <Text style={styles.sub}>Show in Kinexus (Today + Calendar)</Text>
          <View style={styles.row}>
            <Btn label="Show all calendars" variant="secondary" onPress={() => void onPullAll()} busy={busy} />
          </View>
          <View style={styles.wrapRow}>
            {calendars.map((cal) => (
              <Pressable
                key={`pull-${account.id}-${cal.id}`}
                onPress={busy ? undefined : () => void onTogglePull(cal.id)}
                style={[styles.chip, pullIds.has(cal.id) && styles.chipActive]}>
                <Text style={[styles.chipLabel, pullIds.has(cal.id) && styles.chipLabelActive]} numberOfLines={1}>
                  {cal.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : !listing && !listError ? (
        <Text style={styles.body}>No calendars loaded yet. Tap Reload calendars.</Text>
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
      setNote('Google account connected. If calendar chips are missing, tap Reload calendars.');
      void queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
    } else if (google === 'error') {
      setError(params.get('reason') || 'Google connect failed');
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
        setNote('Google account connected.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google connect');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={styles.heading}>Google Calendar</Text>
      <Text style={styles.body}>
        Connect one or more Google accounts. Push family events out per account. Choose which Google calendars to show
        in Kinexus (Today and Calendar).
      </Text>
      {!configured ? (
        <Text style={styles.body}>
          Server needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Add redirect URI{' '}
          <Text style={styles.mono}>/calendar/google/callback</Text> on the Google OAuth client.
        </Text>
      ) : null}
      {status.isLoading ? <Text style={styles.body}>Checking connection…</Text> : null}
      {accounts.map((account) => (
        <AccountBlock
          key={account.id}
          account={account}
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onNote={setNote}
        />
      ))}
      <Btn
        label={accounts.length > 0 ? 'Add another Google account' : 'Connect Google Calendar'}
        onPress={() => void onConnect()}
        busy={busy}
        disabled={!configured}
      />
      {note ? <Text style={styles.body}>{note}</Text> : null}
      <ErrorText message={error || (status.error instanceof Error ? status.error.message : null)} />
      {Platform.OS === 'web' && accounts.length > 0 ? (
        <Pressable onPress={() => void Linking.openURL('https://calendar.google.com')}>
          <Text style={styles.link}>Open Google Calendar</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  sub: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 8,
  },
  mono: {
    fontFamily: Platform.select({ web: 'ui-monospace, monospace', default: 'monospace' }),
    color: colors.text,
  },
  account: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginBottom: 12,
  },
  accountEmail: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: '100%',
    backgroundColor: colors.bg,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.text,
  },
  link: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: space.xs,
  },
});
