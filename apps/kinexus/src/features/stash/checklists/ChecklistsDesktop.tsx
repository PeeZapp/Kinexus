import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue, type ViewStyle } from 'react-native';

import { AppModal } from '@/src/features/shell/AppModal';

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

function TodayPanel({
  compact,
  inModal,
  props,
}: {
  compact?: boolean;
  inModal?: boolean;
  props: ChecklistsLayoutProps;
}) {
  const isToday = props.day === props.today;
  const tasks = (
    <>
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
    </>
  );
  return (
    <View style={[styles.todayPanel, compact && styles.todayPanelCompact, inModal && styles.todayPanelModal]}>
      <View style={styles.todayHead}>
        {inModal ? null : <Text style={styles.todayKicker}>Daily</Text>}
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
      ) : inModal ? (
        <View style={styles.todayStack}>{tasks}</View>
      ) : (
        <ScrollView
          style={compact ? styles.todayScrollCompact : styles.todayScroll}
          contentContainerStyle={styles.todayStack}
          nestedScrollEnabled>
          {tasks}
        </ScrollView>
      )}
    </View>
  );
}

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

const DAILY_PAD = 16;
const DAILY_HEADER = 32;
const DAILY_ADD = 34;
const DAILY_MORE = 28;
const DAILY_GAP = 8;
const DAILY_ROW = 28;
const LIST_GAP = 16;
const LIST_MIN_WIDTH = 220;

function listColumnCount(boardWidth: number) {
  if (boardWidth <= 0) return 0;
  return Math.max(1, Math.floor((boardWidth + LIST_GAP) / (LIST_MIN_WIDTH + LIST_GAP)));
}

function estimatedListCardHeight(width: number) {
  return Math.round(width * 0.75 + 92);
}

function dailyVisibleCount(height: number, total: number) {
  if (total === 0) return 0;
  const base = DAILY_PAD * 2 + DAILY_HEADER + DAILY_GAP + DAILY_ADD + DAILY_GAP;
  const row = DAILY_ROW + 4;
  if (height <= 0) return Math.min(total, 3);
  const withoutMore = Math.max(0, Math.floor((height - base) / row));
  if (total <= withoutMore) return total;
  return Math.max(0, Math.floor((height - base - DAILY_GAP - DAILY_MORE) / row));
}

