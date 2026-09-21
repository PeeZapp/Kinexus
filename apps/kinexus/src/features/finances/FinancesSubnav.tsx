import type { Href } from 'expo-router';

import { SubnavTabs } from '@/src/features/shell/SubnavTabs';

const TABS = [
  { href: '/finances' as Href, label: 'Budget', match: (p: string) => p === '/finances' || p.startsWith('/finances/budget') },
  { href: '/finances/dashboard' as Href, label: 'Dashboard', match: (p: string) => p.startsWith('/finances/dashboard') },
  { href: '/finances/assets' as Href, label: 'Assets', match: (p: string) => p.startsWith('/finances/assets') },
  { href: '/finances/shares' as Href, label: 'Shares', match: (p: string) => p.startsWith('/finances/shares') },
  {
    href: '/finances/collectibles' as Href,
    label: 'Collectibles',
    match: (p: string) => p.startsWith('/finances/collectibles'),
  },
];

export function FinancesSubnav() {
  return <SubnavTabs title="Money" tabs={TABS} />;
}
