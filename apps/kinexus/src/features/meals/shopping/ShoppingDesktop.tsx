import { StyleSheet, View } from 'react-native';

import { AddItemForm, ShoppingChrome, ShoppingList } from '@/src/features/meals/shopping/ShoppingShared';
import type { ShoppingListItem } from '@/src/features/meals/mappers';
import { weekPlanPhrase } from '@/src/features/meals/week-labels';
import { EmptyState } from '@/src/features/shell/states';

export function ShoppingDesktop(props: {
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
    onPrevWeek: props.onPrevWeek,
    onNextWeek: props.onNextWeek,
    onGenerate: props.onGenerate,
    onClearChecked: props.onClearChecked,
  };
  return (
    <ShoppingChrome {...chrome} desktop checkedCount={props.checked.length}>
      <View style={styles.cols}>
        <View style={styles.col}>
          {props.active.length === 0 && props.checked.length === 0 ? (
            <EmptyState
              title="List is empty"
              body={
                props.plannedMealCount === 0
                  ? `No meals on ${weekPlanPhrase(props.weekStart)} yet. Fill that week first, then generate.`
                  : `Generate from ${weekPlanPhrase(props.weekStart)} to pull ingredients, or add extras on the right. Check-off syncs live with the household.`
              }
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
        </View>
        <View style={styles.col}>
          <AddItemForm onAdd={props.onAdd} disabled={!props.online} />
          <ShoppingList
            title="Checked off"
            items={props.checked}
            onToggle={props.onToggle}
            onDelete={props.onDelete}
            onRecipe={props.onRecipe}
          />
        </View>
      </View>
    </ShoppingChrome>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  col: { flex: 1, gap: 16, minWidth: 320 },
});
