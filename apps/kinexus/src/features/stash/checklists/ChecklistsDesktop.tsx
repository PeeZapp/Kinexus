import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { categoryLabel, type StashListItem } from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import {
  ChecklistItemRow,
  ChecklistListCard,
  type ChecklistListCardModel,
} from '@/src/features/stash/checklists/ChecklistShared';
import { ListBackLink, PrimaryActions, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export type ChecklistsLayoutProps = {
  desktop: boolean;
  tablet: boolean;
  kicker: string;
  title: string;
  query: string;
  setQuery: (v: string) => void;
  listCards: ChecklistListCardModel[];
  subListCards: ChecklistListCardModel[];
  selectedListId: string | null;
  onOpenList: (id: string) => void;
  onBack: () => void;
  today: string;
  onPushToday: (item: StashListItem) => void;
  onRenameList?: (id: string) => void;
  canManageList: (id: string) => boolean;
  peopleNames: Map<string, string>;
  listNames: Map<string, string>;
  selectedListName: string;
  selectedShareLabel: string;
  parentListName: string | null;
  active: StashListItem[];
  checked: StashListItem[];
  emptyLists: string;
  emptyItems: string;
  quickAdd: string;
  setQuickAdd: (v: string) => void;
  onQuickAdd: () => void;
  onClearListChecked?: () => void;
  categoryFilter: string | null;
  setCategoryFilter: (id: string | null) => void;
  categoriesInUse: string[];
  personFilter: string | null;
  setPersonFilter: (id: string | null) => void;
  assigneesInUse: string[];
  onAddList?: () => void;
  onAddItem?: () => void;
  onAddItemAnywhere?: () => void;
  onToggleItem: (item: StashListItem) => void;
  onOpenItem: (item: StashListItem) => void;
  online: boolean;
};

function ItemSections(props: ChecklistsLayoutProps) {
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  return (
    <View style={styles.stack}>
      {props.categoriesInUse.length > 0 || props.assigneesInUse.length > 0 ? (
        <FilterBar>
          {props.categoriesInUse.length > 0 ? (
            <FilterDropdown<string | null>
              id="category"
              label="Category"
              value={props.categoryFilter}
              valueLabel={props.categoryFilter ? categoryLabel(props.categoryFilter) : 'All'}
              open={openMenu === 'category'}
              options={[
                { value: null, label: 'All' },
                ...props.categoriesInUse.map((id) => ({ value: id, label: categoryLabel(id) })),
              ]}
              onToggle={toggleMenu}
              onSelect={pick(props.setCategoryFilter)}
            />
          ) : null}
          {props.assigneesInUse.length > 0 ? (
            <FilterDropdown<string | null>
              id="person"
              label="Person"
              value={props.personFilter}
              valueLabel={props.personFilter ? props.peopleNames.get(props.personFilter) ?? 'Person' : 'Anyone'}
              open={openMenu === 'person'}
              options={[
                { value: null, label: 'Anyone' },
                ...props.assigneesInUse.map((id) => ({
                  value: id,
                  label: props.peopleNames.get(id) ?? 'Person',
                })),
              ]}
              onToggle={toggleMenu}
              onSelect={pick(props.setPersonFilter)}
            />
          ) : null}
        </FilterBar>
      ) : null}
      {props.onAddItem ? (
        <View style={styles.quickRow}>
          <Field
            label="Quick add"
            value={props.quickAdd}
            onChangeText={props.setQuickAdd}
            placeholder="Item title"
            autoCapitalize="sentences"
            onSubmitEditing={props.onQuickAdd}
            returnKeyType="done"
            editable={props.online}
          />
          <Btn
            label="Add"
            onPress={props.onQuickAdd}
            disabled={!props.quickAdd.trim() || !props.online}
          />
        </View>
      ) : null}
      {props.active.length === 0 && props.checked.length === 0 ? (
        <EmptyState title="Nothing on this list" body={props.emptyItems} />
      ) : (
        <>
          {props.active.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              today={props.today}
              peopleNames={props.peopleNames}
              listNames={props.listNames}
              showListName={false}
              onToggle={() => props.onToggleItem(item)}
              onOpen={() => props.onOpenItem(item)}
              onPushToday={item.dueOn !== props.today ? () => props.onPushToday(item) : undefined}
            />
          ))}
          {props.checked.length > 0 ? (
            <>
              <View style={styles.doneHead}>
                <Text style={styles.doneLabel}>Checked off · {props.checked.length}</Text>
                {props.onClearListChecked ? (
                  <Pressable onPress={props.onClearListChecked} disabled={!props.online} hitSlop={6}>
                    <Text style={styles.clearChecked}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              {props.checked.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  today={props.today}
                  peopleNames={props.peopleNames}
                  listNames={props.listNames}
                  showListName={false}
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

function ListCardsGrid({
  cards,
  wide,
  props,
}: {
  cards: ChecklistListCardModel[];
  wide?: boolean;
  props: ChecklistsLayoutProps;
}) {
  if (cards.length === 0) {
    return <EmptyState title="No lists yet" body={props.emptyLists} />;
  }
  return (
    <View style={wide ? styles.listGrid : styles.listStack}>
      {cards.map((list) => (
        <ChecklistListCard
          key={list.id}
          list={list}
          wide={wide}
          onPress={() => props.onOpenList(list.id)}
          onSettings={
            props.onRenameList && props.canManageList(list.id)
              ? () => props.onRenameList?.(list.id)
              : undefined
          }
        />
      ))}
    </View>
  );
}

function ListDetail(props: ChecklistsLayoutProps) {
  return (
    <View style={styles.detail}>
      <ListBackLink label={props.parentListName ? props.parentListName : 'Lists'} onPress={props.onBack} />
      <View style={styles.titleRow}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {props.selectedListName}
        </Text>
        <Text style={styles.meta}>
          {props.active.length} open · {props.selectedShareLabel}
        </Text>
      </View>
      <PrimaryActions
        addLabel="Add item"
        onAdd={props.onAddItem ?? (() => undefined)}
        extraLabel={props.onRenameList ? 'Settings' : undefined}
        onExtra={
          props.onRenameList && props.selectedListId
            ? () => props.onRenameList?.(props.selectedListId!)
            : undefined
        }
        disabled={!props.online || !props.onAddItem}
      />
      <SearchField value={props.query} onChange={props.setQuery} placeholder="Search this list" />
      {props.subListCards.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sub-lists</Text>
          <ListCardsGrid cards={props.subListCards} wide={props.desktop} props={props} />
        </View>
      ) : null}
      <ItemSections {...props} />
    </View>
  );
}

export function ChecklistsDesktop(props: ChecklistsLayoutProps) {
  const inList = Boolean(props.selectedListId);
  return (
    <StashChrome desktop kicker={props.kicker} title={props.title}>
      {!inList ? (
        <PrimaryActions
          addLabel="New list"
          onAdd={props.onAddList ?? (() => undefined)}
          disabled={!props.online || !props.onAddList}
        />
      ) : null}
      {inList ? (
        <ListDetail {...props} />
      ) : (
        <ListCardsGrid cards={props.listCards} wide props={props} />
      )}
    </StashChrome>
  );
}

function ListHomeActions({
  onNewList,
  onAddItem,
  disabled,
}: {
  onNewList?: () => void;
  onAddItem?: () => void;
  disabled?: boolean;
}) {
  if (!onNewList && !onAddItem) return null;
  return (
    <View style={styles.topActions}>
      {onNewList ? (
        <Pressable
          onPress={onNewList}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="New list"
          style={({ pressed }) => [
            styles.topAction,
            styles.topActionPrimary,
            disabled && styles.topActionDisabled,
            pressed && styles.topActionPressed,
          ]}>
          <Text style={styles.topActionPrimaryLabel}>New list</Text>
        </Pressable>
      ) : null}
      {onAddItem ? (
        <Pressable
          onPress={onAddItem}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Add item"
          style={({ pressed }) => [
            styles.topAction,
            styles.topActionSecondary,
            disabled && styles.topActionDisabled,
            pressed && styles.topActionPressed,
          ]}>
          <Text style={styles.topActionLabel}>Add item</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ChecklistsMobile(props: ChecklistsLayoutProps) {
  if (props.selectedListId) {
    return (
      <ScrollView style={styles.mobileShell} contentContainerStyle={styles.mobileShellContent}>
        <ListDetail {...props} />
      </ScrollView>
    );
  }

  return (
    <StashChrome desktop={false} kicker={props.kicker} title={props.title}>
      <ListHomeActions
        onNewList={props.onAddList}
        onAddItem={props.onAddItemAnywhere}
        disabled={!props.online}
      />
      <Text style={styles.sectionTitle}>Your lists</Text>
      <ListCardsGrid cards={props.listCards} props={props} />
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  detail: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  listTitle: { color: colors.text, fontSize: 22, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  section: { gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  listStack: { gap: space.md },
  stack: { gap: 10 },
  quickRow: { gap: 8 },
  doneHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  doneLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  clearChecked: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  topActions: { flexDirection: 'row', gap: 10 },
  topAction: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  topActionPrimary: { backgroundColor: colors.accent },
  topActionSecondary: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topActionPrimaryLabel: { color: colors.bg, fontSize: 17, fontWeight: '800' },
  topActionLabel: { color: colors.text, fontSize: 17, fontWeight: '800' },
  topActionDisabled: { opacity: 0.55 },
  topActionPressed: { opacity: 0.86 },
  mobileShell: { flex: 1, backgroundColor: colors.bg },
  mobileShellContent: { padding: space.md, gap: 14, paddingBottom: 48 },
});
