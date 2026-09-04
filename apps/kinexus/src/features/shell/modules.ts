import type { Href } from 'expo-router';

export type ModuleKey = 'meals' | 'stash' | 'nutrition' | 'train';

export const SETTINGS_PATH = '/settings';
export const SETTINGS_HREF = SETTINGS_PATH as Href;

export type AppModule = {
  key: ModuleKey;
  href: '/meals' | '/stash' | '/nutrition' | '/train';
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
    key: 'stash',
    href: '/stash',
    label: 'Stash',
    short: 'ST',
    description: 'Wishlist and saved finds for your household.',
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
  if (pathname.startsWith('/meals/generate')) return 'Generate';
  if (pathname.startsWith('/meals/shopping')) return 'Shopping';
  if (pathname.startsWith('/meals/recipes')) return 'Recipes';
  return moduleFromPath(pathname)?.label ?? 'Kinexus';
}
