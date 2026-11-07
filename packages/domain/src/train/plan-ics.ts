import { dayDateIso } from './plan-week';
import type { Day } from '../meals/types';

const CRLF = '\r\n';
const FOLD_LIMIT = 75;

export type PlanIcsDay = {
  id: string;
  day: Day;
  restDay: boolean;
  focus: string[];
  scheduledTime: string | null;
  durationMin: number | null;
};

export type PlanIcsInput = {
  planId: string;
  planName: string;
  weekStart: string;
  days: PlanIcsDay[];
  /** IANA TZ for floating local times. Default Australia/Perth. */
  timeZone?: string;
  /** When true, emit UTC Z timestamps instead of TZID. */
  useUtc?: boolean;
  /** Fixed offset minutes east of UTC for useUtc conversion (Perth = 480). */
  utcOffsetMinutes?: number;
};

export function trainingPlanDayIcsUid(dayId: string): string {
  return `training-plan-day-${dayId}@kinexus.app`;
}

/** RFC 5545 TEXT escaping. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/** Fold long content lines at 75 octets with CRLF + space continuation. */
export function foldIcsLine(line: string): string {
  if (line.length <= FOLD_LIMIT) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, FOLD_LIMIT));
  remaining = remaining.slice(FOLD_LIMIT);
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, FOLD_LIMIT - 1);
    parts.push(` ${chunk}`);
    remaining = remaining.slice(FOLD_LIMIT - 1);
  }
  return parts.join(CRLF);
}

function normalizeTime(value: string | null | undefined): string {
  if (!value) return '07:00';
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : '07:00';
}

function addMinutesToLocal(
  dateIso: string,
  timeHhMm: string,
  minutes: number,
): { dateIso: string; timeHhMm: string } {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = timeHhMm.split(':').map(Number);
  const total = (hh ?? 0) * 60 + (mm ?? 0) + minutes;
  const dayDelta = Math.floor(total / (24 * 60));
  const rem = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const outH = Math.floor(rem / 60);
  const outM = rem % 60;
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + dayDelta);
  const yy = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  return {
    dateIso: `${yy}-${mo}-${da}`,
    timeHhMm: `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`,
  };
}

function localToUtcStamp(dateIso: string, timeHhMm: string, offsetMinutes: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = timeHhMm.split(':').map(Number);
  const utcMs =
    Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0) - offsetMinutes * 60_000;
  const dt = new Date(utcMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`
  );
}

function localStamp(dateIso: string, timeHhMm: string): string {
  const [y, m, d] = dateIso.split('-');
  const [hh, mm] = timeHhMm.split(':');
  return `${y}${m}${d}T${hh}${mm}00`;
}

function perthVTimezone(): string[] {
  return [
    'BEGIN:VTIMEZONE',
    'TZID:Australia/Perth',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:AWST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
}

function eventLines(input: {
  day: PlanIcsDay;
  weekStart: string;
  planName: string;
  timeZone: string;
  useUtc: boolean;
  utcOffsetMinutes: number;
}): string[] {
  if (input.day.restDay) return [];
  const date = dayDateIso(input.weekStart, input.day.day);
  const start = normalizeTime(input.day.scheduledTime);
  const duration = input.day.durationMin && input.day.durationMin > 0 ? input.day.durationMin : 40;
  const end = addMinutesToLocal(date, start, duration);
  const focus = input.day.focus[0] ?? 'Train';
  const summary = `🏋️ ${focus} · ${duration} min`;
  const uid = trainingPlanDayIcsUid(input.day.id);
  const dtStart = input.useUtc
    ? `DTSTART:${localToUtcStamp(date, start, input.utcOffsetMinutes)}`
    : `DTSTART;TZID=${input.timeZone}:${localStamp(date, start)}`;
  const dtEnd = input.useUtc
    ? `DTEND:${localToUtcStamp(end.dateIso, end.timeHhMm, input.utcOffsetMinutes)}`
    : `DTEND;TZID=${input.timeZone}:${localStamp(end.dateIso, end.timeHhMm)}`;
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(input.planName)}`,
    'END:VEVENT',
  ];
}

/** Build an RFC 5545 .ics calendar for one or more plan days. */
export function buildTrainingPlanIcs(input: PlanIcsInput): string {
  const timeZone = input.timeZone ?? 'Australia/Perth';
  const useUtc = Boolean(input.useUtc);
  const utcOffsetMinutes = input.utcOffsetMinutes ?? 480;
  const days = input.days.filter((day) => !day.restDay);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kinexus//Train Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  if (!useUtc && timeZone === 'Australia/Perth') {
    lines.push(...perthVTimezone());
  }
  for (const day of days) {
    lines.push(
      ...eventLines({
        day,
        weekStart: input.weekStart,
        planName: input.planName,
        timeZone,
        useUtc,
        utcOffsetMinutes,
      }),
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
