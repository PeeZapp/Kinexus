import { describe, expect, it } from 'vitest';

import { defaultTrainBuddyPermissions } from './buddies';
import {
  buddyHubVisibility,
  canViewTrainBuddyEvent,
  filterTrainBuddyFeed,
  isTrainBuddyEventType,
  trainBuddyEventLabel,
  trainBuddyEventPermission,
} from './feed';

describe('trainBuddyEventPermission', () => {
  it('maps event types to buddy flags', () => {
    expect(trainBuddyEventPermission('completed_workout')).toBe('can_view_sessions');
    expect(trainBuddyEventPermission('new_pr')).toBe('can_view_prs');
    expect(trainBuddyEventPermission('shared_workout')).toBe('can_view_workouts');
  });
});

describe('canViewTrainBuddyEvent', () => {
  const actor = 'actor';
  const viewer = 'viewer';
  const perms = {
    ...defaultTrainBuddyPermissions(),
    can_view_sessions: true,
    can_view_prs: true,
  };

  it('allows the actor', () => {
    expect(
      canViewTrainBuddyEvent({
        viewerId: actor,
        actorId: actor,
        eventType: 'new_pr',
        buddyStatus: null,
        buddyPermissions: null,
      }),
    ).toBe(true);
  });

  it('requires accepted buddy + matching permission', () => {
    expect(
      canViewTrainBuddyEvent({
        viewerId: viewer,
        actorId: actor,
        eventType: 'completed_workout',
        buddyStatus: 'accepted',
        buddyPermissions: perms,
      }),
    ).toBe(true);
    expect(
      canViewTrainBuddyEvent({
        viewerId: viewer,
        actorId: actor,
        eventType: 'shared_workout',
        buddyStatus: 'accepted',
        buddyPermissions: perms,
      }),
    ).toBe(true);
    expect(
      canViewTrainBuddyEvent({
        viewerId: viewer,
        actorId: actor,
        eventType: 'shared_workout',
        buddyStatus: 'accepted',
        buddyPermissions: { ...perms, can_view_workouts: false },
      }),
    ).toBe(false);
  });

  it('hides after block or remove', () => {
    expect(
      canViewTrainBuddyEvent({
        viewerId: viewer,
        actorId: actor,
        eventType: 'completed_workout',
        buddyStatus: 'blocked',
        buddyPermissions: perms,
      }),
    ).toBe(false);
    expect(
      canViewTrainBuddyEvent({
        viewerId: viewer,
        actorId: actor,
        eventType: 'completed_workout',
        buddyStatus: null,
        buddyPermissions: perms,
      }),
    ).toBe(false);
  });
});

describe('filterTrainBuddyFeed', () => {
  it('keeps only permitted events', () => {
    const events = [
      { id: '1', actorId: 'a', eventType: 'completed_workout' as const },
      { id: '2', actorId: 'a', eventType: 'new_pr' as const },
      { id: '3', actorId: 'b', eventType: 'shared_workout' as const },
      { id: '4', actorId: 'viewer', eventType: 'shared_workout' as const },
    ];
    const filtered = filterTrainBuddyFeed(events, {
      viewerId: 'viewer',
      buddyStatusByActor: new Map([
        ['a', 'accepted'],
        ['b', 'blocked'],
        ['viewer', 'accepted'],
      ]),
      buddyPermissionsByActor: new Map([
        ['a', { ...defaultTrainBuddyPermissions(), can_view_sessions: true }],
        ['b', defaultTrainBuddyPermissions()],
      ]),
    });
    expect(filtered.map((row) => row.id)).toEqual(['1', '4']);
  });
});

describe('buddyHubVisibility', () => {
  it('gates hub sections by their permissions for me', () => {
    const vis = buddyHubVisibility({
      buddyStatus: 'accepted',
      theirPermissionsForMe: {
        ...defaultTrainBuddyPermissions(),
        can_view_plan: true,
        can_view_sessions: true,
      },
    });
    expect(vis.plan).toBe(true);
    expect(vis.workouts).toBe(true);
    expect(vis.copyWorkouts).toBe(true);
    expect(vis.sessions).toBe(true);
    expect(vis.prs).toBe(false);
  });

  it('shows nothing when blocked', () => {
    const vis = buddyHubVisibility({
      buddyStatus: 'blocked',
      theirPermissionsForMe: {
        ...defaultTrainBuddyPermissions(),
        can_view_plan: true,
        can_view_prs: true,
        can_view_sessions: true,
      },
    });
    expect(vis).toEqual({
      plan: false,
      workouts: false,
      copyWorkouts: false,
      sessions: false,
      prs: false,
    });
  });
});

describe('trainBuddyEventLabel', () => {
  it('formats copy', () => {
    expect(trainBuddyEventLabel('completed_workout', 'Push')).toBe('Completed Push');
    expect(trainBuddyEventLabel('new_pr', 'Squat')).toBe('New PR · Squat');
    expect(trainBuddyEventLabel('shared_workout', '')).toBe('Shared Workout');
  });
});

describe('isTrainBuddyEventType', () => {
  it('accepts known types', () => {
    expect(isTrainBuddyEventType('new_pr')).toBe(true);
    expect(isTrainBuddyEventType('comment')).toBe(false);
  });
});
