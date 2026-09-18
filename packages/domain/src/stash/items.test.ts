import { describe, expect, it } from 'vitest';

import {
  completeChecklistItem,
  filterChecklistItems,
  formatDueLabel,
  nextDueOn,
  sortChecklistItems,
  splitCheckedItems,
  todayChecklistItems,
} from './items';
import type { StashListItem } from './types';

function item(partial: Partial<StashListItem> & Pick<StashListItem, 'id' | 'title'>): StashListItem {
  return {
    householdId: 'h1',
    listId: 'list',
    notes: null,
    category: 'chores',
    priority: 0,
    dueOn: null,
    recurrence: 'none',
    assignedPersonId: null,
    isChecked: false,
    position: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...partial,
  };
}

describe('checklist items', () => {
  it('sorts overdue then today then later, with completed last', () => {
    const today = '2026-09-07';
    const items = [
      item({ id: 'c', title: 'Done', isChecked: true, priority: 4, dueOn: '2026-09-01' }),
      item({ id: 'later', title: 'Later', dueOn: '2026-09-10', priority: 4 }),
      item({ id: 'milk', title: 'Milk', dueOn: '2026-09-07', priority: 1 }),
      item({ id: 'bins', title: 'Bins', dueOn: '2026-09-01', priority: 1 }),
    ];
    expect(sortChecklistItems(items, today).map((row) => row.id)).toEqual(['bins', 'milk', 'later', 'c']);
    const split = splitCheckedItems(items, today);
    expect(split.active.map((row) => row.id)).toEqual(['bins', 'milk', 'later']);
    expect(split.checked.map((row) => row.id)).toEqual(['c']);
  });

  it('filters by search and category', () => {
    const items = [
      item({ id: 'a', title: 'Milk', category: 'groceries', notes: '2L' }),
      item({ id: 'b', title: 'Bins', category: 'chores' }),
    ];
    expect(filterChecklistItems(items, { category: 'chores' }).map((row) => row.id)).toEqual(['b']);
    expect(filterChecklistItems(items, { search: '2l' }).map((row) => row.id)).toEqual(['a']);
  });

  it('advances overdue weekly chores to the next date on or after today', () => {
    expect(nextDueOn('2026-08-24', 'weekly', '2026-09-07')).toBe('2026-09-07');
    expect(nextDueOn('2026-09-07', 'weekly', '2026-09-07')).toBe('2026-09-14');
    expect(nextDueOn('2026-01-31', 'monthly', '2026-02-01')).toBe('2026-02-28');
  });

  it('rolls a repeating item forward instead of leaving it checked', () => {
    const patch = completeChecklistItem(
      item({ id: 'bins', title: 'Bins', dueOn: '2026-09-07', recurrence: 'weekly' }),
      '2026-09-07',
    );
    expect(patch).toEqual({ isChecked: false, dueOn: '2026-09-14' });
    expect(completeChecklistItem(item({ id: 'milk', title: 'Milk', dueOn: '2026-09-07' }), '2026-09-07')).toEqual({
      isChecked: true,
      dueOn: '2026-09-07',
    });
  });

  it('labels due dates and collects today/overdue items', () => {
    const today = '2026-09-07';
    expect(formatDueLabel('2026-09-01', today)).toBe('Overdue · 1 Sep');
    expect(formatDueLabel('2026-09-07', today)).toBe('Today');
    expect(formatDueLabel('2026-09-08', today)).toBe('Tomorrow');
    const items = [
      item({ id: 'over', title: 'Over', dueOn: '2026-09-01' }),
      item({ id: 'now', title: 'Now', dueOn: today }),
      item({ id: 'later', title: 'Later', dueOn: '2026-09-20' }),
      item({ id: 'done', title: 'Done', dueOn: today, isChecked: true }),
    ];
    expect(todayChecklistItems(items, today).map((row) => row.id)).toEqual(['over', 'now']);
  });
});
