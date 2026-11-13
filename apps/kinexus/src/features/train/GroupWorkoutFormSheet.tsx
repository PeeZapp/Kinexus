import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { REMIX_CATEGORIES, REMIX_CATEGORY_COLOR, type RemixCategory } from '@kinexus/domain';

import { AppModal } from '@/src/features/shell/AppModal';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
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
import { Choice, Field, Segmented, TrainButton } from '@/src/features/train/ui';
import { confirmAction } from '@/src/features/train/confirm';
import { useExperienceMode } from '@/src/lib/experience-mode';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateInput(value: string): Date | null {
  const parts = value.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDateLabel(value: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function snapMinute(value: number) {
  const snapped = Math.round(value / 5) * 5;
  return Math.min(55, Math.max(0, snapped));
}

function splitClock(d: Date) {
  const hours24 = d.getHours();
  const meridiem: 'AM' | 'PM' = hours24 >= 12 ? 'PM' : 'AM';
  let hour = hours24 % 12;
  if (hour === 0) hour = 12;
  return { hour, minute: snapMinute(d.getMinutes()), meridiem };
}

function combineToIso(date: string, hour: number, minute: number, meridiem: 'AM' | 'PM'): string | null {
  const parsed = parseDateInput(date);
  if (!parsed) return null;
  let hours24 = hour % 12;
  if (meridiem === 'PM') hours24 += 12;
  parsed.setHours(hours24, minute, 0, 0);
  return parsed.toISOString();
}

function defaultWorkoutDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateInput(d);
}

/** Evening before workout date at 18:00 local; bump if that is not in the future. */
export function defaultClosesAt(workoutDate: string): Date {
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
    return bump.getTime() <= workoutEnd.getTime() ? bump : workoutEnd;
  }
  return closes;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;
const HOUR_OPTIONS = HOURS.map((value) => ({ value, label: String(value) }));
const MINUTE_OPTIONS = MINUTES.map((value) => ({ value, label: pad(value) }));
const PICK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => ({
  value,
  label: String(value),
}));

type FormState = {
  title: string;
  workoutDate: string;
  categories: RemixCategory[];
  picksPerPerson: number;
  closesDate: string;
  closesHour: number;
  closesMinute: number;
  closesMeridiem: 'AM' | 'PM';
  joinMode: GroupWorkoutJoinMode;
  inviteeIds: string[];
};

function formFromCloses(d: Date): Pick<FormState, 'closesDate' | 'closesHour' | 'closesMinute' | 'closesMeridiem'> {
  const clock = splitClock(d);
  return {
    closesDate: toDateInput(d),
    closesHour: clock.hour,
    closesMinute: clock.minute,
    closesMeridiem: clock.meridiem,
  };
}

