import { describe, expect, it } from 'vitest';

import { birthdayMarkers, markersForDay, schoolHolidayMarkers } from './markers';

describe('calendar markers', () => {
  it('rolls birthdays into the requested range', () => {
    const markers = birthdayMarkers(
      [
        { id: 'p1', name: 'Sam', birthday: '2015-10-19' },
        { id: 'p2', name: 'Alex', birthday: null },
      ],
      '2026-10-01',
      '2026-10-31',
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]?.title).toBe('Sam’s birthday');
    expect(markers[0]?.startsOn).toBe('2026-10-19');
    expect(markersForDay(markers, '2026-10-19')).toHaveLength(1);
  });

  it('includes AU school holidays for the household country', () => {
    const markers = schoolHolidayMarkers('AU', '2026-07-01', '2026-07-20');
    expect(markers.some((marker) => marker.startsOn === '2026-07-06')).toBe(true);
    expect(markers[0]?.source).toContain('NSW');
  });
});
