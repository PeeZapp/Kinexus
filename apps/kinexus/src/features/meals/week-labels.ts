import { DAYS, DAY_LABELS, addDaysIso, type Day } from '@kinexus/domain';

export function todayDay(): Day {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1] ?? 'monday';
}

export function isoDayNumber(iso: string): string {
  return iso.slice(8);
}

export function weekDayIso(weekStart: string, day: Day): string {
  const idx = DAYS.indexOf(day);
  return addDaysIso(weekStart, idx < 0 ? 0 : idx);
}

export function weekHeading(weekStart: string): string {
  const end = addDaysIso(weekStart, 6);
  return `${weekStart} → ${end}`;
}

export function dayShort(day: Day): string {
  return DAY_LABELS[day].slice(0, 3);
}
