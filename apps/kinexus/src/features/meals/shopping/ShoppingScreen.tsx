import { useMemo } from 'react';
import { useRouter } from 'expo-router';

import { estimateShoppingListCost } from '@kinexus/domain';

import { recipeHref } from '@/src/features/meals/recipe-href';
import { ShoppingDesktop } from '@/src/features/meals/shopping/ShoppingDesktop';
import { ShoppingMobile } from '@/src/features/meals/shopping/ShoppingMobile';
import { ShoppingShops } from '@/src/features/meals/shopping/ShoppingShops';
import { useGroceryPrices } from '@/src/features/meals/shopping/use-grocery-prices';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function ShoppingScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const meals = useMealsSync();
  const { activeHousehold } = useHousehold();
  const active = meals.shoppingItems.filter((item) => !item.checked);
  const checked = meals.shoppingItems.filter((item) => item.checked);
  const costEstimate = useMemo(
    () =>
      estimateShoppingListCost(
        active.map((item) => ({ name: item.name, amount: item.amount })),
        meals.market,
        meals.priceBook,
      ),
    [active, meals.market, meals.priceBook],
  );
  const priceItems = useMemo(
    () => active.map((item) => ({ id: item.id, name: item.name, amount: item.amount, quote: item.groceryQuote })),
    [active],
  );
  const grocery = useGroceryPrices({
    country: activeHousehold?.country,
    online: meals.online,
    items: priceItems,
    onSave: meals.saveShoppingQuotes,
  });
  const shopPicker = (
    <ShoppingShops
      country={activeHousehold?.country}
      online={meals.online}
      comparison={grocery.comparison}
      busy={grocery.busy}
      error={grocery.error}
      warning={grocery.warning}
      onRecheck={grocery.recheck}
    />
  );
  const shared = {
    weekStart: meals.weekStart,
    online: meals.online,
    pendingCount: meals.pendingCount,
    importBlockedReason: meals.importBlockedReason,
    error: meals.error,
    shoppingError: meals.shoppingError,
    shoppingBusy: meals.shoppingBusy,
    plannedMealCount: meals.slots.filter((slot) => !slot.hidden && slot.recipeId).length,
    active,
    checked,
    onPrevWeek: () => meals.shiftWeek(-1),
    onNextWeek: () => meals.shiftWeek(1),
    onGenerate: () => void meals.rebuildShopping(),
    onClearChecked: () => void meals.clearCheckedShopping(),
    onToggle: (item: typeof active[0]) => void meals.toggleShoppingItem(item.id, !item.checked),
    onEdit: (id: string, name: string, amount: string) => meals.updateShoppingItem(id, name, amount),
    onDelete: (id: string) => void meals.deleteShoppingItem(id),
    onRecipe: (id: string) => router.push(recipeHref(id, { from: 'shopping' })),
    onAdd: (name: string, amount?: string) => void meals.addShoppingItem(name, amount),
    costEstimate: grocery.comparison?.cheapestShop ? null : costEstimate,
    stores: meals.market.stores,
    shopPicker,
    itemPrices: grocery.itemPrices,
  };

  return mode === 'desktop' ? <ShoppingDesktop {...shared} /> : <ShoppingMobile {...shared} />;
}
