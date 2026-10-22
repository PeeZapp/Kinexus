import { type ReactNode } from 'react';

import type { ShoppingCostEstimate } from '@kinexus/domain';

import { ShoppingChrome, ShoppingList } from '@/src/features/meals/shopping/ShoppingShared';
import type { ShoppingItemPrice } from '@/src/features/meals/shopping/use-grocery-prices';
import type { ShoppingListItem } from '@/src/features/meals/mappers';
import { weekPlanPhrase } from '@/src/features/meals/week-labels';
import { EmptyState } from '@/src/features/shell/states';

export function ShoppingMobile(props: {
  weekStart: string;
  online: boolean;
  pendingCount: number;
  importBlockedReason: string | null;
  error: string | null;
  shoppingError: string | null;
  shoppingBusy: boolean;
  plannedMealCount: number;
  active: ShoppingListItem[];
  checked: ShoppingListItem[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGenerate: () => void;
  onClearChecked: () => void;
  onToggle: (item: ShoppingListItem) => void;
  onEdit: (id: string, name: string, amount: string) => Promise<void>;
  onDelete: (id: string) => void;
  onRecipe: (id: string) => void;
  onSetPurchase: (recipeId: string, mode: 'buy' | 'make') => void;
  onAdd: (name: string, amount?: string) => void;
  costEstimate: ShoppingCostEstimate | null;
  stores: readonly string[];
  shopPicker?: ReactNode;
  itemPrices?: Readonly<Record<string, ShoppingItemPrice>>;
}) {
  const chrome = {
    weekStart: props.weekStart,
    online: props.online,
    pendingCount: props.pendingCount,
    importBlockedReason: props.importBlockedReason,
    error: props.error,
    shoppingError: props.shoppingError,
    shoppingBusy: props.shoppingBusy,
    onPrevWeek: props.onPrevWeek,
    onNextWeek: props.onNextWeek,
    onGenerate: props.onGenerate,
    onClearChecked: props.onClearChecked,
    onAdd: props.onAdd,
    costEstimate: props.costEstimate,
    stores: props.stores,
    shopPicker: props.shopPicker,
  };
  return (
    <ShoppingChrome {...chrome} desktop={false} checkedCount={props.checked.length}>
      {props.active.length === 0 && props.checked.length === 0 ? (
        <EmptyState
          title="List is empty"
          body={
            props.plannedMealCount === 0
              ? `No meals on ${weekPlanPhrase(props.weekStart)} yet. Fill that week first, then generate.`
              : `Generate from ${weekPlanPhrase(props.weekStart)} to pull ingredients, or add extras from the toolbar. Check-off syncs live with the household.`
          }
        />
      ) : (
        <ShoppingList
          title="To buy"
          items={props.active}
          onToggle={props.onToggle}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
          onRecipe={props.onRecipe}
          onSetPurchase={props.onSetPurchase}
          editDisabled={!props.online}
          itemPrices={props.itemPrices}
        />
      )}
      <ShoppingList
        title="Checked off"
        items={props.checked}
        onToggle={props.onToggle}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onRecipe={props.onRecipe}
        onSetPurchase={props.onSetPurchase}
        editDisabled={!props.online}
      />
    </ShoppingChrome>
  );
}
