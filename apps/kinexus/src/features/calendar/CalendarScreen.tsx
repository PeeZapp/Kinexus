import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  addDaysIso,
  calendarRecurrenceLabel,
  draftFromEvent,
  emptyEventDraft,
  eventDotDates,
  eventsForDay,
  expandEventsInRange,
  formatCalendarDayHeading,
  formatEventTimeLabel,
  formatMonthHeading,
  markerDotDates,
  markerKindLabel,
  markersForDay,
  monthGrid,
  occurrenceKey,
  shiftCalendarMonth,
  todayIso,
  type CalendarEvent,
  type CalendarEventDraft,
} from '@kinexus/domain';

import { EVENT_COLOR, EVENT_COLOR_SOFT, MARKER_COLOR, MARKER_COLOR_SOFT } from '@/src/features/calendar/colors';
import { EventSheet } from '@/src/features/calendar/EventSheet';
import { loadPersonalGoogleEventsInRange } from '@/src/features/calendar/google-sync';
import { loadCalendarMarkers } from '@/src/features/calendar/observances';
import {
  createHouseholdEvent,
  deleteHouseholdEvent,
  loadHouseholdEventMasters,
  updateHouseholdEvent,
} from '@/src/features/calendar/store';
import { Btn } from '@/src/features/household/ui';
import { EmptyState, ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';
import { isSupabaseConfigured } from '@/src/lib/supabase';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function CalendarScreen() {
  const { user } = useAuth();
  const { activeHousehold, people, isReady } = useHousehold();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const queryClient = useQueryClient();

  const today = todayIso();
  const [selected, setSelected] = useState(today);
  const [monthCursor, setMonthCursor] = useState(selected);
  const [draft, setDraft] = useState<CalendarEventDraft | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rangeFrom = addDaysIso(monthCursor.slice(0, 7) + '-01', -7);
  const rangeTo = addDaysIso(shiftCalendarMonth(monthCursor, 1).slice(0, 7) + '-01', 41);

  const query = useQuery({
    queryKey: ['household-events', activeHousehold?.id, rangeFrom, rangeTo],
    enabled: Boolean(activeHousehold?.id && isSupabaseConfigured),
    queryFn: () => loadHouseholdEventMasters(activeHousehold!.id, rangeFrom, rangeTo),
    staleTime: 30_000,
  });

  const markersQuery = useQuery({
    queryKey: ['calendar-markers', activeHousehold?.id, activeHousehold?.country, rangeFrom, rangeTo, people.map((p) => `${p.id}:${p.birthday}`).join('|')],
    enabled: Boolean(activeHousehold?.id),
    queryFn: () =>
      loadCalendarMarkers({
        country: activeHousehold!.country,
        people,
        from: rangeFrom,
        to: rangeTo,
      }),
    staleTime: 60 * 60 * 1000,
  });

  const personalQuery = useQuery({
    queryKey: ['calendar-personal-google', user?.id, rangeFrom, rangeTo],
    enabled: Boolean(user?.id && isSupabaseConfigured),
    queryFn: () => loadPersonalGoogleEventsInRange(rangeFrom, rangeTo),
    staleTime: 60_000,
  });

  const masters = query.data ?? [];
  const householdEvents = useMemo(
    () => expandEventsInRange(masters, rangeFrom, rangeTo),
    [masters, rangeFrom, rangeTo],
  );
  const personalEvents = personalQuery.data ?? [];
  const events = useMemo(
    () => [...householdEvents, ...personalEvents],
    [householdEvents, personalEvents],
  );
  const markers = markersQuery.data ?? [];
  const dayEvents = useMemo(() => eventsForDay(events, selected), [events, selected]);
  const dayMarkers = useMemo(() => markersForDay(markers, selected), [markers, selected]);
  const eventDots = useMemo(() => eventDotDates(events, rangeFrom, rangeTo), [events, rangeFrom, rangeTo]);
  const markerDots = useMemo(() => markerDotDates(markers, rangeFrom, rangeTo), [markers, rangeFrom, rangeTo]);
  const cells = useMemo(() => monthGrid(monthCursor, today), [monthCursor, today]);

  const openCreate = (day = selected) => {
    setEditing(null);
    setFormError(null);
    setDraft(emptyEventDraft(day));
  };

  const openEdit = (event: CalendarEvent) => {
    if (event.source === 'google') return;
    const master = masters.find((item) => item.id === event.id) ?? event;
    setEditing(master);
    setFormError(null);
    setDraft(draftFromEvent(master));
  };

  const closeSheet = () => {
    setDraft(null);
    setEditing(null);
    setFormError(null);
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['household-events', activeHousehold?.id] });
    await queryClient.invalidateQueries({ queryKey: ['today-events', activeHousehold?.id] });
  };

  const save = async () => {
    if (!activeHousehold || !draft) return;
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await updateHouseholdEvent(editing.id, activeHousehold.id, draft);
      } else {
        await createHouseholdEvent(activeHousehold.id, draft, user?.id ?? null);
      }
      setSelected(draft.startsOn);
      setMonthCursor(draft.startsOn);
      await invalidate();
      closeSheet();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the event.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!activeHousehold || !editing) return;
    setBusy(true);
    setFormError(null);
    try {
      await deleteHouseholdEvent(editing.id, activeHousehold.id);
      await invalidate();
      closeSheet();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not delete the event.');
    } finally {
      setBusy(false);
    }
  };

  if (!isReady) return <LoadingState label="Opening Calendar…" />;
  if (!activeHousehold) return null;

  if (!isSupabaseConfigured) {
    return (
      <EmptyState
        title="Calendar needs Supabase"
        body="Connect the app to your household database to keep a shared family calendar."
      />
    );
  }

  const monthPane = (
        <View style={[styles.hero, desktop && styles.heroDesktop]}>
          <Text style={styles.kicker}>Family calendar</Text>
          <Text style={styles.title}>{formatMonthHeading(monthCursor)}</Text>
          <View style={styles.monthNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => setMonthCursor((current) => shiftCalendarMonth(current, -1))}
              style={styles.navBtn}>
              <Text style={styles.navLabel}>‹</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSelected(today);
                setMonthCursor(today);
              }}
              style={styles.todayChip}>
              <Text style={styles.todayChipLabel}>Today</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => setMonthCursor((current) => shiftCalendarMonth(current, 1))}
              style={styles.navBtn}>
              <Text style={styles.navLabel}>›</Text>
            </Pressable>
          </View>

          <View style={desktop ? styles.gridFrameDesktop : undefined}>
            <View style={[styles.weekRow, desktop && styles.weekRowDesktop]}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekday}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
            {cells.map((cell, index) => {
              const selectedDay = cell.date === selected;
              const hasEvents = eventDots.has(cell.date);
              const hasMarkers = markerDots.has(cell.date);
              return (
                <Pressable
                  key={cell.date}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDay }}
                  onPress={() => {
                    setSelected(cell.date);
                    setMonthCursor(cell.date);
                  }}
                  style={[
                    styles.cell,
                    desktop ? styles.cellDesktop : styles.cellSquare,
                    desktop && index % 7 === 6 && styles.cellEdgeRight,
                    desktop && index >= cells.length - 7 && styles.cellEdgeBottom,
                    !desktop && !cell.inMonth && styles.cellMuted,
                    cell.isToday && styles.cellToday,
                    selectedDay && styles.cellSelected,
                  ]}>
                  <Text
                    style={[
                      styles.cellLabel,
                      !cell.inMonth && styles.cellLabelMuted,
                      selectedDay && styles.cellLabelSelected,
                    ]}>
                    {Number(cell.date.slice(8, 10))}
                  </Text>
                  <View style={styles.dotRow}>
                    <View style={[styles.dot, hasEvents && styles.dotOn, selectedDay && styles.dotSelected]} />
                    <View
                      style={[styles.dot, hasMarkers && styles.dotMarker, selectedDay && hasMarkers && styles.dotSelected]}
                    />
                  </View>
                </Pressable>
              );
            })}
            </View>
          </View>
        </View>
  );

  const agendaPane = (
        <View style={[styles.agenda, desktop && styles.agendaDesktop]}>
          <View style={styles.agendaHead}>
            <View style={styles.agendaTitles}>
              <Text style={styles.agendaKicker}>Agenda</Text>
              <Text style={styles.agendaTitle}>{formatCalendarDayHeading(selected, today)}</Text>
            </View>
            <Btn label="Add" onPress={() => openCreate(selected)} />
          </View>

          {query.isLoading || personalQuery.isLoading ? <Text style={styles.meta}>Loading events…</Text> : null}
          <ErrorBanner
            message={query.error instanceof Error ? query.error.message : query.isError ? 'Could not load events.' : null}
          />

          {!query.isLoading && !personalQuery.isLoading && dayEvents.length === 0 && dayMarkers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing planned</Text>
              <Text style={styles.emptyBody}>Add a family event for this day — school, sport, dinner, travel.</Text>
              <Btn label="New event" variant="secondary" onPress={() => openCreate(selected)} />
            </View>
          ) : null}

          <View style={styles.eventList}>
            {dayMarkers.map((marker) => (
              <View
                key={marker.id}
                style={[
                  styles.eventCard,
                  { backgroundColor: MARKER_COLOR_SOFT[marker.kind], borderColor: MARKER_COLOR[marker.kind] },
                ]}>
                <View style={[styles.eventBar, { backgroundColor: MARKER_COLOR[marker.kind] }]} />
                <View style={styles.eventBody}>
                  <Text style={styles.eventTime}>{markerKindLabel(marker.kind)}</Text>
                  <Text style={styles.eventTitle}>{marker.title}</Text>
                  {marker.source ? <Text style={styles.eventMeta}>{marker.source}</Text> : null}
                  {marker.kind === 'school_holiday' && marker.startsOn !== marker.endsOn ? (
                    <Text style={styles.eventMeta}>
                      {marker.startsOn} → {marker.endsOn}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
            {dayEvents.map((event) => {
              const personal = event.source === 'google';
              return (
                <Pressable
                  key={occurrenceKey(event)}
                  accessibilityRole="button"
                  onPress={() => openEdit(event)}
                  disabled={personal}
                  style={({ pressed }) => [
                    styles.eventCard,
                    { backgroundColor: EVENT_COLOR_SOFT[event.color], borderColor: EVENT_COLOR[event.color] },
                    pressed && !personal && styles.eventPressed,
                  ]}>
                  <View style={[styles.eventBar, { backgroundColor: EVENT_COLOR[event.color] }]} />
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTime}>
                      {formatEventTimeLabel(event)}
                      {event.recurrence !== 'none' ? ` · ${calendarRecurrenceLabel(event.recurrence)}` : ''}
                      {personal ? ' · Google' : ''}
                    </Text>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {personal && event.calendarName ? (
                      <Text style={styles.eventMeta} numberOfLines={1}>
                        {event.calendarName}
                      </Text>
                    ) : null}
                    {!personal && event.location ? <Text style={styles.eventMeta}>{event.location}</Text> : null}
                    {!personal && event.personIds.length > 0 ? (
                      <Text style={styles.eventMeta} numberOfLines={1}>
                        {event.personIds
                          .map((id) => people.find((person) => person.id === id)?.name)
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
  );

  return (
    <View style={[styles.root, desktop && styles.rootDesktop]}>
      {desktop ? (
        <View style={styles.desktopSplit}>
          {monthPane}
          <ScrollView style={styles.agendaScroll} contentContainerStyle={styles.agendaScrollContent}>
            {agendaPane}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {monthPane}
          {agendaPane}
        </ScrollView>
      )}

      {draft ? (
        <EventSheet
          visible
          draft={draft}
          editing={editing}
          people={people}
          busy={busy}
          error={formError}
          onChange={setDraft}
          onClose={closeSheet}
          onSave={() => void save()}
          onDelete={editing ? () => void remove() : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  rootDesktop: { alignItems: 'center' },
  scroll: { padding: space.md, paddingBottom: space.xl, gap: space.lg },
  desktopSplit: {
    flex: 1,
    width: '100%',
    maxWidth: 1120,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  hero: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
    overflow: 'hidden',
  },
  heroDesktop: { flex: 1.4, minWidth: 0, padding: space.md, alignSelf: 'flex-start' },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgHover,
  },
  navLabel: { color: colors.text, fontSize: 24, lineHeight: 28, fontWeight: '600' },
  todayChip: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  todayChipLabel: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  weekRow: { flexDirection: 'row', marginTop: space.sm },
  weekRowDesktop: {
    marginTop: 0,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  gridFrameDesktop: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: 3,
  },
  cellSquare: { aspectRatio: 1 },
  cellDesktop: {
    height: 44,
    borderRadius: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  cellEdgeRight: { borderRightWidth: 0 },
  cellEdgeBottom: { borderBottomWidth: 0 },
  cellMuted: { opacity: 0.45 },
  cellToday: { backgroundColor: colors.bgHover },
  cellSelected: { backgroundColor: colors.accent },
  cellLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cellLabelMuted: { color: colors.textMuted },
  cellLabelSelected: { color: colors.bg, fontWeight: '800' },
  dotRow: { flexDirection: 'row', gap: 3, minHeight: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dotOn: { backgroundColor: colors.accent },
  dotMarker: { backgroundColor: colors.warning },
  dotSelected: { backgroundColor: colors.bg },
  agendaScroll: { flex: 1, minWidth: 280 },
  agendaScrollContent: { paddingBottom: space.md },
  agenda: { gap: space.md },
  agendaDesktop: {
    padding: space.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  agendaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  agendaTitles: { flex: 1, gap: 2 },
  agendaKicker: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  agendaTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 14 },
  emptyCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: space.xs },
  eventList: { gap: space.sm },
  eventCard: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 72,
  },
  eventPressed: { opacity: 0.88 },
  eventBar: { width: 5 },
  eventBody: { flex: 1, paddingVertical: space.sm, paddingHorizontal: space.md, gap: 2 },
  eventTime: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  eventTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  eventMeta: { color: colors.textMuted, fontSize: 13 },
});
