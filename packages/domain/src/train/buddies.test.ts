import { describe, expect, it } from 'vitest';

import {
  areTrainBuddies,
  buddyCan,
  defaultTrainBuddyPermissions,
  isTrainBuddyPermissionKey,
  normalizeBuddyUsername,
} from './buddies';

describe('areTrainBuddies', () => {
  it('is true only for accepted', () => {
    expect(areTrainBuddies('accepted')).toBe(true);
    expect(areTrainBuddies('pending')).toBe(false);
    expect(areTrainBuddies('blocked')).toBe(false);
    expect(areTrainBuddies(null)).toBe(false);
  });
});

describe('buddyCan', () => {
  const defaults = defaultTrainBuddyPermissions();

  it('defaults allow view/copy workouts only', () => {
    expect(buddyCan('accepted', defaults, 'can_view_workouts')).toBe(true);
    expect(buddyCan('accepted', defaults, 'can_copy_workouts')).toBe(true);
    expect(buddyCan('accepted', defaults, 'can_view_plan')).toBe(false);
    expect(buddyCan('accepted', defaults, 'can_view_sessions')).toBe(false);
    expect(buddyCan('accepted', defaults, 'can_view_prs')).toBe(false);
    expect(buddyCan('accepted', defaults, 'can_coedit_shared')).toBe(false);
  });

  it('revokes instantly when blocked or removed (no status)', () => {
    expect(buddyCan('blocked', defaults, 'can_view_workouts')).toBe(false);
    expect(buddyCan('pending', defaults, 'can_view_workouts')).toBe(false);
    expect(buddyCan(null, defaults, 'can_view_workouts')).toBe(false);
  });

  it('denies non-buddies even if a permission row exists', () => {
    expect(buddyCan('pending', { can_view_workouts: true }, 'can_view_workouts')).toBe(false);
  });

  it('requires the specific flag', () => {
    expect(buddyCan('accepted', { ...defaults, can_view_prs: true }, 'can_view_prs')).toBe(true);
    expect(buddyCan('accepted', { ...defaults, can_view_prs: false }, 'can_view_prs')).toBe(false);
    expect(buddyCan('accepted', null, 'can_view_workouts')).toBe(false);
  });
});

describe('normalizeBuddyUsername', () => {
  it('strips @ and whitespace', () => {
    expect(normalizeBuddyUsername('  @SwiftOak  ')).toBe('SwiftOak');
    expect(normalizeBuddyUsername('SwiftOak')).toBe('SwiftOak');
  });
});

describe('isTrainBuddyPermissionKey', () => {
  it('accepts known keys only', () => {
    expect(isTrainBuddyPermissionKey('can_view_workouts')).toBe(true);
    expect(isTrainBuddyPermissionKey('can_hack')).toBe(false);
  });
});
