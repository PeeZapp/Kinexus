import type { Href } from 'expo-router';
import { usePathname } from 'expo-router';
import { mondayWeekStart } from '@kinexus/domain';

import { WeekSwitcher } from '@/src/features/meals/plan/PlanShared';
import { SubnavTabs } from '@/src/features/shell/SubnavTabs';
import { useTrainWeek } from '@/src/features/train/TrainWeekContext';

const TABS = [
  {
    href: '/train' as Href,
    label: 'Plan',
    match: (path: string) => path === '/train' || path.startsWith('/train/plan'),
  },
  {
    href: '/train/workouts' as Href,
    label: 'Workouts',
    match: (path: string) =>
      path === '/train/workouts' ||
      (/^\/train\/[^/]+$/.test(path) &&
        !path.startsWith('/train/remix') &&
        !path.startsWith('/train/library') &&
        !path.startsWith('/train/history') &&
        !path.startsWith('/train/buddies') &&
        !path.startsWith('/train/group') &&
        !path.startsWith('/train/plan') &&
        !path.startsWith('/train/family') &&
        !path.startsWith('/train/settings') &&
        !path.startsWith('/train/session') &&
        !path.startsWith('/train/workouts')),
  },
  {
    href: '/train/history' as Href,
    label: 'History',
    match: (path: string) => path.startsWith('/train/history') || path.startsWith('/train/session'),
  },
  { href: '/train/remix' as Href, label: 'Remix', match: (path: string) => path.startsWith('/train/remix') },
  { href: '/train/library' as Href, label: 'Exercises', match: (path: string) => path.startsWith('/train/library') },
  {
    href: '/train/buddies' as Href,
    label: 'Buddies',
    match: (path: string) => path.startsWith('/train/buddies'),
  },
  {
    href: '/train/group' as Href,
    label: 'Group session',
    match: (path: string) => path.startsWith('/train/group'),
  },
  {
    href: '/train/settings' as Href,
    label: 'Settings',
    match: (path: string) => path.startsWith('/train/settings'),
  },
];

export function TrainSubnav() {
  const pathname = usePathname();
  const { weekStart, setWeek, shiftWeek } = useTrainWeek();
  const showWeek = pathname === '/train' || pathname.startsWith('/train/plan');

  return (
    <SubnavTabs
      title="Train"
      tabs={TABS}
      accessory={
        showWeek ? (
          <WeekSwitcher
            compact
            weekStart={weekStart}
            onPrev={() => shiftWeek(-1)}
            onNext={() => shiftWeek(1)}
            onJumpCurrent={() => setWeek(mondayWeekStart())}
          />
        ) : null
      }
    />
  );
}
