import { addDaysIso } from '../stash/items';

import { isIsoDate } from './events';
import { schoolHolidayRangesForCountry } from './school-holidays';

export const CALENDAR_MARKER_KINDS = ['birthday', 'public_holiday', 'school_holiday'] as const;
export type CalendarMarkerKind = (typeof CALENDAR_MARKER_KINDS)[number];

export type CalendarMarker = {
  id: string;
  kind: CalendarMarkerKind;
  title: string;
  startsOn: string;
  endsOn: string;
  personId?: string;
  source?: string;
};

export type BirthdayPerson = {
  id: string;
  name: string;
  birthday: string | null;
};

export function markerTouchesDay(marker: Pick<CalendarMarker, 'startsOn' | 'endsOn'>, day: string): boolean {
  return day >= marker.startsOn && day <= marker.endsOn;
}

export function markersForDay(markers: readonly CalendarMarker[], day: string): CalendarMarker[] {
  return markers
    .filter((marker) => markerTouchesDay(marker, day))
    .sort((a, b) => {
      if (a.kind !== b.kind) return kindRank(a.kind) - kindRank(b.kind);
      return a.title.localeCompare(b.title);
    });
}

function kindRank(kind: CalendarMarkerKind): number {
  if (kind === 'birthday') return 0;
  if (kind === 'public_holiday') return 1;
  return 2;
}

export function markerKindLabel(kind: CalendarMarkerKind): string {
  if (kind === 'birthday') return 'Birthday';
  if (kind === 'public_holiday') return 'Public holiday';
  return 'School holidays';
}

/** Birthdays falling in [from, to], rolled forward each year. */
export function birthdayMarkers(
  people: readonly BirthdayPerson[],
  from: string,
  to: string,
): CalendarMarker[] {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return [];
  const out: CalendarMarker[] = [];
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));

  for (const person of people) {
    const birthday = person.birthday?.trim();
    if (!birthday || !isIsoDate(birthday)) continue;
    const monthDay = birthday.slice(5);
    for (let year = fromYear; year <= toYear; year += 1) {
      const date = resolveBirthdayDate(year, monthDay);
      if (!date || date < from || date > to) continue;
      const name = person.name.trim() || 'Family member';
      out.push({
        id: `birthday:${person.id}:${date}`,
        kind: 'birthday',
        title: `${name}’s birthday`,
        startsOn: date,
        endsOn: date,
        personId: person.id,
      });
    }
  }
  return out;
}

function resolveBirthdayDate(year: number, monthDay: string): string | null {
  const candidate = `${year}-${monthDay}`;
  if (isIsoDate(candidate)) return candidate;
  // Feb 29 → Feb 28 in non-leap years
  if (monthDay === '02-29') {
    const fallback = `${year}-02-28`;
    return isIsoDate(fallback) ? fallback : null;
  }
  return null;
}

export function schoolHolidayMarkers(
  country: string | null | undefined,
  from: string,
  to: string,
): CalendarMarker[] {
  return schoolHolidayRangesForCountry(country, from, to).map((range) => ({
    id: `school:${range.id}`,
    kind: 'school_holiday' as const,
    title: range.title,
    startsOn: range.startsOn,
    endsOn: range.endsOn,
    source: range.source,
  }));
}

export function publicHolidayMarkers(
  holidays: readonly { date: string; name: string }[],
  from: string,
  to: string,
): CalendarMarker[] {
  const seen = new Set<string>();
  const out: CalendarMarker[] = [];
  for (const holiday of holidays) {
    if (!isIsoDate(holiday.date) || holiday.date < from || holiday.date > to) continue;
    const title = holiday.name.trim();
    if (!title) continue;
    const key = `${holiday.date}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `public:${holiday.date}:${title}`,
      kind: 'public_holiday',
      title,
      startsOn: holiday.date,
      endsOn: holiday.date,
      source: 'public holiday',
    });
  }
  return out;
}

export function mergeCalendarMarkers(...groups: readonly (readonly CalendarMarker[])[]): CalendarMarker[] {
  const seen = new Set<string>();
  const out: CalendarMarker[] = [];
  for (const group of groups) {
    for (const marker of group) {
      if (seen.has(marker.id)) continue;
      seen.add(marker.id);
      out.push(marker);
    }
  }
  return out.sort((a, b) => {
    if (a.startsOn !== b.startsOn) return a.startsOn < b.startsOn ? -1 : 1;
    if (a.kind !== b.kind) return kindRank(a.kind) - kindRank(b.kind);
    return a.title.localeCompare(b.title);
  });
}

export function markerDotDates(markers: readonly CalendarMarker[], from: string, to: string): Set<string> {
  const dates = new Set<string>();
  for (const marker of markers) {
    if (marker.endsOn < from || marker.startsOn > to) continue;
    let cursor = marker.startsOn < from ? from : marker.startsOn;
    const last = marker.endsOn > to ? to : marker.endsOn;
    while (cursor <= last) {
      dates.add(cursor);
      cursor = addDaysIso(cursor, 1);
    }
  }
  return dates;
}
