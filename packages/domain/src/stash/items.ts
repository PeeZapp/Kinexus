import type { StashListItem, StashListItemPriority, StashListRecurrence } from './types';

export const CHECKLIST_CATEGORIES = [
  { id: 'groceries', label: 'Groceries' },
  { id: 'chores', label: 'Chores' },
  { id: 'errands', label: 'Errands' },
  { id: 'school', label: 'School' },
  { id: 'home', label: 'Home' },
  { id: 'packing', label: 'Packing' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'health', label: 'Health' },
  { id: 'other', label: 'Other' },
] as const;

export const CHECKLIST_PRIORITIES: { id: StashListItemPriority; label: string }[] = [
  { id: 0, label: 'None' },
  { id: 1, label: 'Low' },
  { id: 2, label: 'Medium' },
  { id: 3, label: 'High' },
  { id: 4, label: 'Urgent' },
];

export const CHECKLIST_RECURRENCES: { id: StashListRecurrence; label: string }[] = [
  { id: 'none', label: 'Doesn’t repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RECURRENCES = new Set<StashListRecurrence>(['none', 'daily', 'weekly', 'monthly', 'yearly']);

export function categoryLabel(id: string | null | undefined): string {
  if (!id) return '';
  return CHECKLIST_CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export function priorityLabel(priority: StashListItemPriority): string {
  return CHECKLIST_PRIORITIES.find((item) => item.id === priority)?.label ?? 'None';
}

export function recurrenceLabel(recurrence: StashListRecurrence): string {
  return CHECKLIST_RECURRENCES.find((item) => item.id === recurrence)?.label ?? 'Doesn’t repeat';
}

export function itemsForList(listId: string, items: readonly StashListItem[]): StashListItem[] {
  return items.filter((item) => item.listId === listId);
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isIsoDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  return dt.getFullYear() === y && dt.getMonth() === (m ?? 1) - 1 && dt.getDate() === d;
}

export function isChecklistRecurrence(value: string | null | undefined): value is StashListRecurrence {
  return Boolean(value && RECURRENCES.has(value as StashListRecurrence));
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return todayIso(dt);
}

export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1 + months, 1);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d ?? 1, last));
  return todayIso(dt);
}

export function nextWeekendIso(today: string = todayIso()): string {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const day = dt.getDay();
  const add = day === 6 ? 0 : 6 - day;
  return addDaysIso(today, add);
}

export function dueDatePresets(today: string = todayIso()): { id: string; label: string; dueOn: string | null }[] {
  return [
    { id: 'none', label: 'None', dueOn: null },
    { id: 'today', label: 'Today', dueOn: today },
    { id: 'tomorrow', label: 'Tomorrow', dueOn: addDaysIso(today, 1) },
    { id: 'weekend', label: 'This weekend', dueOn: nextWeekendIso(today) },
    { id: 'week', label: 'Next week', dueOn: addDaysIso(today, 7) },
  ];
}

function advanceDue(dueOn: string, recurrence: StashListRecurrence): string {
  if (recurrence === 'daily') return addDaysIso(dueOn, 1);
  if (recurrence === 'weekly') return addDaysIso(dueOn, 7);
  if (recurrence === 'monthly') return addMonthsIso(dueOn, 1);
  if (recurrence === 'yearly') return addMonthsIso(dueOn, 12);
  return dueOn;
}

export function nextDueOn(
  dueOn: string,
  recurrence: StashListRecurrence,
  today: string = todayIso(),
): string | null {
  if (recurrence === 'none' || !isIsoDate(dueOn)) return null;
  let next = advanceDue(dueOn, recurrence);
  let guard = 0;
  while (next < today && guard < 400) {
    next = advanceDue(next, recurrence);
    guard += 1;
  }
  return next;
}

export function completeChecklistItem(
  item: Pick<StashListItem, 'isChecked' | 'dueOn' | 'recurrence'>,
  today: string = todayIso(),
): { isChecked: boolean; dueOn: string | null } {
  if (item.isChecked) return { isChecked: false, dueOn: item.dueOn };
  if (item.recurrence !== 'none') {
    const from = item.dueOn && isIsoDate(item.dueOn) ? item.dueOn : today;
    return { isChecked: false, dueOn: nextDueOn(from, item.recurrence, today) };
  }
  return { isChecked: true, dueOn: item.dueOn };
}

export type DueTone = 'overdue' | 'today' | 'soon' | null;

