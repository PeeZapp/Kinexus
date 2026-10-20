import { addDaysIso, addMonthsIso, todayIso } from '../stash/items';

import {
  CALENDAR_COLORS,
  CALENDAR_RECURRENCES,
  type CalendarColor,
  type CalendarEvent,
  type CalendarEventDraft,
  type CalendarRecurrence,
  type MonthCell,
} from './types';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RECURRENCE_IDS = new Set<CalendarRecurrence>(CALENDAR_RECURRENCES.map((item) => item.id));

export function isCalendarColor(value: string | null | undefined): value is CalendarColor {
  return Boolean(value && (CALENDAR_COLORS as readonly string[]).includes(value));
}

export function normalizeCalendarColor(value: string | null | undefined): CalendarColor {
  return isCalendarColor(value) ? value : 'teal';
}

export function isCalendarRecurrence(value: string | null | undefined): value is CalendarRecurrence {
  return Boolean(value && RECURRENCE_IDS.has(value as CalendarRecurrence));
}

export function normalizeCalendarRecurrence(value: string | null | undefined): CalendarRecurrence {
  return isCalendarRecurrence(value) ? value : 'none';
}

export function recurrenceLabel(recurrence: CalendarRecurrence): string {
  return CALENDAR_RECURRENCES.find((item) => item.id === recurrence)?.label ?? 'Doesn’t repeat';
}

/** Accepts `HH:MM` or `HH:MM:SS`; returns `HH:MM` or null. */
export function normalizeEventTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

