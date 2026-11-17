import type { Href } from 'expo-router';

import { SubnavTabs } from '@/src/features/shell/SubnavTabs';

const TABS = [
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
      path.startsWith('/settings/preferences') ||
      path.startsWith('/settings/news') ||
      path.startsWith('/settings/recipe-images'),
  },
];

export function SettingsSubnav() {
  return <SubnavTabs title="Settings" tabs={TABS} />;
}
