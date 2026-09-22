import type { Href } from 'expo-router';

export type ModuleKey = 'meals' | 'lists' | 'finances' | 'nutrition' | 'train';

export const SETTINGS_PATH = '/settings';
export const SETTINGS_HREF = SETTINGS_PATH as Href;

export type AppModule = {
  key: ModuleKey;
  href: '/meals' | '/lists' | '/finances' | '/nutrition' | '/train';
  label: string;
  short: string;
  description: string;
};

export const MODULES: readonly AppModule[] = [
  {
    key: 'meals',
    href: '/meals',
    label: 'Meals',
    short: 'ME',
    description: 'Weekly meal planning, recipes, and shopping.',
  },
  {
    key: 'lists',
    href: '/lists',
    label: 'Lists',
    short: 'LI',
    description: 'Household checklists, wishlists, watchlist, and saved finds.',
  },
  {
    key: 'finances',
    href: '/finances',
    label: 'Money',
    short: 'MN',
    description: 'Family assets, net worth, and monthly budget.',
  },
  {
    key: 'nutrition',
    href: '/nutrition',
    label: 'Nutrition',
    short: 'NU',
    description: 'Daily food log and nutrition tracking.',
  },
  {
    key: 'train',
    href: '/train',
    label: 'Train',
    short: 'TR',
    description: 'Workouts and training plans.',
  },
];

export function moduleFromPath(pathname: string): AppModule | undefined {
  return MODULES.find((mod) => pathname === mod.href || pathname.startsWith(`${mod.href}/`));
}

export function titleFromPath(pathname: string): string {
  if (pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`)) return 'Settings';
  if (pathname.startsWith('/invite')) return 'Invite';
  if (pathname.startsWith('/import')) return 'Import';
  if (pathname === '/recipes' || pathname.startsWith('/recipes/')) return 'Cook';
  if (pathname.startsWith('/lists/wishlists')) return 'Wishlists';
  if (pathname.startsWith('/lists/watchlist')) return 'Watchlist';
  if (pathname.startsWith('/lists/saves')) return 'Saves';
  if (pathname.startsWith('/lists/reader')) return 'Reader';
  if (pathname.startsWith('/finances/assets')) return 'Assets';
  if (pathname.startsWith('/finances/shares')) return 'Shares';
  if (pathname.startsWith('/finances/collectibles')) return 'Collectibles';
  if (pathname.startsWith('/finances/dashboard')) return 'Dashboard';
  if (pathname === '/finances' || pathname.startsWith('/finances/budget')) return 'Budget';
  if (pathname.startsWith('/meals/generate')) return 'Generate';
  if (pathname.startsWith('/meals/shopping')) return 'Shopping';
  if (pathname.startsWith('/meals/recipes')) return 'Recipes';
  return moduleFromPath(pathname)?.label ?? 'Kinexus';
}
