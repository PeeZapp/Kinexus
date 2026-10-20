import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveShoppingCategory, shoppingCategoryEmoji } from '@kinexus/domain';

import { Btn, ErrorText, Field } from '@/src/features/household/ui';
import type { ShoppingListItem } from '@/src/features/meals/mappers';
import { OfflineBanner, Sheet } from '@/src/features/meals/meals-kit';
import { WeekSwitcher } from '@/src/features/meals/plan/PlanShared';
import { weekPlanPhrase } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

type DetailSheet =
  | { kind: 'recipes'; item: ShoppingListItem }
  | { kind: 'merged'; item: ShoppingListItem }
  | null;

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
  const [detail, setDetail] = useState<DetailSheet>(null);

  const groups = useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>();
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sorted) {
      const cat = resolveShoppingCategory(item.category, item.name);
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

  const detailItem = detail?.item;
  const detailTitle =
    detail?.kind === 'recipes'
      ? 'In recipes'
      : detail?.kind === 'merged'
        ? 'Merged as'
        : '';

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{title}</Text>
      {groups.map((group) => (
        <View key={group.category} style={styles.cat}>
          <Text style={styles.catTitle}>
            {group.emoji} {group.category}
          </Text>
          {group.items.map((item) => {
            const recipeCount = item.recipeSources.length;
            const shared = recipeCount > 1;
            const single = recipeCount === 1 ? item.recipeSources[0] : null;
            return (
              <View key={item.id} style={styles.row}>
                <Pressable onPress={() => onToggle(item)} style={[styles.check, item.checked && styles.checkOn]}>
                  <Text style={styles.checkMark}>{item.checked ? '✓' : ''}</Text>
                </Pressable>
                <View style={styles.rowBody}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, item.checked && styles.checkedName]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {shared ? (
                      <Pressable
                        onPress={() => setDetail({ kind: 'recipes', item })}
                        style={styles.sharedChip}
                        hitSlop={4}>
                        <Text style={styles.sharedChipText}>Shared ×{recipeCount}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {item.amount ? (
                    <Text style={styles.meta} numberOfLines={2}>
                      {item.amount}
                    </Text>
                  ) : null}
                  <View style={styles.noteRow}>
                    {item.mergedFrom.length > 0 ? (
                      <Pressable onPress={() => setDetail({ kind: 'merged', item })} hitSlop={6}>
                        <Text style={styles.noteLink}>Merged · {item.mergedFrom.length}</Text>
                      </Pressable>
                    ) : null}
                    {single ? (
                      <Pressable onPress={() => onRecipe(single.recipeId)} hitSlop={6} style={{ flexShrink: 1 }}>
                        <Text style={styles.link} numberOfLines={1}>
                          {single.recipeName}
                        </Text>
                      </Pressable>
                    ) : null}
                    {!single && !shared && item.manual ? (
                      <Text style={styles.meta}>Added manually</Text>
                    ) : null}
                  </View>
                </View>
                <Pressable onPress={() => onDelete(item.id)} hitSlop={8}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}

      <Sheet visible={detail != null} title={detailTitle} onClose={() => setDetail(null)}>
        {detail?.kind === 'recipes' && detailItem ? (
          <View style={styles.sheetList}>
            {detailItem.recipeSources.map((source) => (
              <Pressable
                key={source.recipeId}
                style={styles.sheetRow}
                onPress={() => {
                  setDetail(null);
                  onRecipe(source.recipeId);
                }}>
                <Text style={styles.sheetRowText}>{source.recipeName}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {detail?.kind === 'merged' && detailItem ? (
          <View style={styles.sheetList}>
            <Text style={styles.sheetLead}>Shown as “{detailItem.name}”. Also matched:</Text>
            {detailItem.mergedFrom.map((name) => (
              <Text key={name} style={styles.sheetBullet}>
                · {name}
              </Text>
            ))}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

export function AddItemButton({
  onAdd,
  disabled,
}: {
  onAdd: (name: string, amount?: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  function close() {
    setOpen(false);
    setName('');
    setAmount('');
  }

  return (
    <>
      <Btn label="Add item" variant="secondary" disabled={disabled} onPress={() => setOpen(true)} />
      <Sheet visible={open} title="Add item" onClose={close}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Bananas" />
        <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="6" />
        <Btn
          label="Add"
          disabled={disabled || !name.trim()}
          onPress={() => {
            onAdd(name, amount);
            close();
          }}
        />
      </Sheet>
    </>
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
  onPrevWeek,
  onNextWeek,
  onGenerate,
  onClearChecked,
  onAdd,
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
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGenerate: () => void;
  onClearChecked: () => void;
  onAdd: (name: string, amount?: string) => void;
  checkedCount: number;
  children: ReactNode;
}) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Shopping</Text>
      <WeekSwitcher weekStart={weekStart} onPrev={onPrevWeek} onNext={onNextWeek} />
      <Text style={styles.lede}>Built from {weekPlanPhrase(weekStart)}. Check-off needs a connection.</Text>
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
        <AddItemButton onAdd={onAdd} disabled={!online} />
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
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  lede: { color: colors.textMuted, fontSize: 15 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  toolbarDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  block: { gap: 12 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cat: { gap: 6 },
  catTitle: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
  },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.bg, fontWeight: '800' },
  name: { color: colors.text, fontWeight: '700', flexShrink: 1 },
  checkedName: { textDecorationLine: 'line-through', color: colors.textMuted },
  meta: { color: colors.textDim, fontSize: 12 },
  link: { color: colors.accent, fontSize: 12 },
  noteLink: { color: colors.textMuted, fontSize: 12, textDecorationLine: 'underline' },
  sharedChip: {
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sharedChipText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: 4 },
  sheetList: { gap: 10, paddingBottom: 8 },
  sheetLead: { color: colors.textMuted, fontSize: 14, marginBottom: 4 },
  sheetBullet: { color: colors.text, fontSize: 15 },
  sheetRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetRowText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
});
