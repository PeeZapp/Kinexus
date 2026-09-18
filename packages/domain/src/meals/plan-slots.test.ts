import { describe, expect, it } from 'vitest';

import {
  addableMealSlotKeys,
  dayIsRemovedFromPlan,
  orderedMealSlotKeys,
  otherDaysToHideForNewSlot,
  plannedDays,
  shouldDropSlotFromActive,
  visibleMealSlotKeys,
} from './plan-slots';

describe('orderedMealSlotKeys', () => {
  it('returns meal-of-day order even if active slots are stored out of order', () => {
    expect(orderedMealSlotKeys(['dinner', 'breakfast', 'dessert'])).toEqual(['breakfast', 'dinner', 'dessert']);
  });
});

describe('visibleMealSlotKeys', () => {
  it('drops hidden slots for that day', () => {
    expect(visibleMealSlotKeys(['breakfast', 'lunch', 'dinner'], new Set(['lunch']))).toEqual(['breakfast', 'dinner']);
  });
});

describe('addableMealSlotKeys', () => {
  it('offers every slot type that is not already showing on the day', () => {
    expect(addableMealSlotKeys(['breakfast', 'dinner'])).toEqual([
      'morning_snack',
      'lunch',
      'afternoon_snack',
      'night_snack',
      'dessert',
    ]);
  });
});

describe('dayIsRemovedFromPlan', () => {
  it('is false when the day has no slot rows yet', () => {
    expect(dayIsRemovedFromPlan(['breakfast', 'lunch', 'dinner'], new Map(), 'monday')).toBe(false);
  });

  it('is true only when every active slot on the day is hidden', () => {
    const slotMap = new Map([
      ['monday_breakfast', { hidden: true }],
      ['monday_lunch', { hidden: true }],
      ['monday_dinner', { hidden: true }],
      ['tuesday_breakfast', { hidden: true }],
    ]);
    expect(dayIsRemovedFromPlan(['breakfast', 'lunch', 'dinner'], slotMap, 'monday')).toBe(true);
    expect(dayIsRemovedFromPlan(['breakfast', 'lunch', 'dinner'], slotMap, 'tuesday')).toBe(false);
  });

  it('lists remaining planned days in week order', () => {
    const slotMap = new Map([
      ['friday_breakfast', { hidden: true }],
      ['friday_lunch', { hidden: true }],
      ['friday_dinner', { hidden: true }],
    ]);
    expect(plannedDays(['breakfast', 'lunch', 'dinner'], slotMap)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'saturday',
      'sunday',
    ]);
  });
});

describe('otherDaysToHideForNewSlot', () => {
  it('hides the new type on other days so it only appears on the chosen day', () => {
    expect(otherDaysToHideForNewSlot('lunch', 'tuesday', ['breakfast', 'dinner'])).toEqual([
      'monday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
  });

  it('does not hide other days when the type is already on the week', () => {
    expect(otherDaysToHideForNewSlot('lunch', 'tuesday', ['breakfast', 'lunch', 'dinner'])).toEqual([]);
  });
});

describe('shouldDropSlotFromActive', () => {
  it('drops a type that is only showing on the day being edited', () => {
    const slotMap = new Map(
      ['monday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => [
        `${day}_lunch`,
        { hidden: true },
      ]),
    );
    expect(shouldDropSlotFromActive('lunch', 'tuesday', ['breakfast', 'lunch', 'dinner'], slotMap)).toBe(true);
  });

  it('keeps a type that is still showing on other days', () => {
    expect(shouldDropSlotFromActive('lunch', 'monday', ['breakfast', 'lunch', 'dinner'], new Map())).toBe(false);
  });
});
