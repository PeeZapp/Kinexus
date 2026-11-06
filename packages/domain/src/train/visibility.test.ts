import { describe, expect, it } from 'vitest';

import { defaultTrainBuddyPermissions } from './buddies';
import {
  allowedFamilyPlanShares,
  canCopySharedWorkout,
  canEditWorkoutVisibility,
  canViewSessionVisibility,
  canViewWorkoutVisibility,
  canViewWorkoutWeights,
  normalizeTrainShare,
  resolveDefaultWorkoutVisibility,
  trainVisibilityLabel,
  trainVisibilityOptions,
} from './visibility';

const perms = defaultTrainBuddyPermissions();

describe('resolveDefaultWorkoutVisibility', () => {
  it('defaults private and blocks global for non-creators', () => {
    expect(resolveDefaultWorkoutVisibility({ preferred: null, isApprovedCreator: false })).toBe('private');
    expect(resolveDefaultWorkoutVisibility({ preferred: 'global', isApprovedCreator: false })).toBe('private');
    expect(resolveDefaultWorkoutVisibility({ preferred: 'global', isApprovedCreator: true })).toBe('global');
    expect(resolveDefaultWorkoutVisibility({ preferred: 'buddies', isApprovedCreator: false })).toBe('buddies');
  });
});

describe('normalizeTrainShare', () => {
  it('keeps people ids and clears buddy ids', () => {
    expect(normalizeTrainShare('people', ['a', 'a', 'b'], ['x'])).toEqual({
      visibility: 'people',
      personIds: ['a', 'b'],
      buddyUserIds: [],
    });
  });

  it('keeps buddy ids only for buddies_selected', () => {
    expect(normalizeTrainShare('buddies_selected', ['a'], ['x', 'x'])).toEqual({
      visibility: 'buddies_selected',
      personIds: [],
      buddyUserIds: ['x'],
    });
    expect(normalizeTrainShare('buddies', ['a'], ['x']).buddyUserIds).toEqual([]);
  });
});

describe('canViewWorkoutVisibility', () => {
  const base = {
    viewerId: 'viewer',
    ownerId: 'owner',
    visibility: 'private' as const,
    householdMember: false,
    householdRole: null,
    sharedWithViewer: false,
    buddySharedWithViewer: false,
    buddyStatus: 'accepted' as const,
    buddyPermissions: perms,
  };

  it('allows owner', () => {
    expect(canViewWorkoutVisibility({ ...base, viewerId: 'owner', visibility: 'private' })).toBe(true);
  });

  it('denies non-buddy / non-household', () => {
    expect(canViewWorkoutVisibility({ ...base, visibility: 'buddies', buddyStatus: null })).toBe(false);
    expect(canViewWorkoutVisibility({ ...base, visibility: 'household' })).toBe(false);
  });

  it('allows household family visibility', () => {
    expect(
      canViewWorkoutVisibility({
        ...base,
        visibility: 'household',
        householdMember: true,
        householdRole: 'adult',
      }),
    ).toBe(true);
  });

  it('keeps people household sharing', () => {
    expect(
      canViewWorkoutVisibility({
        ...base,
        visibility: 'people',
        householdMember: true,
        householdRole: 'teen',
        sharedWithViewer: true,
      }),
    ).toBe(true);
    expect(
      canViewWorkoutVisibility({
        ...base,
        visibility: 'people',
        householdMember: true,
        householdRole: 'teen',
        sharedWithViewer: false,
      }),
    ).toBe(false);
  });

  it('allows all-buddies and specific-buddy-only', () => {
    expect(canViewWorkoutVisibility({ ...base, visibility: 'buddies' })).toBe(true);
    expect(
      canViewWorkoutVisibility({
        ...base,
        visibility: 'buddies_selected',
        buddySharedWithViewer: false,
      }),
    ).toBe(false);
    expect(
      canViewWorkoutVisibility({
        ...base,
        visibility: 'buddies_selected',
        buddySharedWithViewer: true,
      }),
    ).toBe(true);
  });

  it('blocks removed / blocked buddies', () => {
    expect(canViewWorkoutVisibility({ ...base, visibility: 'buddies', buddyStatus: 'blocked' })).toBe(false);
    expect(canViewWorkoutVisibility({ ...base, visibility: 'buddies', buddyStatus: null })).toBe(false);
    expect(
      canViewWorkoutVisibility({
        ...base,
        visibility: 'buddies',
        buddyPermissions: { ...perms, can_view_workouts: false },
      }),
    ).toBe(false);
  });

  it('respects child cannot edit others', () => {
    expect(
      canEditWorkoutVisibility({
        ...base,
        visibility: 'household',
        householdMember: true,
        householdRole: 'child',
      }),
    ).toBe(false);
    expect(
      canEditWorkoutVisibility({
        ...base,
        viewerId: 'owner',
        ownerId: 'owner',
        householdMember: true,
        householdRole: 'teen',
        visibility: 'private',
      }),
    ).toBe(true);
  });
});

describe('session and weights privacy', () => {
  it('hides sessions beyond owner without permission', () => {
    expect(
      canViewSessionVisibility({
        viewerId: 'viewer',
        ownerId: 'owner',
        buddyStatus: 'accepted',
        buddyPermissions: perms,
        householdMember: true,
        householdRole: 'adult',
        familyPlanShare: 'plan',
      }),
    ).toBe(false);
  });

  it('allows family activity for non-child and never leaks weights to child/teen', () => {
    expect(
      canViewSessionVisibility({
        viewerId: 'viewer',
        ownerId: 'owner',
        buddyStatus: null,
        buddyPermissions: null,
        householdMember: true,
        householdRole: 'adult',
        familyPlanShare: 'plan_activity',
      }),
    ).toBe(true);
    expect(
      canViewWorkoutWeights({
        viewerId: 'viewer',
        ownerId: 'owner',
        buddyStatus: null,
        buddyPermissions: null,
        householdRole: 'child',
        familyPlanShare: 'plan_activity',
      }),
    ).toBe(false);
    expect(
      canViewWorkoutWeights({
        viewerId: 'viewer',
        ownerId: 'owner',
        buddyStatus: null,
        buddyPermissions: null,
        householdRole: 'adult',
        familyPlanShare: 'plan_activity',
      }),
    ).toBe(true);
  });
});

describe('copy + picker', () => {
  it('gates copy on can_copy_workouts', () => {
    expect(canCopySharedWorkout({ buddyStatus: 'accepted', buddyPermissions: perms })).toBe(true);
    expect(
      canCopySharedWorkout({
        buddyStatus: 'accepted',
        buddyPermissions: { ...perms, can_copy_workouts: false },
      }),
    ).toBe(false);
  });

  it('shows Everyone only to creators and labels Family', () => {
    expect(trainVisibilityOptions({ isApprovedCreator: false }).some((o) => o.value === 'global')).toBe(false);
    expect(trainVisibilityOptions({ isApprovedCreator: true }).some((o) => o.value === 'global')).toBe(true);
    expect(trainVisibilityLabel('household')).toBe('Family');
    expect(allowedFamilyPlanShares('child')).toEqual(['off', 'plan']);
  });
});
