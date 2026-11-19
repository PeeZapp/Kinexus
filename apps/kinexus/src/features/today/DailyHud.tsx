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
  HOUSEHOLD_DAY_TASK_LIMIT,
  localPuzzleDate,
  markerKindLabel,
  markersForDay,
  normalizeDayTasks,
  type CalendarEvent,
  type CalendarMarker,
  type DayTask,
} from '@kinexus/domain';

import { queueCalendarOpen } from '@/src/features/calendar/calendar-open-stash';
import { EVENT_COLOR, MARKER_COLOR } from '@/src/features/calendar/colors';
import { EventDetailSheet } from '@/src/features/calendar/EventDetailSheet';
import { loadPersonalGoogleDayEvents } from '@/src/features/calendar/google-sync';
import { loadCalendarMarkers } from '@/src/features/calendar/observances';
import { loadDayEvents } from '@/src/features/calendar/store';
import { OptionTiles } from '@/src/features/household/option-tiles';
import { ErrorText } from '@/src/features/household/ui';
import { recipeHref } from '@/src/features/meals/recipe-href';
import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius } from '@/src/features/shell/theme';
import {
  emptyUserDay,
  loadJournalEntries,
  loadUserDay,
  rollPersonalTasksForward,
  saveUserDay,
  addJournalEntry,
  type UserDay,
} from '@/src/features/today/day-store';
import {
  addHouseholdDayTask,
  loadHouseholdDayTasks,
  removeHouseholdDayTask,
  rollHouseholdDayTasksForward,
  setHouseholdDayTaskDone,
  updateHouseholdDayTask,
  type HouseholdDayTask,
} from '@/src/features/today/household-tasks-store';
import {
  isJournalPin,
  loadJournalLock,
  normalizeJournalPin,
  saveJournalPin,
  verifyJournalPin,
  type JournalLock,
} from '@/src/features/today/journal-lock';
import { loadDayMenu, type MenuCourse } from '@/src/features/today/menu';
import {
  addTalkItem,
  loadTalkItems,
  removeTalkItem,
  setTalkItemDone,
  TALK_ITEM_LIMIT,
  updateTalkItem,
  type TalkItem,
} from '@/src/features/today/talk-store';
import type { AuthUser } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { retainPostgresChannel } from '@/src/lib/realtime';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

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
    queryFn: async () => {
      if (date === today) return rollPersonalTasksForward(user, today);
      return loadUserDay(user, date);
    },
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
  const hasCalendar = dayEvents.length > 0 || dayMarkers.length > 0;

  return (
    <View style={styles.stage}>
      {saving ? <Text style={styles.status}>Saving</Text> : null}
      <ErrorText message={error} />
      <View style={desktop && hasCalendar ? styles.pair : styles.stack}>
        <View style={desktop && hasCalendar ? styles.share : styles.fill}>
          <TasksPanel
            user={user}
            date={day.date}
            tasks={day.tasks}
            onChange={(tasks) => commit({ ...dayRef.current, tasks }, true)}
          />
        </View>
        {hasCalendar ? (
          <View style={desktop ? styles.share : styles.fill}>
            <CalendarPanel
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
        ) : null}
      </View>
      <TalkPanel user={user} />
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

type TaskAudience =
  | { mode: 'me' }
  | { mode: 'household' }
  | { mode: 'people'; userIds: string[] };

type TaskEditor =
  | { kind: 'create' }
  | { kind: 'edit-personal'; id: string; done: boolean }
  | { kind: 'edit-shared'; id: string; done: boolean };

function sharedTaskTag(
  task: HouseholdDayTask,
  selfId: string,
  nameById: Map<string, string>,
): string {
  if (task.visibility === 'household') return 'Everyone';
  const names = task.visibleTo
    .filter((id) => id !== selfId)
    .map((id) => nameById.get(id) ?? 'Someone');
  if (names.length === 0) return 'Shared';
  if (names.length <= 2) return names.join(' · ');
  return `${names[0]} +${names.length - 1}`;
}

function audienceFromShared(task: HouseholdDayTask): TaskAudience {
  if (task.visibility === 'household') return { mode: 'household' };
  return { mode: 'people', userIds: [...task.visibleTo] };
}

function TasksPanel({
  user,
  date,
  tasks,
  onChange,
}: {
  user: AuthUser;
  date: string;
  tasks: DayTask[];
  onChange: (tasks: DayTask[]) => void;
}) {
  const { activeHousehold, isReady, members } = useHousehold();
  const householdId = activeHousehold?.id ?? null;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editor, setEditor] = useState<TaskEditor | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [audience, setAudience] = useState<TaskAudience>({ mode: 'me' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canShare = Boolean(householdId && isReady && isSupabaseConfigured && !user.isDevBypass);
  const others = members.filter((member) => member.profile.id !== user.id);
  const nameById = new Map(
    members.map((member) => [member.profile.id, firstName(member.profile.displayName)] as const),
  );

  const shared = useQuery({
    queryKey: ['household-day-tasks', householdId, date],
    enabled: Boolean(householdId && isSupabaseConfigured && !user.isDevBypass),
    queryFn: async () => {
      const today = localPuzzleDate();
      if (date === today) await rollHouseholdDayTasksForward(householdId!, today);
      return loadHouseholdDayTasks(householdId!, date);
    },
  });

  useEffect(() => {
    if (!canShare || !householdId || !supabase) return;
    return retainPostgresChannel(supabase, `household-day-tasks:${householdId}`, (channel) =>
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'household_day_tasks',
            filter: `household_id=eq.${householdId}`,
          },
          () => {
            void queryClient.invalidateQueries({ queryKey: ['household-day-tasks', householdId] });
          },
        )
        .subscribe(),
    );
  }, [canShare, householdId, queryClient]);

  const sharedTasks = shared.data ?? [];
  const personalFull = tasks.length >= DAY_TASK_LIMIT;
  const sharedFull = sharedTasks.length >= HOUSEHOLD_DAY_TASK_LIMIT;
  const listsFull = personalFull && sharedFull;
  const open = tasks.filter((task) => !task.done).length + sharedTasks.filter((task) => !task.done).length;
  const empty = tasks.length === 0 && sharedTasks.length === 0;
  const modalOpen = editor !== null;
  const cleanedEdit = editLabel.replace(/\s+/g, ' ').trim().slice(0, 120);
  const stayingPersonal = editor?.kind === 'edit-personal' && audience.mode === 'me';
  const stayingShared = editor?.kind === 'edit-shared' && audience.mode !== 'me';
  const audienceBlocked =
    !cleanedEdit ||
    (audience.mode === 'people' && audience.userIds.length === 0) ||
    (audience.mode === 'me' && personalFull && !stayingPersonal) ||
    (audience.mode !== 'me' && sharedFull && !stayingShared);

  const resetEditor = () => {
    setEditor(null);
    setEditLabel('');
    setAudience({ mode: 'me' });
    setError(null);
  };

  const closeModal = () => {
    if (busy) return;
    resetEditor();
  };

  const togglePerson = (id: string) => {
    setAudience((current) => {
      if (current.mode === 'people') {
        const on = current.userIds.includes(id);
        const next = on ? current.userIds.filter((item) => item !== id) : [...current.userIds, id];
        return next.length === 0 ? { mode: 'me' } : { mode: 'people', userIds: next };
      }
      return { mode: 'people', userIds: [id] };
    });
  };

  const beginAdd = () => {
    const label = draft.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!label || listsFull || busy) return;
    setError(null);
    if (!canShare) {
      if (personalFull) {
        setError('Your private list is full for this day.');
        return;
      }
      onChange(normalizeDayTasks([...tasks, { id: taskId(), label, done: false }]));
      setDraft('');
      return;
    }
    setAudience({ mode: 'me' });
    setEditLabel(label);
    setEditor({ kind: 'create' });
  };

  const beginEditPersonal = (task: DayTask) => {
    if (busy) return;
    setError(null);
    setEditLabel(task.label);
    setAudience({ mode: 'me' });
    setEditor({ kind: 'edit-personal', id: task.id, done: task.done });
  };

  const beginEditShared = (task: HouseholdDayTask) => {
    if (busy) return;
    setError(null);
    setEditLabel(task.label);
    setAudience(audienceFromShared(task));
    setEditor({ kind: 'edit-shared', id: task.id, done: task.done });
  };

  const patchSharedCache = (next: HouseholdDayTask[] | ((current: HouseholdDayTask[]) => HouseholdDayTask[])) => {
    queryClient.setQueryData<HouseholdDayTask[]>(['household-day-tasks', householdId, date], (current) => {
      const list = current ?? [];
      return typeof next === 'function' ? next(list) : next;
    });
  };

  const confirmEditor = () => {
    if (!editor || busy || audienceBlocked) return;
    const label = cleanedEdit;

    const finishLocalPersonal = (nextTasks: DayTask[]) => {
      onChange(normalizeDayTasks(nextTasks));
      if (editor.kind === 'create') setDraft('');
      resetEditor();
    };

    if (audience.mode === 'me') {
      if (editor.kind === 'create') {
        finishLocalPersonal([...tasks, { id: taskId(), label, done: false }]);
        return;
      }
      if (editor.kind === 'edit-personal') {
        finishLocalPersonal(
          tasks.map((item) => (item.id === editor.id ? { ...item, label } : item)),
        );
        return;
      }
      // Shared → private
      if (personalFull) {
        setError('Your private list is full for this day.');
        return;
      }
      if (!householdId) return;
      setBusy(true);
      setError(null);
      void removeHouseholdDayTask(editor.id)
        .then(() => {
          patchSharedCache((current) => current.filter((item) => item.id !== editor.id));
          onChange(normalizeDayTasks([...tasks, { id: taskId(), label, done: editor.done }]));
          setBusy(false);
          resetEditor();
        })
        .catch((err: unknown) => {
          setBusy(false);
          setError(err instanceof Error ? err.message : 'Could not update the task.');
        });
      return;
    }

    if (!householdId || !canShare) {
      setError('Join a household and sign in to share tasks.');
      return;
    }

    const share =
      audience.mode === 'household'
        ? ({ visibility: 'household' } as const)
        : ({ visibility: 'people', visibleTo: audience.userIds } as const);

    setBusy(true);
    setError(null);

    if (editor.kind === 'edit-shared') {
      void updateHouseholdDayTask(user, editor.id, label, share)
        .then((item) => {
          patchSharedCache((current) => current.map((row) => (row.id === item.id ? item : row)));
          setBusy(false);
          resetEditor();
        })
        .catch((err: unknown) => {
          setBusy(false);
          setError(err instanceof Error ? err.message : 'Could not update the task.');
        });
      return;
    }

    // create shared, or personal → shared
    void addHouseholdDayTask(user, householdId, date, label, share)
      .then((item) => {
        const withDone = editor.kind === 'edit-personal' ? { ...item, done: editor.done } : item;
        if (editor.kind === 'edit-personal' && editor.done !== item.done) {
          return setHouseholdDayTaskDone(item.id, editor.done).then(() => withDone);
        }
        return withDone;
      })
      .then((item) => {
        patchSharedCache((current) => [...current, item]);
        if (editor.kind === 'edit-personal') {
          onChange(normalizeDayTasks(tasks.filter((row) => row.id !== editor.id)));
        } else {
          setDraft('');
        }
        setBusy(false);
        resetEditor();
      })
      .catch((err: unknown) => {
        setBusy(false);
        setError(err instanceof Error ? err.message : 'Could not save the task.');
      });
  };

  const toggleShared = (task: HouseholdDayTask) => {
    if (!householdId || busy) return;
    const next = !task.done;
    patchSharedCache((current) =>
      current.map((item) => (item.id === task.id ? { ...item, done: next } : item)),
    );
    void setHouseholdDayTaskDone(task.id, next).catch((err: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ['household-day-tasks', householdId, date] });
      setError(err instanceof Error ? err.message : 'Could not update the task.');
    });
  };

  const removeShared = (task: HouseholdDayTask) => {
    if (!householdId || busy) return;
    patchSharedCache((current) => current.filter((item) => item.id !== task.id));
    void removeHouseholdDayTask(task.id).catch((err: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ['household-day-tasks', householdId, date] });
      setError(err instanceof Error ? err.message : 'Could not remove the task.');
    });
  };

  const meDisabled = personalFull && !stayingPersonal;
  const shareDisabled = sharedFull && !stayingShared;
  const saving = editor?.kind === 'create' ? 'Adding…' : 'Saving…';
  const saveLabel = editor?.kind === 'create' ? 'Add task' : 'Save';

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Tasks</Text>
        <Text style={styles.panelMeta}>
          {empty ? 'Clear' : open === 0 ? 'Complete' : `${open} open`}
        </Text>
      </View>
      {empty ? <Text style={styles.empty}>Nothing listed for this day.</Text> : null}
      {tasks.map((task) => (
        <View key={`me:${task.id}`} style={styles.taskRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done }}
            onPress={() =>
              onChange(tasks.map((item) => (item.id === task.id ? { ...item, done: !item.done } : item)))
            }
            style={[styles.check, task.done && styles.checkOn]}>
            {task.done ? <Text style={styles.checkMark}>✓</Text> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${task.label}`}
            onPress={() => beginEditPersonal(task)}
            style={styles.taskHit}>
            <Text style={[styles.taskLabel, task.done && styles.taskDone]} numberOfLines={2}>
              {task.label}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit Just me"
            onPress={() => beginEditPersonal(task)}
            style={styles.taskTag}>
            <Text style={styles.taskTagLabel}>Just me</Text>
          </Pressable>
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
      {sharedTasks.map((task) => {
        const tag = sharedTaskTag(task, user.id, nameById);
        return (
          <View key={`hh:${task.id}`} style={styles.taskRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.done }}
              onPress={() => toggleShared(task)}
              style={[styles.check, task.done && styles.checkOn]}>
              {task.done ? <Text style={styles.checkMark}>✓</Text> : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${task.label}`}
              onPress={() => beginEditShared(task)}
              style={styles.taskHit}>
              <Text style={[styles.taskLabel, task.done && styles.taskDone]} numberOfLines={2}>
                {task.label}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${tag}`}
              onPress={() => beginEditShared(task)}
              style={styles.taskTag}>
              <Text style={styles.taskTagLabel} numberOfLines={1}>
                {tag}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${task.label}`}
              hitSlop={8}
              onPress={() => removeShared(task)}
              style={styles.removeHit}>
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </View>
        );
      })}
      <ErrorText message={error && !modalOpen ? error : null} />
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={listsFull ? 'The list is full' : 'Add a task'}
          placeholderTextColor={colors.textDim}
          editable={!listsFull && !busy}
          style={styles.addInput}
          returnKeyType="done"
          onSubmitEditing={beginAdd}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!draft.trim() || listsFull || busy}
          onPress={beginAdd}
          style={styles.addBtn}>
          <Text style={[styles.addBtnLabel, (!draft.trim() || listsFull || busy) && styles.addBtnOff]}>
            Add
          </Text>
        </Pressable>
      </View>

      <AppModal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.sheetBackdrop} onPress={closeModal}>
          <Pressable onPress={() => undefined} accessibilityViewIsModal style={styles.taskSheetCard}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{editor?.kind === 'create' ? 'Add task' : 'Edit task'}</Text>
              <Pressable onPress={closeModal} hitSlop={8} disabled={busy}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
            </View>
            <View style={styles.taskSheetBody}>
              <TextInput
                value={editLabel}
                onChangeText={setEditLabel}
                placeholder="Task"
                placeholderTextColor={colors.textDim}
                editable={!busy}
                style={styles.taskSheetInput}
                maxLength={120}
                returnKeyType="done"
                onSubmitEditing={confirmEditor}
              />
              {canShare ? (
                <OptionTiles
                  label="Who can see"
                  rows={[
                    {
                      key: 'me',
                      label: 'Just me',
                      active: audience.mode === 'me',
                      disabled: meDisabled,
                      onPress: meDisabled ? undefined : () => setAudience({ mode: 'me' }),
                    },
                    {
                      key: 'household',
                      label: 'Everyone',
                      active: audience.mode === 'household',
                      disabled: shareDisabled,
                      onPress: shareDisabled ? undefined : () => setAudience({ mode: 'household' }),
                    },
                    ...others.map((member) => ({
                      key: member.profile.id,
                      label: firstName(member.profile.displayName),
                      active: audience.mode === 'people' && audience.userIds.includes(member.profile.id),
                      disabled: shareDisabled,
                      onPress: shareDisabled ? undefined : () => togglePerson(member.profile.id),
                    })),
                  ]}
                />
              ) : null}
              <ErrorText message={error} />
              <Pressable
                accessibilityRole="button"
                disabled={busy || audienceBlocked}
                onPress={confirmEditor}
                style={[styles.taskSheetSave, (busy || audienceBlocked) && styles.taskSheetSaveOff]}>
                <Text style={styles.taskSheetSaveLabel}>{busy ? saving : saveLabel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </AppModal>
    </View>
  );
}

