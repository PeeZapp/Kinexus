export type CalendarOpenRequest = {
  day?: string;
  /** When set with mode 'edit', calendar opens the edit sheet for this event. */
  eventId?: string;
  mode?: 'day' | 'edit';
};

let pending: CalendarOpenRequest | null = null;

export function queueCalendarOpen(request: CalendarOpenRequest): void {
  pending = request;
}

export function takeCalendarOpen(): CalendarOpenRequest | null {
  const next = pending;
  pending = null;
  return next;
}

export function peekCalendarOpen(): CalendarOpenRequest | null {
  return pending;
}
