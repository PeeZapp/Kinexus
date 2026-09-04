import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { addDaysIso, mondayWeekStart } from '@kinexus/domain';

type MealsWeekValue = {
  weekStart: string;
  setWeek: (next: string) => void;
  shiftWeek: (delta: number) => void;
};

const MealsWeekContext = createContext<MealsWeekValue | null>(null);

export function MealsWeekProvider({ children }: { children: ReactNode }) {
  const [weekStart, setWeekStart] = useState(mondayWeekStart);
  const value = useMemo<MealsWeekValue>(
    () => ({
      weekStart,
      setWeek: setWeekStart,
      shiftWeek: (delta) => setWeekStart((current) => addDaysIso(current, delta * 7)),
    }),
    [weekStart],
  );
  return <MealsWeekContext.Provider value={value}>{children}</MealsWeekContext.Provider>;
}

export function useMealsWeek(): MealsWeekValue {
  const ctx = useContext(MealsWeekContext);
  if (!ctx) throw new Error('useMealsWeek must be used inside MealsWeekProvider');
  return ctx;
}
