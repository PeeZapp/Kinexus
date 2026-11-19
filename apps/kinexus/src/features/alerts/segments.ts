export type AlertSegment =
  | 'meal_plan'
  | 'calendar'
  | 'talk'
  | 'tasks'
  | 'wishlist'
  | 'shopping'
  | 'checklist'
  | 'watchlist_available'
  | 'budget'
  | 'investment_alert'
  | 'staff';

/** Household-facing alert segments (prefs + main inbox). */
export const ALERT_SEGMENTS: readonly AlertSegment[] = [
  'meal_plan',
  'calendar',
  'talk',
  'tasks',
  'wishlist',
  'shopping',
  'checklist',
  'watchlist_available',
  'budget',
  'investment_alert',
];

export const STAFF_ALERT_SEGMENT: AlertSegment = 'staff';

export type AlertScope = 'household' | 'staff';

export function alertSegmentLabel(segment: AlertSegment | string): string {
  switch (segment) {
    case 'meal_plan':
      return 'Meal planner';
    case 'calendar':
      return 'Calendar';
    case 'talk':
      return 'Talk';
    case 'tasks':
      return 'Tasks';
    case 'wishlist':
      return 'Wishlist';
    case 'shopping':
      return 'Shopping';
    case 'checklist':
      return 'Checklist';
    case 'watchlist_available':
      return 'Watchlist availability';
    case 'budget':
      return 'Budget';
    case 'investment_alert':
      return 'Investment alerts';
    case 'staff':
      return 'Developer';
    default:
      return 'Alert';
  }
}
