import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  addDaysIso,
  alertEventsForDay,
  calendarRecurrenceLabel,
  DAY_TASK_LIMIT,
  eventIsPast,
  formatEventTimeLabel,
  localPuzzleDate,
  markerKindLabel,
  markersForDay,
  normalizeDayTasks,
  type CalendarEvent,
  type CalendarMarker,
  type DayTask,
} from '@kinexus/domain';

import { EVENT_COLOR, MARKER_COLOR } from '@/src/features/calendar/colors';
import { loadPersonalGoogleDayEvents } from '@/src/features/calendar/google-sync';
import { loadCalendarMarkers } from '@/src/features/calendar/observances';
import { loadDayEvents } from '@/src/features/calendar/store';
import { ErrorText } from '@/src/features/household/ui';
import { recipeHref } from '@/src/features/meals/recipe-href';
import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius } from '@/src/features/shell/theme';
import { emptyUserDay, loadJournalEntries, loadUserDay, saveUserDay, addJournalEntry, type UserDay } from '@/src/features/today/day-store';
import {
  isJournalPin,
  loadJournalLock,
  normalizeJournalPin,
  saveJournalPin,
  verifyJournalPin,
  type JournalLock,
} from '@/src/features/today/journal-lock';
import { loadDayMenu, type MenuCourse } from '@/src/features/today/menu';
import type { AuthUser } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { isSupabaseConfigured } from '@/src/lib/supabase';

function taskId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const first = name.trim().split(/\s+/)[0] || 'there';
  return `Good ${part}, ${first}`;
}

function dateFromIso(iso: string): Date | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function longDate(iso: string): string {
  return dateFromIso(iso)?.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) ?? iso;
}

function shortDate(iso: string): string {
  return dateFromIso(iso)?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) ?? iso;
}

