import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/src/features/shell/AppModal';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { colors, radius, space } from '@/src/features/shell/theme';
import {
  filterWorkoutsForSessionTypes,
  sessionTypeForPreferredWorkout,
  sessionTypeLabel,
  type InviteWorkoutOption,
} from '@/src/features/train/joint-sessions-api';
import {
  SessionTypePickerList,
  WorkoutPickerList,
  sessionWorkoutPickerStyles,
  sortWorkoutPickerRows,
} from '@/src/features/train/SessionWorkoutPickers';
import { Choice, Segmented, TrainButton } from '@/src/features/train/ui';
import { useExperienceMode } from '@/src/lib/experience-mode';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultWhen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

function parseDateInput(value: string): Date | null {
  const parts = value.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;
const HOUR_OPTIONS = HOURS.map((value) => ({ value, label: String(value) }));
const MINUTE_OPTIONS = MINUTES.map((value) => ({ value, label: pad(value) }));

export type InviteTogetherPerson = {
  id: string;
  name: string;
  kind: 'family' | 'buddy';
};

export type InviteTogetherBuddy = InviteTogetherPerson;

export function InviteTogetherModal({
  visible,
  invitees,
  buddies,
  workouts,
  busy,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  /** Family + buddies. Prefer this over deprecated `buddies`. */
  invitees?: readonly InviteTogetherPerson[];
  /** @deprecated use invitees */
  buddies?: readonly InviteTogetherPerson[];
  workouts: readonly InviteWorkoutOption[];
  busy?: boolean;
  onClose: () => void;
  onSubmit: (input: {
    scheduledAt: string;
    inviteeIds: string[];
    /** @deprecated same as inviteeIds */
    buddyIds: string[];
    offeredSessionTypeIds: string[];
    offeredWorkoutIds: string[];
    inviterSessionTypeId: string;
    inviterWorkoutId: string | null;
  }) => Promise<void> | void;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const defaults = useMemo(() => defaultWhen(), []);
  const people = invitees ?? buddies ?? [];
  const { openMenu, toggleMenu, pick } = useFilterMenus();

  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [date, setDate] = useState(toDateInput(defaults));
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(0);
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>('PM');
  const [sessionTypeIds, setSessionTypeIds] = useState<string[]>([]);
  const [preferredSessionTypeId, setPreferredSessionTypeId] = useState<string | null>(null);
  const [workoutIds, setWorkoutIds] = useState<string[]>([]);
  const [preferredWorkoutId, setPreferredWorkoutId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [workoutPickerOpen, setWorkoutPickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = defaultWhen();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!visible) return;
    const next = defaultWhen();
    setInviteeIds([]);
    setDate(toDateInput(next));
    setHour(6);
    setMinute(0);
    setMeridiem('PM');
    setSessionTypeIds([]);
    setPreferredSessionTypeId(null);
    setWorkoutIds([]);
    setPreferredWorkoutId(null);
    setError(null);
    setCalendarMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [visible]);

  const filteredWorkouts = useMemo(
    () => sortWorkoutPickerRows(filterWorkoutsForSessionTypes(workouts, sessionTypeIds)),
    [workouts, sessionTypeIds],
  );

  const dateLabel = useMemo(() => {
    const parsed = parseDateInput(date);
    if (!parsed) return date;
    return parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [date]);

  function toggleSessionType(id: string) {
    setSessionTypeIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((value) => value !== id);
        if (preferredSessionTypeId === id) setPreferredSessionTypeId(next[0] ?? null);
        setWorkoutIds([]);
        setPreferredWorkoutId(null);
        return next;
      }
      if (current.length >= 3) return current;
      const next = [...current, id];
      if (!preferredSessionTypeId) setPreferredSessionTypeId(id);
      return next;
    });
  }

  function applyPreferredWorkout(workoutId: string | null, offeredTypes: readonly string[] = sessionTypeIds) {
    setPreferredWorkoutId(workoutId);
    if (!workoutId) return;
    const workout = workouts.find((row) => row.id === workoutId);
    const matched = sessionTypeForPreferredWorkout(workout, offeredTypes);
    if (matched) setPreferredSessionTypeId(matched);
  }

  function toggleWorkout(id: string) {
    setWorkoutIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((value) => value !== id);
        if (preferredWorkoutId === id) applyPreferredWorkout(next[0] ?? null);
        return next;
      }
      if (current.length >= 3) return current;
      const next = [...current, id];
      if (!preferredWorkoutId) applyPreferredWorkout(id);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (inviteeIds.length === 0) {
      setError('Pick at least one person');
      return;
    }
    if (sessionTypeIds.length < 1) {
      setError('Pick at least one session type');
      return;
    }
    const prefWorkoutId =
      preferredWorkoutId && workoutIds.includes(preferredWorkoutId) ? preferredWorkoutId : null;
    const workoutOverride = sessionTypeForPreferredWorkout(
      prefWorkoutId ? workouts.find((row) => row.id === prefWorkoutId) : null,
      sessionTypeIds,
    );
    const prefType = workoutOverride ?? preferredSessionTypeId ?? sessionTypeIds[0]!;
    if (!sessionTypeIds.includes(prefType)) {
      setError('Pick your preferred session type');
      return;
    }
    const parsed = parseDateInput(date);
    if (!parsed) {
      setError('Pick a date');
      return;
    }
    let hours24 = hour % 12;
    if (meridiem === 'PM') hours24 += 12;
    parsed.setHours(hours24, minute, 0, 0);
    await onSubmit({
      scheduledAt: parsed.toISOString(),
      inviteeIds,
      buddyIds: inviteeIds,
      offeredSessionTypeIds: sessionTypeIds,
      offeredWorkoutIds: workoutIds,
      inviterSessionTypeId: prefType,
      inviterWorkoutId: prefWorkoutId,
    });
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

  return (
    <>
      <AppModal visible={visible} transparent animationType={desktop ? 'fade' : 'slide'} onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
          <Pressable
            onPress={() => undefined}
            accessibilityViewIsModal
            style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile]}>
            <View style={styles.head}>
              <Text style={styles.title}>Invite to train</Text>
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
              <Text style={styles.label}>Date</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCalendarOpen(true)}
                style={({ pressed }) => [styles.selector, pressed && styles.selectorPressed]}>
                <Text style={styles.selectorText}>{dateLabel}</Text>
              </Pressable>

              <Text style={styles.label}>Time</Text>
              <FilterBar>
                <FilterDropdown
                  id="hour"
                  label="Hour"
                  value={hour}
                  valueLabel={String(hour)}
                  open={openMenu === 'hour'}
                  options={HOUR_OPTIONS}
                  onToggle={toggleMenu}
                  onSelect={pick(setHour)}
                  style={styles.timeDropdown}
                />
                <FilterDropdown
                  id="minute"
                  label="Min"
                  value={minute}
                  valueLabel={pad(minute)}
                  open={openMenu === 'minute'}
                  options={MINUTE_OPTIONS}
                  onToggle={toggleMenu}
                  onSelect={pick(setMinute)}
                  style={styles.timeDropdown}
                />
              </FilterBar>
              <Segmented
                value={meridiem}
                options={[
                  { value: 'AM', label: 'AM' },
                  { value: 'PM', label: 'PM' },
                ]}
                onChange={setMeridiem}
                compact
              />

              <Text style={styles.label}>Who</Text>
              <View style={styles.picks}>
                {people.length === 0 ? <Text style={styles.muted}>Add family or buddies first.</Text> : null}
                {people.map((person) => {
                  const on = inviteeIds.includes(person.id);
                  return (
                    <Choice
                      key={person.id}
                      label={`${person.name} · ${person.kind === 'family' ? 'Family' : 'Buddy'}`}
                      active={on}
                      onPress={() =>
                        setInviteeIds((current) =>
                          on ? current.filter((id) => id !== person.id) : [...current, person.id],
                        )
                      }
                    />
                  );
                })}
              </View>

              <Text style={styles.label}>Session types</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSessionPickerOpen(true)}
                style={({ pressed }) => [styles.selector, pressed && styles.selectorPressed]}>
                <Text style={styles.selectorText}>
                  {sessionTypeIds.length === 0
                    ? 'Pick 1–3 session types'
                    : sessionTypeIds.map(sessionTypeLabel).join(', ')}
                </Text>
              </Pressable>
              {sessionTypeIds.length > 0 ? (
                <>
                  <Text style={styles.subLabel}>Your preference</Text>
                  <View style={styles.picks}>
                    {sessionTypeIds.map((id) => (
                      <Choice
                        key={`pref-${id}`}
                        label={sessionTypeLabel(id)}
                        active={preferredSessionTypeId === id}
                        onPress={() => setPreferredSessionTypeId(id)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>Workouts</Text>
              <Pressable
                accessibilityRole="button"
                disabled={sessionTypeIds.length === 0}
                onPress={() => setWorkoutPickerOpen(true)}
                style={({ pressed }) => [
                  styles.selector,
                  sessionTypeIds.length === 0 && styles.selectorDisabled,
                  pressed && styles.selectorPressed,
                ]}>
                <Text style={styles.selectorText}>
                  {sessionTypeIds.length === 0
                    ? 'Pick session types first'
                    : workoutIds.length === 0
                      ? 'Optional · pick up to 3'
                      : workoutIds
                          .map((id) => workouts.find((row) => row.id === id)?.name ?? id)
                          .join(', ')}
                </Text>
              </Pressable>
              {workoutIds.length > 0 ? (
                <>
                  <Text style={styles.subLabel}>Your preferred workout</Text>
                  <View style={styles.picks}>
                    {workoutIds.map((id) => (
                      <Choice
                        key={`wpref-${id}`}
                        label={workouts.find((row) => row.id === id)?.name ?? id}
                        active={preferredWorkoutId === id}
                        onPress={() => applyPreferredWorkout(id)}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <TrainButton label="Send invite" disabled={busy} onPress={() => void submit()} fill />
          </Pressable>
        </Pressable>
      </AppModal>

      <AppModal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCalendarOpen(false)}>
          <Pressable onPress={() => undefined} style={[styles.card, styles.cardDesktop, styles.calendarCard]}>
            <View style={styles.head}>
              <Text style={styles.title}>Pick a day</Text>
              <Pressable onPress={() => setCalendarOpen(false)}>
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
                    if (!cell.iso) return;
                    setDate(cell.iso);
                    setCalendarOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.calCell,
                    cell.iso === date && styles.calCellActive,
                    pressed && cell.iso && styles.selectorPressed,
                  ]}>
                  <Text style={[styles.calCellText, cell.iso === date && styles.calCellTextActive]}>
                    {cell.day ?? ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </AppModal>

      <AppModal
        visible={sessionPickerOpen}
        transparent
        animationType={desktop ? 'fade' : 'slide'}
        onRequestClose={() => setSessionPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSessionPickerOpen(false)}>
          <Pressable
            onPress={() => undefined}
            accessibilityViewIsModal
            style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile, styles.pickerCard]}>
            <View style={styles.head}>
              <Text style={styles.title}>
                Session types{sessionTypeIds.length > 0 ? ` · ${sessionTypeIds.length}/3` : ''}
              </Text>
              <Pressable onPress={() => setSessionPickerOpen(false)} hitSlop={8}>
                <Text style={styles.close}>Done</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.pickerScroll}
              contentContainerStyle={sessionWorkoutPickerStyles.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <SessionTypePickerList selectedIds={sessionTypeIds} onToggle={toggleSessionType} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </AppModal>

      <AppModal
        visible={workoutPickerOpen}
        transparent
        animationType={desktop ? 'fade' : 'slide'}
        onRequestClose={() => setWorkoutPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setWorkoutPickerOpen(false)}>
          <Pressable
            onPress={() => undefined}
            accessibilityViewIsModal
            style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile, styles.pickerCard]}>
            <View style={styles.head}>
              <Text style={styles.title}>
                Workouts{workoutIds.length > 0 ? ` · ${workoutIds.length}/3` : ''}
              </Text>
              <Pressable onPress={() => setWorkoutPickerOpen(false)} hitSlop={8}>
                <Text style={styles.close}>Done</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.pickerScroll}
              contentContainerStyle={sessionWorkoutPickerStyles.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {workoutPickerOpen ? (
                <WorkoutPickerList
                  workouts={filteredWorkouts}
                  selectedIds={workoutIds}
                  onToggle={toggleWorkout}
                />
              ) : null}
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
  subLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
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
  pickerCard: { maxHeight: '86%' },
  pickerScroll: { flexGrow: 1, minHeight: 0 },
});
