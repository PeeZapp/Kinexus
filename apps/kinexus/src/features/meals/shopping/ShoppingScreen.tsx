import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ShoppingDesktop } from '@/src/features/meals/shopping/ShoppingDesktop';
import { ShoppingMobile } from '@/src/features/meals/shopping/ShoppingMobile';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function ShoppingScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const meals = useMealsSync();
  const active = meals.shoppingItems.filter((item) => !item.checked);
  const checked = meals.shoppingItems.filter((item) => item.checked);
  const shared = {
    weekStart: meals.weekStart,
    online: meals.online,
    pendingCount: meals.pendingCount,
    importBlockedReason: meals.importBlockedReason,
    error: meals.error,
    shoppingError: meals.shoppingError,
    shoppingBusy: meals.shoppingBusy,
    active,
    checked,
    onGenerate: () => void meals.rebuildShopping(),
    onClearChecked: () => void meals.clearCheckedShopping(),
    onToggle: (item: typeof active[0]) => void meals.toggleShoppingItem(item.id, !item.checked),
    onDelete: (id: string) => void meals.deleteShoppingItem(id),
    onRecipe: (id: string) => router.push(`/meals/recipes/${id}` as Href),
    onAdd: (name: string, amount?: string) => void meals.addShoppingItem(name, amount),
  };

  return mode === 'desktop' ? <ShoppingDesktop {...shared} /> : <ShoppingMobile {...shared} />;
}