function emptyForm(): FormState {
  const workoutDate = defaultWorkoutDate();
  return {
    title: 'Gym with buddies',
    workoutDate,
    categories: [],
    picksPerPerson: 3,
    ...formFromCloses(defaultClosesAt(workoutDate)),
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
    ...formFromCloses(new Date(group.closesAt)),
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
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const { openMenu, toggleMenu, pick } = useFilterMenus();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedJoinCode, setSavedJoinCode] = useState<string | null>(null);

  const [calendarTarget, setCalendarTarget] = useState<'workout' | 'closes' | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const isEdit = Boolean(editing);
  const canEdit = !editing || editing.status === 'picking';

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setBusy(false);
    setSavedJoinCode(editing?.joinCode ?? null);
    setCategoryPickerOpen(false);
    setCalendarTarget(null);
    const next = editing ? formFromGroup(editing) : emptyForm();
    setForm(next);
    const seed = parseDateInput(next.workoutDate) ?? new Date();
    setCalendarMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
  }, [visible, editing]);

  const accepted = useMemo(() => buddies.filter((row) => row.status === 'accepted'), [buddies]);

  const workoutDateLabel = useMemo(() => formatDateLabel(form.workoutDate), [form.workoutDate]);
  const closesDateLabel = useMemo(() => formatDateLabel(form.closesDate), [form.closesDate]);
  const categoryLabel = useMemo(() => {
    if (form.categories.length === 0) return 'Pick categories';
    return form.categories.join(', ');
  }, [form.categories]);

  function openCalendar(target: 'workout' | 'closes') {
    if (!canEdit) return;
    const seed = parseDateInput(target === 'workout' ? form.workoutDate : form.closesDate) ?? new Date();
    setCalendarMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
    setCalendarTarget(target);
  }

  function toggleCategory(category: RemixCategory) {
    if (!canEdit) return;
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
      ...formFromCloses(defaultClosesAt(workoutDate)),
    }));
  }

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ key: string; day: number | null; iso: string | null }> = [];
    for (let i = 0; i < firstDow; i += 1) cells.push({ key: `e${i}`, day: null, iso: null });
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        key: `d${day}`,
        day,
        iso: `${year}-${pad(month + 1)}-${pad(day)}`,
      });
    }
    return cells;
  }, [calendarMonth]);

  const selectedCalendarIso = calendarTarget === 'closes' ? form.closesDate : form.workoutDate;

  async function onSave() {
    if (!canEdit || busy) return;
    setError(null);

    const title = form.title.trim() || 'Gym with buddies';
    if (!parseDateInput(form.workoutDate)) {
      setError('Pick a workout date');
      return;
    }
    if (form.categories.length === 0) {
      setError('Pick at least one category');
      return;
    }
    const closesAt = combineToIso(form.closesDate, form.closesHour, form.closesMinute, form.closesMeridiem);
    if (!closesAt) {
      setError('Pick when picking closes');
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
    <>
      <AppModal visible={visible} transparent animationType={desktop ? 'fade' : 'slide'} onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
          <Pressable
            onPress={() => undefined}
            accessibilityViewIsModal
            style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile]}>
            <View style={styles.head}>
              <Text style={styles.title}>{isEdit ? 'Edit group workout' : 'New group workout'}</Text>
              <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Text style={styles.label}>Title</Text>
              <Field
                value={form.title}
                onChangeText={(title) => setForm((current) => ({ ...current, title }))}
                editable={canEdit}
              />

              <Text style={styles.label}>Date</Text>
              <Pressable
                accessibilityRole="button"
                disabled={!canEdit}
                onPress={() => openCalendar('workout')}
                style={({ pressed }) => [
                  styles.selector,
                  !canEdit && styles.selectorDisabled,
                  pressed && canEdit && styles.selectorPressed,
                ]}>
                <Text style={styles.selectorText}>{workoutDateLabel}</Text>
              </Pressable>

              <Text style={styles.label}>Categories</Text>
              <Pressable
                accessibilityRole="button"
                disabled={!canEdit}
                onPress={() => canEdit && setCategoryPickerOpen(true)}
                style={({ pressed }) => [
                  styles.selector,
                  !canEdit && styles.selectorDisabled,
                  pressed && canEdit && styles.selectorPressed,
                ]}>
                <Text style={styles.selectorText} numberOfLines={2}>
                  {categoryLabel}
                </Text>
              </Pressable>

              <Text style={styles.label}>Picks per person</Text>
              <FilterBar>
                <FilterDropdown
                  id="picks"
                  label="Picks"
                  value={form.picksPerPerson}
                  valueLabel={String(form.picksPerPerson)}
                  open={openMenu === 'picks'}
                  options={PICK_OPTIONS}
                  onToggle={canEdit ? toggleMenu : () => undefined}
                  onSelect={canEdit ? pick((value: number) => setForm((current) => ({ ...current, picksPerPerson: value }))) : () => undefined}
                  style={styles.picksDropdown}
                />
              </FilterBar>

              <Text style={styles.label}>Picking closes</Text>
              <Pressable
                accessibilityRole="button"
                disabled={!canEdit}
                onPress={() => openCalendar('closes')}
                style={({ pressed }) => [
                  styles.selector,
                  !canEdit && styles.selectorDisabled,
                  pressed && canEdit && styles.selectorPressed,
                ]}>
                <Text style={styles.selectorText}>{closesDateLabel}</Text>
              </Pressable>
              <FilterBar>
                <FilterDropdown
                  id="closes-hour"
                  label="Hour"
                  value={form.closesHour}
                  valueLabel={String(form.closesHour)}
                  open={openMenu === 'closes-hour'}
                  options={HOUR_OPTIONS}
                  onToggle={canEdit ? toggleMenu : () => undefined}
                  onSelect={canEdit ? pick((value: number) => setForm((current) => ({ ...current, closesHour: value }))) : () => undefined}
                  style={styles.timeDropdown}
                />
                <FilterDropdown
                  id="closes-minute"
                  label="Min"
                  value={form.closesMinute}
                  valueLabel={pad(form.closesMinute)}
                  open={openMenu === 'closes-minute'}
                  options={MINUTE_OPTIONS}
                  onToggle={canEdit ? toggleMenu : () => undefined}
                  onSelect={
                    canEdit
                      ? pick((value: number) => setForm((current) => ({ ...current, closesMinute: value })))
                      : () => undefined
                  }
                  style={styles.timeDropdown}
                />
              </FilterBar>
              <Segmented
                value={form.closesMeridiem}
                options={[
                  { value: 'AM', label: 'AM' },
                  { value: 'PM', label: 'PM' },
                ]}
                onChange={(closesMeridiem) => canEdit && setForm((current) => ({ ...current, closesMeridiem }))}
                compact
              />

              <Text style={styles.label}>Who can join</Text>
              <Segmented
                value={form.joinMode}
                options={[
                  { value: 'buddies', label: 'Buddies' },
                  { value: 'code', label: 'Buddies + code' },
                ]}
                onChange={(joinMode) => canEdit && setForm((current) => ({ ...current, joinMode }))}
                compact
              />

              {canEdit ? (
                <>
                  <Text style={styles.label}>Invite buddies</Text>
                  <View style={styles.picks}>
                    {accepted.length === 0 ? <Text style={styles.muted}>No buddies yet</Text> : null}
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
                  <Text style={styles.codeLabel}>Join code</Text>
                  <Text style={styles.code}>{savedJoinCode}</Text>
                  <View style={styles.codeActions}>
                    <TrainButton
                      label="Copy"
                      tone="ghost"
                      onPress={() => void Clipboard.setStringAsync(savedJoinCode)}
                      fill
                    />
                    <TrainButton label="Done" onPress={onClose} fill />
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {canEdit ? (
              <TrainButton label={busy ? 'Saving…' : isEdit ? 'Save' : 'Create'} disabled={busy} fill onPress={() => void onSave()} />
            ) : null}
            {isEdit && editing?.status === 'picking' ? (
              <TrainButton
                label="Cancel group workout"
                tone="ghost"
                disabled={busy}
                onPress={() => void onCancelGroup()}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </AppModal>

      <AppModal
        visible={calendarTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setCalendarTarget(null)}>
          <Pressable onPress={() => undefined} style={[styles.card, styles.cardDesktop, styles.calendarCard]}>
            <View style={styles.head}>
              <Text style={styles.title}>{calendarTarget === 'closes' ? 'Picking closes' : 'Workout day'}</Text>
              <Pressable onPress={() => setCalendarTarget(null)} hitSlop={8}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.calNav}>
              <TrainButton
                label="Prev"
                tone="ghost"
                onPress={() =>
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                }
              />
              <Text style={styles.calMonth}>
                {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              <TrainButton
                label="Next"
                tone="ghost"
                onPress={() =>
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                }
              />
            </View>
            <View style={styles.calDow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                <Text key={`${label}${index}`} style={styles.calDowText}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.calGrid}>
              {calendarCells.map((cell) => (
                <Pressable
                  key={cell.key}
                  disabled={!cell.iso}
                  onPress={() => {
                    if (!cell.iso || !calendarTarget) return;
                    if (calendarTarget === 'workout') setWorkoutDate(cell.iso);
                    else setForm((current) => ({ ...current, closesDate: cell.iso! }));
                    setCalendarTarget(null);
                  }}
                  style={({ pressed }) => [
                    styles.calCell,
                    cell.iso === selectedCalendarIso && styles.calCellActive,
                    pressed && cell.iso && styles.selectorPressed,
                  ]}>
                  <Text style={[styles.calCellText, cell.iso === selectedCalendarIso && styles.calCellTextActive]}>
                    {cell.day ?? ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </AppModal>

      <AppModal
        visible={categoryPickerOpen}
        transparent
        animationType={desktop ? 'fade' : 'slide'}
        onRequestClose={() => setCategoryPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCategoryPickerOpen(false)}>
          <Pressable
            onPress={() => undefined}
            accessibilityViewIsModal
            style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile, styles.pickerCard]}>
            <View style={styles.head}>
              <Text style={styles.title}>
                Categories{form.categories.length > 0 ? ` · ${form.categories.length}` : ''}
              </Text>
              <Pressable onPress={() => setCategoryPickerOpen(false)} hitSlop={8}>
                <Text style={styles.close}>Done</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.pickerSectionBody}>
                {REMIX_CATEGORIES.map((category, index) => {
                  const on = form.categories.includes(category);
                  const last = index === REMIX_CATEGORIES.length - 1;
                  return (
                    <Pressable
                      key={category}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => toggleCategory(category)}
                      style={({ pressed }) => [
                        styles.listRow,
                        last && styles.listRowLast,
                        on && styles.listRowOn,
                        pressed && styles.listRowPressed,
                      ]}>
                      <View style={[styles.swatch, { backgroundColor: REMIX_CATEGORY_COLOR[category] }]} />
                      <Text style={styles.listRowLabel}>{category}</Text>
                      {on ? <Text style={styles.listCheck}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 14, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    gap: space.md,
    padding: space.lg,
    maxHeight: '90%',
  },
  cardMobile: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: space.xl,
  },
  cardDesktop: {
    maxWidth: 460,
    marginBottom: 48,
    borderRadius: radius.xl,
    alignSelf: 'center',
  },
  calendarCard: { maxWidth: 380 },
  pickerCard: { maxHeight: '86%' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  close: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  scroll: { flexGrow: 0 },
  body: { gap: space.sm, paddingBottom: space.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 4 },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
  selector: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    backgroundColor: colors.bg,
  },
  selectorDisabled: { opacity: 0.5 },
  selectorPressed: { opacity: 0.85 },
  selectorText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  timeDropdown: { flexGrow: 1, minWidth: 100 },
  picksDropdown: { flexGrow: 1, minWidth: 120 },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  calMonth: { color: colors.text, fontSize: 15, fontWeight: '700' },
  calDow: { flexDirection: 'row' },
  calDowText: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  calCellActive: { backgroundColor: colors.accent },
  calCellText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  calCellTextActive: { color: colors.bg },
  pickerScroll: { flexGrow: 1, minHeight: 0 },
  pickerList: { gap: space.md, paddingBottom: space.lg },
  pickerSectionBody: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listRowLast: { borderBottomWidth: 0 },
  listRowOn: { backgroundColor: colors.accentSoft },
  listRowPressed: { opacity: 0.88 },
  listRowLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  listCheck: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  codeBox: {
    gap: space.sm,
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  codeLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  code: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  codeActions: { flexDirection: 'row', gap: 8, width: '100%' },
});
