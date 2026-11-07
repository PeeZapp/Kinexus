import { describe, expect, it } from 'vitest';

import { dayDateIso, isRegeneratableDay } from './plan-week.js';

describe('plan-week helpers', () => {
  it('maps week days to ISO dates', () => {
    expect(dayDateIso('2026-11-02', 'monday')).toBe('2026-11-02');
    expect(dayDateIso('2026-11-02', 'wednesday')).toBe('2026-11-04');
    expect(dayDateIso('2026-11-02', 'sunday')).toBe('2026-11-08');
  });

  it('only regenerates future planned days', () => {
    expect(
      isRegeneratableDay({
        weekStart: '2026-11-02',
        day: 'monday',
        status: 'planned',
        todayIso: '2026-11-04',
      }),
    ).toBe(false);
    expect(
      isRegeneratableDay({
        weekStart: '2026-11-02',
        day: 'wednesday',
        status: 'planned',
        todayIso: '2026-11-04',
      }),
    ).toBe(true);
    expect(
      isRegeneratableDay({
        weekStart: '2026-11-02',
        day: 'friday',
        status: 'skipped',
        todayIso: '2026-11-04',
      }),
    ).toBe(false);
  });
});
