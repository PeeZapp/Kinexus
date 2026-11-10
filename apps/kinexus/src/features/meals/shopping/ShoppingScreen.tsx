import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { estimateShoppingListCost, lookupChainsForCountry } from '@kinexus/domain';

import { ListExportSheet } from '@/src/features/lists/ListExportSheet';
import { ListImportWizard } from '@/src/features/lists/ListImportWizard';
import {
  shoppingDedupe,
  shoppingExportInput,
  type ListImportWriters,
} from '@/src/features/lists/list-io-adapters';
import { recipeHref } from '@/src/features/meals/recipe-href';
import { ShoppingBot } from '@/src/features/meals/shopping/ShoppingBot';
import { ShoppingDesktop } from '@/src/features/meals/shopping/ShoppingDesktop';
import { ShoppingMobile } from '@/src/features/meals/shopping/ShoppingMobile';
import { ShoppingProductSheet } from '@/src/features/meals/shopping/ShoppingProductSheet';
import { ShoppingShops } from '@/src/features/meals/shopping/ShoppingShops';
import { useGroceryPrices } from '@/src/features/meals/shopping/use-grocery-prices';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

export function ShoppingScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const meals = useMealsSync();
  const { activeHousehold, updatePreferredGroceryChain } = useHousehold();
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
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const picking = pickingId ? meals.shoppingItems.find((item) => item.id === pickingId) ?? null : null;
  const canMatch = meals.online && lookupChainsForCountry(activeHousehold?.country).length > 0;
  const grocery = useGroceryPrices({
    country: activeHousehold?.country,
    householdId: activeHousehold?.id,
    online: meals.online,
    items: priceItems,
    onSave: meals.saveShoppingQuotes,
  });
  const shopChains = lookupChainsForCountry(activeHousehold?.country);
  const shopPicker = (
    <>
      <ShoppingShops
        country={activeHousehold?.country}
        online={meals.online}
        comparison={grocery.comparison}
        busy={grocery.busy}
        error={grocery.error}
        warning={grocery.warning}
        pricesAsOf={grocery.pricesAsOf}
        onRecheck={grocery.recheck}
      />
      {activeHousehold ? (
        <ShoppingBot
          householdId={activeHousehold.id}
          weekStart={meals.weekStart}
          chains={shopChains}
          preferredChainId={activeHousehold.preferredGroceryChain}
          canChooseShop={meals.online}
          online={meals.online}
          onPrefer={updatePreferredGroceryChain}
        />
      ) : null}
    </>
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
    onSetPurchase: (recipeId: string, mode: 'buy' | 'make') => void meals.setShoppingPurchase(recipeId, mode),
    onAdd: (name: string, amount?: string) => void meals.addShoppingItem(name, amount),
    onImport: () => setImportOpen(true),
    onExport: () => setExportOpen(true),
    costEstimate: grocery.comparison?.cheapestShop ? null : costEstimate,
    stores: meals.market.stores,
    shopPicker,
    itemPrices: grocery.itemPrices,
    onChooseProduct: canMatch ? (item: (typeof active)[number]) => setPickingId(item.id) : undefined,
    pricesBusy: grocery.busy,
  };

  const list = mode === 'desktop' ? <ShoppingDesktop {...shared} /> : <ShoppingMobile {...shared} />;
  return (
    <>
      {list}
      <ShoppingProductSheet
        item={picking}
        country={activeHousehold?.country}
        householdId={activeHousehold?.id}
        onClose={() => setPickingId(null)}
        onSave={(id, quote) => meals.saveShoppingQuotes([{ id, quote }])}
      />
      <ListExportSheet
        visible={exportOpen}
        input={shoppingExportInput(meals.weekStart, meals.shoppingItems)}
        onClose={() => setExportOpen(false)}
      />
      <ListImportWizard
        visible={importOpen}
        kind="shopping"
        existingLists={[]}
        existingItems={shoppingDedupe(meals.shoppingItems)}
        writers={
          {
            ensureTargetList: async () => null,
            writeRow: async (_listId, row) => {
              await meals.addShoppingItem(row.title, row.quantity ?? undefined);
            },
          } satisfies ListImportWriters
        }
        onClose={() => setImportOpen(false)}
      />
    </>
  );
}
