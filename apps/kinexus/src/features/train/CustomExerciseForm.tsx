import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_SOURCE_BADGE_LABEL,
  REMIX_CATEGORIES,
  findDuplicateExerciseSuggestions,
  type ExerciseDifficulty,
  type RemixCategory,
} from '@kinexus/domain';

import { Chip, Sheet } from '@/src/features/meals/meals-kit';
import { Btn, ErrorText, Field } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import {
  archiveCustomExercise,
  createCustomExercise,
  promoteCustomExercise,
  publishGlobalExercise,
  updateCustomExercise,
  uploadExerciseMedia,
  type CustomExerciseInput,
  type ExerciseGroup,
} from '@/src/features/train/custom-exercises-api';
import type { LibraryExercise } from '@/src/features/train/api';
import { Choice, TrainButton } from '@/src/features/train/ui';
import { exerciseTitle } from '@/src/features/train/format';
import { useCreator } from '@/src/features/creators/use-creator';
import { useExperienceMode } from '@/src/lib/experience-mode';

const BODY_PARTS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'forearms',
  'cardio',
  'neck',
  'upper legs',
  'lower legs',
  'waist',
  'upper arms',
] as const;

const EQUIPMENT = [
  'body weight',
  'dumbbell',
  'barbell',
  'cable',
  'band',
  'kettlebell',
  'machine',
  'ez barbell',
  'smith machine',
  'leverage machine',
  'medicine ball',
  'stability ball',
  'assisted',
] as const;

const MUSCLES = [
  'pectorals',
  'lats',
  'quads',
  'hamstrings',
  'glutes',
  'delts',
  'biceps',
  'triceps',
  'abs',
  'calves',
  'traps',
  'forearms',
  'cardiovascular system',
] as const;

type VisibilityChoice = 'private' | 'household' | 'group' | 'everyone';

type DraftState = {
  name: string;
  category: RemixCategory | '';
  bodyPart: string;
  equipment: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  instructionsText: string;
  mediaUrl: string;
  difficulty: ExerciseDifficulty | '';
  isCompound: boolean | null;
  visibility: VisibilityChoice;
  groupId: string | null;
};

function emptyDraft(seedName = ''): DraftState {
  return {
    name: seedName,
    category: '',
    bodyPart: 'chest',
    equipment: 'body weight',
    targetMuscle: 'pectorals',
    secondaryMuscles: [],
    instructionsText: '',
    mediaUrl: '',
    difficulty: '',
    isCompound: true,
    visibility: 'private',
    groupId: null,
  };
}

function draftFromExercise(exercise: LibraryExercise): DraftState {
  return {
    name: exercise.name,
    category: (REMIX_CATEGORIES as readonly string[]).includes(exercise.category ?? '')
      ? (exercise.category as RemixCategory)
      : '',
    bodyPart: exercise.bodyPart || 'chest',
    equipment: exercise.equipment || 'body weight',
    targetMuscle: exercise.targetMuscle || 'pectorals',
    secondaryMuscles: exercise.secondaryMuscles ?? [],
    instructionsText: (exercise.instructions ?? []).join('\n'),
    mediaUrl: exercise.mediaUrl ?? '',
    difficulty: exercise.difficulty ?? '',
    isCompound: exercise.isCompound ?? null,
    visibility:
      exercise.scope === 'household'
        ? 'household'
        : exercise.scope === 'group'
          ? 'group'
          : exercise.scope === 'global'
            ? 'everyone'
            : 'private',
    groupId: exercise.groupId,
  };
}

