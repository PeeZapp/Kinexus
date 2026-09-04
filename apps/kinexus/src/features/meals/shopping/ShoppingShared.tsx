import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveShoppingCategory, shoppingCategoryEmoji } from '@kinexus/domain';

import { Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import type { ShoppingListItem } from '@/src/features/meals/mappers';
import { OfflineBanner } from '@/src/features/meals/meals-kit';
import { weekHeading } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

export function ShoppingList({
  title,
  items,
  onToggle,
  onDelete,
  onRecipe,
}: {
  title: string;
  items: ShoppingListItem[];
  onToggle: (item: ShoppingListItem) => void;
  onDelete: (id: string) => void;
  onRecipe: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>();
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sorted) {
      const cat = resolveShoppingCategory(item.category);
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))
      .map(([category, groupItems]) => ({
        category,
        emoji: shoppingCategoryEmoji(category),
        items: groupItems,
      }));
  }, [items]);

  if (items.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{title}</Text>
      {groups.map((group) => (
        <View key={group.category} style={styles.cat}>
          <Text style={styles.catTitle}>
            {group.emoji} {group.category}
          </Text>
          {group.items.map((item) => (
            <View key={item.id} style={styles.row}>
              <Pressable onPress={() => onToggle(item)} style={[styles.check, item.checked && styles.checkOn]}>
                <Text style={styles.checkMark}>{item.checked ? '✓' : ''}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, item.checked && styles.checkedName]}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.amount ?? ''}
                  {item.sharedMealCount > 1 ? ` · shared ×${item.sharedMealCount}` : ''}
                </Text>
                {item.recipeSources[0] ? (
                  <Pressable onPress={() => onRecipe(item.recipeSources[0]!.recipeId)}>
                    <Text style={styles.link}>{item.recipeSources.map((s) => s.recipeName).join(', ')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={() => onDelete(item.id)} hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function AddItemForm({ onAdd, disabled }: { onAdd: (name: string, amount?: string) => void; disabled: boolean }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <Card>
      <Text style={styles.heading}>Add item</Text>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Bananas" />
      <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="6" />
      <Btn
        label="Add"
        variant="secondary"
        disabled={disabled || !name.trim()}
        onPress={() => {
          onAdd(name, amount);
          setName('');
          setAmount('');
        }}
      />
    </Card>
  );
}

export function ShoppingChrome({
  weekStart,
  desktop,
  online,
  pendingCount,
  importBlockedReason,
  error,
  shoppingError,
  shoppingBusy,
  onGenerate,
  onClearChecked,
  checkedCount,
  children,
}: {
  weekStart: string;
  desktop: boolean;
  online: boolean;
  pendingCount: number;
  importBlockedReason: string | null;
  error: string | null;
  shoppingError: string | null;
  shoppingBusy: boolean;
  onGenerate: () => void;
  onClearChecked: () => void;
  checkedCount: number;
  children: ReactNode;
}) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <Text style={styles.kicker}>{weekHeading(weekStart)}</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Shopping</Text>
      <Text style={styles.lede}>Built from this week’s plan. Check-off needs a connection.</Text>
      <OfflineBanner online={online} pendingCount={pendingCount} extra={importBlockedReason} />
      <ErrorText message={error} />
      <ErrorText message={shoppingError} />
      <View style={desktop ? styles.toolbarDesktop : styles.toolbar}>
        <Btn
          label={online ? 'Generate from plan' : 'Generate (needs connection)'}
          onPress={onGenerate}
          disabled={!online}
          busy={shoppingBusy}
        />
        {checkedCount > 0 ? (
          <Btn label="Clear checked" variant="ghost" onPress={onClearChecked} disabled={!online} />
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 14, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 48, paddingTop: 8, maxWidth: 1100 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  lede: { color: colors.textMuted, fontSize: 15 },
  toolbar: { gap: 8 },
  toolbarDesktop: { flexDirection: 'row', gap: 10, maxWidth: 480 },
  block: { gap: 12 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cat: { gap: 6 },
  catTitle: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.bg, fontWeight: '800' },
  name: { color: colors.text, fontWeight: '700' },
  checkedName: { textDecorationLine: 'line-through', color: colors.textMuted },
  meta: { color: colors.textDim, fontSize: 12 },
  link: { color: colors.accent, fontSize: 12, marginTop: 2 },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
