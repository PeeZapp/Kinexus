import { useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { mondayWeekStart } from '@kinexus/domain';

import { useMealsWeek } from '@/src/features/meals/MealsWeekContext';
import { ShoppingScreen } from '@/src/features/meals/shopping/ShoppingScreen';

function parseWeekParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  if (date.getFullYear() !== y || date.getMonth() !== m! - 1 || date.getDate() !== d) return null;
  if (mondayWeekStart(date) !== raw) return null;
  return raw;
}

export default function ShoppingRoute() {
  const params = useLocalSearchParams<{ week?: string | string[] }>();
  const { setWeek } = useMealsWeek();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    const week = parseWeekParam(params.week);
    if (!week) return;
    applied.current = true;
    setWeek(week);
  }, [params.week, setWeek]);

  return <ShoppingScreen />;
}
