import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  addDaysIso,
  canManageLists,
  checklistItemsForDay,
  childLists,
  completeChecklistItem,
  filterChecklistItems,
  formatDayHeading,
  isTopLevelList,
  itemsForList,
  listShareLabel,
  listsOfKind,
  movedChecklistDayPositions,
  normalizeListEmoji,
  normalizeListTheme,
  overdueChecklistItems,
  splitCheckedItems,
  todayChecklistItems,
  todayIso,
  type StashList,
  type StashListItem,
} from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { ChecklistsDesktop } from './ChecklistsDesktop';
import { ChecklistsMobile } from './ChecklistsMobile';
import type { ChecklistListCardModel } from './ChecklistShared';
import { AddListSheet, ChecklistItemSheet, ListSettingsSheet } from '@/src/features/stash/sheets';
import { useStashSync, actionErrorMessage, type ChecklistItemDraft, type ListIdentityDraft, type ListShareDraft } from '@/src/features/stash/use-stash-sync';
import { LoadingState } from '@/src/features/shell/states';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const FAMILY_SHARE: ListShareDraft = { visibility: 'household', personIds: [] };
const DEFAULT_IDENTITY: ListIdentityDraft = { emoji: normalizeListEmoji(null), theme: normalizeListTheme(null) };

function toListCard(
  list: StashList,
  lists: readonly StashList[],
  items: readonly StashListItem[],
  today: string,
  shareLabel: string,
): ChecklistListCardModel {
  const listItems = itemsForList(list.id, items);
  const open = listItems.filter((item) => !item.isChecked);
  const dueToday = todayChecklistItems(listItems, today).filter((item) => !item.isChecked);
  return {
    id: list.id,
    name: list.name,
    emoji: normalizeListEmoji(list.emoji),
    theme: normalizeListTheme(list.theme),
    openCount: open.length,
    dueTodayCount: dueToday.length,
    subListCount: childLists(lists, list.id).length,
    shareLabel,
  };
}

