import { describe, expect, it } from 'vitest';

import {
  alertEventsForDay,
  emptyEventDraft,
  eventIsPast,
  eventsForDay,
  expandEventsInRange,
  formatEventTimeLabel,
  monthGrid,
  normalizeEventDraft,
  validateEventDraft,
} from './index';
import type { CalendarEvent } from './types';

function event(partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'startsOn'>): CalendarEvent {
  return {
    householdId: 'h1',
    notes: '',
    location: '',
    allDay: true,
    endsOn: partial.startsOn,
    startTime: null,
    endTime: null,
    color: 'teal',
    remindMinutes: null,
    recurrence: 'none',
    untilOn: null,
    personIds: [],
    createdBy: null,
    createdAt: '2026-10-19T00:00:00Z',
    updatedAt: '2026-10-19T00:00:00Z',
    ...partial,
  };
}

describe('calendar events', () => {
  it('validates and normalizes drafts', () => {
    const draft = emptyEventDraft('2026-10-19');
    expect(validateEventDraft(draft)).toBe('title');
    draft.title = ' Soccer practice ';
    draft.allDay = false;
    draft.startTime = '16:00';
    draft.endTime = '15:00';
    expect(validateEventDraft(draft)).toBe('times');
    draft.endTime = '17:30';
    expect(validateEventDraft(draft)).toBeNull();
    const normalized = normalizeEventDraft(draft);
    expect(normalized.title).toBe('Soccer practice');
    expect(normalized.startTime).toBe('16:00');
    expect(normalized.endTime).toBe('17:30');
  });

  it('sorts all-day before timed and filters by day', () => {
    const events = [
      event({ id: '1', title: 'Dentist', startsOn: '2026-10-19', allDay: false, startTime: '10:00', endTime: '10:30' }),
      event({ id: '2', title: 'Holiday', startsOn: '2026-10-18', endsOn: '2026-10-20' }),
      event({ id: '3', title: 'Other', startsOn: '2026-10-21' }),
    ];
    const day = eventsForDay(events, '2026-10-19');
    expect(day.map((item) => item.id)).toEqual(['2', '1']);
    expect(formatEventTimeLabel(day[0]!)).toBe('All day');
    expect(alertEventsForDay(events, '2026-10-19')).toHaveLength(2);
  });

  it('builds a monday-first month grid', () => {
    const cells = monthGrid('2026-10-01', '2026-10-19');
    expect(cells).toHaveLength(42);
    expect(cells[0]?.date).toBe('2026-09-28');
    expect(cells.find((cell) => cell.date === '2026-10-19')?.isToday).toBe(true);
  });

  it('marks past timed events on today', () => {
    const timed = event({
      id: '1',
      title: 'Morning',
      startsOn: '2026-10-19',
      allDay: false,
      startTime: '08:00',
      endTime: '09:00',
    });
    const now = new Date(2026, 9, 19, 12, 0, 0);
    expect(eventIsPast(timed, '2026-10-19', now)).toBe(true);
    expect(eventIsPast({ ...timed, endTime: '18:00' }, '2026-10-19', now)).toBe(false);
  });

  it('expands weekly series inside a range and respects until', () => {
    const weekly = event({
      id: 'w1',
      title: 'Soccer',
      startsOn: '2026-10-06',
      recurrence: 'weekly',
      untilOn: '2026-10-20',
      allDay: false,
      startTime: '16:00',
      endTime: '17:00',
    });
    const expanded = expandEventsInRange([weekly], '2026-10-01', '2026-10-31');
    expect(expanded.map((item) => item.startsOn)).toEqual(['2026-10-06', '2026-10-13', '2026-10-20']);
    expect(eventsForDay(expanded, '2026-10-13')).toHaveLength(1);
    expect(eventsForDay(expanded, '2026-10-27')).toHaveLength(0);
  });
});
