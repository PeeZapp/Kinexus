import { describe, expect, it } from 'vitest';

import {
  canManageLists,
  canViewList,
  descendantListIds,
  formatListLabel,
  listShareLabel,
  listTree,
  listsOfKind,
  normalizeListShare,
  productsForList,
  wouldCreateListCycle,
} from './lists';
import type { StashList, StashListProduct, StashProduct } from './types';

function list(partial: Partial<StashList> & Pick<StashList, 'id' | 'name'>): StashList {
  return {
    householdId: 'h1',
    createdBy: 'admin',
    visibility: 'household',
    personIds: [],
    kind: 'wishlist',
    parentListId: null,
    shareToken: null,
    isShared: false,
    emoji: null,
    theme: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...partial,
  };
}

function product(partial: Partial<StashProduct> & Pick<StashProduct, 'id' | 'title'>): StashProduct {
  return {
    householdId: 'h1',
    currentPrice: 10,
    originalPrice: null,
    isOnSale: false,
    imageUrl: null,
    sourceUrl: '',
    storeName: null,
    description: null,
    sku: null,
    priceSource: 'manual',
    detailStatus: 'ready',
    detailAttempts: 0,
    isOwned: false,
    notes: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...partial,
  };
}

describe('stash lists', () => {
  const gifts = list({ id: 'gifts', name: 'Gifts' });
  const dad = list({ id: 'dad', name: 'Dad', parentListId: 'gifts' });
  const tools = list({ id: 'tools', name: 'Tools', parentListId: 'dad' });

  it('walks descendants and builds a tree', () => {
    const lists = [gifts, dad, tools];
    expect(descendantListIds(lists, 'gifts')).toEqual(['dad', 'tools']);
    const tree = listTree(lists);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.children[0]?.id).toBe('tools');
  });

  it('aggregates products from nested lists without duplicates', () => {
    const lists = [gifts, dad, tools];
    const products = [product({ id: 'a', title: 'Mug' }), product({ id: 'b', title: 'Wrench' })];
    const memberships: StashListProduct[] = [
      { listId: 'gifts', productId: 'a', addedAt: '2026-01-01' },
      { listId: 'tools', productId: 'b', addedAt: '2026-01-01' },
      { listId: 'dad', productId: 'a', addedAt: '2026-01-01' },
    ];
    const nested = productsForList('gifts', products, memberships, lists);
    expect(nested.map((item) => item.id).sort()).toEqual(['a', 'b']);
  });

  it('blocks cycles and labels nested lists', () => {
    const lists = [gifts, dad, tools];
    expect(wouldCreateListCycle(lists, 'gifts', 'tools')).toBe(true);
    expect(wouldCreateListCycle(lists, 'tools', 'gifts')).toBe(false);
    expect(formatListLabel(dad, lists)).toBe('Gifts → Dad');
  });

  it('shares with family, privately, or specific people', () => {
    const family = list({ id: 'family', name: 'Groceries', visibility: 'household' });
    const secret = list({ id: 'secret', name: 'Gifts', visibility: 'private', createdBy: 'admin' });
    const kids = list({
      id: 'kids',
      name: 'Leo birthday',
      visibility: 'people',
      personIds: ['leo', 'paul'],
    });
    const member = { role: 'member' as const, userId: 'kid-user', personId: 'leo' };
    expect(canViewList(family, member)).toBe(true);
    expect(canViewList(secret, member)).toBe(false);
    expect(canViewList(secret, { role: 'admin', userId: 'other', personId: null })).toBe(true);
    expect(canViewList(kids, member)).toBe(true);
    expect(canViewList(kids, { role: 'member', userId: 'sib', personId: 'charlie' })).toBe(false);
    expect(canManageLists('member')).toBe(false);
    expect(canManageLists('owner')).toBe(true);
    expect(listShareLabel(kids, [{ id: 'leo', name: 'Leo' }, { id: 'paul', name: 'Paul' }])).toBe('Leo · Paul');
    expect(normalizeListShare('private', ['leo']).personIds).toEqual([]);
  });

  it('filters lists by kind', () => {
    const lists = [
      list({ id: 'gifts', name: 'Gifts', kind: 'wishlist' }),
      list({ id: 'chores', name: 'Chores', kind: 'checklist' }),
    ];
    expect(listsOfKind(lists, 'checklist').map((row) => row.id)).toEqual(['chores']);
    expect(listsOfKind(lists, 'wishlist').map((row) => row.id)).toEqual(['gifts']);
  });
});