function DayAddModal({
  props,
  visible,
  onClose,
}: {
  props: ChecklistsLayoutProps;
  visible: boolean;
  onClose: () => void;
}) {
  const canAdd = props.online && props.dayQuickAdd.trim().length > 0;

  function submitTask() {
    if (!canAdd) return;
    props.onDayQuickAdd();
    onClose();
  }

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>Add task</Text>
          <Text style={styles.modalDay}>{props.dayHeading}</Text>
          <Field
            label="Task"
            value={props.dayQuickAdd}
            onChangeText={props.setDayQuickAdd}
            placeholder="What needs doing?"
            autoCapitalize="sentences"
            autoCorrect
            onSubmitEditing={submitTask}
            returnKeyType="done"
            editable={props.online}
          />
          <View style={styles.modalActions}>
            <Btn label="Cancel" variant="secondary" onPress={onClose} />
            <Btn label="Add" onPress={submitTask} disabled={!canAdd} />
          </View>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

function DayHeading({ props }: { props: ChecklistsLayoutProps }) {
  const isToday = props.day === props.today;
  return (
    <View style={styles.dailyHead}>
      <Pressable onPress={props.onPrevDay} hitSlop={8} style={styles.dayNavBtn} accessibilityLabel="Previous day">
        <Text style={styles.dayNavLabel}>‹</Text>
      </Pressable>
      <Text style={styles.dailyDate} numberOfLines={1}>
        {props.dayHeading}
      </Text>
      {!isToday ? (
        <Pressable onPress={props.onGoToday} hitSlop={6} accessibilityLabel="Jump to today">
          <Text style={styles.jumpToday}>Today</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={props.onNextDay} hitSlop={8} style={styles.dayNavBtn} accessibilityLabel="Next day">
        <Text style={styles.dayNavLabel}>›</Text>
      </Pressable>
    </View>
  );
}

function DailyTaskLine({
  item,
  checked,
  onToggle,
}: {
  item: StashListItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.dailyTask}>
      <Pressable
        onPress={onToggle}
        style={[styles.dailyCheck, checked && styles.dailyCheckOn]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}>
        <Text style={styles.dailyCheckMark}>{checked ? '✓' : ''}</Text>
      </Pressable>
      <Text style={[styles.dailyTaskTitle, checked && styles.dailyTaskDone]} numberOfLines={1}>
        {item.title}
      </Text>
    </View>
  );
}

function DailyListCard({
  props,
  onMore,
  filled,
}: {
  props: ChecklistsLayoutProps;
  onMore: () => void;
  filled: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const items = [...props.dayActive, ...props.dayChecked];
  const [height, setHeight] = useState(0);
  const visibleCount = dailyVisibleCount(height, items.length);
  const shown = items.slice(0, visibleCount);
  const hidden = items.length - shown.length;

  return (
    <View
      style={[styles.dailyCard, filled && styles.dailyCardFill]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.height;
        setHeight((current) => (Math.abs(current - next) < 2 ? current : next));
      }}>
      <DayHeading props={props} />
      <Pressable
        onPress={() => setAddOpen(true)}
        disabled={!props.online}
        accessibilityRole="button"
        accessibilityLabel="Add task"
        style={({ pressed }) => [styles.dailyAddBtn, !props.online && styles.topActionDisabled, pressed && styles.topActionPressed]}>
        <Text style={styles.dailyAddLabel}>Add</Text>
      </Pressable>
      {items.length === 0 ? (
        <Text style={styles.todayEmpty}>{props.emptyDay}</Text>
      ) : (
        <View style={styles.dailyTasks}>
          {shown.map((item) => (
            <DailyTaskLine
              key={item.id}
              item={item}
              checked={item.isChecked}
              onToggle={() => props.onToggleItem(item)}
            />
          ))}
        </View>
      )}
      {hidden > 0 ? (
        <Pressable onPress={onMore} accessibilityRole="button" accessibilityLabel="More" style={styles.dailyMore}>
          <Text style={styles.dailyMoreLabel}>More</Text>
        </Pressable>
      ) : null}
      <DayAddModal props={props} visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

function DailyDetail({ props, onBack }: { props: ChecklistsLayoutProps; onBack: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const isToday = props.day === props.today;
  return (
    <View style={styles.detail}>
      <ListBackLink label="Lists" onPress={onBack} />
      <DayHeading props={props} />
      <Pressable
        onPress={() => setAddOpen(true)}
        disabled={!props.online}
        accessibilityRole="button"
        accessibilityLabel="Add task"
        style={({ pressed }) => [styles.dailyAddBtn, styles.dailyAddBtnWide, !props.online && styles.topActionDisabled, pressed && styles.topActionPressed]}>
        <Text style={styles.dailyAddLabel}>Add</Text>
      </Pressable>
      {isToday && props.overdueCount > 0 && props.onMigrateOverdue ? (
        <Pressable onPress={props.onMigrateOverdue} disabled={!props.online}>
          <Text style={styles.migrateAction}>
            Move {props.overdueCount} earlier task{props.overdueCount === 1 ? '' : 's'} to today
          </Text>
        </Pressable>
      ) : null}
      {props.dayActive.length === 0 && props.dayChecked.length === 0 ? (
        <Text style={styles.todayEmpty}>{props.emptyDay}</Text>
      ) : (
        <View style={styles.stack}>
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
        </View>
      )}
      <DayAddModal props={props} visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

function ListsBoard({ props, onOpenDaily }: { props: ChecklistsLayoutProps; onOpenDaily: () => void }) {
  const [boardWidth, setBoardWidth] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const columns = listColumnCount(boardWidth);
  const basis: DimensionValue | undefined =
    columns > 0 ? `${Math.floor((100 / columns) * 100) / 100}%` : undefined;

  function rememberHeight(height: number) {
    if (height < 1) return;
    setCardHeight((current) => (Math.abs(current - height) < 2 ? current : height));
  }

  const slotStyle: ViewStyle =
    basis != null
      ? { width: basis, maxWidth: basis, minWidth: 0, paddingRight: LIST_GAP, paddingBottom: LIST_GAP }
      : styles.cardSlotFluid;

  return (
    <View
      style={[styles.flowGrid, styles.gridStart]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        setBoardWidth((current) => (Math.abs(current - next) < 1 ? current : next));
      }}>
      <View style={slotStyle}>
        <View
          style={[styles.cardSlot, cardHeight > 0 && { height: cardHeight }]}
          onLayout={(event) => {
            if (props.listCards.length > 0) return;
            rememberHeight(estimatedListCardHeight(event.nativeEvent.layout.width));
          }}>
          <DailyListCard props={props} onMore={onOpenDaily} filled={cardHeight > 0} />
        </View>
      </View>
      {props.listCards.map((list, index) => (
        <View key={list.id} style={slotStyle}>
          <View
            style={styles.cardSlot}
            onLayout={index === 0 ? (event) => rememberHeight(event.nativeEvent.layout.height) : undefined}>
            <ChecklistListCard
              list={list}
              onPress={() => props.onOpenList(list.id)}
              onSettings={
                props.onRenameList && props.canManageList(list.id) ? () => props.onRenameList?.(list.id) : undefined
              }
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ChecklistsDesktop(props: ChecklistsLayoutProps) {
  const [dailyOpen, setDailyOpen] = useState(false);
  const inList = Boolean(props.selectedListId);
  return (
    <StashChrome desktop kicker={props.kicker} title={props.title}>
      {!inList && !dailyOpen ? (
        <PrimaryActions
          addLabel="New list"
          onAdd={props.onAddList ?? (() => undefined)}
          disabled={!props.online || !props.onAddList}
        />
      ) : null}
      {inList ? (
        <ListDetail {...props} />
      ) : dailyOpen ? (
        <DailyDetail props={props} onBack={() => setDailyOpen(false)} />
      ) : (
        <ListsBoard props={props} onOpenDaily={() => setDailyOpen(true)} />
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

function dailyButtonMeta(props: ChecklistsLayoutProps) {
  if (props.day !== props.today) return props.dayHeading;
  const bits = [`${props.dayActive.length} open`];
  if (props.dayChecked.length > 0) bits.push(`${props.dayChecked.length} done`);
  if (props.overdueCount > 0) bits.push(`${props.overdueCount} overdue`);
  return bits.join(' · ');
}

export function ChecklistsMobile(props: ChecklistsLayoutProps) {
  const [dailyOpen, setDailyOpen] = useState(false);

  if (props.selectedListId) {
    return (
      <ScrollView style={styles.mobileShell} contentContainerStyle={styles.mobileShellContent}>
        <ListDetail {...props} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <StashChrome desktop={false} kicker={props.kicker} title={props.title}>
        <ListHomeActions
          onNewList={props.onAddList}
          onAddItem={props.onAddItemAnywhere}
          disabled={!props.online}
        />
        <Pressable
          onPress={() => setDailyOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open daily list"
          style={styles.dailyButton}>
          <View style={styles.dailyButtonMark}>
            <Text style={styles.dailyButtonEmoji}>🗓️</Text>
          </View>
          <View style={styles.dailyButtonBody}>
            <Text style={styles.dailyButtonTitle}>Daily</Text>
            <Text style={styles.dailyButtonMeta} numberOfLines={1}>
              {dailyButtonMeta(props)}
            </Text>
          </View>
          <Text style={styles.dailyButtonChevron}>›</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>Your lists</Text>
        <ListCardsGrid cards={props.listCards} props={props} />
      </StashChrome>
      {dailyOpen ? (
        <View style={styles.dailyBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDailyOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close daily list"
          />
          <View style={styles.dailySheet}>
            <View style={styles.dailySheetHead}>
              <Text style={styles.dailySheetTitle}>Daily</Text>
              <Pressable onPress={() => setDailyOpen(false)} hitSlop={8}>
                <Text style={styles.sheetClose}>Close</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.dailySheetBody}
              contentContainerStyle={styles.dailySheetContent}
              keyboardShouldPersistTaps="handled">
              <TodayPanel inModal props={props} />
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
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
  todayPanelModal: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    borderRadius: 0,
  },
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
  jumpToday: { color: colors.accent, fontSize: 12, fontWeight: '700', textAlign: 'center' },
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
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  listTitle: { color: colors.text, fontSize: 22, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  section: { gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  flowGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  gridStart: { alignItems: 'flex-start' },
  cardSlot: { width: '100%' },
  cardSlotFluid: { flexGrow: 1, flexBasis: LIST_MIN_WIDTH, minWidth: LIST_MIN_WIDTH, maxWidth: '100%' },
  dailyCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: space.md,
    gap: DAILY_GAP,
  },
  dailyCardFill: { flex: 1, height: '100%' },
  dailyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: DAILY_HEADER,
  },
  dailyDate: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  dailyAddBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: DAILY_ADD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dailyAddBtnWide: { alignSelf: 'flex-start', minWidth: 120 },
  dailyAddLabel: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  dailyTasks: { gap: 4 },
  dailyTask: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: DAILY_ROW },
  dailyCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyCheckOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  dailyCheckMark: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  dailyTaskTitle: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13, fontWeight: '600' },
  dailyTaskDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  dailyMore: { marginTop: 'auto', alignItems: 'center', minHeight: DAILY_MORE, justifyContent: 'center' },
  dailyMoreLabel: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: 12,
  },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  modalDay: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: -6 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
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
  mobileRoot: { flex: 1 },
  dailyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: radius.lg,
    padding: space.md,
  },
  dailyButtonMark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyButtonEmoji: { fontSize: 22 },
  dailyButtonBody: { flex: 1, minWidth: 0, gap: 2 },
  dailyButtonTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  dailyButtonMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  dailyButtonChevron: { color: colors.textMuted, fontSize: 22, fontWeight: '600' },
  dailyBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dailySheet: {
    height: '92%',
    zIndex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: space.md,
    gap: 8,
  },
  dailySheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  dailySheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sheetClose: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  dailySheetBody: { flex: 1 },
  dailySheetContent: { paddingHorizontal: space.md, paddingBottom: 32 },
});
