import type { CalendarColor, CalendarMarkerKind } from '@kinexus/domain';

import { colors } from '@/src/features/shell/theme';

export const EVENT_COLOR: Record<CalendarColor, string> = {
  teal: colors.accent,
  amber: '#F5C16C',
  rose: '#F07178',
  sky: '#6CB6FF',
  violet: '#B39DFF',
  coral: '#FF8B6B',
};

export const EVENT_COLOR_SOFT: Record<CalendarColor, string> = {
  teal: colors.accentSoft,
  amber: 'rgba(245, 193, 108, 0.14)',
  rose: 'rgba(240, 113, 120, 0.14)',
  sky: 'rgba(108, 182, 255, 0.14)',
  violet: 'rgba(179, 157, 255, 0.14)',
  coral: 'rgba(255, 139, 107, 0.14)',
};

export const MARKER_COLOR: Record<CalendarMarkerKind, string> = {
  birthday: '#F07178',
  public_holiday: '#F5C16C',
  school_holiday: '#6CB6FF',
};

export const MARKER_COLOR_SOFT: Record<CalendarMarkerKind, string> = {
  birthday: 'rgba(240, 113, 120, 0.14)',
  public_holiday: 'rgba(245, 193, 108, 0.14)',
  school_holiday: 'rgba(108, 182, 255, 0.14)',
};
