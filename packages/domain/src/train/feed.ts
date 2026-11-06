import { buddyCan, type TrainBuddyPermissions, type TrainBuddyStatus } from './buddies';

export const TRAIN_BUDDY_EVENT_TYPES = ['completed_workout', 'new_pr', 'shared_workout'] as const;
export type TrainBuddyEventType = (typeof TRAIN_BUDDY_EVENT_TYPES)[number];

export const TRAIN_TOGETHER_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type TrainTogetherStatus = (typeof TRAIN_TOGETHER_STATUSES)[number];

/** Maps feed event type → buddy permission required of the actor toward the viewer. */
export function trainBuddyEventPermission(
  eventType: TrainBuddyEventType,
): 'can_view_sessions' | 'can_view_prs' | 'can_view_workouts' {
  switch (eventType) {
    case 'completed_workout':
      return 'can_view_sessions';
    case 'new_pr':
      return 'can_view_prs';
    case 'shared_workout':
      return 'can_view_workouts';
  }
}

export function canViewTrainBuddyEvent(opts: {
  viewerId: string | null;
  actorId: string | null;
  eventType: TrainBuddyEventType;
  buddyStatus: TrainBuddyStatus | null | undefined;
  /** Permissions granted by actor → viewer. */
  buddyPermissions: Partial<TrainBuddyPermissions> | null | undefined;
}): boolean {
  if (!opts.viewerId || !opts.actorId) return false;
  if (opts.viewerId === opts.actorId) return true;
  return buddyCan(opts.buddyStatus, opts.buddyPermissions, trainBuddyEventPermission(opts.eventType));
}

export function filterTrainBuddyFeed<T extends { actorId: string; eventType: TrainBuddyEventType }>(
  events: readonly T[],
  opts: {
    viewerId: string | null;
    /** actorId → connection status with viewer */
    buddyStatusByActor: ReadonlyMap<string, TrainBuddyStatus | null | undefined>;
    /** actorId → permissions actor granted to viewer */
    buddyPermissionsByActor: ReadonlyMap<string, Partial<TrainBuddyPermissions> | null | undefined>;
  },
): T[] {
  if (!opts.viewerId) return [];
  return events.filter((event) =>
    canViewTrainBuddyEvent({
      viewerId: opts.viewerId,
      actorId: event.actorId,
      eventType: event.eventType,
      buddyStatus: opts.buddyStatusByActor.get(event.actorId),
      buddyPermissions: opts.buddyPermissionsByActor.get(event.actorId),
    }),
  );
}

/** What a viewer may see on a buddy's hub detail. */
export function buddyHubVisibility(opts: {
  buddyStatus: TrainBuddyStatus | null | undefined;
  /** Permissions granted by buddy → viewer. */
  theirPermissionsForMe: Partial<TrainBuddyPermissions> | null | undefined;
}): {
  plan: boolean;
  workouts: boolean;
  copyWorkouts: boolean;
  sessions: boolean;
  prs: boolean;
} {
  return {
    plan: buddyCan(opts.buddyStatus, opts.theirPermissionsForMe, 'can_view_plan'),
    workouts: buddyCan(opts.buddyStatus, opts.theirPermissionsForMe, 'can_view_workouts'),
    copyWorkouts: buddyCan(opts.buddyStatus, opts.theirPermissionsForMe, 'can_copy_workouts'),
    sessions: buddyCan(opts.buddyStatus, opts.theirPermissionsForMe, 'can_view_sessions'),
    prs: buddyCan(opts.buddyStatus, opts.theirPermissionsForMe, 'can_view_prs'),
  };
}

export function trainBuddyEventLabel(eventType: TrainBuddyEventType, title: string): string {
  const name = title.trim() || 'Workout';
  switch (eventType) {
    case 'completed_workout':
      return `Completed ${name}`;
    case 'new_pr':
      return `New PR · ${name}`;
    case 'shared_workout':
      return `Shared ${name}`;
  }
}

export function isTrainBuddyEventType(value: string): value is TrainBuddyEventType {
  return (TRAIN_BUDDY_EVENT_TYPES as readonly string[]).includes(value);
}

export function isTrainTogetherStatus(value: string): value is TrainTogetherStatus {
  return (TRAIN_TOGETHER_STATUSES as readonly string[]).includes(value);
}
