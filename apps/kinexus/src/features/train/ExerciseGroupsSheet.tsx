import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/src/features/meals/meals-kit';
import { Btn, ErrorText, Field } from '@/src/features/household/ui';
import { PublicName } from '@/src/features/shell/PublicName';
import { colors, space } from '@/src/features/shell/theme';
import {
  addExerciseGroupMember,
  createExerciseGroup,
  deleteExerciseGroup,
  leaveExerciseGroup,
  loadExerciseGroups,
  removeExerciseGroupMember,
  renameExerciseGroup,
  type ExerciseGroup,
} from '@/src/features/train/custom-exercises-api';
import { loadTrainBuddies, type TrainBuddyConnection } from '@/src/features/train/buddies-api';
import { TrainButton } from '@/src/features/train/ui';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function ExerciseGroupsSheet({
  visible,
  onClose,
  userId,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string;
  onChanged?: (groups: ExerciseGroup[]) => void;
}) {
  useExperienceMode();
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  const [buddies, setBuddies] = useState<TrainBuddyConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [rename, setRename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [nextGroups, nextBuddies] = await Promise.all([
      loadExerciseGroups(userId),
      loadTrainBuddies(userId),
    ]);
    setGroups(nextGroups);
    setBuddies(nextBuddies.filter((row) => row.status === 'accepted'));
    onChanged?.(nextGroups);
    if (selectedId && !nextGroups.some((row) => row.id === selectedId)) {
      setSelectedId(nextGroups[0]?.id ?? null);
    }
  }

  useEffect(() => {
    if (!visible) return;
    setError(null);
    void refresh().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load groups'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

  const selected = useMemo(
    () => groups.find((row) => row.id === selectedId) ?? null,
    [groups, selectedId],
  );

  const candidateBuddies = useMemo(() => {
    if (!selected) return [];
    const memberSet = new Set(selected.memberIds);
    return buddies.filter((row) => !memberSet.has(row.otherUserId));
  }, [buddies, selected]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const id = await createExerciseGroup({ userId, name });
      setName('');
      await refresh();
      setSelectedId(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create group');
    } finally {
      setBusy(false);
    }
  }

  async function onRename() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await renameExerciseGroup({ groupId: selected.id, name: rename || selected.name });
      setRename('');
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not rename');
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(buddyUserId: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await addExerciseGroupMember({ groupId: selected.id, userId: buddyUserId });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add buddy');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(memberId: string) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      if (memberId === userId && selected.ownerId !== userId) {
        await leaveExerciseGroup({ groupId: selected.id, userId });
        setSelectedId(null);
      } else {
        await removeExerciseGroupMember({ groupId: selected.id, userId: memberId });
      }
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update members');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selected || selected.ownerId !== userId) return;
    setBusy(true);
    setError(null);
    try {
      await deleteExerciseGroup(selected.id);
      setSelectedId(null);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete group');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Buddy groups" onClose={onClose} wide>
      <View style={styles.wrap}>
        <Field label="New group" value={name} onChangeText={setName} />
        <Btn label={busy ? '…' : 'Create'} onPress={() => void onCreate()} disabled={busy || !name.trim()} />

        <View style={styles.list}>
          {groups.map((group) => (
            <TrainButton
              key={group.id}
              label={group.name}
              tone={selectedId === group.id ? 'accent' : 'ghost'}
              onPress={() => {
                setSelectedId(group.id);
                setRename(group.name);
              }}
            />
          ))}
          {groups.length === 0 ? <Text style={styles.muted}>No groups yet</Text> : null}
        </View>

        {selected ? (
          <View style={styles.detail}>
            {selected.ownerId === userId ? (
              <>
                <Field label="Rename" value={rename} onChangeText={setRename} />
                <TrainButton label="Save name" tone="ghost" disabled={busy} onPress={() => void onRename()} />
              </>
            ) : null}

            <Text style={styles.heading}>Members</Text>
            {selected.members.map((member) => (
              <View key={member.id} style={styles.member}>
                <PublicName user={member} />
                {selected.ownerId === userId && member.id !== selected.ownerId ? (
                  <TrainButton label="Remove" tone="ghost" disabled={busy} onPress={() => void onRemove(member.id)} />
                ) : null}
                {member.id === userId && selected.ownerId !== userId ? (
                  <TrainButton label="Leave" tone="danger" disabled={busy} onPress={() => void onRemove(member.id)} />
                ) : null}
              </View>
            ))}

            {selected.ownerId === userId ? (
              <>
                <Text style={styles.heading}>Add buddy</Text>
                {candidateBuddies.length === 0 ? (
                  <Text style={styles.muted}>All accepted buddies are already in this group</Text>
                ) : (
                  candidateBuddies.map((buddy) => (
                    <View key={buddy.id} style={styles.member}>
                      <PublicName user={buddy.profile} />
                      <TrainButton
                        label="Add"
                        tone="ghost"
                        disabled={busy}
                        onPress={() => void onAdd(buddy.otherUserId)}
                      />
                    </View>
                  ))
                )}
                <TrainButton label="Delete group" tone="danger" disabled={busy} onPress={() => void onDelete()} />
              </>
            ) : null}
          </View>
        ) : null}

        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingBottom: space.xl },
  list: { gap: 8 },
  detail: { gap: space.sm },
  heading: { color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 4 },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  muted: { color: colors.textMuted, fontSize: 13 },
});