export function ChecklistsScreen() {
  const { mode } = useExperienceMode();
  const { people, role } = useHousehold();
  const stash = useStashSync();
  const canManage = canManageLists(role);
  const [query, setQuery] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState('');
  const [dayQuickAdd, setDayQuickAdd] = useState('');
  const [day, setDay] = useState(() => todayIso());
  const [addList, setAddList] = useState(false);
  const [addItem, setAddItem] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [share, setShare] = useState<ListShareDraft>(FAMILY_SHARE);
  const [identity, setIdentity] = useState<ListIdentityDraft>(DEFAULT_IDENTITY);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lists = useMemo(() => listsOfKind(stash.lists, 'checklist'), [stash.lists]);
  const today = todayIso();
  const peopleNames = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people]);
  const listNames = useMemo(() => new Map(lists.map((list) => [list.id, list.name])), [lists]);
  const shareLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of lists) map.set(list.id, listShareLabel(list, people));
    return map;
  }, [lists, people]);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const parentList = selectedList?.parentListId
    ? lists.find((list) => list.id === selectedList.parentListId) ?? null
    : null;

  const listCards = useMemo(
    () =>
      lists
        .filter(isTopLevelList)
        .filter((list) => list.name.trim().toLowerCase() !== 'daily')
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((list) => toListCard(list, lists, stash.items, today, shareLabels.get(list.id) ?? 'Family')),
    [lists, shareLabels, stash.items, today],
  );

  const subListCards = useMemo(() => {
    if (!selectedListId) return [];
    return childLists(lists, selectedListId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((list) => toListCard(list, lists, stash.items, today, shareLabels.get(list.id) ?? 'Family'));
  }, [lists, selectedListId, shareLabels, stash.items, today]);

  const dayItems = useMemo(() => checklistItemsForDay(stash.items, day), [day, stash.items]);
  const { active: dayActive, checked: dayChecked } = useMemo(
    () => splitCheckedItems(dayItems, today),
    [dayItems, today],
  );
  const overdue = useMemo(() => overdueChecklistItems(stash.items, today), [stash.items, today]);

  const selectedItems = useMemo(() => {
    if (!selectedListId) return [];
    return filterChecklistItems(itemsForList(selectedListId, stash.items), {
      search: query,
      category: categoryFilter,
    });
  }, [categoryFilter, query, selectedListId, stash.items]);
  const { active, checked } = useMemo(() => splitCheckedItems(selectedItems, today), [selectedItems, today]);

  const categoriesInUse = useMemo(() => {
    if (!selectedListId) return [];
    const ids = new Set<string>();
    for (const row of itemsForList(selectedListId, stash.items)) {
      if (row.category) ids.add(row.category);
    }
    return [...ids];
  }, [selectedListId, stash.items]);

  const item = stash.items.find((row) => row.id === itemId) ?? null;

  function openList(id: string) {
    setSelectedListId(id);
    setQuery('');
    setCategoryFilter(null);
    setQuickAdd('');
  }

  function goBack() {
    setQuery('');
    setCategoryFilter(null);
    setQuickAdd('');
    if (selectedList?.parentListId) {
      setSelectedListId(selectedList.parentListId);
      return;
    }
    setSelectedListId(null);
  }

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      setActionError(actionErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(draft: ChecklistItemDraft) {
    if (item) return run(() => stash.updateItem(item.id, draft));
    if (!selectedListId) return false;
    return run(() => stash.createItem(selectedListId, draft));
  }

  const layoutProps = {
    desktop: mode === 'desktop',
    kicker: 'Family',
    title: 'Lists',
    query,
    setQuery,
    listCards,
    subListCards,
    selectedListId,
    onOpenList: openList,
    onBack: goBack,
    today,
    day,
    dayHeading: formatDayHeading(day, today),
    onPrevDay: () => setDay((current) => addDaysIso(current, -1)),
    onNextDay: () => setDay((current) => addDaysIso(current, 1)),
    onGoToday: () => setDay(today),
    dayActive,
    dayChecked,
    overdueCount: overdue.length,
    onMigrateOverdue:
      overdue.length > 0
        ? () => {
            void run(async () => {
              for (const row of overdue) {
                await stash.updateItem(row.id, { dueOn: today });
              }
            });
          }
        : undefined,
    onClearDayChecked:
      dayChecked.length > 0
        ? () => {
            void run(async () => {
              for (const row of dayChecked) {
                await stash.deleteItem(row.id);
              }
            });
          }
        : undefined,
    dayQuickAdd,
    setDayQuickAdd,
    onDayQuickAdd: () => {
      const title = dayQuickAdd.trim();
      if (!title) return;
      void run(async () => {
        const listId = await stash.ensureDailyList();
        await stash.createItem(listId, { title, dueOn: day });
        setDayQuickAdd('');
      });
    },
    onMoveDayItem: (row: StashListItem, direction: -1 | 1) => {
      const patches = movedChecklistDayPositions(dayActive, row.id, direction);
      if (patches.length === 0) return;
      void run(() => stash.reorderItems(patches));
    },
    onPushTomorrow: (row: StashListItem) => {
      void run(() => stash.updateItem(row.id, { dueOn: addDaysIso(day, 1) }));
    },
    onPushToday: (row: StashListItem) => {
      void run(() => stash.updateItem(row.id, { dueOn: today }));
    },
    onRenameList: canManage
      ? (id: string) => {
          const list = lists.find((row) => row.id === id);
          setRenameId(id);
          setRenameValue(list?.name ?? '');
          setShare({
            visibility: list?.visibility ?? 'household',
            personIds: list?.personIds ?? [],
          });
          setIdentity({
            emoji: normalizeListEmoji(list?.emoji),
            theme: normalizeListTheme(list?.theme),
          });
        }
      : undefined,
    canManageList: () => canManage,
    peopleNames,
    listNames,
    selectedListName: selectedList
      ? `${normalizeListEmoji(selectedList.emoji)} ${selectedList.name}`
      : 'Lists',
    selectedShareLabel: selectedList ? listShareLabel(selectedList, people) : 'Family',
    parentListName: parentList ? `${normalizeListEmoji(parentList.emoji)} ${parentList.name}` : null,
    active,
    checked,
    emptyLists: canManage
      ? 'Create a list, choose who can see it, then add items with a due date, repeat, and who it is for.'
      : 'No lists shared with you yet.',
    emptyItems: canManage ? 'Add an item, or use quick add above.' : 'Nothing on this list yet.',
    emptyDay: 'Nothing planned for this day. Add a quick task above.',
    quickAdd,
    setQuickAdd,
    onQuickAdd: () => {
      const title = quickAdd.trim();
      if (!title || !selectedListId) return;
      void run(async () => {
        await stash.createItem(selectedListId, { title });
        setQuickAdd('');
      });
    },
    onClearListChecked:
      checked.length > 0
        ? () => {
            void run(async () => {
              for (const row of checked) {
                await stash.deleteItem(row.id);
              }
            });
          }
        : undefined,
    categoryFilter,
    setCategoryFilter,
    categoriesInUse,
    onAddList: canManage ? () => setAddList(true) : undefined,
    onAddItem: selectedListId
      ? () => {
          setItemId(null);
          setAddItem(true);
        }
      : undefined,
    onToggleItem: (row: StashListItem) => {
      const patch = completeChecklistItem(row, today);
      void run(() => stash.updateItem(row.id, patch));
    },
    onOpenItem: (row: StashListItem) => setItemId(row.id),
    online: stash.online,
  };

  if (stash.loading && lists.length === 0 && stash.items.length === 0) {
    return <LoadingState label="Loading lists" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ErrorText message={actionError ?? stash.error} />
      {mode === 'desktop' ? <ChecklistsDesktop {...layoutProps} /> : <ChecklistsMobile {...layoutProps} />}
      <AddListSheet
        visible={addList}
        title="New list"
        placeholder="Groceries, packing, chores…"
        people={people}
        showShare
        defaultShare={FAMILY_SHARE}
        busy={busy}
        error={actionError}
        onClose={() => setAddList(false)}
        onSave={async (name, nextShare, nextIdentity) => {
          setActionError(null);
          setBusy(true);
          try {
            const id = await stash.createList(name, nextShare, {
              kind: 'checklist',
              emoji: nextIdentity.emoji,
              theme: nextIdentity.theme,
            });
            setSelectedListId(id);
            setAddList(false);
          } catch (err) {
            setActionError(actionErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <ChecklistItemSheet
        visible={addItem || Boolean(item)}
        item={addItem ? null : item}
        people={people}
        busy={busy}
        error={actionError}
        onClose={() => {
          setAddItem(false);
          setItemId(null);
        }}
        onSave={async (draft) => {
          if (await saveItem(draft)) {
            setAddItem(false);
            setItemId(null);
          }
        }}
        onDelete={
          item
            ? async () => {
                if (await run(() => stash.deleteItem(item.id))) setItemId(null);
              }
            : undefined
        }
      />
      <ListSettingsSheet
        visible={Boolean(renameId)}
        name={renameValue}
        onNameChange={setRenameValue}
        share={share}
        onShareChange={setShare}
        identity={identity}
        onIdentityChange={setIdentity}
        people={people}
        busy={busy}
        error={actionError}
        onClose={() => setRenameId(null)}
        onSave={async () => {
          if (!renameId) return;
          if (await run(() => stash.renameList(renameId, renameValue, share, identity))) setRenameId(null);
        }}
        onDelete={async () => {
          if (!renameId) return;
          if (await run(() => stash.deleteList(renameId))) {
            if (selectedListId === renameId) setSelectedListId(null);
            setRenameId(null);
          }
        }}
      />
    </View>
  );
}
