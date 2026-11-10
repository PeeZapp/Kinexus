import { describe, expect, it } from 'vitest';

import {
  canManageReadlist,
  canViewReadlist,
  groupReadlistShelves,
  progressFromPages,
  progressFromSeconds,
  progressPercent,
  readStatusLabel,
} from './readlist';
import type { ReadlistItem, ReadlistList } from './types';

function list(partial: Partial<ReadlistList> & Pick<ReadlistList, 'id' | 'name'>): ReadlistList {
  return {
    householdId: 'hh',
    createdBy: 'u1',
    visibility: 'household',
    isDefault: false,
    personIds: [],
    shareToken: null,
    isShared: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

function item(partial: Partial<ReadlistItem> & Pick<ReadlistItem, 'id' | 'status'>): ReadlistItem {
  return {
    listId: 'list',
    workId: 'work',
    preferredEditionId: null,
    addedBy: 'u1',
    addedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('readlist visibility', () => {
  it('mirrors watchlist canView / canManage', () => {
    const mine = list({ id: 'p', name: 'Mine', visibility: 'private', createdBy: 'u1' });
    expect(canViewReadlist(mine, { role: 'adult', userId: 'u1', personId: 'p1' })).toBe(true);
    expect(canViewReadlist(mine, { role: 'adult', userId: 'u2', personId: 'p2' })).toBe(false);
    expect(canManageReadlist(mine, { role: 'adult', userId: 'u1', personId: 'p1' })).toBe(true);
    expect(canManageReadlist(mine, { role: 'adult', userId: 'u2', personId: 'p2' })).toBe(false);

    const family = list({ id: 'f', name: 'Family', visibility: 'household' });
    expect(canViewReadlist(family, { role: 'teen', userId: 'u2', personId: 'p2' })).toBe(true);
    expect(canManageReadlist(family, { role: 'teen', userId: 'u2', personId: 'p2' })).toBe(true);

    const shared = list({
      id: 's',
      name: 'Shared',
      visibility: 'people',
      personIds: ['p2'],
      createdBy: 'u1',
    });
    expect(canViewReadlist(shared, { role: 'adult', userId: 'u2', personId: 'p2' })).toBe(true);
    expect(canViewReadlist(shared, { role: 'adult', userId: 'u3', personId: 'p3' })).toBe(false);
  });
});

describe('groupReadlistShelves', () => {
  it('splits items into three shelves by status', () => {
    const shelves = groupReadlistShelves([
      item({ id: '1', status: 'want_to_read' }),
      item({ id: '2', status: 'reading' }),
      item({ id: '3', status: 'finished' }),
      item({ id: '4', status: 'want_to_read' }),
    ]);
    expect(shelves.wantToRead.map((row) => row.id)).toEqual(['1', '4']);
    expect(shelves.reading.map((row) => row.id)).toEqual(['2']);
    expect(shelves.finished.map((row) => row.id)).toEqual(['3']);
  });
});

describe('progress helpers', () => {
  it('computes percent from pages and seconds', () => {
    expect(progressFromPages(50, 200)).toBe(25);
    expect(progressFromSeconds(900, 3600)).toBe(25);
    expect(progressPercent({ percent: 40, pagesRead: 10, pages: 100 })).toBe(40);
    expect(progressPercent({ pagesRead: 0, pages: 100 })).toBe(0);
    expect(progressPercent({ pagesRead: 10, pages: 0 })).toBeNull();
    expect(progressPercent({})).toBeNull();
  });
});

describe('readStatusLabel', () => {
  it('labels the three shelves', () => {
    expect(readStatusLabel('want_to_read')).toBe('Want to read');
    expect(readStatusLabel('reading')).toBe('Reading');
    expect(readStatusLabel('finished')).toBe('Already read');
  });
});
