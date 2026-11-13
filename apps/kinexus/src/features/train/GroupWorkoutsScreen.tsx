import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { ProfileAvatar } from '@/src/features/shell/ProfileAvatar';
import { colors, space } from '@/src/features/shell/theme';
import {
  loadGlobalWorkouts,
  loadHiddenWorkoutIds,
  loadWorkouts,
  type WorkoutDraft,
} from '@/src/features/train/api';
import { loadTrainBuddies, type TrainBuddyConnection } from '@/src/features/train/buddies-api';
import { DecideJointSessionModal } from '@/src/features/train/DecideJointSessionModal';
import { GroupWorkoutFormSheet } from '@/src/features/train/GroupWorkoutFormSheet';
import { GroupWorkoutJoinSheet } from '@/src/features/train/GroupWorkoutJoinSheet';
import {
  listMyGroupWorkouts,
  type GroupWorkoutSummary,
} from '@/src/features/train/group-workouts-api';
import { InviteTogetherModal } from '@/src/features/train/InviteTogetherModal';
import {
  createTrainJointSession,
  decideTrainJointSession,
  jointSessionNeedsAlert,
  loadMyJointSessions,
  respondTrainJointSession,
  sessionTypeLabel,
  type InviteWorkoutOption,
  type JointSessionRow,
} from '@/src/features/train/joint-sessions-api';
import { RespondJointSessionModal } from '@/src/features/train/RespondJointSessionModal';
import { Card, Pill, TextAction, TrainButton, TrainPage } from '@/src/features/train/ui';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isActiveOrUpcomingGroup(group: GroupWorkoutSummary): boolean {
  if (group.status === 'cancelled' || group.status === 'built') return false;
  return group.workoutDate >= todayIso();
}

function isActiveOrUpcomingJoint(session: JointSessionRow): boolean {
  if (session.status === 'cancelled') return false;
  return new Date(session.scheduledAt).getTime() >= Date.now();
}

function groupStatusChip(group: GroupWorkoutSummary): string {
  if (group.status === 'closed') return 'Ready';
  const closes = new Date(group.closesAt);
  const day = closes.toLocaleDateString(undefined, { weekday: 'short' });
  const time = closes.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `Picking · closes ${day} ${time}`;
}

function toInviteWorkout(
  workout: {
    id: string;
    name: string;
    exercises: readonly { name: string; targetSets: number; supersetId?: string | null }[];
  },
  origin: InviteWorkoutOption['origin'],
): InviteWorkoutOption {
  return {
    id: workout.id,
    name: workout.name,
    origin,
    exercises: workout.exercises.map((exercise) => ({
      name: exercise.name,
      targetSets: exercise.targetSets,
      supersetId: exercise.supersetId ?? null,
    })),
  };
}

