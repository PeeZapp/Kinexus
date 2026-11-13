import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';

import type { TrainBuddyPermissions } from '@kinexus/domain';

import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { PublicName } from '@/src/features/shell/PublicName';
import { colors, radius, space } from '@/src/features/shell/theme';
import { BuddyDetailSheet } from '@/src/features/train/BuddyDetailSheet';
import { BuddyPermissionsSheet } from '@/src/features/train/BuddyPermissionsSheet';
import {
  blockTrainBuddy,
  createTrainBuddyInvite,
  loadMyTrainBuddyInvites,
  loadTrainBuddies,
  removeTrainBuddy,
  requestTrainBuddyByUsername,
  respondTrainBuddyRequest,
  revokeTrainBuddyInvite,
  searchTrainBuddyByUsername,
  type CreatedTrainBuddyInvite,
  type TrainBuddyConnection,
} from '@/src/features/train/buddies-api';
import {
  Card,
  SearchField,
  TextAction,
  TrainButton,
  TrainPage,
} from '@/src/features/train/ui';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function BuddiesScreen() {
  const { user } = useAuth();
  const { mode } = useExperienceMode();
  const userId = user && !user.isDevBypass ? user.id : null;
  const wide = mode === 'desktop';

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [connections, setConnections] = useState<TrainBuddyConnection[]>([]);
  const [invite, setInvite] = useState<CreatedTrainBuddyInvite | null>(null);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; expiresAt: string }[]>([]);
  const [detailBuddy, setDetailBuddy] = useState<TrainBuddyConnection | null>(null);
  const [permissionsBuddy, setPermissionsBuddy] = useState<TrainBuddyConnection | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setConnections([]);
      setPendingInvites([]);
      return;
    }
    const [rows, invites] = await Promise.all([loadTrainBuddies(userId), loadMyTrainBuddyInvites()]);
    setConnections(rows.filter((row) => row.status !== 'blocked'));
    setPendingInvites(
      invites
        .filter((row) => !row.acceptedAt && !row.revokedAt && new Date(row.expiresAt) > new Date())
        .map((row) => ({ id: row.id, expiresAt: row.expiresAt })),
    );
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      refresh()
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load buddies');
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      return () => {
        cancelled = true;
      };
    }, [refresh]),
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onAddByUsername() {
    const found = await searchTrainBuddyByUsername(query);
    if (!found) throw new Error('No user with that @username');
    await requestTrainBuddyByUsername(query);
    setQuery('');
  }

  async function onCreateInvite() {
    const created = await createTrainBuddyInvite();
    setInvite(created);
    await Clipboard.setStringAsync(created.url);
  }

  const incoming = connections.filter((row) => row.status === 'pending' && row.direction === 'incoming');
  const outgoing = connections.filter((row) => row.status === 'pending' && row.direction === 'outgoing');
  const accepted = connections.filter((row) => row.status === 'accepted');

  if (!userId) {
    return (
      <TrainPage>
        <Text style={styles.muted}>Sign in to add gym buddies.</Text>
      </TrainPage>
    );
  }

  if (!ready) {
    return (
      <TrainPage>
        <LoadingState />
      </TrainPage>
    );
  }

  return (
    <TrainPage>
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]}>
        {error ? <ErrorBanner message={error} /> : null}

        <Card>
          <Text style={styles.heading}>Add by @username</Text>
          <SearchField value={query} onChangeText={setQuery} placeholder="@username" />
          <TrainButton
            label="Send request"
            disabled={busy || !query.trim()}
            onPress={() => void run(onAddByUsername)}
          />
        </Card>

        <Card>
          <Text style={styles.heading}>Invite link / QR</Text>
          <TrainButton label="Create invite" disabled={busy} onPress={() => void run(onCreateInvite)} />
          {invite ? (
            <View style={styles.inviteBox}>
              <Image source={{ uri: invite.qrUrl }} style={styles.qr} accessibilityLabel="Buddy invite QR code" />
              <Text selectable style={styles.mono}>
                {invite.url}
              </Text>
              <TrainButton
                label="Copy link"
                tone="ghost"
                onPress={() => void Clipboard.setStringAsync(invite.url)}
              />
              <Text style={styles.meta}>Expires {new Date(invite.expiresAt).toLocaleString()}</Text>
            </View>
          ) : null}
          {pendingInvites.length > 0 ? (
            <View style={styles.list}>
              {pendingInvites.map((row) => (
                <View key={row.id} style={styles.row}>
                  <Text style={styles.meta}>Pending · expires {new Date(row.expiresAt).toLocaleString()}</Text>
                  <TextAction
                    label="Revoke"
                    tone="danger"
                    onPress={() => void run(() => revokeTrainBuddyInvite(row.id))}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {incoming.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Buddy requests</Text>
            {incoming.map((row) => (
              <Card key={row.id}>
                <PublicName user={row.profile} />
                <View style={styles.actions}>
                  <TrainButton
                    label="Accept"
                    disabled={busy}
                    onPress={() => void run(() => respondTrainBuddyRequest(row.id, true))}
                  />
                  <TrainButton
                    label="Decline"
                    tone="ghost"
                    disabled={busy}
                    onPress={() => void run(() => respondTrainBuddyRequest(row.id, false))}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {outgoing.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sent</Text>
            {outgoing.map((row) => (
              <Card key={row.id}>
                <PublicName user={row.profile} />
                <TextAction
                  label="Cancel"
                  tone="danger"
                  onPress={() => void run(() => removeTrainBuddy(row.otherUserId))}
                />
              </Card>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buddies</Text>
          {accepted.length === 0 ? <Text style={styles.muted}>No gym buddies yet.</Text> : null}
          {accepted.map((row) => (
            <Card key={row.id} onPress={() => setDetailBuddy(row)}>
              <PublicName user={row.profile} />
              <View style={styles.actions}>
                <TextAction label="Open" onPress={() => setDetailBuddy(row)} />
                <TextAction label="Permissions" onPress={() => setPermissionsBuddy(row)} />
                <TextAction label="Remove" onPress={() => void run(() => removeTrainBuddy(row.otherUserId))} />
                <TextAction
                  label="Block"
                  tone="danger"
                  onPress={() => void run(() => blockTrainBuddy(row.otherUserId))}
                />
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      <BuddyDetailSheet
        buddy={detailBuddy}
        onClose={() => setDetailBuddy(null)}
        onOpenPermissions={() => {
          if (detailBuddy) {
            setPermissionsBuddy(detailBuddy);
            setDetailBuddy(null);
          }
        }}
      />

      <BuddyPermissionsSheet
        buddy={permissionsBuddy}
        onClose={() => setPermissionsBuddy(null)}
        onSaved={(buddyId, permissions: TrainBuddyPermissions) => {
          setConnections((current) =>
            current.map((row) => (row.otherUserId === buddyId ? { ...row, permissions } : row)),
          );
        }}
      />
    </TrainPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.xl },
  bodyWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  section: { gap: space.sm },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  muted: { color: colors.textMuted, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  inviteBox: { gap: space.sm, alignItems: 'center' },
  qr: { width: 180, height: 180, borderRadius: radius.md, backgroundColor: colors.bg },
  mono: { color: colors.textDim, fontSize: 12, alignSelf: 'stretch' },
  meta: { color: colors.textDim, fontSize: 12 },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
