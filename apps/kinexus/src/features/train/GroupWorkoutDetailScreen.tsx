import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { formatTrackingTarget, orderGroupPicks } from '@kinexus/domain';

import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { ProfileAvatar } from '@/src/features/shell/ProfileAvatar';
import { PublicName, publicPrimaryName } from '@/src/features/shell/PublicName';
import { colors, radius, space } from '@/src/features/shell/theme';
import { confirmAction } from '@/src/features/train/confirm';
import { exerciseTitle } from '@/src/features/train/format';
import {
  addGroupWorkoutPick,
  addMyGroupWorkoutToLibrary,
  cancelGroupWorkout,
  copyGroupWorkoutToLibrary,
  getGroupWorkout,
  leaveGroupWorkout,
  removeGroupWorkoutPick,
  type GroupWorkoutDetail,
  type GroupWorkoutPick,
} from '@/src/features/train/group-workouts-api';
import { GroupWorkoutFormSheet } from '@/src/features/train/GroupWorkoutFormSheet';
import { GroupWorkoutPickSheet } from '@/src/features/train/GroupWorkoutPickSheet';
import { loadTrainBuddies, type TrainBuddyConnection } from '@/src/features/train/buddies-api';
import { Badge, Pill, TextAction, TrainButton, TrainPage } from '@/src/features/train/ui';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

