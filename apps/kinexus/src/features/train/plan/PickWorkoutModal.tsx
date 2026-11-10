import { useMemo } from 'react';

import { PlanChoiceModal } from '@/src/features/train/plan/PlanChoiceModal';

export type PickWorkoutItem = {
  id: string;
  name: string;
  durationMin: number | null;
  completed: boolean;
  myScore: number | null;
};

const CLEAR_KEY = '__clear__';

function workoutDetail(workout: PickWorkoutItem): string {
  return [
    workout.durationMin != null ? `${workout.durationMin} min` : null,
    workout.completed ? 'Done before' : null,
    workout.myScore != null ? `Rated ${workout.myScore}/10` : null,
  ]
    .filter(Boolean)
    .join(' · ') || 'Saved workout';
}

export function PickWorkoutModal({
  visible,
  workouts,
  canClear,
  onClose,
  onPick,
  onClear,
}: {
  visible: boolean;
  workouts: readonly PickWorkoutItem[];
  canClear?: boolean;
  onClose: () => void;
  onPick: (workoutId: string) => void;
  onClear?: () => void;
}) {
  const options = useMemo(() => {
    const rows = workouts.map((workout) => ({
      key: workout.id,
      label: workout.name,
      detail: workoutDetail(workout),
    }));
    if (canClear) {
      return [
        {
          key: CLEAR_KEY,
          label: 'Clear',
          detail: 'Remove from this day',
        },
        ...rows,
      ];
    }
    return rows;
  }, [canClear, workouts]);

  return (
    <PlanChoiceModal
      visible={visible}
      title="Pick workout"
      options={options}
      emptyLabel="No saved workouts yet"
      onClose={onClose}
      onChoose={(choice) => {
        if (choice === CLEAR_KEY) {
          onClear?.();
          return;
        }
        onPick(choice);
      }}
    />
  );
}
