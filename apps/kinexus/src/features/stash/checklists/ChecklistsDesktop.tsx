import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { categoryLabel, type StashListItem } from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import {
  ChecklistItemRow,
  ChecklistListCard,
  type ChecklistListCardModel,
} from '@/src/features/stash/checklists/ChecklistShared';
import { PrimaryActions, SearchField, StashChrome } from '@/src/features/stash/StashShared';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export type ChecklistsLayoutProps = {
  desktop: boolean;
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
  day: string;
  dayHeading: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onGoToday: () => void;
  dayActive: StashListItem[];
  dayChecked: StashListItem[];
  overdueCount: number;
  onMigrateOverdue?: () => void;
  onClearDayChecked?: () => void;
  dayQuickAdd: string;
  setDayQuickAdd: (v: string) => void;
  onDayQuickAdd: () => void;
  onMoveDayItem: (item: StashListItem, direction: -1 | 1) => void;
  onPushTomorrow: (item: StashListItem) => void;
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
  emptyDay: string;
  quickAdd: string;
  setQuickAdd: (v: string) => void;
  onQuickAdd: () => void;
  onClearListChecked?: () => void;
  categoryFilter: string | null;
  setCategoryFilter: (id: string | null) => void;
  categoriesInUse: string[];
  onAddList?: () => void;
  onAddItem?: () => void;
  onToggleItem: (item: StashListItem) => void;
  onOpenItem: (item: StashListItem) => void;
  online: boolean;
};

function TodayPanel({
  compact,
  props,
}: {
  compact?: boolean;
  props: ChecklistsLayoutProps;
}) {
  const isToday = props.day === props.today;
  return (
    <View style={[styles.todayPanel, compact && styles.todayPanelCompact]}>
      <View style={styles.todayHead}>
        <Text style={styles.todayKicker}>Daily</Text>
        <View style={styles.dayNav}>
          <Pressable onPress={props.onPrevDay} hitSlop={8} style={styles.dayNavBtn}>
            <Text style={styles.dayNavLabel}>‹</Text>
          </Pressable>
          <View style={styles.dayNavCenter}>
            <Text style={styles.todayTitle} numberOfLines={1}>
              {props.dayHeading}
            </Text>
            {!isToday ? (
              <Pressable onPress={props.onGoToday}>
                <Text style={styles.jumpToday}>Jump to today</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={props.onNextDay} hitSlop={8} style={styles.dayNavBtn}>
            <Text style={styles.dayNavLabel}>›</Text>
          </Pressable>
        </View>
        <Text style={styles.todayMeta}>
          {props.dayActive.length} open
          {props.dayChecked.length > 0 ? ` · ${props.dayChecked.length} done` : ''}
        </Text>
      </View>

      {isToday && props.overdueCount > 0 && props.onMigrateOverdue ? (
        <View style={styles.migrateBanner}>
          <Text style={styles.migrateText}>
            {props.overdueCount} incomplete task{props.overdueCount === 1 ? '' : 's'} from earlier days.
          </Text>
          <Pressable onPress={props.onMigrateOverdue} disabled={!props.online}>
            <Text style={styles.migrateAction}>Move to today</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.dayAddRow}>
        <Field
          label="Add to this day"
          value={props.dayQuickAdd}
          onChangeText={props.setDayQuickAdd}
          placeholder="Quick task…"
          autoCapitalize="sentences"
          onSubmitEditing={props.onDayQuickAdd}
          returnKeyType="done"
          editable={props.online}
        />
        <Btn
          label="Add"
          onPress={props.onDayQuickAdd}
          disabled={!props.dayQuickAdd.trim() || !props.online}
        />
      </View>

      {props.dayActive.length === 0 && props.dayChecked.length === 0 ? (
        <Text style={styles.todayEmpty}>{props.emptyDay}</Text>
      ) : (
        <ScrollView
          style={compact ? styles.todayScrollCompact : styles.todayScroll}
          contentContainerStyle={styles.todayStack}
          nestedScrollEnabled>
          {props.dayActive.map((item, index) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              today={props.today}
              peopleNames={props.peopleNames}
              listNames={props.listNames}
              showListName
              onToggle={() => props.onToggleItem(item)}
              onOpen={() => props.onOpenItem(item)}
              onMoveUp={index > 0 ? () => props.onMoveDayItem(item, -1) : undefined}
              onMoveDown={index < props.dayActive.length - 1 ? () => props.onMoveDayItem(item, 1) : undefined}
              onPushTomorrow={() => props.onPushTomorrow(item)}
            />
          ))}
          {props.dayChecked.length > 0 ? (
            <>
              <View style={styles.doneHead}>
                <Text style={styles.doneLabel}>Done · {props.dayChecked.length}</Text>
                {props.onClearDayChecked ? (
                  <Pressable onPress={props.onClearDayChecked} disabled={!props.online} hitSlop={6}>
                    <Text style={styles.clearChecked}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              {props.dayChecked.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  today={props.today}
                  peopleNames={props.peopleNames}
                  listNames={props.listNames}
                  showListName
                  onToggle={() => props.onToggleItem(item)}
                  onOpen={() => props.onOpenItem(item)}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
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
      <Pressable onPress={props.onBack} accessibilityRole="button" accessibilityLabel="Back to lists">
        <Text style={styles.back}>← {props.parentListName ? props.parentListName : 'Lists'}</Text>
      </Pressable>
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
  return (
    <StashChrome desktop kicker={props.kicker} title={props.title}>
      {!props.selectedListId ? (
        <PrimaryActions
          addLabel="New list"
          onAdd={props.onAddList ?? (() => undefined)}
          disabled={!props.online || !props.onAddList}
        />
      ) : null}
      <View style={styles.cols}>
        <TodayPanel props={props} />
        <View style={styles.main}>
          {props.selectedListId ? (
            <ListDetail {...props} />
          ) : (
            <>
              <Text style={styles.sectionTitle}>Your lists</Text>
              <ListCardsGrid cards={props.listCards} wide props={props} />
            </>
          )}
        </View>
      </View>
    </StashChrome>
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
      <PrimaryActions
        addLabel="New list"
        onAdd={props.onAddList ?? (() => undefined)}
        disabled={!props.online || !props.onAddList}
      />
      <TodayPanel compact props={props} />
      <Text style={styles.sectionTitle}>Your lists</Text>
      <ListCardsGrid cards={props.listCards} props={props} />
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  main: { flex: 1, gap: 14, minWidth: 0 },
  todayPanel: {
    width: 320,
    gap: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
  },
  todayPanelCompact: { width: '100%' },
  todayHead: { gap: 4 },
  todayKicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayNavBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavLabel: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  dayNavCenter: { flex: 1, minWidth: 0, gap: 2 },
  jumpToday: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  todayTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  todayMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  todayEmpty: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  migrateBanner: {
    gap: 8,
    padding: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningBg,
  },
  migrateText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  migrateAction: { color: colors.warning, fontSize: 13, fontWeight: '800' },
  dayAddRow: { gap: 8 },
  todayScroll: { maxHeight: 480 },
  todayScrollCompact: { maxHeight: 220 },
  todayStack: { gap: 8, paddingBottom: 4 },
  detail: { gap: 12 },
  back: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  listTitle: { color: colors.text, fontSize: 22, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  section: { gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  listStack: { gap: space.md },
  stack: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  mobileShell: { flex: 1, backgroundColor: colors.bg },
  mobileShellContent: { padding: space.md, gap: 14, paddingBottom: 48 },
});