export function DailyHud({
  user,
  desktop,
  weather,
  children,
}: {
  user: AuthUser;
  desktop: boolean;
  weather?: ReactNode;
  children?: ReactNode;
}) {
  const today = localPuzzleDate();
  const [date, setDate] = useState(today);
  const earliest = addDaysIso(today, -90);
  const latest = addDaysIso(today, 1);
  const day = useQuery({
    queryKey: ['user-day', user.id, date],
    queryFn: () => loadUserDay(user, date),
  });
  const onToday = date === today;

  return (
    <View style={styles.board}>
      <View style={[styles.mast, desktop && styles.mastDesktop]}>
        <View style={styles.mastCopy}>
          <Text style={styles.kicker}>Today</Text>
          <View style={styles.titleLine}>
            <Text style={[styles.title, desktop && styles.titleDesktop]}>{greeting(user.displayName)}</Text>
            {weather}
          </View>
          <Text style={styles.subline}>{onToday ? longDate(date) : `Showing ${longDate(date)}`}</Text>
        </View>
        <View style={styles.mastTools}>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous day"
              disabled={date <= earliest}
              onPress={() => setDate((current) => addDaysIso(current, -1))}
              style={[styles.step, date <= earliest && styles.stepOff]}>
              <Text style={styles.stepLabel}>‹</Text>
            </Pressable>
            <Text style={styles.stepDate}>{shortDate(date)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next day"
              disabled={date >= latest}
              onPress={() => setDate((current) => addDaysIso(current, 1))}
              style={[styles.step, date >= latest && styles.stepOff]}>
              <Text style={styles.stepLabel}>›</Text>
            </Pressable>
          </View>
          {onToday ? null : (
            <Pressable accessibilityRole="button" onPress={() => setDate(today)} style={styles.todayBtn}>
              <Text style={styles.todayBtnLabel}>Today</Text>
            </Pressable>
          )}
        </View>
      </View>

      {children}

      {day.isLoading ? <Text style={styles.muted}>Opening this day…</Text> : null}
      {day.isError ? (
        <ErrorText message={day.error instanceof Error ? day.error.message : 'Could not open this day.'} />
      ) : null}
      {day.data ? (
        <DayBoard
          key={`${user.id}:${date}`}
          user={user}
          desktop={desktop}
          initial={day.data ?? emptyUserDay(date)}
          onOpenDay={setDate}
        />
      ) : null}
    </View>
  );
}

function DayBoard({
  user,
  desktop,
  initial,
  onOpenDay,
}: {
  user: AuthUser;
  desktop: boolean;
  initial: UserDay;
  onOpenDay: (date: string) => void;
}) {
  const { activeHousehold, isReady, people } = useHousehold();
  const peopleKey = people.map((person) => `${person.id}:${person.birthday}`).join('|');
  const queryClient = useQueryClient();
  const [day, setDay] = useState(initial);
  const dayRef = useRef(initial);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      void saveUserDay(user, dayRef.current);
    };
  }, [user]);

  const commit = (next: UserDay, immediate: boolean) => {
    dayRef.current = next;
    setDay(next);
    setError(null);
    setSaving(true);
    const rev = ++revision.current;
    const flush = () => {
      if (rev !== revision.current) return;
      const snapshot = dayRef.current;
      queue.current = queue.current.catch(() => undefined).then(async () => {
        try {
          await saveUserDay(user, snapshot);
          void queryClient.invalidateQueries({ queryKey: ['journal-entries', user.id] });
          if (alive.current && rev === revision.current) setSaving(false);
        } catch (err: unknown) {
          if (!alive.current || rev !== revision.current) return;
          setSaving(false);
          setError(err instanceof Error ? err.message : 'Could not save this day.');
        }
      });
    };
    if (timer.current) clearTimeout(timer.current);
    if (immediate) {
      timer.current = null;
      flush();
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, 500);
  };

  const menu = useQuery({
    queryKey: ['today-menu', activeHousehold?.id, day.date],
    enabled: Boolean(activeHousehold),
    queryFn: () => loadDayMenu(activeHousehold!.id, day.date),
    staleTime: 60 * 1000,
  });

  const calendar = useQuery({
    queryKey: ['today-events', activeHousehold?.id, day.date],
    enabled: Boolean(activeHousehold && isSupabaseConfigured),
    queryFn: () => loadDayEvents(activeHousehold!.id, day.date),
    staleTime: 30 * 1000,
  });

  const personalGoogle = useQuery({
    queryKey: ['today-personal-google', user.id, day.date],
    enabled: isSupabaseConfigured,
    queryFn: () => loadPersonalGoogleDayEvents(day.date),
    staleTime: 60 * 1000,
  });

  const markers = useQuery({
    queryKey: ['today-markers', activeHousehold?.id, activeHousehold?.country, day.date, peopleKey],
    enabled: Boolean(activeHousehold),
    queryFn: () =>
      loadCalendarMarkers({
        country: activeHousehold!.country,
        people,
        from: day.date,
        to: day.date,
      }),
    staleTime: 60 * 60 * 1000,
  });

  const dayEvents = alertEventsForDay(
    [...(calendar.data ?? []), ...(personalGoogle.data ?? [])],
    day.date,
  );
  const dayMarkers = markersForDay(markers.data ?? [], day.date);

  return (
    <View style={styles.stage}>
      {saving ? <Text style={styles.status}>Saving</Text> : null}
      <ErrorText message={error} />
      <View style={desktop ? styles.pair : styles.stack}>
        <View style={desktop ? styles.share : styles.fill}>
          <TasksPanel tasks={day.tasks} onChange={(tasks) => commit({ ...dayRef.current, tasks }, true)} />
        </View>
        <View style={desktop ? styles.share : styles.fill}>
          <CalendarPanel
            ready={isReady}
            hasHousehold={Boolean(activeHousehold)}
            loading={
              (Boolean(activeHousehold) && (calendar.isLoading || markers.isLoading)) ||
              personalGoogle.isLoading
            }
            error={
              calendar.error instanceof Error
                ? calendar.error.message
                : calendar.isError
                  ? 'Could not load the calendar.'
                  : null
            }
            events={dayEvents}
            markers={dayMarkers}
            day={day.date}
            peopleNames={new Map((people ?? []).map((person) => [person.id, person.name]))}
          />
        </View>
      </View>
      <View style={styles.stack}>
        <MenuPanel
          ready={isReady}
          hasHousehold={Boolean(activeHousehold)}
          loading={Boolean(activeHousehold) && menu.isLoading}
          error={menu.error instanceof Error ? menu.error.message : menu.isError ? 'Could not load the menu.' : null}
          courses={menu.data ?? []}
        />
        <JournalPanel date={day.date} onOpenDay={onOpenDay} user={user} />
      </View>
    </View>
  );
}

