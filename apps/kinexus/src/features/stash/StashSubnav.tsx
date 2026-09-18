import type { Href } from 'expo-router';

import { SubnavTabs } from '@/src/features/shell/SubnavTabs';

const TABS = [
  { href: '/lists' as Href, label: 'Lists', match: (p: string) => p === '/lists' },
  { href: '/lists/wishlists' as Href, label: 'Wishlists', match: (p: string) => p.startsWith('/lists/wishlists') },
  { href: '/lists/watchlist' as Href, label: 'Watchlist', match: (p: string) => p.startsWith('/lists/watchlist') },
  { href: '/lists/saves' as Href, label: 'Saves', match: (p: string) => p.startsWith('/lists/saves') },
];

export function StashSubnav() {
  return <SubnavTabs title="Lists" tabs={TABS} />;
}
