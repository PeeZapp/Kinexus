import { describe, expect, it } from 'vitest';

import {
  buildTrainingPlanIcs,
  escapeIcsText,
  foldIcsLine,
  trainingPlanDayIcsUid,
} from './plan-ics.js';

describe('plan-ics', () => {
  it('escapes RFC 5545 text', () => {
    expect(escapeIcsText('A;B,C\\D\nE')).toBe('A\\;B\\,C\\\\D\\nE');
  });

  it('folds long lines with CRLF + space', () => {
    const long = `SUMMARY:${'x'.repeat(90)}`;
    const folded = foldIcsLine(long);
    expect(folded.includes('\r\n ')).toBe(true);
    expect(folded.split('\r\n').every((part) => part.length <= 75)).toBe(true);
  });

  it('uses stable UIDs per day', () => {
    expect(trainingPlanDayIcsUid('day-1')).toBe('training-plan-day-day-1@kinexus.app');
    const ics = buildTrainingPlanIcs({
      planId: 'plan-1',
      planName: 'Week',
      weekStart: '2026-11-02',
      days: [
        {
          id: 'day-mon',
          day: 'monday',
          restDay: false,
          focus: ['Push'],
          scheduledTime: '07:00',
          durationMin: 40,
        },
      ],
    });
    expect(ics).toContain('UID:training-plan-day-day-mon@kinexus.app');
    expect(ics).toContain('DTSTART;TZID=Australia/Perth:20261102T070000');
    expect(ics).toContain('DTEND;TZID=Australia/Perth:20261102T074000');
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.includes('\n') && !ics.includes('\r\n') ? false : true).toBe(true);
  });

  it('skips rest days and supports UTC stamps', () => {
    const ics = buildTrainingPlanIcs({
      planId: 'plan-1',
      planName: 'Week',
      weekStart: '2026-11-02',
      useUtc: true,
      utcOffsetMinutes: 480,
      days: [
        {
          id: 'day-rest',
          day: 'tuesday',
          restDay: true,
          focus: [],
          scheduledTime: null,
          durationMin: null,
        },
        {
          id: 'day-wed',
          day: 'wednesday',
          restDay: false,
          focus: ['Pull'],
          scheduledTime: null,
          durationMin: 45,
        },
      ],
    });
    expect(ics).not.toContain('day-rest');
    expect(ics).toContain('UID:training-plan-day-day-wed@kinexus.app');
    // Perth 07:00 → previous day 23:00Z
    expect(ics).toContain('DTSTART:20261103T230000Z');
  });
});
