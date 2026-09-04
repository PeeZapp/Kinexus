import { HouseholdGate } from '@/src/features/household/HouseholdGate';
import { ModuleScreen } from '@/src/features/shell/ModuleScreen';

export default function StashScreen() {
  return (
    <HouseholdGate module="Stash">
      <ModuleScreen
        title="Stash"
        description="Wishlist and saved finds for the household. Intentionally empty until Meals MVP is done — then we rebuild from Stashd ideas, not a UI copy."
        planned={['Household lists you can share', 'Products, links, and prices in one place', 'Add from a URL without leaving Kinexus']}
        later="No lists or products are stored yet. Nothing here is a stub of Stashd."
      />
    </HouseholdGate>
  );
}
