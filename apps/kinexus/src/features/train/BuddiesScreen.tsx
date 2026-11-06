import { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import {
  trainBuddyEventLabel,
  type TrainBuddyPermissions,
} from '@kinexus/domain';

import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { PublicName } from '@/src/features/shell/PublicName';
import { colors, radius, space } from '@/src/features/shell/theme';
import { BuddyDetailSheet } from '@/src/features/train/BuddyDetailSheet';
import { BuddyPermissionsSheet } from '@/src/features/train/BuddyPermissionsSheet';
import { loadBuddySharedWorkouts, loadWorkouts, type WorkoutDraft } from '@/src/features/train/api';
import {
  blockTrainBuddy,
  cancelTrainTogether,
  createTrainBuddyInvite,
  highFiveTrainBuddyEvent,
  inviteTrainTogether,
  loadMyTrainBuddyInvites,
  loadTrainBuddies,
  loadTrainBuddyFeed,
  loadTrainTogetherInvites,
  removeTrainBuddy,
  requestTrainBuddyByUsername,
  respondTrainBuddyRequest,
  respondTrainTogether,
  revokeTrainBuddyInvite,
  searchTrainBuddyByUsername,
  type CreatedTrainBuddyInvite,
  type TrainBuddyConnection,
  type TrainBuddyFeedEvent,
  type TrainTogetherInvite,
} from '@/src/features/train/buddies-api';
import { TrainSettingsPanel } from '@/src/features/train/TrainSettingsPanel';
import {
  Badge,
  Card,
  Choice,
  Field,
  Pill,
  SearchField,
  Segmented,
  TextAction,
  TrainButton,
  TrainPage,
} from '@/src/features/train/ui';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

type HubTab = 'buddies' | 'activity' | 'together';

export function BuddiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const { mode } = useExperienceMode();
  const userId = user && !user.isDevBypass ? user.id : null;
  const wide = mode === 'desktop';

  const [tab, setTab] = useState<HubTab>('buddies');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [connections, setConnections] = useState<TrainBuddyConnection[]>([]);
  const [sharedWorkouts, setSharedWorkouts] = useState<WorkoutDraft[]>([]);
  const [myWorkouts, setMyWorkouts] = useState<WorkoutDraft[]>([]);
  const [invite, setInvite] = useState<CreatedTrainBuddyInvite | null>(null);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; expiresAt: string }[]>([]);
  const [feed, setFeed] = useState<TrainBuddyFeedEvent[]>([]);
  const [together, setTogether] = useState<TrainTogetherInvite[]>([]);
  const [detailBuddy, setDetailBuddy] = useState<TrainBuddyConnection | null>(null);
  const [permissionsBuddy, setPermissionsBuddy] = useState<TrainBuddyConnection | null>(null);
  const [busy, setBusy] = useState(false);

  const [togetherWorkoutId, setTogetherWorkoutId] = useState<string | null>(null);
  const [togetherBuddyIds, setTogetherBuddyIds] = useState<string[]>([]);
  const [togetherWhen, setTogetherWhen] = useState('');

  const refresh = useCallback(async () => {
    if (!userId) {
      setConnections([]);
      setPendingInvites([]);
      setSharedWorkouts([]);
      setMyWorkouts([]);
      setFeed([]);
      setTogether([]);
      return;
    }
    const [rows, invites, shared, events, togetherRows, workouts] = await Promise.all([
      loadTrainBuddies(userId),
      loadMyTrainBuddyInvites(),
      loadBuddySharedWorkouts(),
      loadTrainBuddyFeed(userId),
      loadTrainTogetherInvites(userId),
      activeHousehold ? loadWorkouts(activeHousehold.id) : Promise.resolve([] as WorkoutDraft[]),
    ]);
    setConnections(rows.filter((row) => row.status !== 'blocked'));
    setPendingInvites(
      invites
        .filter((row) => !row.acceptedAt && !row.revokedAt && new Date(row.expiresAt) > new Date())
        .map((row) => ({ id: row.id, expiresAt: row.expiresAt })),
    );
    setSharedWorkouts(shared.filter((workout) => workout.createdBy && workout.createdBy !== userId));
    setFeed(events);
    setTogether(togetherRows);
    setMyWorkouts(workouts.filter((workout) => workout.createdBy === userId));
  }, [activeHousehold, userId]);

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

  async function onInviteTogether() {
    if (!togetherWorkoutId || togetherBuddyIds.length === 0) {
      throw new Error('Pick a workout and at least one buddy');
    }
    const scheduledAt = togetherWhen.trim()
      ? new Date(togetherWhen.trim()).toISOString()
      : null;
    if (togetherWhen.trim() && Number.isNaN(Date.parse(togetherWhen.trim()))) {
      throw new Error('Use a valid date/time');
    }
    await inviteTrainTogether({
      workoutId: togetherWorkoutId,
      inviteeIds: togetherBuddyIds,
      scheduledAt,
    });
    setTogetherBuddyIds([]);
    setTogetherWhen('');
    setTab('together');
  }

  const incoming = connections.filter((row) => row.status === 'pending' && row.direction === 'incoming');
  const outgoing = connections.filter((row) => row.status === 'pending' && row.direction === 'outgoing');
  const accepted = connections.filter((row) => row.status === 'accepted');

  const pendingTogether = useMemo(
    () => together.filter((row) => row.status === 'pending'),
    [together],
  );
  const acceptedTogether = useMemo(
    () => together.filter((row) => row.status === 'accepted'),
    [together],
  );

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

        <TrainSettingsPanel />

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'buddies', label: 'Buddies' },
            { value: 'activity', label: 'Activity' },
            { value: 'together', label: 'Together' },
          ]}
        />

        {tab === 'buddies' ? (
          <>
            {sharedWorkouts.length > 0 ? (
              <Card>
                <Text style={styles.heading}>Shared with you</Text>
                {sharedWorkouts.map((workout) => (
                  <View key={workout.id} style={styles.row}>
                    <Text style={styles.meta}>{workout.name}</Text>
                    <TextAction label="Open" onPress={() => router.push(`/train/${workout.id}` as Href)} />
                  </View>
                ))}
              </Card>
            ) : null}

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
              <TrainButton
                label="Create invite"
                disabled={busy}
                onPress={() => void run(onCreateInvite)}
              />
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
                <Text style={styles.sectionTitle}>Requests</Text>
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
          </>
        ) : null}

        {tab === 'activity' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity</Text>
            {feed.length === 0 ? <Text style={styles.muted}>No buddy activity yet.</Text> : null}
            {feed.map((event) => (
              <Card key={event.id}>
                <PublicName user={event.actor} />
                <Text style={styles.eventTitle}>{trainBuddyEventLabel(event.eventType, event.title)}</Text>
                <Text style={styles.meta}>{new Date(event.createdAt).toLocaleString()}</Text>
                <View style={styles.actions}>
                  {event.workoutId ? (
                    <TextAction
                      label="Open"
                      onPress={() => router.push(`/train/${event.workoutId}` as Href)}
                    />
                  ) : null}
                  <TextAction
                    label={event.highFivedByMe ? `High-five · ${event.highFiveCount}` : 'High-five'}
                    tone={event.highFivedByMe ? 'muted' : 'accent'}
                    onPress={() => {
                      if (event.highFivedByMe) return;
                      void run(() => highFiveTrainBuddyEvent(event.id));
                    }}
                  />
                  {event.highFiveCount > 0 ? <Badge label={`${event.highFiveCount}`} /> : null}
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {tab === 'together' ? (
          <>
            <Card>
              <Text style={styles.heading}>Train together</Text>
              <Text style={styles.sectionTitle}>Workout</Text>
              <View style={styles.picks}>
                {myWorkouts.length === 0 ? <Text style={styles.muted}>Create a workout first.</Text> : null}
                {myWorkouts.map((workout) => (
                  <Choice
                    key={workout.id}
                    label={workout.name}
                    active={togetherWorkoutId === workout.id}
                    onPress={() => setTogetherWorkoutId(workout.id)}
                  />
                ))}
              </View>
              <Text style={styles.sectionTitle}>Buddies</Text>
              <View style={styles.picks}>
                {accepted.map((row) => {
                  const on = togetherBuddyIds.includes(row.otherUserId);
                  return (
                    <Choice
                      key={row.id}
                      label={row.profile.username || row.profile.globalHandle}
                      active={on}
                      onPress={() =>
                        setTogetherBuddyIds((current) =>
                          on
                            ? current.filter((id) => id !== row.otherUserId)
                            : [...current, row.otherUserId],
                        )
                      }
                    />
                  );
                })}
              </View>
              <Field
                value={togetherWhen}
                onChangeText={setTogetherWhen}
                placeholder="Optional schedule (YYYY-MM-DDTHH:mm)"
              />
              <TrainButton
                label="Invite"
                disabled={busy || !togetherWorkoutId || togetherBuddyIds.length === 0}
                onPress={() => void run(onInviteTogether)}
                fill
              />
            </Card>

            {pendingTogether.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending</Text>
                {pendingTogether.map((row) => (
                  <Card key={row.id}>
                    <PublicName user={row.otherProfile} />
                    <Text style={styles.eventTitle}>{row.workoutName}</Text>
                    {row.scheduledAt ? (
                      <Text style={styles.meta}>{new Date(row.scheduledAt).toLocaleString()}</Text>
                    ) : null}
                    <Pill label={row.direction === 'incoming' ? 'Incoming' : 'Sent'} />
                    <View style={styles.actions}>
                      {row.direction === 'incoming' ? (
                        <>
                          <TrainButton
                            label="Accept"
                            disabled={busy}
                            onPress={() => void run(() => respondTrainTogether(row.id, true))}
                          />
                          <TrainButton
                            label="Decline"
                            tone="ghost"
                            disabled={busy}
                            onPress={() => void run(() => respondTrainTogether(row.id, false))}
                          />
                        </>
                      ) : (
                        <TextAction
                          label="Cancel"
                          tone="danger"
                          onPress={() => void run(() => cancelTrainTogether(row.id))}
                        />
                      )}
                      <TextAction
                        label="Open"
                        onPress={() => router.push(`/train/${row.workoutId}` as Href)}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}

            {acceptedTogether.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Scheduled</Text>
                {acceptedTogether.map((row) => (
                  <Card key={row.id}>
                    <PublicName user={row.otherProfile} />
                    <Text style={styles.eventTitle}>{row.workoutName}</Text>
                    {row.scheduledAt ? (
                      <Text style={styles.meta}>{new Date(row.scheduledAt).toLocaleString()}</Text>
                    ) : (
                      <Text style={styles.meta}>No time set</Text>
                    )}
                    <View style={styles.actions}>
                      <TextAction
                        label="Open"
                        onPress={() => router.push(`/train/${row.workoutId}` as Href)}
                      />
                      <TextAction
                        label="Start"
                        tone="accent"
                        onPress={() => router.push(`/train/session/${row.workoutId}` as Href)}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
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
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