function TasksPanel({ tasks, onChange }: { tasks: DayTask[]; onChange: (tasks: DayTask[]) => void }) {
  const [draft, setDraft] = useState('');
  const full = tasks.length >= DAY_TASK_LIMIT;
  const open = tasks.filter((task) => !task.done).length;

  const add = () => {
    const label = draft.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!label || full) return;
    onChange(normalizeDayTasks([...tasks, { id: taskId(), label, done: false }]));
    setDraft('');
  };

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Tasks</Text>
        <Text style={styles.panelMeta}>{tasks.length === 0 ? 'Clear' : open === 0 ? 'Complete' : `${open} open`}</Text>
      </View>
      {tasks.length === 0 ? <Text style={styles.empty}>Nothing listed for this day.</Text> : null}
      {tasks.map((task) => (
        <View key={task.id} style={styles.taskRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done }}
            onPress={() => onChange(tasks.map((item) => (item.id === task.id ? { ...item, done: !item.done } : item)))}
            style={[styles.check, task.done && styles.checkOn]}>
            {task.done ? <Text style={styles.checkMark}>✓</Text> : null}
          </Pressable>
          <Text style={[styles.taskLabel, task.done && styles.taskDone]}>{task.label}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${task.label}`}
            hitSlop={8}
            onPress={() => onChange(tasks.filter((item) => item.id !== task.id))}
            style={styles.removeHit}>
            <Text style={styles.remove}>×</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={full ? 'The list is full' : 'Add a task'}
          placeholderTextColor={colors.textDim}
          editable={!full}
          style={styles.addInput}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <Pressable accessibilityRole="button" disabled={!draft.trim() || full} onPress={add} style={styles.addBtn}>
          <Text style={[styles.addBtnLabel, (!draft.trim() || full) && styles.addBtnOff]}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CalendarPanel({
  ready,
  hasHousehold,
  loading,
  error,
  events,
  markers,
  day,
  peopleNames,
}: {
  ready: boolean;
  hasHousehold: boolean;
  loading: boolean;
  error: string | null;
  events: CalendarEvent[];
  markers: CalendarMarker[];
  day: string;
  peopleNames: Map<string, string>;
}) {
  const router = useRouter();
  const open = events.filter((event) => !eventIsPast(event, day)).length;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Calendar</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/calendar' as Href)} hitSlop={6}>
          <Text style={styles.link}>Family calendar</Text>
        </Pressable>
      </View>
      {!ready || loading ? <Text style={styles.empty}>Checking the day…</Text> : null}
      {ready && !hasHousehold ? <Text style={styles.empty}>Join a household to see family events.</Text> : null}
      <ErrorText message={error} />
      {markers.map((marker) => (
        <Pressable
          key={marker.id}
          accessibilityRole="link"
          onPress={() => router.push('/calendar' as Href)}
          style={({ pressed }) => [styles.calRow, pressed && styles.coursePressed]}>
          <View style={[styles.calDot, { backgroundColor: MARKER_COLOR[marker.kind] }]} />
          <View style={styles.calBody}>
            <Text style={styles.calTime}>{markerKindLabel(marker.kind)}</Text>
            <Text style={styles.calTitle} numberOfLines={1}>
              {marker.title}
            </Text>
            {marker.source ? (
              <Text style={styles.calMeta} numberOfLines={1}>
                {marker.source}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
      {events.map((event) => {
        const past = eventIsPast(event, day);
        const personal = event.source === 'google';
        const who = event.personIds
          .map((id) => peopleNames.get(id))
          .filter(Boolean)
          .join(' · ');
        const meta = personal
          ? [event.calendarName || 'Personal', event.location].filter(Boolean).join(' · ')
          : [who, event.location].filter(Boolean).join(' · ');
        return (
          <Pressable
            key={event.id}
            accessibilityRole="link"
            onPress={() => (personal ? undefined : router.push('/calendar' as Href))}
            style={({ pressed }) => [styles.calRow, pressed && !personal && styles.coursePressed, past && styles.calPast]}>
            <View style={[styles.calDot, { backgroundColor: EVENT_COLOR[event.color] }]} />
            <View style={styles.calBody}>
              <Text style={styles.calTime}>
                {formatEventTimeLabel(event)}
                {event.recurrence !== 'none' ? ` · ${calendarRecurrenceLabel(event.recurrence)}` : ''}
                {personal ? ' · Google' : ''}
              </Text>
              <Text style={[styles.calTitle, past && styles.taskDone]} numberOfLines={1}>
                {event.title}
              </Text>
              {meta ? (
                <Text style={styles.calMeta} numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {ready && hasHousehold && !loading && !error && events.length === 0 && markers.length === 0 ? (
        <Text style={styles.empty}>No family events for this day.</Text>
      ) : null}
      {ready && hasHousehold && !loading && events.length > 0 ? (
        <Text style={styles.panelFoot}>{open === 0 ? 'All done for now' : open === 1 ? '1 still ahead' : `${open} still ahead`}</Text>
      ) : null}
    </View>
  );
}

function MenuPanel({
  ready,
  hasHousehold,
  loading,
  error,
  courses,
}: {
  ready: boolean;
  hasHousehold: boolean;
  loading: boolean;
  error: string | null;
  courses: MenuCourse[];
}) {
  const router = useRouter();
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Menu</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/meals')} hitSlop={6}>
          <Text style={styles.link}>Meal plan</Text>
        </Pressable>
      </View>
      {!ready || loading ? <Text style={styles.empty}>Checking the plan…</Text> : null}
      {ready && !hasHousehold ? <Text style={styles.empty}>Join a household to see the meal plan.</Text> : null}
      <ErrorText message={error} />
      {courses.map((course) => {
        const name = `${course.emoji ? `${course.emoji} ` : ''}${course.name}`;
        const row = (
          <>
            <Text style={styles.courseSlot}>{course.label}</Text>
            <Text style={styles.courseName} numberOfLines={1}>
              {name}
            </Text>
          </>
        );
        if (!course.recipeId) {
          return (
            <View key={course.slotKey} style={styles.course}>
              {row}
            </View>
          );
        }
        return (
          <Pressable
            key={course.slotKey}
            accessibilityRole="link"
            onPress={() => router.push(recipeHref(course.recipeId!))}
            style={({ pressed }) => [styles.course, pressed && styles.coursePressed]}>
            {row}
          </Pressable>
        );
      })}
      {ready && hasHousehold && !loading && !error && courses.length === 0 ? (
        <Text style={styles.empty}>Nothing is planned for this day.</Text>
      ) : null}
    </View>
  );
}

function JournalPanel({
  user,
  date,
  onOpenDay,
}: {
  user: AuthUser;
  date: string;
  onOpenDay: (date: string) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ready = draft.trim().length > 0 && !busy;

  const submit = () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    void addJournalEntry(user, date, body)
      .then(async () => {
        setDraft('');
        await queryClient.invalidateQueries({ queryKey: ['journal-entries', user.id] });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not log this entry.');
      })
      .finally(() => setBusy(false));
  };

  return (
    <View style={[styles.panel, styles.journal]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open your journal entries"
        onPress={() => setOpen(true)}
        style={styles.panelHead}>
        <View style={styles.journalTitle}>
          <Text style={styles.panelTitle}>Journal</Text>
          <View style={styles.privateMark}>
            <Text style={styles.privateLabel}>Private</Text>
          </View>
        </View>
        <Text style={styles.link}>Entries</Text>
      </Pressable>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="How did the day go?"
        placeholderTextColor={colors.textDim}
        style={styles.journalInput}
        multiline
        textAlignVertical="top"
        maxLength={8000}
      />
      <View style={styles.journalSubmitRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!ready}
          onPress={submit}
          style={[styles.journalSubmit, !ready && styles.stepOff]}>
          <Text style={styles.journalSubmitLabel}>{busy ? 'Logging…' : 'Log entry'}</Text>
        </Pressable>
      </View>
      <ErrorText message={error} />
      <JournalArchive
        user={user}
        visible={open}
        onClose={() => setOpen(false)}
        onOpenDay={(next) => {
          setOpen(false);
          onOpenDay(next);
        }}
      />
    </View>
  );
}

function JournalArchive({
  user,
  visible,
  onClose,
  onOpenDay,
}: {
  user: AuthUser;
  visible: boolean;
  onClose: () => void;
  onOpenDay: (date: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const lock = useQuery({
    queryKey: ['journal-lock', user.id],
    queryFn: () => loadJournalLock(user),
    enabled: visible,
  });
  const entries = useQuery({
    queryKey: ['journal-entries', user.id],
    queryFn: () => loadJournalEntries(user),
    enabled: visible && unlocked,
  });
  const reading = entries.data?.find((entry) => entry.id === selected) ?? null;
  const gated = !unlocked || changingPin;

  const close = () => {
    setSelected(null);
    setUnlocked(false);
    setChangingPin(false);
    onClose();
  };

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setUnlocked(false);
      setChangingPin(false);
    }
  }, [visible]);

  const title = changingPin
    ? 'Change PIN'
    : !unlocked
      ? lock.data
        ? 'Unlock journal'
        : 'Set journal PIN'
      : reading
        ? entryTitle(reading.date, reading.createdAt)
        : 'Journal';

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.sheetBackdrop} onPress={close}>
        <Pressable onPress={() => undefined} accessibilityViewIsModal style={styles.sheetCard}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable
              onPress={() => {
                if (changingPin) {
                  setChangingPin(false);
                  return;
                }
                if (reading) {
                  setSelected(null);
                  return;
                }
                close();
              }}
              hitSlop={8}>
              <Text style={styles.link}>{changingPin ? 'Cancel' : reading ? 'All entries' : 'Close'}</Text>
            </Pressable>
          </View>
          {lock.isLoading ? (
            <View style={styles.sheetBody}>
              <Text style={styles.empty}>Checking your PIN…</Text>
            </View>
          ) : lock.isError ? (
            <View style={styles.sheetBody}>
              <ErrorText message={lock.error instanceof Error ? lock.error.message : 'Could not load your journal lock.'} />
            </View>
          ) : gated ? (
            <JournalPinGate
              user={user}
              lock={lock.data ?? null}
              mode={changingPin ? 'change' : lock.data ? 'unlock' : 'setup'}
              onUnlocked={() => {
                setUnlocked(true);
                setChangingPin(false);
              }}
            />
          ) : (
            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
              {entries.isLoading ? <Text style={styles.empty}>Opening your entries…</Text> : null}
              {entries.isError ? (
                <ErrorText message={entries.error instanceof Error ? entries.error.message : 'Could not open your journal.'} />
              ) : null}
              {reading ? (
                <View style={styles.entryBody}>
                  <Text style={styles.entryText}>{reading.body}</Text>
                  <Pressable onPress={() => onOpenDay(reading.date)} style={styles.entryOpen}>
                    <Text style={styles.link}>Open this day</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Pressable onPress={() => setChangingPin(true)} style={styles.pinManage}>
                    <Text style={styles.link}>Change PIN</Text>
                  </Pressable>
                  {entries.data?.map((entry) => (
                    <Pressable key={entry.id} onPress={() => setSelected(entry.id)} style={styles.entryRow}>
                      <Text style={styles.entryDate}>{entryTitle(entry.date, entry.createdAt)}</Text>
                      <Text style={styles.entryPreview} numberOfLines={2}>
                        {entry.body}
                      </Text>
                    </Pressable>
                  ))}
                  {entries.data && entries.data.length === 0 ? <Text style={styles.empty}>No entries yet.</Text> : null}
                </>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

function JournalPinGate({
  user,
  lock,
  mode,
  onUnlocked,
}: {
  user: AuthUser;
  lock: JournalLock | null;
  mode: 'setup' | 'unlock' | 'change';
  onUnlocked: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'current' | 'create' | 'confirm'>(
    mode === 'unlock' ? 'current' : mode === 'change' ? 'current' : 'create',
  );
  const [pin, setPin] = useState('');
  const [pending, setPending] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep(mode === 'unlock' ? 'current' : mode === 'change' ? 'current' : 'create');
    setPin('');
    setPending('');
    setBusy(false);
    setError(null);
  }, [mode]);

  const copy =
    step === 'current'
      ? mode === 'change'
        ? 'Enter your current 6-digit PIN.'
        : 'Enter your 6-digit PIN to open past entries.'
      : step === 'create'
        ? mode === 'change'
          ? 'Choose a new 6-digit PIN.'
          : 'Choose a 6-digit PIN to keep your journal private on this device.'
        : 'Enter the same PIN again to confirm.';

  const submit = (value: string) => {
    if (busy || !isJournalPin(value)) return;
    setBusy(true);
    setError(null);

    const finish = (err?: string) => {
      setBusy(false);
      if (err) {
        setError(err);
        setPin('');
        return;
      }
      setPin('');
    };

    if (step === 'current') {
      void verifyJournalPin(user, value, lock)
        .then((ok) => {
          if (!ok) {
            finish('That PIN is incorrect.');
            return;
          }
          if (mode === 'unlock') {
            onUnlocked();
            finish();
            return;
          }
          setPending('');
          setStep('create');
          finish();
        })
        .catch((err: unknown) => {
          finish(err instanceof Error ? err.message : 'Could not check your PIN.');
        });
      return;
    }

    if (step === 'create') {
      setPending(value);
      setStep('confirm');
      finish();
      return;
    }

    if (value !== pending) {
      setStep('create');
      setPending('');
      finish('Those PINs did not match. Try again.');
      return;
    }

    void saveJournalPin(user, value)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ['journal-lock', user.id] });
        onUnlocked();
        finish();
      })
      .catch((err: unknown) => {
        finish(err instanceof Error ? err.message : 'Could not save your PIN.');
      });
  };

  const pushDigit = (digit: string) => {
    if (busy) return;
    const next = normalizeJournalPin(pin + digit);
    setPin(next);
    setError(null);
    if (next.length === 6) submit(next);
  };

  const backspace = () => {
    if (busy) return;
    setPin((current) => current.slice(0, -1));
    setError(null);
  };

  return (
    <View style={styles.pinGate}>
      <Text style={styles.pinCopy}>{copy}</Text>
      <View style={styles.pinDots} accessibilityLabel={`${pin.length} of 6 digits entered`}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={[styles.pinDot, index < pin.length && styles.pinDotOn]} />
        ))}
      </View>
      <ErrorText message={error} />
      <View style={styles.pinPad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) => {
          if (!key) return <View key="blank" style={styles.pinKey} />;
          const isBack = key === '⌫';
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={isBack ? 'Delete' : key}
              disabled={busy}
              onPress={() => (isBack ? backspace() : pushDigit(key))}
              style={({ pressed }) => [styles.pinKey, pressed && styles.pinKeyPressed, busy && styles.stepOff]}>
              <Text style={styles.pinKeyLabel}>{key}</Text>
            </Pressable>
          );
        })}
      </View>
      {busy ? <Text style={styles.muted}>Working…</Text> : null}
    </View>
  );
}

function entryTitle(date: string, createdAt: string | null): string {
  if (!createdAt) return longDate(date);
  const when = new Date(createdAt);
  if (Number.isNaN(when.getTime())) return longDate(date);
  return when.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  board: {
    gap: 22,
  },
  mast: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  mastDesktop: {
    alignItems: 'flex-end',
  },
  mastCopy: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 220,
    gap: 4,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  titleDesktop: {
    fontSize: 40,
    lineHeight: 46,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  subline: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 2,
  },
  mastTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  step: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: {
    opacity: 0.35,
  },
  stepLabel: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
  },
  stepDate: {
    minWidth: 92,
    textAlign: 'center',
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  todayBtn: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  todayBtnLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  stage: {
    gap: 12,
  },
  status: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  columns: {
    gap: 12,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  share: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  fill: {
    alignSelf: 'stretch',
  },
  stack: {
    gap: 12,
  },
  panel: {
    alignSelf: 'stretch',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  journal: {
    alignSelf: 'stretch',
    paddingBottom: 16,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 28,
    marginBottom: 8,
  },
  journalTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  panelMeta: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  panelFoot: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    paddingTop: 4,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 48,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  calPast: {
    opacity: 0.55,
  },
  calDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  calBody: {
    flex: 1,
    gap: 1,
  },
  calTime: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  calTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  calMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  privateMark: {
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  privateLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 8,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkMark: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  taskLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  taskDone: {
    color: colors.textDim,
    textDecorationLine: 'line-through',
  },
  removeHit: {
    paddingVertical: 8,
  },
  remove: {
    color: colors.textDim,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '500',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 44,
    paddingVertical: 10,
  },
  addBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  addBtnLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  addBtnOff: {
    opacity: 0.35,
  },
  course: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  coursePressed: {
    opacity: 0.72,
  },
  courseSlot: {
    width: 118,
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  courseName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  journalInput: {
    minHeight: 96,
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
    paddingTop: 4,
    paddingBottom: 8,
  },
  journalSubmitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
  journalSubmit: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  journalSubmitLabel: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  link: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 12, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  sheetCard: {
    maxWidth: 640,
    width: '100%',
    maxHeight: '80%',
    alignSelf: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sheetBody: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  entryRow: {
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryDate: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  entryPreview: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  entryBody: {
    gap: 16,
    paddingVertical: 12,
  },
  entryText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
  },
  entryOpen: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  pinManage: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 4,
  },
  pinGate: {
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  pinCopy: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.textDim,
    backgroundColor: 'transparent',
  },
  pinDotOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pinPad: {
    width: '100%',
    maxWidth: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  pinKey: {
    width: '30%',
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinKeyPressed: {
    opacity: 0.72,
  },
  pinKeyLabel: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
  },
});
