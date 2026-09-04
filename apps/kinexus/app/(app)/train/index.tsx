import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { ModuleScreen } from '@/src/features/shell/ModuleScreen';

export default function TrainScreen() {
  return (
    <HouseholdGate module="Train">
      <ModuleScreen
        title="Train"
        description="Workouts and training plans. New UI later, using RemixFit ideas and models only — RemixFit itself stays a separate app."
        planned={['Session plans for the household', 'An exercise library we import on purpose', 'Deep link from Nutrition when both exist']}
        later="No workouts are stored yet. Meals is the live module today."
      />
    </HouseholdGate>
  );
}
