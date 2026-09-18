import type { Database } from '@kinexus/db';
import {
  isChecklistPriority,
  isChecklistRecurrence,
  isSale,
  type SavedLink,
  type SavedLinkCollection,
  type SavedLinkPriority,
  type SavedLinkStatus,
  type SavedLinkType,
  type StashList,
  type StashListItem,
  type StashListKind,
  type StashListProduct,
  type StashListVisibility,
  type StashPriceSource,
  type StashProduct,
} from '@kinexus/domain';

type ProductRow = Database['public']['Tables']['stash_products']['Row'];
type ListRow = Database['public']['Tables']['stash_lists']['Row'];
type ListProductRow = Database['public']['Tables']['stash_list_products']['Row'];
type ListItemRow = Database['public']['Tables']['stash_list_items']['Row'];
type CollectionRow = Database['public']['Tables']['stash_link_collections']['Row'];
type LinkRow = Database['public']['Tables']['stash_links']['Row'];

const PRICE_SOURCES = new Set<StashPriceSource>(['manual', 'scraped']);
const VISIBILITIES = new Set<StashListVisibility>(['household', 'private', 'people']);
const LIST_KINDS = new Set<StashListKind>(['checklist', 'wishlist']);
const LINK_TYPES = new Set<SavedLinkType>(['recipe', 'video', 'article', 'tool', 'place', 'product', 'other']);
const LINK_STATUSES = new Set<SavedLinkStatus>(['saved', 'try_next', 'tried', 'liked', 'not_for_me', 'archived']);

function asNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function productFromRow(row: ProductRow): StashProduct {
  const currentPrice = asNum(row.current_price);
  const originalPrice = asNum(row.original_price);
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    currentPrice,
    originalPrice,
    isOnSale: row.is_on_sale || isSale(currentPrice, originalPrice),
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    storeName: row.store_name,
    description: row.description,
    sku: row.sku,
    priceSource: row.price_source && PRICE_SOURCES.has(row.price_source) ? row.price_source : null,
    isOwned: row.is_owned,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listFromRow(row: ListRow, personIds: string[] = []): StashList {
  return {
    id: row.id,
    householdId: row.household_id,
    createdBy: row.created_by,
    name: row.name,
    kind: LIST_KINDS.has(row.kind) ? row.kind : 'wishlist',
    visibility: VISIBILITIES.has(row.visibility) ? row.visibility : 'household',
    personIds,
    parentListId: row.parent_list_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listItemFromRow(row: ListItemRow): StashListItem {
  return {
    id: row.id,
    householdId: row.household_id,
    listId: row.list_id,
    title: row.title,
    notes: row.notes,
    category: row.category,
    priority: isChecklistPriority(row.priority) ? row.priority : 0,
    dueOn: row.due_on,
    recurrence: isChecklistRecurrence(row.recurrence) ? row.recurrence : 'none',
    assignedPersonId: row.assigned_person_id,
    isChecked: row.is_checked,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProductFromRow(row: ListProductRow): StashListProduct {
  return { listId: row.list_id, productId: row.product_id, addedAt: row.added_at };
}

export function collectionFromRow(row: CollectionRow): SavedLinkCollection {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    description: row.description,
    color: row.color,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function linkFromRow(row: LinkRow, collectionIds: string[]): SavedLink {
  const priority = row.priority as SavedLinkPriority;
  return {
    id: row.id,
    householdId: row.household_id,
    collectionIds,
    url: row.url,
    canonicalUrl: row.canonical_url,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    siteName: row.site_name,
    faviconUrl: row.favicon_url,
    linkType: LINK_TYPES.has(row.link_type) ? row.link_type : 'other',
    status: LINK_STATUSES.has(row.status) ? row.status : 'saved',
    priority: [0, 1, 2, 3, 4].includes(priority) ? priority : 0,
    tags: row.tags ?? [],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
