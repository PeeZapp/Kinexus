import type { Day } from '@kinexus/domain';

import type { TrainingPlanDayStatus, TrainingPlanWeekRow } from '@/src/features/train/api';

export type PlanDayCardModel = {
  id: string;
  planId: string;
  day: Day;
  restDay: boolean;
  focus: string[];
  scheduledTime: string | null;
  durationMin: number | null;
  status: TrainingPlanDayStatus;
  workoutId: string | null;
  sessionId: string | null;
  /** Shown after calendar add when scheduled_time was null (defaulted to 07:00). */
  usedDefaultTime?: boolean;
};

export type PlanAudienceRow = {
  label: string;
  plan: TrainingPlanWeekRow;
  cards: PlanDayCardModel[];
};
