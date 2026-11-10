import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { addDaysIso, mondayWeekStart } from '@kinexus/domain';

type TrainWeekValue = {
  weekStart: string;
  setWeek: (next: string) => void;
  shiftWeek: (delta: number) => void;
};

const TrainWeekContext = createContext<TrainWeekValue | null>(null);

export function TrainWeekProvider({ children }: { children: ReactNode }) {
  const [weekStart, setWeekStart] = useState(mondayWeekStart);
  const value = useMemo<TrainWeekValue>(
    () => ({
      weekStart,
      setWeek: setWeekStart,
      shiftWeek: (delta) => setWeekStart((current) => addDaysIso(current, delta * 7)),
    }),
    [weekStart],
  );
  return <TrainWeekContext.Provider value={value}>{children}</TrainWeekContext.Provider>;
}

export function useTrainWeek(): TrainWeekValue {
  const ctx = useContext(TrainWeekContext);
  if (!ctx) throw new Error('useTrainWeek must be used inside TrainWeekProvider');
  return ctx;
}
