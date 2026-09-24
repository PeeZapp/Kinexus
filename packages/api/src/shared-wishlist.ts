import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';

export type SharedWishlistProduct = {
  id: string;
  title: string;
  currentPrice: number | null;
  originalPrice: number | null;
  isOnSale: boolean;
  imageUrl: string | null;
  sourceUrl: string;
  storeName: string | null;
};

export type SharedWishlistPayload = {
  name: string;
  currency: string;
  products: SharedWishlistProduct[];
};

function asNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function descendantIds(lists: readonly { id: string; parent_list_id: string | null }[], rootId: string): string[] {
  const ids: string[] = [];
  const walk = (parentId: string) => {
    for (const list of lists) {
      if (list.parent_list_id === parentId) {
        ids.push(list.id);
        walk(list.id);
      }
    }
  };
  walk(rootId);
  return ids;
}

export async function handleGetSharedWishlist(
  token: string,
): Promise<{ status: number; body: SharedWishlistPayload | { error: string } }> {
  const trimmed = token.trim();
  if (!trimmed) return { status: 400, body: { error: 'Share token required' } };
  if (!isServiceRoleConfigured()) {
    return { status: 503, body: { error: 'Shared lists are not configured' } };
  }

  const client = createServiceClient();
  const { data: list, error: listError } = await client
    .from('stash_lists')
    .select('id, household_id, name, kind, is_shared, share_token')
    .eq('share_token', trimmed)
    .eq('is_shared', true)
    .maybeSingle();

  if (listError) return { status: 500, body: { error: listError.message } };
  if (!list || list.kind !== 'wishlist') {
    return { status: 404, body: { error: 'List not found or not shared' } };
  }

  const { data: household } = await client.from('households').select('currency').eq('id', list.household_id).maybeSingle();

  const { data: allLists, error: listsError } = await client
    .from('stash_lists')
    .select('id, parent_list_id')
    .eq('household_id', list.household_id)
    .eq('kind', 'wishlist');
  if (listsError) return { status: 500, body: { error: listsError.message } };

  const listIds = [list.id, ...descendantIds(allLists ?? [], list.id)];

  const { data: memberships, error: membershipError } = await client
    .from('stash_list_products')
    .select('product_id, list_id')
    .eq('household_id', list.household_id)
    .in('list_id', listIds);
  if (membershipError) return { status: 500, body: { error: membershipError.message } };

  const productIds = [...new Set((memberships ?? []).map((row) => row.product_id))];
  if (productIds.length === 0) {
    return {
      status: 200,
      body: {
        name: list.name,
        currency: household?.currency || 'AUD',
        products: [],
      },
    };
  }

  const { data: products, error: productsError } = await client
    .from('stash_products')
    .select('id, title, current_price, original_price, is_on_sale, image_url, source_url, store_name')
    .eq('household_id', list.household_id)
    .in('id', productIds);
  if (productsError) return { status: 500, body: { error: productsError.message } };

  const mapped: SharedWishlistProduct[] = (products ?? [])
    .map((row) => {
      const currentPrice = asNum(row.current_price);
      const originalPrice = asNum(row.original_price);
      return {
        id: row.id,
        title: row.title,
        currentPrice,
        originalPrice,
        isOnSale: Boolean(row.is_on_sale) || (currentPrice != null && originalPrice != null && currentPrice < originalPrice),
        imageUrl: row.image_url,
        sourceUrl: row.source_url ?? '',
        storeName: row.store_name,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    status: 200,
    body: {
      name: list.name,
      currency: household?.currency || 'AUD',
      products: mapped,
    },
  };
}
