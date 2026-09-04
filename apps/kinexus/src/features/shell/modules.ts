export type ModuleKey = 'meals' | 'stash' | 'nutrition' | 'train';

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
