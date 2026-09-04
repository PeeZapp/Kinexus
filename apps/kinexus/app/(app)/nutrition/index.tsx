import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { ModuleScreen } from '@/src/features/shell/ModuleScreen';

export default function NutritionScreen() {
  return (
    <HouseholdGate module="Nutrition">
      <ModuleScreen
        title="Nutrition"
        description="Daily food log and tracking will be built from scratch here. Huddle’s nutrition screen, barcode logging, and meal-photo log are not coming across."
        planned={['Log meals against household goals', 'Reuse the calorie/protein targets Meals already stores', 'Optional handoff: log a planned dinner later']}
        later="Generate Plan already uses dietary notes and macros. This module is the diary — not the planner."
      />
    </HouseholdGate>
  );
}
