import type { HouseholdRole } from '../household/types';
import type { StashList, StashListKind, StashListNode, StashListProduct, StashListVisibility, StashProduct } from './types';

/** Huddle-style list emoji presets. */
export const STASH_LIST_EMOJIS = ['📋', '🛒', '🏠', '🎁', '🎉', '🧒', '🔨', '✅', '📌', '📚', '🚗', '💡', '🏋️', '🎯'] as const;

/** Accent theme colors for list cards (readable on dark UI). */
export const STASH_LIST_THEMES = [
  { id: 'teal', color: '#3ECFBF' },
  { id: 'blue', color: '#3B82F6' },
  { id: 'amber', color: '#F59E0B' },
  { id: 'rose', color: '#F07178' },
  { id: 'violet', color: '#8B5CF6' },
  { id: 'green', color: '#34D399' },
  { id: 'pink', color: '#EC4899' },
  { id: 'sky', color: '#38BDF8' },
] as const;

export const DEFAULT_STASH_LIST_EMOJI = '📋';
export const DEFAULT_STASH_LIST_THEME = STASH_LIST_THEMES[0]!.color;

export function normalizeListEmoji(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_STASH_LIST_EMOJI;
}

export function normalizeListTheme(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (trimmed && /^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  return DEFAULT_STASH_LIST_THEME;
}

export function listThemeSoft(color: string, alpha = 0.18): string {
  const hex = normalizeListTheme(color).replace('#', '');
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function listsOfKind(lists: readonly StashList[], kind: StashListKind): StashList[] {
  return lists.filter((list) => list.kind === kind);
}

export function isTopLevelList(list: Pick<StashList, 'parentListId'>): boolean {
  return !list.parentListId;
}

export function childLists(lists: readonly StashList[], parentId: string): StashList[] {
  return lists.filter((list) => list.parentListId === parentId);
}

export function descendantListIds(lists: readonly StashList[], rootId: string): string[] {
  const ids: string[] = [];
  const walk = (parentId: string) => {
    for (const list of lists) {
      if (list.parentListId === parentId) {
        ids.push(list.id);
        walk(list.id);
      }
    }
  };
  walk(rootId);
  return ids;
}

export function listTree(lists: readonly StashList[]): StashListNode[] {
  const byParent = new Map<string | null, StashList[]>();
  for (const list of lists) {
    const key = list.parentListId;
    const bucket = byParent.get(key) ?? [];
    bucket.push(list);
    byParent.set(key, bucket);
  }
  const build = (parentId: string | null): StashListNode[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((list) => ({ ...list, children: build(list.id) }));
  return build(null);
}

export function formatListLabel(list: StashList, allLists: readonly StashList[]): string {
  if (!list.parentListId) return list.name;
  const parent = allLists.find((entry) => entry.id === list.parentListId);
  return parent ? `${parent.name} → ${list.name}` : list.name;
}

export function wouldCreateListCycle(
  lists: readonly StashList[],
  listId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (listId === newParentId) return true;
  const byId = new Map(lists.map((list) => [list.id, list]));
  const seen = new Set<string>();
  let current: string | null = newParentId;
  while (current) {
    if (current === listId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = byId.get(current)?.parentListId ?? null;
  }
  return false;
}

export function productsForList(
  listId: string,
  products: readonly StashProduct[],
  memberships: readonly StashListProduct[],
  lists: readonly StashList[],
): StashProduct[] {
  const ids = new Set([listId, ...descendantListIds(lists, listId)]);
  const productIds = new Set(memberships.filter((row) => ids.has(row.listId)).map((row) => row.productId));
  return products.filter((product) => productIds.has(product.id));
}

export function listIdsForProduct(productId: string, memberships: readonly StashListProduct[]): string[] {
  return memberships.filter((row) => row.productId === productId).map((row) => row.listId);
}

export function listTotals(products: readonly StashProduct[]): { count: number; totalCost: number } {
  return {
    count: products.length,
    totalCost: products.reduce((sum, product) => sum + (product.currentPrice ?? 0), 0),
  };
}

export function canManageLists(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canViewList(
  list: StashList,
  opts: { role: HouseholdRole | null; userId: string | null; personId: string | null },
): boolean {
  if (canManageLists(opts.role)) return true;
  if (list.createdBy && list.createdBy === opts.userId) return true;
  if (list.visibility === 'household') return true;
  if (list.visibility === 'private') return false;
  return Boolean(opts.personId && list.personIds.includes(opts.personId));
}

export function listShareLabel(list: StashList, people: readonly { id: string; name: string }[]): string {
  if (list.visibility === 'household') return 'Family';
  if (list.visibility === 'private') return 'Private';
  const names = list.personIds
    .map((id) => people.find((person) => person.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return 'Shared';
  if (names.length <= 2) return names.join(' · ');
  return `${names[0]} +${names.length - 1}`;
}

export function normalizeListShare(
  visibility: StashListVisibility,
  personIds: readonly string[],
): { visibility: StashListVisibility; personIds: string[] } {
  if (visibility !== 'people') return { visibility, personIds: [] };
  const unique = [...new Set(personIds)];
  return { visibility: 'people', personIds: unique };
}
