import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { TodayScreen } from '@/src/features/today/TodayScreen';

export default function TodayRoute() {
  return (
    <HouseholdGate module="Today">
      <TodayScreen />
    </HouseholdGate>
  );
}

