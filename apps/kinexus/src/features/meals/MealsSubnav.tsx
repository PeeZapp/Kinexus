import type { Href } from 'expo-router';

import { canManageMealPlan } from '@/src/features/meals/picker-access';
import { SubnavTabs } from '@/src/features/shell/SubnavTabs';
import { useHousehold } from '@/src/lib/household';

const TABS = [
  { href: '/meals' as Href, label: 'Plan', match: (p: string) => p === '/meals' },
  {
    href: '/meals/generate' as Href,
    label: 'Generate',
    match: (p: string) => p.startsWith('/meals/generate'),
    managersOnly: true,
  },
  {
    href: '/meals/picks' as Href,
    label: 'Picks',
    match: (p: string) => p.startsWith('/meals/picks'),
    managersOnly: true,
  },
  { href: '/meals/shopping' as Href, label: 'Shopping', match: (p: string) => p.startsWith('/meals/shopping') },
  { href: '/meals/recipes' as Href, label: 'Recipes', match: (p: string) => p.startsWith('/meals/recipes') },
];

export function MealsSubnav() {
  const { role } = useHousehold();
  const manage = canManageMealPlan(role);
  return <SubnavTabs title="Meals" tabs={TABS.filter((tab) => manage || !tab.managersOnly)} />;
}
