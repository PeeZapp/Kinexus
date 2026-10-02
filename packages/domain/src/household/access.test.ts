import { describe, expect, it } from 'vitest';

import {
  assignableRoles,
  canChangeMemberRole,
  canEditBudgetTxn,
  canEditShared,
  canRemoveMember,
  canSeeShared,
  canViewFinances,
  inviteRoles,
} from './access';

const adultView = {
  role: 'adult' as const,
  userId: 'adult-1',
  personId: 'p1',
  createdBy: 'other',
  visibility: 'private' as const,
  personIds: [] as string[],
};

describe('household access', () => {
  it('lets adults invite below admin and not as admin', () => {
    expect(inviteRoles('adult')).toEqual(['adult', 'teen', 'child']);
    expect(inviteRoles('admin')).toEqual(['admin', 'adult', 'teen', 'child']);
  });

  it('lets admins change anyone except the owner, and adults only lower roles', () => {
    expect(canChangeMemberRole('admin', 'admin', 'teen', false)).toBe(true);
    expect(canChangeMemberRole('admin', 'owner', 'adult', false)).toBe(false);
    expect(canChangeMemberRole('adult', 'teen', 'child', false)).toBe(true);
    expect(canChangeMemberRole('adult', 'admin', 'adult', false)).toBe(false);
    expect(assignableRoles('adult', 'admin', false)).toEqual([]);
  });

  it('lets owners and admins remove only adult, teen, and child', () => {
    expect(canRemoveMember('admin', 'teen', false)).toBe(true);
    expect(canRemoveMember('admin', 'admin', false)).toBe(false);
    expect(canRemoveMember('adult', 'teen', false)).toBe(false);
  });

  it('hides finances from teens and children', () => {
    expect(canViewFinances('adult')).toBe(true);
    expect(canViewFinances('teen')).toBe(false);
    expect(canViewFinances('child')).toBe(false);
  });

  it('lets adults edit only budget amounts they entered', () => {
    expect(canEditBudgetTxn('adult', 'adult-1', 'adult-1')).toBe(true);
    expect(canEditBudgetTxn('adult', 'other', 'adult-1')).toBe(false);
    expect(canEditBudgetTxn('admin', 'other', 'admin-1')).toBe(true);
  });

  it('hides private saves from adults who were not given access', () => {
    expect(canSeeShared(adultView)).toBe(false);
    expect(canSeeShared({ ...adultView, createdBy: 'adult-1' })).toBe(true);
    expect(canSeeShared({ ...adultView, visibility: 'household' })).toBe(true);
    expect(canSeeShared({ ...adultView, visibility: 'people', personIds: ['p1'] })).toBe(true);
    expect(canSeeShared({ ...adultView, role: 'admin' })).toBe(false);
    expect(canSeeShared({ ...adultView, role: 'admin', createdBy: 'adult-1', userId: 'adult-1' })).toBe(true);
    expect(canSeeShared({ ...adultView, role: 'owner' })).toBe(true);
    expect(canSeeShared({ ...adultView, role: 'admin', visibility: 'household' })).toBe(true);
    expect(canEditShared({ ...adultView, role: 'admin' })).toBe(false);
    expect(canEditShared(adultView)).toBe(false);
    expect(canEditShared({ ...adultView, visibility: 'household' })).toBe(true);
    expect(canEditShared({ ...adultView, role: 'teen', visibility: 'household' })).toBe(false);
    expect(canEditShared({ ...adultView, role: 'teen', visibility: 'household' }, true)).toBe(true);
  });
});