function firstName(value: string | null | undefined): string {
  const first = (value ?? '').trim().split(/\s+/)[0];
  return first || 'Someone';
}

function TalkPanel({ user }: { user: AuthUser }) {
  const { activeHousehold, isReady, members } = useHousehold();
  const householdId = activeHousehold?.id ?? null;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameById = new Map(
    members.map((member) => [member.profile.id, firstName(member.profile.displayName)] as const),
  );

  const talk = useQuery({
    queryKey: ['household-talk', householdId],
    enabled: Boolean(householdId && isSupabaseConfigured && !user.isDevBypass),
    queryFn: () => loadTalkItems(householdId!),
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    const client = supabase;
    if (!client || !householdId || user.isDevBypass) return;
    return retainPostgresChannel(client, `talk-sync:${householdId}`, (channel) =>
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'household_talk_items',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['household-talk', householdId] });
        },
      ),
    );
  }, [householdId, queryClient, user.isDevBypass]);

  const items = talk.data ?? [];
  const full = items.length >= TALK_ITEM_LIMIT;
  const open = items.filter((item) => !item.done).length;
  const canWrite = Boolean(householdId && isSupabaseConfigured && !user.isDevBypass);
  const modalOpen = editingId !== null;
  const cleanedEdit = editBody.replace(/\s+/g, ' ').trim().slice(0, 120);

  const patchCache = (next: TalkItem[]) => {
    if (!householdId) return;
    queryClient.setQueryData<TalkItem[]>(['household-talk', householdId], next);
  };

  const closeEdit = () => {
    if (busy) return;
    setEditingId(null);
    setEditBody('');
    setError(null);
  };

  const beginEdit = (item: TalkItem) => {
    if (!canWrite || busy) return;
    setError(null);
    setEditingId(item.id);
    setEditBody(item.body);
  };

  const saveEdit = () => {
    if (!editingId || !cleanedEdit || !canWrite || busy) return;
    setBusy(true);
    setError(null);
    const previous = items;
    patchCache(items.map((row) => (row.id === editingId ? { ...row, body: cleanedEdit } : row)));
    void updateTalkItem(editingId, cleanedEdit)
      .then((item) => {
        patchCache(previous.map((row) => (row.id === item.id ? item : row)));
        setBusy(false);
        setEditingId(null);
        setEditBody('');
      })
      .catch((err: unknown) => {
        patchCache(previous);
        setBusy(false);
        setError(err instanceof Error ? err.message : 'Could not update that.');
      });
  };

  const add = () => {
    const body = draft.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!body || !householdId || !canWrite || full || busy) return;
    setBusy(true);
    setError(null);
    void addTalkItem(user, householdId, body)
      .then((item) => {
        setDraft('');
        patchCache([...items, item].slice(0, TALK_ITEM_LIMIT));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not add that.');
      })
      .finally(() => setBusy(false));
  };

  const toggle = (item: TalkItem) => {
    if (!canWrite || busy) return;
    const nextDone = !item.done;
    patchCache(items.map((row) => (row.id === item.id ? { ...row, done: nextDone } : row)));
    void setTalkItemDone(item.id, nextDone).catch((err: unknown) => {
      patchCache(items);
      setError(err instanceof Error ? err.message : 'Could not update that.');
    });
  };

  const remove = (item: TalkItem) => {
    if (!canWrite || busy) return;
    patchCache(items.filter((row) => row.id !== item.id));
    void removeTalkItem(item.id).catch((err: unknown) => {
      patchCache(items);
      setError(err instanceof Error ? err.message : 'Could not remove that.');
    });
  };

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Discuss</Text>
        <Text style={styles.panelMeta}>
          {!isReady
            ? '…'
            : !activeHousehold
              ? 'Household'
              : items.length === 0
                ? 'Shared'
                : open === 0
                  ? 'Caught up'
                  : `${open} open`}
        </Text>
      </View>
      {!isReady || talk.isLoading ? <Text style={styles.empty}>Opening the list…</Text> : null}
      {isReady && !activeHousehold ? (
        <Text style={styles.empty}>Join a household to share things to talk about.</Text>
      ) : null}
      {isReady && activeHousehold && !canWrite ? (
        <Text style={styles.empty}>Talk syncs when you are signed in to the household.</Text>
      ) : null}
      <ErrorText
        message={
          (!modalOpen ? error : null) ??
          (talk.error instanceof Error
            ? talk.error.message
            : talk.isError
              ? 'Could not load talk items.'
              : null)
        }
      />
      {items.map((item) => {
        const who = nameById.get(item.createdBy) ?? 'Someone';
        return (
          <View key={item.id} style={styles.taskRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              disabled={!canWrite}
              onPress={() => toggle(item)}
              style={[styles.check, item.done && styles.checkOn]}>
              {item.done ? <Text style={styles.checkMark}>✓</Text> : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={canWrite ? `Edit ${item.body}` : item.body}
              disabled={!canWrite}
              onPress={() => beginEdit(item)}
              style={styles.talkBody}>
              <Text style={[styles.taskLabel, item.done && styles.taskDone]} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.talkWho}>{who}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.body}`}
              disabled={!canWrite}
              hitSlop={8}
              onPress={() => remove(item)}
              style={styles.removeHit}>
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </View>
        );
      })}
      {isReady && activeHousehold && canWrite && !talk.isLoading && !talk.isError && items.length === 0 ? (
        <Text style={styles.empty}>Nothing to talk about yet.</Text>
      ) : null}
      {canWrite ? (
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={full ? 'The list is full' : 'Add something to talk about'}
            placeholderTextColor={colors.textDim}
            editable={!full && !busy}
            style={styles.addInput}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!draft.trim() || full || busy}
            onPress={add}
            style={styles.addBtn}>
            <Text style={[styles.addBtnLabel, (!draft.trim() || full || busy) && styles.addBtnOff]}>Add</Text>
          </Pressable>
        </View>
      ) : null}

      <AppModal visible={modalOpen} transparent animationType="fade" onRequestClose={closeEdit}>
        <Pressable style={styles.sheetBackdrop} onPress={closeEdit}>
          <Pressable onPress={() => undefined} accessibilityViewIsModal style={styles.taskSheetCard}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Edit</Text>
              <Pressable onPress={closeEdit} hitSlop={8} disabled={busy}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
            </View>
            <View style={styles.taskSheetBody}>
              <TextInput
                value={editBody}
                onChangeText={setEditBody}
                placeholder="Something to talk about"
                placeholderTextColor={colors.textDim}
                editable={!busy}
                style={styles.taskSheetInput}
                maxLength={120}
                returnKeyType="done"
                onSubmitEditing={saveEdit}
                autoFocus
              />
              <ErrorText message={error} />
              <Pressable
                accessibilityRole="button"
                disabled={busy || !cleanedEdit}
                onPress={saveEdit}
                style={[styles.taskSheetSave, (busy || !cleanedEdit) && styles.taskSheetSaveOff]}>
                <Text style={styles.taskSheetSaveLabel}>{busy ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </AppModal>
    </View>
  );
}

function CalendarPanel({
  error,
  events,
  markers,
  day,
  peopleNames,
}: {
  error: string | null;
  events: CalendarEvent[];
  markers: CalendarMarker[];
  day: string;
  peopleNames: Map<string, string>;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const open = events.filter((event) => !eventIsPast(event, day)).length;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Calendar</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/calendar' as Href)} hitSlop={6}>
          <Text style={styles.link}>Family calendar</Text>
        </Pressable>
      </View>
      <ErrorText message={error} />
      {markers.map((marker) => (
        <Pressable
          key={marker.id}
          accessibilityRole="link"
          onPress={() => {
            queueCalendarOpen({ day, mode: 'day' });
            router.push('/calendar' as Href);
          }}
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
            accessibilityRole="button"
            onPress={() => setDetail(event)}
            style={({ pressed }) => [styles.calRow, pressed && styles.coursePressed, past && styles.calPast]}>
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
      {events.length > 0 ? (
        <Text style={styles.panelFoot}>{open === 0 ? 'All done for now' : open === 1 ? '1 still ahead' : `${open} still ahead`}</Text>
      ) : null}

      <EventDetailSheet
        visible={Boolean(detail)}
        event={detail}
        people={peopleNames}
        onClose={() => setDetail(null)}
        onEdit={
          detail && detail.source !== 'google'
            ? () => {
                const eventId = detail.id;
                const eventDay = detail.startsOn || day;
                setDetail(null);
                queueCalendarOpen({ day: eventDay, eventId, mode: 'edit' });
                router.push('/calendar' as Href);
              }
            : undefined
        }
      />
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
  taskHit: {
    flex: 1,
    minWidth: 0,
  },
  taskLabel: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  taskTag: {
    maxWidth: 108,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  taskTagLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  talkBody: {
    flex: 1,
    gap: 1,
  },
  talkWho: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  taskDone: {
    color: colors.textDim,
    textDecorationLine: 'line-through',
  },
  taskSheetCard: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  taskSheetBody: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  taskSheetInput: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  taskSheetSave: {
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskSheetSaveOff: {
    opacity: 0.4,
  },
  taskSheetSaveLabel: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
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
