import { DAYS, DAY_LABELS, addDaysIso, mondayWeekStart, type Day } from '@kinexus/domain';

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function weekRangeLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const ma = MONTHS[start.getMonth()] ?? '';
  const mb = MONTHS[end.getMonth()] ?? '';
  const a = start.getDate();
  const b = end.getDate();
  if (start.getFullYear() !== end.getFullYear()) {
    return `${ma} ${a}, ${start.getFullYear()} – ${mb} ${b}, ${end.getFullYear()}`;
  }
  if (ma === mb) return `${ma} ${a}–${b}, ${start.getFullYear()}`;
  return `${ma} ${a} – ${mb} ${b}, ${start.getFullYear()}`;
}

export function dayShort(day: Day): string {
  return DAY_LABELS[day].slice(0, 3);
}

function weekRelation(weekStart: string): 'this' | 'next' | 'last' | 'other' {
  const current = mondayWeekStart();
  if (weekStart === current) return 'this';
  if (weekStart === addDaysIso(current, 7)) return 'next';
  if (weekStart === addDaysIso(current, -7)) return 'last';
  return 'other';
}

export function weekPlanPhrase(weekStart: string): string {
  const rel = weekRelation(weekStart);
  if (rel === 'this') return "this week's plan";
  if (rel === 'next') return "next week's plan";
  if (rel === 'last') return "last week's plan";
  return `the ${weekRangeLabel(weekStart)} plan`;
}

export function weekApplyLabel(weekStart: string): string {
  const rel = weekRelation(weekStart);
  if (rel === 'this') return 'Apply to this week';
  if (rel === 'next') return 'Apply to next week';
  if (rel === 'last') return 'Apply to last week';
  return `Apply to ${weekRangeLabel(weekStart)}`;
}