export function dueTone(dueOn: string | null, today: string = todayIso()): DueTone {
  if (!dueOn) return null;
  if (dueOn < today) return 'overdue';
  if (dueOn === today) return 'today';
  if (dueOn <= addDaysIso(today, 7)) return 'soon';
  return null;
}

export function formatDueLabel(dueOn: string | null, today: string = todayIso()): string {
  if (!dueOn || !isIsoDate(dueOn)) return '';
  const [y, m, d] = dueOn.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const pretty = `${d} ${MONTHS[(m ?? 1) - 1]}`;
  if (dueOn < today) return `Overdue · ${pretty}`;
  if (dueOn === today) return 'Today';
  if (dueOn === addDaysIso(today, 1)) return 'Tomorrow';
  if (dueOn <= addDaysIso(today, 6)) return WEEKDAYS[dt.getDay()] ?? pretty;
  if (y === Number(today.slice(0, 4))) return pretty;
  return `${pretty} ${y}`;
}

function dueRank(item: StashListItem, today: string): number {
  if (item.isChecked || !item.dueOn) return 3;
  if (item.dueOn < today) return 0;
  if (item.dueOn === today) return 1;
  return 2;
}

export function sortChecklistItems(items: readonly StashListItem[], today: string = todayIso()): StashListItem[] {
  return [...items].sort((a, b) => {
    if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
    const rank = dueRank(a, today) - dueRank(b, today);
    if (rank !== 0) return rank;
    if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.position !== b.position) return a.position - b.position;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function splitCheckedItems(items: readonly StashListItem[], today: string = todayIso()): {
  active: StashListItem[];
  checked: StashListItem[];
} {
  const sorted = sortChecklistItems(items, today);
  return {
    active: sorted.filter((item) => !item.isChecked),
    checked: sorted.filter((item) => item.isChecked),
  };
}

export function isChecklistPriority(value: number): value is StashListItemPriority {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

export function todayChecklistItems(items: readonly StashListItem[], today: string = todayIso()): StashListItem[] {
  return sortChecklistItems(
    items.filter((item) => !item.isChecked && Boolean(item.dueOn) && item.dueOn! <= today),
    today,
  );
}

/** Unchecked items due on a specific calendar day (not overdue carry-over). */
export function checklistItemsForDay(items: readonly StashListItem[], day: string): StashListItem[] {
  return sortChecklistItems(
    items.filter((item) => item.dueOn === day),
    day,
  );
}

/** Unchecked items whose due date is before today. */
export function overdueChecklistItems(items: readonly StashListItem[], today: string = todayIso()): StashListItem[] {
  return sortChecklistItems(
    items.filter((item) => !item.isChecked && Boolean(item.dueOn) && item.dueOn! < today),
    today,
  );
}

export function formatDayHeading(day: string, today: string = todayIso()): string {
  if (!isIsoDate(day)) return day;
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const pretty = `${WEEKDAYS[dt.getDay()]} ${d} ${MONTHS[(m ?? 1) - 1]}`;
  if (day === today) return `Today · ${pretty}`;
  if (day === addDaysIso(today, 1)) return `Tomorrow · ${pretty}`;
  if (day === addDaysIso(today, -1)) return `Yesterday · ${pretty}`;
  if (y === Number(today.slice(0, 4))) return pretty;
  return `${pretty} ${y}`;
}

export type ChecklistItemPosition = { id: string; position: number };

/** Reorder active day items; returns position patches for persistence. */
export function movedChecklistDayPositions(
  dayItems: readonly StashListItem[],
  id: string,
  direction: -1 | 1,
): ChecklistItemPosition[] {
  const active = dayItems.filter((item) => !item.isChecked);
  const from = active.findIndex((item) => item.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= active.length) return [];
  const next = active.slice();
  const swap = next[from]!;
  next[from] = next[to]!;
  next[to] = swap;
  return next.flatMap((item, position) => (item.position === position ? [] : [{ id: item.id, position }]));
}

export function filterChecklistItems(
  items: readonly StashListItem[],
  opts: { search?: string; category?: string | null; assignedPersonId?: string | null } = {},
): StashListItem[] {
  const q = opts.search?.trim().toLowerCase() ?? '';
  return items.filter((item) => {
    if (opts.category && item.category !== opts.category) return false;
    if (opts.assignedPersonId && item.assignedPersonId !== opts.assignedPersonId) return false;
    if (!q) return true;
    const hay = [item.title, item.notes, categoryLabel(item.category)].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}