export function GroupWorkoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold, members } = useHousehold();
  const { mode } = useExperienceMode();
  const userId = user && !user.isDevBypass ? user.id : null;
  const wide = mode === 'desktop';

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupWorkouts, setGroupWorkouts] = useState<GroupWorkoutSummary[]>([]);
  const [connections, setConnections] = useState<TrainBuddyConnection[]>([]);
  const [inviteWorkouts, setInviteWorkouts] = useState<InviteWorkoutOption[]>([]);
  const [sessions, setSessions] = useState<JointSessionRow[]>([]);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupJoinOpen, setGroupJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupWorkoutSummary | null>(null);
  const [respondSession, setRespondSession] = useState<JointSessionRow | null>(null);
  const [decideSession, setDecideSession] = useState<JointSessionRow | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setGroupWorkouts([]);
      setConnections([]);
      setInviteWorkouts([]);
      setSessions([]);
      return;
    }
    const [groups, rows, householdWorkouts, globalWorkouts, joint, hiddenIds] = await Promise.all([
      listMyGroupWorkouts(),
      loadTrainBuddies(userId),
      activeHousehold ? loadWorkouts(activeHousehold.id) : Promise.resolve([] as WorkoutDraft[]),
      loadGlobalWorkouts(userId),
      loadMyJointSessions(userId),
      loadHiddenWorkoutIds(userId),
    ]);
    setGroupWorkouts(groups.filter(isActiveOrUpcomingGroup));
    setConnections(rows.filter((row) => row.status === 'accepted'));
    setSessions(joint.filter(isActiveOrUpcomingJoint));

    const hidden = new Set(hiddenIds);
    const seen = new Set<string>();
    const merged: InviteWorkoutOption[] = [];
    for (const workout of householdWorkouts) {
      if (hidden.has(workout.id) || seen.has(workout.id)) continue;
      seen.add(workout.id);
      merged.push(toInviteWorkout(workout, 'yours'));
    }
    for (const workout of globalWorkouts) {
      if (hidden.has(workout.id) || seen.has(workout.id)) continue;
      seen.add(workout.id);
      merged.push(toInviteWorkout(workout, 'global'));
    }
    setInviteWorkouts(merged);
  }, [activeHousehold, userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      refresh()
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load group sessions');
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

  const invitePeople = useMemo(() => {
    const family = members
      .filter((member) => member.userId !== userId)
      .map((member) => ({
        id: member.userId,
        name: member.profile.username || member.profile.displayName || member.profile.globalHandle || 'Family',
        kind: 'family' as const,
      }));
    const buddyRows = connections.map((row) => ({
      id: row.otherUserId,
      name: row.profile.username || row.profile.globalHandle || 'Buddy',
      kind: 'buddy' as const,
    }));
    const seen = new Set(family.map((row) => row.id));
    return [...family, ...buddyRows.filter((row) => !seen.has(row.id))];
  }, [connections, members, userId]);

  const workoutNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const workout of inviteWorkouts) map[workout.id] = workout.name;
    return map;
  }, [inviteWorkouts]);

  const pendingJoint = sessions.filter(
    (row) =>
      row.members.some(
        (member) => member.userId === userId && member.role === 'invitee' && member.inviteStatus === 'pending',
      ),
  );
  const openJoint = sessions.filter((row) => row.status !== 'cancelled');
  const alerts = userId
    ? sessions
        .map((row) => ({ row, message: jointSessionNeedsAlert(row, userId) }))
        .filter((item): item is { row: JointSessionRow; message: string } => Boolean(item.message))
    : [];

  if (!ready) {
    return (
      <TrainPage>
        <LoadingState />
      </TrainPage>
    );
  }

  const emptyList = groupWorkouts.length === 0 && openJoint.length === 0 && pendingJoint.length === 0;

  return (
    <TrainPage>
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]}>
        {error ? <ErrorBanner message={error} /> : null}

        {alerts.map(({ row, message }) => (
          <Card key={`alert-${row.id}`}>
            <Text style={styles.title}>Needs your pick</Text>
            <Text style={styles.meta}>{message}</Text>
            <TextAction label="Choose" onPress={() => setDecideSession(row)} />
          </Card>
        ))}

        <View style={styles.actions}>
          <TrainButton
            label="Invite Buddies"
            disabled={busy || !activeHousehold || !userId}
            onPress={() => setInviteOpen(true)}
          />
          <TrainButton
            label="New group workout"
            tone="ghost"
            onPress={() => {
              setEditingGroup(null);
              setGroupFormOpen(true);
            }}
          />
          <TrainButton label="Join with code" tone="ghost" onPress={() => setGroupJoinOpen(true)} />
        </View>

        {pendingJoint.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Train invites</Text>
            {pendingJoint.map((row) => (
              <Card key={row.id}>
                <Text style={styles.title}>
                  {new Date(row.scheduledAt).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.meta}>{row.offeredSessionTypeIds.map(sessionTypeLabel).join(' · ')}</Text>
                <TextAction label="Respond" onPress={() => setRespondSession(row)} />
              </Card>
            ))}
          </View>
        ) : null}

        {emptyList ? <Text style={styles.muted}>No upcoming group sessions.</Text> : null}

        {openJoint.map((row) => {
          const acceptedNames = row.members
            .filter((member) => member.inviteStatus === 'accepted' && member.role === 'invitee')
            .map((member) => member.profile.username || member.profile.globalHandle);
          return (
            <Card key={`s-${row.id}`}>
              <Text style={styles.title}>
                {new Date(row.scheduledAt).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={styles.meta}>
                {row.resolvedSessionTypeId
                  ? sessionTypeLabel(row.resolvedSessionTypeId)
                  : 'Session with buddies'}
                {acceptedNames.length > 0 ? ` · ${acceptedNames.join(', ')}` : ''}
              </Text>
              <Pill
                label={row.status === 'resolved' ? 'Locked' : row.needsInviterDecision ? 'Needs pick' : 'Open'}
              />
              {row.inviterId === userId && row.needsInviterDecision ? (
                <TextAction label="Choose" onPress={() => setDecideSession(row)} />
              ) : null}
            </Card>
          );
        })}

        {groupWorkouts.map((group) => (
          <Card key={group.id} onPress={() => router.push(`/train/group/${group.id}` as Href)}>
            <Text style={styles.title}>{group.title}</Text>
            <Text style={styles.meta}>
              {new Date(`${group.workoutDate}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <Pill label={groupStatusChip(group)} />
            <View style={styles.avatarRow}>
              {group.members.slice(0, 6).map((member) => (
                <ProfileAvatar key={member.id} avatarUrl={member.avatarUrl} size={28} />
              ))}
            </View>
            <Text style={styles.meta}>
              {group.myPickCount} of {group.picksPerPerson} picks
            </Text>
            <View style={styles.actions}>
              <TextAction label="Open" onPress={() => router.push(`/train/group/${group.id}` as Href)} />
              {group.creatorId === userId && group.status === 'picking' ? (
                <TextAction
                  label="Edit"
                  onPress={() => {
                    setEditingGroup(group);
                    setGroupFormOpen(true);
                  }}
                />
              ) : null}
            </View>
          </Card>
        ))}
      </ScrollView>

      <InviteTogetherModal
        visible={inviteOpen}
        invitees={invitePeople}
        workouts={inviteWorkouts}
        busy={busy}
        onClose={() => setInviteOpen(false)}
        onSubmit={async (payload) => {
          if (!activeHousehold) throw new Error('Household required');
          await run(async () => {
            await createTrainJointSession({
              householdId: activeHousehold.id,
              scheduledAt: payload.scheduledAt,
              inviteeIds: payload.inviteeIds,
              offeredSessionTypeIds: payload.offeredSessionTypeIds,
              offeredWorkoutIds: payload.offeredWorkoutIds,
              inviterSessionTypeId: payload.inviterSessionTypeId,
              inviterWorkoutId: payload.inviterWorkoutId,
            });
            setInviteOpen(false);
          });
        }}
      />

      <RespondJointSessionModal
        visible={Boolean(respondSession)}
        session={respondSession}
        workoutNames={workoutNames}
        busy={busy}
        onClose={() => setRespondSession(null)}
        onRespond={async ({ accept, sessionTypeId, workoutId }) => {
          if (!respondSession || !activeHousehold || !userId) return;
          await run(async () => {
            await respondTrainJointSession({
              sessionId: respondSession.id,
              userId,
              accept,
              householdId: activeHousehold.id,
              sessionTypeId,
              workoutId,
            });
            setRespondSession(null);
          });
        }}
      />

      <DecideJointSessionModal
        visible={Boolean(decideSession)}
        session={decideSession}
        workoutNames={workoutNames}
        busy={busy}
        onClose={() => setDecideSession(null)}
        onDecide={async ({ sessionTypeId, workoutId }) => {
          if (!decideSession || !userId) return;
          await run(async () => {
            await decideTrainJointSession({
              sessionId: decideSession.id,
              sessionTypeId,
              workoutId,
              userId,
            });
            setDecideSession(null);
          });
        }}
      />

      <GroupWorkoutFormSheet
        visible={groupFormOpen}
        editing={editingGroup}
        buddies={connections}
        onClose={() => {
          setGroupFormOpen(false);
          setEditingGroup(null);
        }}
        onSaved={(result) => {
          void refresh().catch((err: unknown) =>
            setError(err instanceof Error ? err.message : 'Could not refresh'),
          );
          if (result.joinCode) return;
          setGroupFormOpen(false);
          setEditingGroup(null);
          if (result.id) router.push(`/train/group/${result.id}` as Href);
        }}
      />
      <GroupWorkoutJoinSheet
        visible={groupJoinOpen}
        onClose={() => setGroupJoinOpen(false)}
        onJoined={(id) => {
          void refresh();
          router.push(`/train/group/${id}` as Href);
        }}
      />
    </TrainPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.xl },
  bodyWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { gap: space.sm },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 14 },
  avatarRow: { flexDirection: 'row', gap: 6 },
});
