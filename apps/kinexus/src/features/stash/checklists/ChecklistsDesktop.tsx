import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  categoryLabel,
  dueTone,
  formatDueLabel,
  priorityLabel,
  recurrenceLabel,
  type StashListItem,
  type StashListNode,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { ListTree, PrimaryActions, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export type ChecklistsLayoutProps = {
  desktop: boolean;
  kicker: string;
  title: string;
  subtitle: string;
  query: string;
  setQuery: (v: string) => void;
  tree: StashListNode[];
  selectedListId: string | null;
  onSelectList: (id: string) => void;
  view: 'list' | 'today';
  onSelectToday: () => void;
  todayCount: number;
  today: string;
  onRenameList?: (id: string) => void;
  counts: Map<string, number>;
  shareLabels: Map<string, string>;
  peopleNames: Map<string, string>;
  listNames: Map<string, string>;
  selectedListName: string;
  selectedShareLabel: string;
  active: StashListItem[];
  checked: StashListItem[];
  empty: string;
  quickAdd: string;
  setQuickAdd: (v: string) => void;
  onQuickAdd: () => void;
  showQuickAdd: boolean;
  categoryFilter: string | null;
  setCategoryFilter: (id: string | null) => void;
  categoriesInUse: string[];
  onAddList?: () => void;
  onAddItem?: () => void;
  onToggleItem: (item: StashListItem) => void;
  onOpenItem: (item: StashListItem) => void;
  online: boolean;
};

function ChecklistItemRow({
  item,
  today,
  peopleNames,
  listNames,
  showListName,
  onToggle,
  onOpen,
}: {
  item: StashListItem;
  today: string;
  peopleNames: Map<string, string>;
  listNames: Map<string, string>;
  showListName: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const tone = dueTone(item.dueOn, today);
  const bits = [
    formatDueLabel(item.dueOn, today) || null,
    item.assignedPersonId ? peopleNames.get(item.assignedPersonId) ?? null : null,
    item.recurrence !== 'none' ? recurrenceLabel(item.recurrence) : null,
    item.category ? categoryLabel(item.category) : null,
    item.priority > 0 ? priorityLabel(item.priority) : null,
    showListName ? listNames.get(item.listId) ?? null : null,
  ].filter(Boolean);
  const metaStyle =
    !item.isChecked && (tone === 'overdue' || item.priority >= 4)
      ? styles.itemUrgent
      : !item.isChecked && tone === 'today'
        ? styles.itemToday
        : styles.itemMeta;
  return (
    <Pressable onPress={onOpen} style={[styles.itemRow, item.isChecked && styles.itemRowDone]}>
      <Pressable
        onPress={onToggle}
        style={[styles.check, item.isChecked && styles.checkOn, item.priority >= 3 && !item.isChecked && styles.checkHigh]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.isChecked }}>
        <Text style={styles.checkMark}>{item.isChecked ? '✓' : ''}</Text>
      </Pressable>
      <View style={styles.itemBody}>
        <Text style={[styles.itemTitle, item.isChecked && styles.itemTitleDone]} numberOfLines={2}>
          {item.title}
        </Text>
        {bits.length > 0 ? (
          <Text style={metaStyle} numberOfLines={1}>
            {bits.join(' · ')}
          </Text>
        ) : null}
        {item.notes && !item.isChecked ? (
          <Text style={styles.itemNotes} numberOfLines={1}>
            {item.notes}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ItemSections(props: ChecklistsLayoutProps) {
  return (
    <View style={styles.stack}>
      {props.categoriesInUse.length > 0 ? (
        <View style={styles.wrap}>
          <Pill label="All" active={!props.categoryFilter} onPress={() => props.setCategoryFilter(null)} />
          {props.categoriesInUse.map((id) => (
            <Pill
              key={id}
              label={categoryLabel(id)}
              active={props.categoryFilter === id}
              onPress={() => props.setCategoryFilter(props.categoryFilter === id ? null : id)}
            />
          ))}
        </View>
      ) : null}
      {props.showQuickAdd ? (
        <>
          <Field
            label="Quick add"
            value={props.quickAdd}
            onChangeText={props.setQuickAdd}
            placeholder="Item title"
            autoCapitalize="sentences"
            onSubmitEditing={props.onQuickAdd}
            returnKeyType="done"
            editable={Boolean(props.selectedListId) && props.online}
          />
          <Btn
            label="Add"
            onPress={props.onQuickAdd}
            disabled={!props.quickAdd.trim() || !props.selectedListId || !props.online}
          />
        </>
      ) : null}
      {props.active.length === 0 && props.checked.length === 0 ? (
        <EmptyState title={props.view === 'today' ? 'All clear' : 'Nothing on this list'} body={props.empty} />
      ) : (
        <>
          {props.active.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              today={props.today}
              peopleNames={props.peopleNames}
              listNames={props.listNames}
              showListName={props.view === 'today'}
              onToggle={() => props.onToggleItem(item)}
              onOpen={() => props.onOpenItem(item)}
            />
          ))}
          {props.checked.length > 0 ? (
            <>
              <Text style={styles.doneLabel}>Checked off · {props.checked.length}</Text>
              {props.checked.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  today={props.today}
                  peopleNames={props.peopleNames}
                  listNames={props.listNames}
                  showListName={props.view === 'today'}
                  onToggle={() => props.onToggleItem(item)}
                  onOpen={() => props.onOpenItem(item)}
                />
              ))}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

function ListPane(props: ChecklistsLayoutProps) {
  return (
    <>
      <Pressable
        onPress={props.onSelectToday}
        style={[styles.all, props.view === 'today' && styles.allActive]}>
        <Text style={[styles.allLabel, props.view === 'today' && styles.allLabelActive]}>Today</Text>
        <Text style={styles.listCount}>{props.todayCount}</Text>
      </Pressable>
      {props.tree.length === 0 ? (
        <Text style={styles.meta}>Create a list to get started.</Text>
      ) : (
        <ListTree
          nodes={props.tree}
          selectedId={props.view === 'list' ? props.selectedListId : null}
          counts={props.counts}
          shareLabels={props.shareLabels}
          onSelect={props.onSelectList}
        />
      )}
      {props.view === 'list' && props.selectedListId && props.onRenameList ? (
        <View style={styles.sideActions}>
          <Pill label="Settings" onPress={() => props.onRenameList?.(props.selectedListId!)} />
        </View>
      ) : null}
    </>
  );
}

export function ChecklistsDesktop(props: ChecklistsLayoutProps) {
  const showMain = props.view === 'today' || Boolean(props.selectedListId);
  return (
    <StashChrome desktop kicker={props.kicker} title={props.title} subtitle={props.subtitle}>
      <PrimaryActions
        addLabel={props.onAddItem ? 'Add item' : 'New list'}
        onAdd={props.onAddItem ?? props.onAddList ?? (() => undefined)}
        extraLabel={props.onAddItem && props.onAddList ? 'New list' : undefined}
        onExtra={props.onAddList}
        disabled={!props.online || !(props.onAddItem || props.onAddList)}
      />
      <View style={styles.cols}>
        <View style={styles.sidebar}>
          <Text style={styles.sideTitle}>Lists</Text>
          <ListPane {...props} />
        </View>
        <View style={styles.main}>
          {showMain ? (
            <>
              <SearchField
                value={props.query}
                onChange={props.setQuery}
                placeholder={props.view === 'today' ? 'Search today' : 'Search this list'}
              />
              <Text style={styles.meta}>
                {props.selectedListName} · {props.selectedShareLabel} · {props.active.length} open
              </Text>
              <ItemSections {...props} />
            </>
          ) : (
            <EmptyState title="No lists yet" body={props.empty} />
          )}
        </View>
      </View>
    </StashChrome>
  );
}

export function ChecklistsMobile(props: ChecklistsLayoutProps) {
  const showMain = props.view === 'today' || Boolean(props.selectedListId);
  return (
    <StashChrome desktop={false} kicker={props.kicker} title={props.title} subtitle={props.subtitle}>
      <PrimaryActions
        addLabel={props.onAddItem ? 'Add item' : 'New list'}
        onAdd={props.onAddItem ?? props.onAddList ?? (() => undefined)}
        extraLabel={props.onAddItem && props.onAddList ? 'New list' : undefined}
        onExtra={props.onAddList}
        disabled={!props.online || !(props.onAddItem || props.onAddList)}
      />
      <View style={styles.lists}>
        <ListPane {...props} />
      </View>
      {showMain ? (
        <>
          <SearchField
            value={props.query}
            onChange={props.setQuery}
            placeholder={props.view === 'today' ? 'Search today' : 'Search this list'}
          />
          <Text style={styles.meta}>
            {props.selectedListName} · {props.selectedShareLabel}
          </Text>
          <ItemSections {...props} />
        </>
      ) : (
        <EmptyState title="No lists yet" body={props.empty} />
      )}
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  sidebar: {
    width: 280,
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  main: { flex: 1, gap: 12, minWidth: 0 },
  lists: {
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  sideTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  sideActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  all: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    gap: 8,
  },
  allActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  allLabel: { color: colors.textMuted, fontWeight: '700' },
  allLabelActive: { color: colors.accent },
  listCount: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  stack: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  doneLabel: { color: colors.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 8 },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  itemRowDone: { opacity: 0.72 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  checkHigh: { borderColor: colors.warning },
  checkMark: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  itemBody: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  itemTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  itemMeta: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  itemToday: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  itemUrgent: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  itemNotes: { color: colors.textMuted, fontSize: 13 },
});
