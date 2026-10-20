import { describe, expect, it } from 'vitest';

import {
  audienceOverlapsExisting,
  isHouseholdAudience,
  mealSlotRecordKey,
  normalizeAudiencePersonIds,
  slotMatchesPersonFilter,
  slotMatchesPlanPersonFilter,
} from './types';

describe('normalizeAudiencePersonIds', () => {
  it('dedupes and sorts', () => {
    expect(normalizeAudiencePersonIds(['b', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('treats empty as household', () => {
    expect(normalizeAudiencePersonIds([])).toEqual([]);
    expect(isHouseholdAudience([])).toBe(true);
    expect(isHouseholdAudience(['a'])).toBe(false);
  });
});

describe('mealSlotRecordKey', () => {
  it('keeps household keys without audience suffix', () => {
    expect(mealSlotRecordKey('monday', 'lunch')).toBe('monday_lunch');
    expect(mealSlotRecordKey('monday', 'lunch', [])).toBe('monday_lunch');
  });

  it('includes sorted audience for personal slots', () => {
    expect(mealSlotRecordKey('monday', 'lunch', ['b', 'a'])).toBe('monday_lunch__a,b');
  });
});

describe('slotMatchesPersonFilter', () => {
  it('always includes household meals', () => {
    expect(slotMatchesPersonFilter({ audiencePersonIds: [] }, 'p1')).toBe(true);
    expect(slotMatchesPersonFilter({}, 'p1')).toBe(true);
  });

  it('includes personal meals for that person only', () => {
    expect(slotMatchesPersonFilter({ audiencePersonIds: ['p1', 'p2'] }, 'p1')).toBe(true);
    expect(slotMatchesPersonFilter({ audiencePersonIds: ['p1', 'p2'] }, 'p3')).toBe(false);
  });

  it('hides hidden rows', () => {
    expect(slotMatchesPersonFilter({ hidden: true, audiencePersonIds: [] }, 'p1')).toBe(false);
  });
});

describe('slotMatchesPlanPersonFilter', () => {
  it('Everyone shows household meals only', () => {
    expect(slotMatchesPlanPersonFilter({ audiencePersonIds: [] }, 'all')).toBe(true);
    expect(slotMatchesPlanPersonFilter({ audiencePersonIds: ['p1'] }, 'all')).toBe(false);
  });

  it('person filter shows household plus that person', () => {
    expect(slotMatchesPlanPersonFilter({ audiencePersonIds: [] }, 'p1')).toBe(true);
    expect(slotMatchesPlanPersonFilter({ audiencePersonIds: ['p1'] }, 'p1')).toBe(true);
    expect(slotMatchesPlanPersonFilter({ audiencePersonIds: ['p2'] }, 'p1')).toBe(false);
  });
});

describe('audienceOverlapsExisting', () => {
  it('blocks a person who already has that slot that day', () => {
    expect(
      audienceOverlapsExisting(
        [{ id: '1', day: 'monday', slotKey: 'lunch', audiencePersonIds: ['paul'] }],
        'monday',
        'lunch',
        ['paul', 'ariane'],
      ),
    ).toBe(true);
  });

  it('allows non-overlapping audiences', () => {
    expect(
      audienceOverlapsExisting(
        [{ id: '1', day: 'monday', slotKey: 'lunch', audiencePersonIds: ['kids'] }],
        'monday',
        'lunch',
        ['paul', 'ariane'],
      ),
    ).toBe(false);
  });

  it('allows personal alongside a family meal', () => {
    expect(
      audienceOverlapsExisting(
        [{ id: '1', day: 'monday', slotKey: 'lunch', audiencePersonIds: [] }],
        'monday',
        'lunch',
        ['paul'],
      ),
    ).toBe(false);
  });

  it('allows family alongside a personal meal', () => {
    expect(
      audienceOverlapsExisting(
        [{ id: '1', day: 'monday', slotKey: 'lunch', audiencePersonIds: ['paul'] }],
        'monday',
        'lunch',
        [],
      ),
    ).toBe(false);
  });

  it('blocks a second family meal for the same slot', () => {
    expect(
      audienceOverlapsExisting(
        [{ id: '1', day: 'monday', slotKey: 'lunch', audiencePersonIds: [] }],
        'monday',
        'lunch',
        [],
      ),
    ).toBe(true);
  });

  it('ignores hidden and excluded rows', () => {
    expect(
      audienceOverlapsExisting(
        [
          { id: '1', day: 'monday', slotKey: 'lunch', audiencePersonIds: ['paul'], hidden: true },
          { id: '2', day: 'monday', slotKey: 'lunch', audiencePersonIds: ['paul'] },
        ],
        'monday',
        'lunch',
        ['paul'],
        '2',
      ),
    ).toBe(false);
  });
});