export function isIsoDate(value: string | null | undefined): boolean {
  if (!value || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  return dt.getFullYear() === y && dt.getMonth() === (m ?? 1) - 1 && dt.getDate() === d;
}

export function emptyEventDraft(day: string = todayIso()): CalendarEventDraft {
  return {
    title: '',
    notes: '',
    location: '',
    allDay: true,
    startsOn: day,
    endsOn: day,
    startTime: '09:00',
    endTime: '10:00',
    color: 'teal',
    remindMinutes: 30,
    recurrence: 'none',
    untilOn: null,
    personIds: [],
  };
}

export function draftFromEvent(event: CalendarEvent): CalendarEventDraft {
  return {
    title: event.title,
    notes: event.notes,
    location: event.location,
    allDay: event.allDay,
    startsOn: event.startsOn,
    endsOn: event.endsOn,
    startTime: event.startTime ?? '09:00',
    endTime: event.endTime ?? '10:00',
    color: event.color,
    remindMinutes: event.remindMinutes,
    recurrence: event.recurrence,
    untilOn: event.untilOn,
    personIds: [...event.personIds],
  };
}

export type EventDraftIssue =
  | 'title'
  | 'startsOn'
  | 'endsOn'
  | 'range'
  | 'untilOn'
  | 'startTime'
  | 'endTime'
  | 'times';

export function validateEventDraft(draft: CalendarEventDraft): EventDraftIssue | null {
  if (!draft.title.replace(/\s+/g, ' ').trim()) return 'title';
  if (!isIsoDate(draft.startsOn)) return 'startsOn';
  if (!isIsoDate(draft.endsOn)) return 'endsOn';
  if (draft.endsOn < draft.startsOn) return 'range';
  const recurrence = normalizeCalendarRecurrence(draft.recurrence);
  if (recurrence !== 'none' && draft.untilOn) {
    if (!isIsoDate(draft.untilOn)) return 'untilOn';
    if (draft.untilOn < draft.startsOn) return 'untilOn';
  }
  if (!draft.allDay) {
    const start = normalizeEventTime(draft.startTime);
    const end = normalizeEventTime(draft.endTime);
    if (!start) return 'startTime';
    if (!end) return 'endTime';
    if (draft.startsOn === draft.endsOn && end <= start) return 'times';
  }
  return null;
}

export function normalizeEventDraft(draft: CalendarEventDraft): CalendarEventDraft {
  const startsOn = isIsoDate(draft.startsOn) ? draft.startsOn : todayIso();
  let endsOn = isIsoDate(draft.endsOn) ? draft.endsOn : startsOn;
  if (endsOn < startsOn) endsOn = startsOn;
  const allDay = Boolean(draft.allDay);
  const startTime = allDay ? null : normalizeEventTime(draft.startTime) ?? '09:00';
  let endTime = allDay ? null : normalizeEventTime(draft.endTime) ?? '10:00';
  if (!allDay && startsOn === endsOn && endTime && startTime && endTime <= startTime) {
    endTime = bumpHour(startTime);
  }
  const recurrence = normalizeCalendarRecurrence(draft.recurrence);
  let untilOn: string | null = null;
  if (recurrence !== 'none' && draft.untilOn && isIsoDate(draft.untilOn)) {
    untilOn = draft.untilOn < startsOn ? startsOn : draft.untilOn;
  }
  return {
    title: draft.title.replace(/\s+/g, ' ').trim().slice(0, 120),
    notes: draft.notes.trim().slice(0, 2000),
    location: draft.location.replace(/\s+/g, ' ').trim().slice(0, 160),
    allDay,
    startsOn,
    endsOn,
    startTime,
    endTime,
    color: normalizeCalendarColor(draft.color),
    remindMinutes:
      draft.remindMinutes === null || draft.remindMinutes === undefined
        ? null
        : Math.max(0, Math.round(draft.remindMinutes)),
    recurrence,
    untilOn,
    personIds: [...new Set(draft.personIds.filter(Boolean))],
  };
}

export function eventSpanDays(startsOn: string, endsOn: string): number {
  if (endsOn <= startsOn) return 0;
  let span = 0;
  let cursor = startsOn;
  while (cursor < endsOn && span < 366) {
    cursor = addDaysIso(cursor, 1);
    span += 1;
  }
  return span;
}

export function advanceEventOccurrence(start: string, recurrence: CalendarRecurrence): string {
  if (recurrence === 'daily') return addDaysIso(start, 1);
  if (recurrence === 'weekly') return addDaysIso(start, 7);
  if (recurrence === 'monthly') return addMonthsIso(start, 1);
  if (recurrence === 'yearly') return addMonthsIso(start, 12);
  return start;
}

/** Expand series masters into concrete occurrences overlapping [from, to]. */
export function expandEventsInRange(
  masters: readonly CalendarEvent[],
  from: string,
  to: string,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const master of masters) {
    if (master.recurrence === 'none') {
      if (master.startsOn <= to && master.endsOn >= from) out.push({ ...master });
      continue;
    }
    const span = eventSpanDays(master.startsOn, master.endsOn);
    const until = master.untilOn && master.untilOn < to ? master.untilOn : to;
    let occStart = master.startsOn;
    const earliestStart = addDaysIso(from, -span);
    let guard = 0;
    while (occStart < earliestStart && guard < 10_000) {
      const next = advanceEventOccurrence(occStart, master.recurrence);
      if (next <= occStart) break;
      occStart = next;
      guard += 1;
    }
    while (occStart <= until && occStart <= to && guard < 10_000) {
      if (master.untilOn && occStart > master.untilOn) break;
      const occEnd = addDaysIso(occStart, span);
      if (occEnd >= from && occStart <= to) {
        out.push({ ...master, startsOn: occStart, endsOn: occEnd });
      }
      const next = advanceEventOccurrence(occStart, master.recurrence);
      if (next <= occStart) break;
      occStart = next;
      guard += 1;
    }
  }
  return out.sort(compareEvents);
}

export function occurrenceKey(event: Pick<CalendarEvent, 'id' | 'startsOn'>): string {
  return `${event.id}:${event.startsOn}`;
}

function bumpHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const next = ((h ?? 0) + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

export function eventTouchesDay(event: Pick<CalendarEvent, 'startsOn' | 'endsOn'>, day: string): boolean {
  return day >= event.startsOn && day <= event.endsOn;
}

export function eventsForDay(events: readonly CalendarEvent[], day: string): CalendarEvent[] {
  return events
    .filter((event) => eventTouchesDay(event, day))
    .sort((a, b) => compareEvents(a, b));
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.allDay && b.allDay) {
    if (a.startsOn !== b.startsOn) return a.startsOn < b.startsOn ? -1 : 1;
    return a.title.localeCompare(b.title);
  }
  const at = a.startTime ?? '99:99';
  const bt = b.startTime ?? '99:99';
  if (at !== bt) return at < bt ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export function eventsInRange(
  events: readonly CalendarEvent[],
  from: string,
  to: string,
): CalendarEvent[] {
  return events
    .filter((event) => event.startsOn <= to && event.endsOn >= from)
    .sort((a, b) => compareEvents(a, b));
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthStartIso(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function shiftMonth(date: string, delta: number): string {
  const [y, m] = date.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1 + delta, 1);
  return todayIso(dt);
}

export function daysInMonth(date: string): number {
  const [y, m] = date.split('-').map(Number);
  return new Date(y ?? 1970, m ?? 1, 0).getDate();
}

/** Monday-first month grid (6 weeks). */
export function monthGrid(monthDate: string, today: string = todayIso()): MonthCell[] {
  const start = monthStartIso(monthDate);
  const [y, m] = start.split('-').map(Number);
  const first = new Date(y ?? 1970, (m ?? 1) - 1, 1);
  const weekday = first.getDay(); // 0 Sun
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const gridStart = addDaysIso(start, mondayOffset);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDaysIso(gridStart, i);
    cells.push({
      date,
      inMonth: monthKey(date) === monthKey(start),
      isToday: date === today,
    });
  }
  return cells;
}

export function formatEventTimeLabel(event: Pick<CalendarEvent, 'allDay' | 'startTime' | 'endTime'>): string {
  if (event.allDay) return 'All day';
  const start = formatClock(event.startTime);
  const end = formatClock(event.endTime);
  if (start && end) return `${start} – ${end}`;
  return start ?? 'Timed';
}

export function formatClock(time: string | null | undefined): string | null {
  const normalized = normalizeEventTime(time);
  if (!normalized) return null;
  const [hRaw, m] = normalized.split(':').map(Number);
  const h = hRaw ?? 0;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`;
}

export function formatDayHeading(day: string, today: string = todayIso()): string {
  if (day === today) return 'Today';
  if (day === addDaysIso(today, 1)) return 'Tomorrow';
  if (day === addDaysIso(today, -1)) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatMonthHeading(monthDate: string): string {
  const [y, m] = monthDate.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, 1);
  return dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Events that should surface on the Today HUD for a given day. */
export function alertEventsForDay(events: readonly CalendarEvent[], day: string): CalendarEvent[] {
  return eventsForDay(events, day);
}

export function eventIsPast(
  event: Pick<CalendarEvent, 'allDay' | 'endsOn' | 'endTime' | 'startsOn' | 'startTime'>,
  day: string,
  now: Date = new Date(),
): boolean {
  const today = todayIso(now);
  if (day < today) return true;
  if (day > today) return false;
  if (event.allDay) return false;
  const end = timeToMinutes(event.endTime) ?? timeToMinutes(event.startTime);
  if (end === null) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return end <= nowMinutes && event.endsOn <= today;
}

function timeToMinutes(time: string | null | undefined): number | null {
  const normalized = normalizeEventTime(time);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function eventDotDates(events: readonly CalendarEvent[], from: string, to: string): Set<string> {
  const dates = new Set<string>();
  for (const event of eventsInRange(events, from, to)) {
    let cursor = event.startsOn < from ? from : event.startsOn;
    const last = event.endsOn > to ? to : event.endsOn;
    while (cursor <= last) {
      dates.add(cursor);
      cursor = addDaysIso(cursor, 1);
    }
  }
  return dates;
}

export function isValidEventTime(value: string | null | undefined): boolean {
  return Boolean(value && TIME_RE.test(value));
}