function closesLabel(closesAt: string): string {
  const closes = new Date(closesAt);
  const day = closes.toLocaleDateString(undefined, { weekday: 'short' });
  const time = closes.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time}`;
}

function statusChip(detail: GroupWorkoutDetail): string {
  if (detail.status === 'cancelled') return 'Cancelled';
  if (detail.status === 'closed' || detail.status === 'built') return 'Ready';
  return `Picking · closes ${closesLabel(detail.closesAt)}`;
}

function groupPicksByCategory(detail: GroupWorkoutDetail): { category: string; picks: GroupWorkoutPick[] }[] {
  const buckets = new Map<string, GroupWorkoutPick[]>();
  for (const category of detail.categories) buckets.set(category, []);
  for (const pick of detail.picks) {
    const list = buckets.get(pick.category) ?? [];
    list.push(pick);
    buckets.set(pick.category, list);
  }
  const ordered = detail.categories
    .map((category) => ({ category, picks: buckets.get(category) ?? [] }))
    .filter((row) => row.picks.length > 0);
  for (const [category, picks] of buckets) {
    if (detail.categories.includes(category) || picks.length === 0) continue;
    ordered.push({ category, picks });
  }
  return ordered;
}

export function GroupWorkoutDetailScreen() {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const userId = user && !user.isDevBypass ? user.id : null;
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = rawId?.trim() ?? '';

  const [detail, setDetail] = useState<GroupWorkoutDetail | null>(null);
  const [buddies, setBuddies] = useState<TrainBuddyConnection[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const wide = mode === 'desktop';

  const refresh = useCallback(async () => {
    if (!id || !userId) {
      setDetail(null);
      return;
    }
    const [next, rows] = await Promise.all([getGroupWorkout(id), loadTrainBuddies(userId)]);
    setDetail(next);
    setBuddies(rows.filter((row) => row.status !== 'blocked'));
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      refresh()
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load group workout');
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
      return () => {
        cancelled = true;
      };
    }, [refresh]),
  );

  const myPickCount = useMemo(() => {
    if (!detail || !userId) return 0;
    return detail.picks.filter((pick) => pick.userId === userId).length;
  }, [detail, userId]);

  const pickedMeta = useMemo(() => {
    if (!detail) return [];
    return detail.picks.map((pick) => {
      const member = detail.members.find((row) => row.userId === pick.userId);
      return {
        exerciseId: pick.exerciseId,
        byName: member ? publicPrimaryName(member.profile) : 'Someone',
      };
    });
  }, [detail]);

  if (!userId) {
    return (
      <TrainPage>
        <Text style={styles.muted}>Sign in to view this group workout.</Text>
      </TrainPage>
    );
  }

  if (!ready || !detail) {
    return (
      <TrainPage>
        {error ? <ErrorBanner message={error} /> : <LoadingState />}
      </TrainPage>
    );
  }

  const isCreator = detail.creatorId === userId;
  const picking = detail.status === 'picking';
  const built = detail.status === 'built' || detail.status === 'closed';
  const cancelled = detail.status === 'cancelled';
  const myWorkout = detail.myWorkout;
  const lateJoiner = built && !myWorkout;
  const canAddPick = picking && myPickCount < detail.picksPerPerson;
  const pickGroups = groupPicksByCategory(detail);
  const orderedBuilt =
    myWorkout?.exercises ??
    orderGroupPicks(
      detail.picks.map((pick) => ({
        id: pick.id,
        userId: pick.userId,
        exerciseId: pick.exerciseId,
        category: pick.category,
        name: pick.exerciseName,
        canonicalKey: pick.canonicalKey,
        instructions: pick.instructions,
        targetUnit: pick.targetUnit,
        createdAt: pick.createdAt,
      })),
    );

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }

  async function onRemovePick(pickId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeGroupWorkoutPick(pickId);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove pick');
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (busy) return;
    const ok = await confirmAction('Cancel this group workout?', 'Members lose access to picking.');
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await cancelGroupWorkout(detail.id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  async function onLeave() {
    if (busy) return;
    const ok = await confirmAction('Leave this group workout?', picking ? 'Your picks will be removed.' : undefined);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await leaveGroupWorkout(detail.id);
      router.push('/train/buddies' as Href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not leave');
      setBusy(false);
    }
  }

  async function onAddToLibrary() {
    if (!myWorkout || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addMyGroupWorkoutToLibrary(myWorkout.id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add to library');
    } finally {
      setBusy(false);
    }
  }

  async function onCopyToLibrary() {
    if (!activeHousehold || busy) return;
    setBusy(true);
    setError(null);
    try {
      await copyGroupWorkoutToLibrary({
        groupWorkoutId: detail.id,
        householdId: activeHousehold.id,
        userId,
      });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not copy workout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TrainPage>
      <ScrollView
        contentContainerStyle={[styles.body, wide && styles.bodyWide]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        {error ? <ErrorBanner message={error} /> : null}

        <View style={styles.header}>
          <Text style={styles.title}>{detail.title}</Text>
          <Pill label={statusChip(detail)} />
          <Text style={styles.meta}>
            {new Date(`${detail.workoutDate}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          <View style={styles.cats}>
            {detail.categories.map((category) => (
              <Badge key={category} label={category} />
            ))}
          </View>
        </View>

        {cancelled ? (
          <Text style={styles.muted}>Cancelled</Text>
        ) : null}

        {picking ? (
          <>
            <Text style={styles.progress}>
              {`You've picked ${myPickCount} of ${detail.picksPerPerson} · closes ${closesLabel(detail.closesAt)}`}
            </Text>

            {pickGroups.map((group) => (
              <View key={group.category} style={styles.section}>
                <Text style={styles.sectionTitle}>{group.category}</Text>
                {group.picks.map((pick) => {
                  const member = detail.members.find((row) => row.userId === pick.userId);
                  const mine = pick.userId === userId;
                  const target = formatTrackingTarget({
                    targetSets: pick.targetSets,
                    targetReps: pick.targetReps,
                    targetUnit: pick.targetUnit,
                    targetDurationSec: pick.targetDurationSec,
                    targetDistanceKm: pick.targetDistanceKm,
                  });
                  return (
                    <View key={pick.id} style={styles.pickRow}>
                      <ProfileAvatar avatarUrl={member?.profile.avatarUrl ?? null} size={32} />
                      <View style={styles.pickCopy}>
                        <Text style={styles.pickName} numberOfLines={1}>
                          {exerciseTitle(pick.exerciseName)}
                        </Text>
                        <Text style={styles.pickMeta} numberOfLines={1}>
                          {member ? publicPrimaryName(member.profile) : 'Someone'}
                          {target ? ` · ${target}` : ''}
                        </Text>
                      </View>
                      {mine ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove pick"
                          disabled={busy}
                          onPress={() => void onRemovePick(pick.id)}
                          hitSlop={8}
                          style={styles.removeBtn}>
                          <Text style={styles.removeGlyph}>×</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}

            {canAddPick ? (
              <TrainButton label="Add exercise" fill onPress={() => setPickOpen(true)} disabled={busy} />
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Members</Text>
              {detail.members.map((member) => (
                <View key={member.userId} style={styles.memberRow}>
                  <ProfileAvatar avatarUrl={member.profile.avatarUrl} size={36} />
                  <PublicName user={member.profile} />
                  {member.userId === detail.creatorId ? <Badge label="Creator" /> : null}
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <TextAction label="Back" onPress={() => router.push('/train/buddies' as Href)} />
              {isCreator ? (
                <>
                  <TrainButton label="Edit" tone="ghost" onPress={() => setEditOpen(true)} disabled={busy} />
                  <TrainButton label="Cancel" tone="danger" onPress={() => void onCancel()} disabled={busy} />
                </>
              ) : (
                <TrainButton label="Leave" tone="ghost" onPress={() => void onLeave()} disabled={busy} />
              )}
            </View>
          </>
        ) : null}

        {built && !cancelled ? (
          <>
            {lateJoiner ? (
              <View style={styles.section}>
                <Text style={styles.muted}>This group workout was built before you joined</Text>
                <TrainButton
                  label="Copy to my library"
                  fill
                  onPress={() => void onCopyToLibrary()}
                  disabled={busy || !activeHousehold}
                />
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Workout</Text>
                  {(myWorkout?.exercises ?? []).map((exercise) => {
                    const target = formatTrackingTarget({
                      tracking: exercise.tracking,
                      targetUnit: exercise.targetUnit,
                      targetSets: exercise.targetSets,
                      targetReps: exercise.targetReps,
                      targetDurationSec: exercise.targetDurationSec,
                      targetDistanceKm: exercise.targetDistanceKm,
                    });
                    return (
                      <View key={exercise.id} style={styles.builtRow}>
                        <Text style={styles.pickName} numberOfLines={1}>
                          {exerciseTitle(exercise.name)}
                        </Text>
                        {target ? <Text style={styles.pickMeta}>{target}</Text> : null}
                      </View>
                    );
                  })}
                  {!myWorkout && orderedBuilt.length === 0 ? (
                    <Text style={styles.muted}>No exercises</Text>
                  ) : null}
                </View>

                {myWorkout ? (
                  <View style={styles.actions}>
                    <TrainButton
                      label="Start"
                      fill
                      onPress={() => router.push(`/train/session/${myWorkout.id}` as Href)}
                      disabled={busy}
                    />
                    <TrainButton
                      label="Edit my copy"
                      tone="ghost"
                      onPress={() => router.push(`/train/${myWorkout.id}` as Href)}
                      disabled={busy}
                    />
                    {myWorkout.inLibrary ? (
                      <Badge label="In your library" />
                    ) : (
                      <TrainButton
                        label="Add to my library"
                        tone="ghost"
                        onPress={() => void onAddToLibrary()}
                        disabled={busy}
                      />
                    )}
                  </View>
                ) : null}
              </>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Members</Text>
              {detail.members.map((member) => (
                <View key={member.userId} style={styles.memberRow}>
                  <ProfileAvatar avatarUrl={member.profile.avatarUrl} size={36} />
                  <PublicName user={member.profile} />
                  {member.userId === detail.creatorId ? <Badge label="Creator" /> : null}
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <TextAction label="Back" onPress={() => router.push('/train/buddies' as Href)} />
              {!isCreator ? (
                <TrainButton label="Leave" tone="ghost" onPress={() => void onLeave()} disabled={busy} />
              ) : null}
            </View>
          </>
        ) : null}

        {cancelled ? (
          <View style={styles.actions}>
            <TextAction label="Back" onPress={() => router.push('/train/buddies' as Href)} />
          </View>
        ) : null}
      </ScrollView>

      <GroupWorkoutFormSheet
        visible={editOpen}
        editing={detail}
        buddies={buddies}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          void refresh().catch((err: unknown) =>
            setError(err instanceof Error ? err.message : 'Could not refresh'),
          );
        }}
      />

      <GroupWorkoutPickSheet
        visible={pickOpen}
        categories={detail.categories}
        picked={pickedMeta}
        onClose={() => setPickOpen(false)}
        onAdd={async (draft) => {
          try {
            await addGroupWorkoutPick({
              groupWorkoutId: detail.id,
              exerciseId: draft.exerciseId,
              targetSets: draft.targetSets,
              targetReps: draft.targetReps,
              targetUnit: draft.targetUnit,
              targetDurationSec: draft.targetDurationSec,
              targetDistanceKm: draft.targetDistanceKm,
              category: draft.category,
            });
            await refresh();
          } catch (err: unknown) {
            await refresh().catch(() => undefined);
            throw err;
          }
        }}
      />
    </TrainPage>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.xl },
  bodyWide: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: space.sm },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  meta: { color: colors.textDim, fontSize: 14 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  progress: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  section: { gap: space.sm },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 6,
  },
  pickCopy: { flex: 1, minWidth: 0, gap: 2 },
  pickName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pickMeta: { color: colors.textDim, fontSize: 12 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGlyph: { color: colors.textMuted, fontSize: 22, fontWeight: '600', lineHeight: 24 },
  builtRow: { gap: 2, paddingVertical: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  muted: { color: colors.textMuted, fontSize: 15 },
});
