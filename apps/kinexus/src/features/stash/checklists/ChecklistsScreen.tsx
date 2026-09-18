import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  canManageLists,
  completeChecklistItem,
  filterChecklistItems,
  itemsForList,
  listShareLabel,
  listsOfKind,
  listTree,
  splitCheckedItems,
  todayChecklistItems,
  todayIso,
  type StashListItem,
} from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { ChecklistsDesktop } from './ChecklistsDesktop';
import { ChecklistsMobile } from './ChecklistsMobile';
import { AddListSheet, ChecklistItemSheet, ListSettingsSheet } from '@/src/features/stash/sheets';
import { useStashSync, actionErrorMessage, type ChecklistItemDraft, type ListShareDraft } from '@/src/features/stash/use-stash-sync';
import { LoadingState } from '@/src/features/shell/states';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const FAMILY_SHARE: ListShareDraft = { visibility: 'household', personIds: [] };

export function ChecklistsScreen() {
  const { mode } = useExperienceMode();
  const { people, role } = useHousehold();
  const stash = useStashSync();
  const canManage = canManageLists(role);
  const [query, setQuery] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'today'>('list');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState('');
  const [addList, setAddList] = useState(false);
  const [addItem, setAddItem] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [share, setShare] = useState<ListShareDraft>(FAMILY_SHARE);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lists = useMemo(() => listsOfKind(stash.lists, 'checklist'), [stash.lists]);
  const tree = useMemo(() => listTree(lists), [lists]);

  useEffect(() => {
    if (view !== 'list') return;
    if (selectedListId && lists.some((list) => list.id === selectedListId)) return;
    setSelectedListId(lists[0]?.id ?? null);
    setCategoryFilter(null);
  }, [lists, selectedListId, view]);

  const shareLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of lists) map.set(list.id, listShareLabel(list, people));
    return map;
  }, [lists, people]);

  const today = todayIso();
  const peopleNames = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people]);
  const listNames = useMemo(() => new Map(lists.map((list) => [list.id, list.name])), [lists]);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const selectedItems = useMemo(() => {
    if (view === 'today') {
      return filterChecklistItems(todayChecklistItems(stash.items, today), {
        search: query,
        category: categoryFilter,
      });
    }
    if (!selectedListId) return [];
    return filterChecklistItems(itemsForList(selectedListId, stash.items), {
      search: query,
      category: categoryFilter,
    });
  }, [categoryFilter, query, selectedListId, stash.items, today, view]);
  const { active, checked } = useMemo(() => splitCheckedItems(selectedItems, today), [selectedItems, today]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const list of lists) {
      map.set(list.id, itemsForList(list.id, stash.items).filter((item) => !item.isChecked).length);
    }
    return map;
  }, [lists, stash.items]);

  const categoriesInUse = useMemo(() => {
    const source =
      view === 'today' ? todayChecklistItems(stash.items, today) : itemsForList(selectedListId ?? '', stash.items);
    const ids = new Set<string>();
    for (const row of source) {
      if (row.category) ids.add(row.category);
    }
    return [...ids];
  }, [selectedListId, stash.items, today, view]);

  const todayCount = useMemo(
    () => todayChecklistItems(stash.items, today).length,
    [stash.items, today],
  );
  const item = stash.items.find((row) => row.id === itemId) ?? null;

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
    subtitle: 'Shared household checklists — due dates, repeating chores, and who is doing what.',
    query,
    setQuery,
    tree,
    selectedListId,
    onSelectList: (id: string) => {
      setView('list');
      setSelectedListId(id);
      setCategoryFilter(null);
    },
    view,
    onSelectToday: () => {
      setView('today');
      setCategoryFilter(null);
    },
    todayCount,
    today,
    onRenameList: canManage
      ? (id: string) => {
          const list = lists.find((row) => row.id === id);
          setRenameId(id);
          setRenameValue(list?.name ?? '');
          setShare({
            visibility: list?.visibility ?? 'household',
            personIds: list?.personIds ?? [],
          });
        }
      : undefined,
    counts,
    shareLabels,
    peopleNames,
    listNames,
    selectedListName: view === 'today' ? 'Today' : (selectedList?.name ?? 'Lists'),
    selectedShareLabel:
      view === 'today' ? 'Due today and overdue' : selectedList ? listShareLabel(selectedList, people) : 'Family',
    active,
    checked,
    empty:
      view === 'today'
        ? 'Nothing due today. Open an item and give it a due date.'
        : canManage
          ? 'Create a list, choose who can see it, then add items with a due date, repeat, and who it is for.'
          : 'Nothing on this list yet.',
    quickAdd,
    setQuickAdd,
    onQuickAdd: () => {
      const title = quickAdd.trim();
      if (!title || !selectedListId || view !== 'list') return;
      void run(async () => {
        await stash.createItem(selectedListId, { title });
        setQuickAdd('');
      });
    },
    showQuickAdd: view === 'list' && Boolean(selectedListId),
    categoryFilter,
    setCategoryFilter,
    categoriesInUse,
    onAddList: canManage ? () => setAddList(true) : undefined,
    onAddItem:
      view === 'list' && selectedListId
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
        onSave={async (name, nextShare) => {
          setActionError(null);
          setBusy(true);
          try {
            const id = await stash.createList(name, nextShare, { kind: 'checklist' });
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
        people={people}
        busy={busy}
        error={actionError}
        onClose={() => setRenameId(null)}
        onSave={async () => {
          if (!renameId) return;
          if (await run(() => stash.renameList(renameId, renameValue, share))) setRenameId(null);
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
