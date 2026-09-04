import { AddItemForm, ShoppingChrome, ShoppingList } from '@/src/features/meals/shopping/ShoppingShared';
import type { ShoppingListItem } from '@/src/features/meals/mappers';
import { EmptyState } from '@/src/features/shell/states';

export function ShoppingMobile(props: {
  weekStart: string;
  online: boolean;
  pendingCount: number;
  importBlockedReason: string | null;
  error: string | null;
  shoppingError: string | null;
  shoppingBusy: boolean;
  active: ShoppingListItem[];
  checked: ShoppingListItem[];
  onGenerate: () => void;
  onClearChecked: () => void;
  onToggle: (item: ShoppingListItem) => void;
  onDelete: (id: string) => void;
  onRecipe: (id: string) => void;
  onAdd: (name: string, amount?: string) => void;
}) {
  const chrome = {
    weekStart: props.weekStart,
    online: props.online,
    pendingCount: props.pendingCount,
    importBlockedReason: props.importBlockedReason,
    error: props.error,
    shoppingError: props.shoppingError,
    shoppingBusy: props.shoppingBusy,
    onGenerate: props.onGenerate,
    onClearChecked: props.onClearChecked,
  };
  return (
    <ShoppingChrome {...chrome} desktop={false} checkedCount={props.checked.length}>
      {props.active.length === 0 && props.checked.length === 0 ? (
        <EmptyState
          title="List is empty"
          body="Generate from this week’s plan to pull ingredients, or add extras below. Check-off syncs live with the household."
        />
      ) : (
        <ShoppingList
          title="To buy"
          items={props.active}
          onToggle={props.onToggle}
          onDelete={props.onDelete}
          onRecipe={props.onRecipe}
        />
      )}
      <AddItemForm onAdd={props.onAdd} disabled={!props.online} />
      <ShoppingList
        title="Checked off"
        items={props.checked}
        onToggle={props.onToggle}
        onDelete={props.onDelete}
        onRecipe={props.onRecipe}
      />
    </ShoppingChrome>
  );
}
