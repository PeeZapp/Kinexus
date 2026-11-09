import type { Href } from 'expo-router';
import { mondayWeekStart } from '@kinexus/domain';

import { useMealsWeek } from '@/src/features/meals/MealsWeekContext';
import { canManageMealPlan } from '@/src/features/meals/picker-access';
import { WeekSwitcher } from '@/src/features/meals/plan/PlanShared';
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
  { href: '/meals/pantry' as Href, label: 'Pantry', match: (p: string) => p.startsWith('/meals/pantry') },
  {
    href: '/meals/recipes' as Href,
    label: 'Recipes',
    match: (p: string) => p.startsWith('/meals/recipes') && !p.startsWith('/meals/recipes/import'),
  },
  {
    href: '/meals/recipes/import' as Href,
    label: 'Import',
    match: (p: string) => p.startsWith('/meals/recipes/import'),
  },
];

export function MealsSubnav() {
  const { role } = useHousehold();
  const manage = canManageMealPlan(role);
  const { weekStart, setWeek, shiftWeek } = useMealsWeek();
  return (
    <SubnavTabs
      title="Meals"
      tabs={TABS.filter((tab) => manage || !tab.managersOnly)}
      accessory={
        <WeekSwitcher
          compact
          weekStart={weekStart}
          onPrev={() => shiftWeek(-1)}
          onNext={() => shiftWeek(1)}
          onJumpCurrent={() => setWeek(mondayWeekStart())}
        />
      }
    />
  );
}
