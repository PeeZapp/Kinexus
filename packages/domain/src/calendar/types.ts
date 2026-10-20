export const CALENDAR_COLORS = ['teal', 'amber', 'rose', 'sky', 'violet', 'coral'] as const;
export type CalendarColor = (typeof CALENDAR_COLORS)[number];

export const CALENDAR_RECURRENCES = [
  { id: 'none', label: 'Doesn’t repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
] as const;

export type CalendarRecurrence = (typeof CALENDAR_RECURRENCES)[number]['id'];

export const REMIND_OPTIONS = [
  { minutes: null, label: 'None' },
  { minutes: 0, label: 'At time' },
  { minutes: 30, label: '30 min before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
] as const;

export type CalendarRemindMinutes = (typeof REMIND_OPTIONS)[number]['minutes'];

export type CalendarEventSource = 'household' | 'google';

export type CalendarEvent = {
  id: string;
  householdId: string;
  title: string;
  notes: string;
  location: string;
  allDay: boolean;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  color: CalendarColor;
  remindMinutes: number | null;
  recurrence: CalendarRecurrence;
  untilOn: string | null;
  personIds: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Personal Google overlay on Today only — never on the shared family calendar. */
  source?: CalendarEventSource;
  calendarName?: string;
};

export type CalendarEventDraft = {
  title: string;
  notes: string;
  location: string;
  allDay: boolean;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  color: CalendarColor;
  remindMinutes: number | null;
  recurrence: CalendarRecurrence;
  untilOn: string | null;
  personIds: string[];
};

export type MonthCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
};
