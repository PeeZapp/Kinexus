import { useMemo } from 'react';
import type { Href } from 'expo-router';

import { useAlertsUnreadCount } from '@/src/features/alerts/use-alerts';
import { useDeveloperSettingsAccess } from '@/src/features/household/useDeveloperSettingsAccess';
import { SubnavTabs } from '@/src/features/shell/SubnavTabs';

const BASE_TABS = [
  {
    href: '/settings' as Href,
    label: 'Profile',
    match: (path: string) => path === '/settings',
  },
  {
    href: '/settings/household' as Href,
    label: 'Household',
    match: (path: string) =>
      path.startsWith('/settings/household') || path.startsWith('/settings/people'),
  },
  {
    href: '/settings/connections' as Href,
    label: 'Connections',
    match: (path: string) => path.startsWith('/settings/connections'),
  },
  {
    href: '/settings/preferences' as Href,
    label: 'Preferences',
    match: (path: string) =>
      path.startsWith('/settings/preferences') || path.startsWith('/settings/news'),
  },
];

export function SettingsSubnav() {
  const access = useDeveloperSettingsAccess();
  const staffUnread = useAlertsUnreadCount('staff', access.isStaff);
  const unreadCount = access.isStaff ? (staffUnread.data ?? 0) : 0;

  const tabs = useMemo(() => {
    if (!access.showTab) return BASE_TABS;
    const label = unreadCount > 0 ? `Developer (${unreadCount > 99 ? '99+' : unreadCount})` : 'Developer';
    return [
      ...BASE_TABS,
      {
        href: '/settings/developer' as Href,
        label,
        match: (path: string) =>
          path.startsWith('/settings/developer') || path.startsWith('/settings/recipe-images'),
      },
    ];
  }, [access.showTab, unreadCount]);

  return <SubnavTabs title="Settings" tabs={tabs} />;
}
