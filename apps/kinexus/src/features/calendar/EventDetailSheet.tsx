import {
  REMIND_OPTIONS,
  calendarRecurrenceLabel,
  formatCalendarDayHeading,
  formatEventTimeLabel,
  todayIso,
  type CalendarEvent,
  type HouseholdPerson,
} from '@kinexus/domain';
import { StyleSheet, Text, View } from 'react-native';

import { EVENT_COLOR, EVENT_COLOR_SOFT } from '@/src/features/calendar/colors';
import { Btn } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

function remindLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  return REMIND_OPTIONS.find((option) => option.minutes === minutes)?.label ?? null;
}

function dateRangeLabel(event: CalendarEvent): string {
  const today = todayIso();
  if (event.startsOn === event.endsOn) {
    return formatCalendarDayHeading(event.startsOn, today);
  }
  return `${formatCalendarDayHeading(event.startsOn, today)} → ${formatCalendarDayHeading(event.endsOn, today)}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function EventDetailSheet({
  visible,
  event,
  people,
  onClose,
  onEdit,
}: {
  visible: boolean;
  event: CalendarEvent | null;
  people: HouseholdPerson[] | Map<string, string>;
  onClose: () => void;
  onEdit?: () => void;
}) {
  if (!event) return null;

  const personal = event.source === 'google';
  const who =
    people instanceof Map
      ? event.personIds.map((id) => people.get(id)).filter(Boolean).join(' · ')
      : event.personIds
          .map((id) => people.find((person) => person.id === id)?.name)
          .filter(Boolean)
          .join(' · ');
  const remind = personal ? null : remindLabel(event.remindMinutes);
  const accent = EVENT_COLOR[event.color];
  const soft = EVENT_COLOR_SOFT[event.color];

  return (
    <Sheet visible={visible} title={event.title} onClose={onClose}>
      <View style={styles.stack}>
        <View style={[styles.hero, { backgroundColor: soft, borderColor: accent }]}>
          <View style={[styles.heroBar, { backgroundColor: accent }]} />
          <View style={styles.heroBody}>
            <Text style={styles.heroTime}>{formatEventTimeLabel(event)}</Text>
            <Text style={styles.heroDate}>{dateRangeLabel(event)}</Text>
            {personal ? (
              <Text style={styles.heroMeta}>{event.calendarName || 'Google calendar'}</Text>
            ) : null}
          </View>
        </View>

        {event.recurrence !== 'none' ? (
          <DetailRow
            label="Repeats"
            value={
              event.untilOn
                ? `${calendarRecurrenceLabel(event.recurrence)} until ${formatCalendarDayHeading(event.untilOn)}`
                : calendarRecurrenceLabel(event.recurrence)
            }
          />
        ) : null}
        {who ? <DetailRow label="Who" value={who} /> : null}
        {event.location ? <DetailRow label="Place" value={event.location} /> : null}
        {remind ? <DetailRow label="Remind" value={remind} /> : null}
        {event.notes ? <DetailRow label="Notes" value={event.notes} /> : null}

        {!personal && onEdit ? <Btn label="Edit event" onPress={onEdit} /> : null}
        {personal ? (
          <Text style={styles.hint}>Personal Google events are viewed here — edit them in Google Calendar.</Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md, paddingBottom: space.lg },
  hero: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 88,
  },
  heroBar: { width: 6 },
  heroBody: {
    flex: 1,
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    justifyContent: 'center',
  },
  heroTime: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  heroDate: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  heroMeta: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  row: { gap: 4 },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  rowValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  hint: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
});
