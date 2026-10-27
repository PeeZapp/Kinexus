import type { Href } from 'expo-router';

import { SubnavTabs } from '@/src/features/shell/SubnavTabs';

const TABS = [
  {
    href: '/train' as Href,
    label: 'Workouts',
    match: (path: string) =>
      path === '/train' ||
      path.startsWith('/train/session') ||
      (/^\/train\/[^/]+$/.test(path) && !path.startsWith('/train/remix') && !path.startsWith('/train/library')),
  },
  { href: '/train/remix' as Href, label: 'Remix', match: (path: string) => path.startsWith('/train/remix') },
  { href: '/train/library' as Href, label: 'Library', match: (path: string) => path.startsWith('/train/library') },
];

export function TrainSubnav() {
  return <SubnavTabs title="Train" tabs={TABS} />;
}
