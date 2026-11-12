import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { REMIX_CATEGORIES, REMIX_CATEGORY_COLOR, type RemixCategory } from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';
import {
  cancelGroupWorkout,
  createGroupWorkout,
  inviteBuddy,
  updateGroupWorkout,
  type GroupWorkoutDetail,
  type GroupWorkoutJoinMode,
  type GroupWorkoutSummary,
} from '@/src/features/train/group-workouts-api';
import type { TrainBuddyConnection } from '@/src/features/train/buddies-api';
import { Choice, Field, TrainButton } from '@/src/features/train/ui';
import { confirmAction } from '@/src/features/train/confirm';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toDateTimeLocal(d: Date) {
  return `${toDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultWorkoutDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateInput(d);
}

/** Evening before workout date at 18:00 local; bump if that is not in the future. */
export function defaultClosesAt(workoutDate: string): string {
  const parts = workoutDate.split('-').map(Number);
  const y = parts[0] ?? NaN;
  const m = parts[1] ?? NaN;
  const day = parts[2] ?? NaN;
  const closes = new Date(y, m - 1, day, 18, 0, 0, 0);
  closes.setDate(closes.getDate() - 1);
  const now = new Date();
  if (closes.getTime() <= now.getTime()) {
    const bump = new Date(now.getTime() + 60 * 60 * 1000);
    const workoutEnd = new Date(y, m - 1, day, 23, 59, 0, 0);
    return toDateTimeLocal(bump.getTime() <= workoutEnd.getTime() ? bump : workoutEnd);
  }
  return toDateTimeLocal(closes);
}

function parseClosesAt(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

type FormState = {
  title: string;
  workoutDate: string;
  categories: RemixCategory[];
  picksPerPerson: number;
  closesAtLocal: string;
  joinMode: GroupWorkoutJoinMode;
  inviteeIds: string[];
};

function emptyForm(): FormState {
  const workoutDate = defaultWorkoutDate();
  return {
    title: 'Gym with buddies',
    workoutDate,
    categories: [],
    picksPerPerson: 3,
    closesAtLocal: defaultClosesAt(workoutDate),
    joinMode: 'buddies',
    inviteeIds: [],
  };
}

function formFromGroup(group: GroupWorkoutDetail | GroupWorkoutSummary): FormState {
  return {
    title: group.title,
    workoutDate: group.workoutDate,
    categories: group.categories.filter((c): c is RemixCategory =>
      (REMIX_CATEGORIES as readonly string[]).includes(c),
    ),
    picksPerPerson: group.picksPerPerson,
    closesAtLocal: toDateTimeLocal(new Date(group.closesAt)),
    joinMode: group.joinMode,
    inviteeIds: [],
  };
}

export function GroupWorkoutFormSheet({
  visible,
  onClose,
  onSaved,
  editing,
  buddies,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (result: { id: string; joinCode: string | null }) => void;
  editing: GroupWorkoutDetail | GroupWorkoutSummary | null;
  buddies: TrainBuddyConnection[];
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedJoinCode, setSavedJoinCode] = useState<string | null>(null);

  const isEdit = Boolean(editing);
  const canEdit = !editing || editing.status === 'picking';

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setBusy(false);
    setSavedJoinCode(editing?.joinCode ?? null);
    setForm(editing ? formFromGroup(editing) : emptyForm());
  }, [visible, editing]);

  const accepted = useMemo(
    () => buddies.filter((row) => row.status === 'accepted'),
    [buddies],
  );

  function toggleCategory(category: RemixCategory) {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  }

  function setWorkoutDate(workoutDate: string) {
    setForm((current) => ({
      ...current,
      workoutDate,
      closesAtLocal: defaultClosesAt(workoutDate),
    }));
  }

  async function onSave() {
    if (!canEdit || busy) return;
    setError(null);

    const title = form.title.trim() || 'Gym with buddies';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.workoutDate)) {
      setError('Use a workout date like YYYY-MM-DD');
      return;
    }
    if (form.categories.length === 0) {
      setError('Pick at least one category');
      return;
    }
    const closesAt = parseClosesAt(form.closesAtLocal);
    if (!closesAt) {
      setError('Use a picking close time like YYYY-MM-DDTHH:mm');
      return;
    }
    const closesMs = Date.parse(closesAt);
    const workoutEnd = Date.parse(`${form.workoutDate}T23:59:59`);
    if (closesMs <= Date.now()) {
      setError('Picking close must be in the future');
      return;
    }
    if (closesMs > workoutEnd) {
      setError('Picking must close on or before the workout date');
      return;
    }
    const picks = Math.max(1, Math.min(10, Math.floor(form.picksPerPerson) || 3));

    setBusy(true);
    try {
      if (editing) {
        const updated = await updateGroupWorkout(editing.id, {
          title,
          workoutDate: form.workoutDate,
          categories: form.categories,
          picksPerPerson: picks,
          closesAt,
          joinMode: form.joinMode,
        });
        for (const userId of form.inviteeIds) {
          await inviteBuddy(editing.id, userId);
        }
        setSavedJoinCode(updated.joinCode);
        onSaved({ id: editing.id, joinCode: updated.joinCode });
        if (!updated.joinCode) onClose();
      } else {
        const created = await createGroupWorkout({
          title,
          workoutDate: form.workoutDate,
          categories: form.categories,
          picksPerPerson: picks,
          closesAt,
          joinMode: form.joinMode,
          inviteeIds: form.inviteeIds,
        });
        setSavedJoinCode(created.joinCode);
        onSaved(created);
        if (!created.joinCode) onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function onCancelGroup() {
    if (!editing || busy) return;
    const ok = await confirmAction('Cancel this group workout?', 'Members lose access to picking.');
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await cancelGroupWorkout(editing.id);
      onClose();
      onSaved({ id: editing.id, joinCode: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title={isEdit ? 'Edit group workout' : 'New group workout'}
      onClose={onClose}>
      <View style={styles.body}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Title</Text>
        <Field
          value={form.title}
          onChangeText={(title) => setForm((current) => ({ ...current, title }))}
          editable={canEdit}
        />

        <Text style={styles.label}>Date</Text>
        <Field
          value={form.workoutDate}
          onChangeText={setWorkoutDate}
          placeholder="YYYY-MM-DD"
          editable={canEdit}
        />

        <Text style={styles.label}>Categories</Text>
        <View style={styles.chips}>
          {REMIX_CATEGORIES.map((category) => {
            const on = form.categories.includes(category);
            return (
              <Pressable
                key={category}
                disabled={!canEdit}
                onPress={() => toggleCategory(category)}
                style={[styles.chip, on && styles.chipOn]}>
                <View style={[styles.swatch, { backgroundColor: REMIX_CATEGORY_COLOR[category] }]} />
                <Text style={[styles.chipLabel, on && { color: REMIX_CATEGORY_COLOR[category] }]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Picks per person</Text>
        <View style={styles.stepper}>
          <TrainButton
            label="−"
            tone="ghost"
            disabled={!canEdit || form.picksPerPerson <= 1 || busy}
            onPress={() =>
              setForm((current) => ({
                ...current,
                picksPerPerson: Math.max(1, current.picksPerPerson - 1),
              }))
            }
          />
          <Text style={styles.stepperValue}>{form.picksPerPerson}</Text>
          <TrainButton
            label="+"
            tone="ghost"
            disabled={!canEdit || form.picksPerPerson >= 10 || busy}
            onPress={() =>
              setForm((current) => ({
                ...current,
                picksPerPerson: Math.min(10, current.picksPerPerson + 1),
              }))
            }
          />
        </View>

        <Text style={styles.label}>Picking closes</Text>
        <Field
          value={form.closesAtLocal}
          onChangeText={(closesAtLocal) => setForm((current) => ({ ...current, closesAtLocal }))}
          placeholder="YYYY-MM-DDTHH:mm"
          editable={canEdit}
        />

        <Text style={styles.label}>Who can join</Text>
        <View style={styles.chips}>
          <Choice
            label="Buddies only"
            active={form.joinMode === 'buddies'}
            onPress={() => canEdit && setForm((current) => ({ ...current, joinMode: 'buddies' }))}
          />
          <Choice
            label="Buddies + join code"
            active={form.joinMode === 'code'}
            onPress={() => canEdit && setForm((current) => ({ ...current, joinMode: 'code' }))}
          />
        </View>

        {canEdit ? (
          <>
            <Text style={styles.label}>Invite buddies</Text>
            <View style={styles.chips}>
              {accepted.length === 0 ? <Text style={styles.muted}>No buddies yet.</Text> : null}
              {accepted.map((row) => {
                const on = form.inviteeIds.includes(row.otherUserId);
                const label = row.profile.username || row.profile.globalHandle;
                return (
                  <Choice
                    key={row.id}
                    label={label}
                    active={on}
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        inviteeIds: on
                          ? current.inviteeIds.filter((id) => id !== row.otherUserId)
                          : [...current.inviteeIds, row.otherUserId],
                      }))
                    }
                  />
                );
              })}
            </View>
          </>
        ) : null}

        {savedJoinCode && form.joinMode === 'code' ? (
          <View style={styles.codeBox}>
            <Text style={styles.code}>{savedJoinCode}</Text>
            <TrainButton
              label="Copy"
              tone="ghost"
              onPress={() => void Clipboard.setStringAsync(savedJoinCode)}
            />
            <TrainButton label="Done" onPress={onClose} />
          </View>
        ) : null}

        {canEdit ? (
          <TrainButton label={busy ? 'Saving…' : 'Save'} disabled={busy} fill onPress={() => void onSave()} />
        ) : null}

        {isEdit && editing?.status === 'picking' ? (
          <TrainButton
            label="Cancel group workout"
            tone="ghost"
            disabled={busy}
            onPress={() => void onCancelGroup()}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.lg },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
  },
  chipOn: { backgroundColor: colors.bgElevated ?? colors.bgCard },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  chipLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepperValue: { color: colors.text, fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  codeBox: {
    gap: space.sm,
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
  },
  code: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
});
