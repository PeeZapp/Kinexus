export type AlertSegment =
  | 'meal_plan'
  | 'calendar'
  | 'talk'
  | 'wishlist'
  | 'shopping'
  | 'checklist'
  | 'watchlist_available'
  | 'budget'
  | 'investment_alert';

export const ALERT_SEGMENTS: readonly AlertSegment[] = [
  'meal_plan',
  'calendar',
  'talk',
  'wishlist',
  'shopping',
  'checklist',
  'watchlist_available',
  'budget',
  'investment_alert',
];

export function alertSegmentLabel(segment: AlertSegment): string {
  switch (segment) {
    case 'meal_plan':
      return 'Meal planner';
    case 'calendar':
      return 'Calendar';
    case 'talk':
      return 'Talk';
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
  }
}