function toInput(
  draft: DraftState,
  opts: { householdId: string | null; publishEveryone: boolean },
): CustomExerciseInput {
  const scope =
    draft.visibility === 'household'
      ? 'household'
      : draft.visibility === 'group'
        ? 'group'
        : 'private';
  return {
    name: draft.name,
    bodyPart: draft.bodyPart,
    equipment: draft.equipment,
    targetMuscle: draft.targetMuscle,
    secondaryMuscles: draft.secondaryMuscles,
    instructions: draft.instructionsText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean),
    category: draft.category || null,
    difficulty: draft.difficulty || null,
    isCompound: draft.isCompound,
    mediaUrl: draft.mediaUrl.trim() || null,
    mediaUrls: draft.mediaUrl.trim() ? [draft.mediaUrl.trim()] : [],
    mediaKind: draft.mediaUrl.trim()
      ? /\.gif(\?|$)/i.test(draft.mediaUrl)
        ? 'gif'
        : 'image'
      : null,
    scope,
    householdId: scope === 'household' ? opts.householdId : null,
    groupId: scope === 'group' ? draft.groupId : null,
  };
}

function pickImageFile(): Promise<File | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function CustomExerciseForm({
  visible,
  onClose,
  onSaved,
  seedName = '',
  editing = null,
  catalog,
  groups,
  userId,
  householdId,
  canManageHousehold,
  isStaff = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (exerciseId: string) => void;
  seedName?: string;
  editing?: LibraryExercise | null;
  catalog: readonly LibraryExercise[];
  groups: readonly ExerciseGroup[];
  userId: string;
  householdId: string | null;
  canManageHousehold: boolean;
  isStaff?: boolean;
}) {
  useExperienceMode();
  const creator = useCreator();
  const [draft, setDraft] = useState<DraftState>(() => emptyDraft(seedName));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dupAck, setDupAck] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(editing ? draftFromExercise(editing) : emptyDraft(seedName));
    setError(null);
    setDupAck(false);
    setBusy(false);
  }, [visible, editing, seedName]);

  const suggestions = useMemo(() => {
    if (!draft.name.trim() || editing) return [];
    return findDuplicateExerciseSuggestions(
      draft.name,
      catalog.map((row) => ({ id: row.id, name: row.name })),
      4,
    );
  }, [catalog, draft.name, editing]);

  const canEdit =
    !editing ||
    editing.ownerId === userId ||
    (editing.scope === 'household' && canManageHousehold) ||
    (editing.scope === 'group' &&
      groups.some((group) => group.id === editing.groupId && group.ownerId === userId));

  function patch(update: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...update }));
    setDupAck(false);
  }

  async function onUpload() {
    if (!householdId) {
      setError('Pick a household before uploading media');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const file = await pickImageFile();
      if (!file) return;
      const url = await uploadExerciseMedia({ householdId, userId, file });
      patch({ mediaUrl: url });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function save(opts?: { publishEveryone?: boolean }) {
    if (!canEdit) return;
    setError(null);
    if (!draft.name.trim()) {
      setError('Name is required');
      return;
    }
    if (draft.visibility === 'household' && !householdId) {
      setError('No household selected');
      return;
    }
    if (draft.visibility === 'group' && !draft.groupId) {
      setError('Pick a buddy group');
      return;
    }
    if (!editing && suggestions.length > 0 && !dupAck) {
      setError('Review “Did you mean…?” then save again');
      return;
    }
    setBusy(true);
    try {
      const publishEveryone = Boolean(opts?.publishEveryone || draft.visibility === 'everyone');
      const payload = toInput(draft, {
        householdId,
        publishEveryone,
      });
      let id = editing?.id ?? '';
      if (editing) {
        await updateCustomExercise({ exerciseId: editing.id, draft: payload });
        id = editing.id;
        if (publishEveryone && editing.scope !== 'global') {
          id = await publishGlobalExercise(editing.id);
        }
      } else {
        id = await createCustomExercise({ userId, draft: payload });
        if (publishEveryone) id = await publishGlobalExercise(id);
      }
      onSaved(id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save exercise');
    } finally {
      setBusy(false);
    }
  }

  async function onArchive() {
    if (!editing || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      await archiveCustomExercise(editing.id);
      onSaved(editing.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete exercise');
    } finally {
      setBusy(false);
    }
  }

  async function onPromote(target: 'private' | 'household' | 'group') {
    if (!editing || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      if (target === 'private') {
        await promoteCustomExercise({ exerciseId: editing.id, target: { scope: 'private' } });
      } else if (target === 'household') {
        if (!householdId) throw new Error('No household selected');
        await promoteCustomExercise({
          exerciseId: editing.id,
          target: { scope: 'household', householdId },
        });
      } else {
        if (!draft.groupId) throw new Error('Pick a buddy group');
        await promoteCustomExercise({
          exerciseId: editing.id,
          target: { scope: 'group', groupId: draft.groupId },
        });
      }
      onSaved(editing.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update visibility');
    } finally {
      setBusy(false);
    }
  }

  const title = editing ? exerciseTitle(editing.name) : 'Custom exercise';
  const showEveryone = creator.isApprovedCreator || isStaff;

  return (
    <Sheet visible={visible} title={title} onClose={onClose} wide desktopMaxWidth={720}>
      <View style={styles.form}>
        <Field label="Name" value={draft.name} onChangeText={(name) => patch({ name })} />
        {!editing && suggestions.length > 0 ? (
          <View style={styles.dupBox}>
            <Text style={styles.dupTitle}>Did you mean…?</Text>
            {suggestions.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => {
                  const match = catalog.find((item) => item.id === row.id);
                  if (match) patch({ name: match.name });
                }}
                style={styles.dupRow}>
                <Text style={styles.dupName}>{exerciseTitle(row.name)}</Text>
                <Text style={styles.dupMeta}>
                  {EXERCISE_SOURCE_BADGE_LABEL[
                    catalog.find((item) => item.id === row.id)?.sourceBadge ?? 'kinexus'
                  ]}
                </Text>
              </Pressable>
            ))}
            <TrainButton label="Create anyway" tone="ghost" onPress={() => setDupAck(true)} />
            {dupAck ? <Text style={styles.dupAck}>Will create a new exercise</Text> : null}
          </View>
        ) : null}

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {REMIX_CATEGORIES.map((category) => (
            <Chip
              key={category}
              label={category}
              active={draft.category === category}
              onPress={() => patch({ category })}
            />
          ))}
        </View>

        <Text style={styles.label}>Body part</Text>
        <View style={styles.chips}>
          {BODY_PARTS.map((part) => (
            <Chip
              key={part}
              label={part}
              active={draft.bodyPart === part}
              onPress={() => patch({ bodyPart: part })}
            />
          ))}
        </View>

        <Text style={styles.label}>Equipment</Text>
        <View style={styles.chips}>
          {EQUIPMENT.map((item) => (
            <Chip
              key={item}
              label={item}
              active={draft.equipment === item}
              onPress={() => patch({ equipment: item })}
            />
          ))}
        </View>

        <Text style={styles.label}>Target muscle</Text>
        <View style={styles.chips}>
          {MUSCLES.map((muscle) => (
            <Chip
              key={muscle}
              label={muscle}
              active={draft.targetMuscle === muscle}
              onPress={() => patch({ targetMuscle: muscle })}
            />
          ))}
        </View>

        <Text style={styles.label}>Secondary muscles</Text>
        <View style={styles.chips}>
          {MUSCLES.map((muscle) => {
            const active = draft.secondaryMuscles.includes(muscle);
            return (
              <Chip
                key={muscle}
                label={muscle}
                active={active}
                onPress={() =>
                  patch({
                    secondaryMuscles: active
                      ? draft.secondaryMuscles.filter((item) => item !== muscle)
                      : [...draft.secondaryMuscles, muscle],
                  })
                }
              />
            );
          })}
        </View>

        <Text style={styles.label}>Instructions</Text>
        <TextInput
          value={draft.instructionsText}
          onChangeText={(instructionsText) => patch({ instructionsText })}
          multiline
          style={styles.area}
          placeholder="One step per line"
          placeholderTextColor={colors.textDim}
        />

        <Field
          label="Media URL"
          value={draft.mediaUrl}
          onChangeText={(mediaUrl) => patch({ mediaUrl })}
        />
        {Platform.OS === 'web' ? (
          <TrainButton
            label={uploading ? 'Uploading…' : 'Upload image'}
            tone="ghost"
            disabled={uploading || !householdId}
            onPress={() => void onUpload()}
          />
        ) : null}

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chips}>
          {EXERCISE_DIFFICULTIES.map((level) => (
            <Chip
              key={level}
              label={level}
              active={draft.difficulty === level}
              onPress={() => patch({ difficulty: level })}
            />
          ))}
        </View>

        <Text style={styles.label}>Movement</Text>
        <View style={styles.row}>
          <Choice
            label="Compound"
            active={draft.isCompound === true}
            onPress={() => patch({ isCompound: true })}
          />
          <Choice
            label="Isolation"
            active={draft.isCompound === false}
            onPress={() => patch({ isCompound: false })}
          />
        </View>

        <Text style={styles.label}>Who can see this</Text>
        <View style={styles.chips}>
          <Chip
            label="Only me"
            active={draft.visibility === 'private'}
            onPress={() => patch({ visibility: 'private', groupId: null })}
          />
          <Chip
            label="My family"
            active={draft.visibility === 'household'}
            onPress={() => patch({ visibility: 'household', groupId: null })}
          />
          <Chip
            label="A buddy group"
            active={draft.visibility === 'group'}
            onPress={() =>
              patch({
                visibility: 'group',
                groupId: draft.groupId ?? groups[0]?.id ?? null,
              })
            }
          />
          {showEveryone ? (
            <Chip
              label="Everyone"
              active={draft.visibility === 'everyone'}
              onPress={() => patch({ visibility: 'everyone', groupId: null })}
            />
          ) : null}
        </View>
        {draft.visibility === 'group' ? (
          <View style={styles.chips}>
            {groups.length === 0 ? <Text style={styles.hint}>Create a buddy group first</Text> : null}
            {groups.map((group) => (
              <Chip
                key={group.id}
                label={group.name}
                active={draft.groupId === group.id}
                onPress={() => patch({ groupId: group.id })}
              />
            ))}
          </View>
        ) : null}

        <ErrorText message={error} />

        {canEdit ? (
          <View style={styles.actions}>
            <Btn label={busy ? 'Saving…' : editing ? 'Save' : 'Create'} onPress={() => void save()} disabled={busy} />
            {editing && editing.scope !== 'global' ? (
              <>
                <TrainButton label="Make private" tone="ghost" disabled={busy} onPress={() => void onPromote('private')} />
                <TrainButton label="Share with family" tone="ghost" disabled={busy || !householdId} onPress={() => void onPromote('household')} />
                <TrainButton label="Share with group" tone="ghost" disabled={busy || !draft.groupId} onPress={() => void onPromote('group')} />
                {showEveryone ? (
                  <TrainButton
                    label="Publish globally"
                    tone="ghost"
                    disabled={busy}
                    onPress={() => void save({ publishEveryone: true })}
                  />
                ) : null}
                <TrainButton label="Delete" tone="danger" disabled={busy} onPress={() => void onArchive()} />
              </>
            ) : null}
            {editing && editing.scope === 'global' && (editing.ownerId === userId || isStaff) ? (
              <TrainButton label="Hide" tone="danger" disabled={busy} onPress={() => void onArchive()} />
            ) : null}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md, paddingBottom: space.xl },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  area: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
    textAlignVertical: 'top',
  },
  actions: { gap: 10 },
  dupBox: {
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: space.sm,
    gap: 8,
  },
  dupTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  dupRow: { gap: 2 },
  dupName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dupMeta: { color: colors.textMuted, fontSize: 12 },
  dupAck: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13 },
});
