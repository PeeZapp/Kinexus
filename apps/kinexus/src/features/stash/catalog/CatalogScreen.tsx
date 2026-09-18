import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  canManageLists,
  formatListLabel,
  listIdsForProduct,
  listShareLabel,
  listsOfKind,
  listTotals,
  listTree,
  productsForList,
  type StashProduct,
} from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { AddListSheet, AddProductSheet, ListSettingsSheet, ProductSheet } from '@/src/features/stash/sheets';
import { CatalogDesktop } from '@/src/features/stash/catalog/CatalogDesktop';
import { CatalogMobile } from '@/src/features/stash/catalog/CatalogMobile';
import { useStashSync, actionErrorMessage, type ListShareDraft, type ProductDraft } from '@/src/features/stash/use-stash-sync';
import { LoadingState } from '@/src/features/shell/states';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const FAMILY_SHARE: ListShareDraft = { visibility: 'household', personIds: [] };

export function CatalogScreen() {
  const { mode } = useExperienceMode();
  const { people, role } = useHousehold();
  const stash = useStashSync();
  const canManage = canManageLists(role);
  const [query, setQuery] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [addList, setAddList] = useState(false);
  const [addSub, setAddSub] = useState(false);
  const [addProduct, setAddProduct] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [share, setShare] = useState<ListShareDraft>(FAMILY_SHARE);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lists = useMemo(() => listsOfKind(stash.lists, 'wishlist'), [stash.lists]);
  const tree = useMemo(() => listTree(lists), [lists]);
  const shareLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of lists) map.set(list.id, listShareLabel(list, people));
    return map;
  }, [lists, people]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const list of lists) {
      map.set(list.id, productsForList(list.id, stash.products, stash.memberships, lists).length);
    }
    return map;
  }, [lists, stash.memberships, stash.products]);

  const visibleProducts = useMemo(() => {
    const base = selectedListId
      ? productsForList(selectedListId, stash.products, stash.memberships, lists)
      : stash.products;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((product) => {
      const hay = [product.title, product.storeName, product.notes, product.sourceUrl].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [lists, query, selectedListId, stash.memberships, stash.products]);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const product = stash.products.find((item) => item.id === productId) ?? null;
  const totals = listTotals(visibleProducts);
  const parentShare: ListShareDraft = selectedList
    ? { visibility: selectedList.visibility, personIds: selectedList.personIds }
    : FAMILY_SHARE;

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

  const layoutProps = {
    desktop: mode === 'desktop',
    kicker: 'Family',
    title: 'Wishlists',
    subtitle: 'Track products and prices. Share a wishlist with the whole family, keep it private, or pick who can see it.',
    query,
    setQuery,
    tree,
    selectedListId,
    onSelectList: (id: string | null) => setSelectedListId(id),
    onRenameList: canManage
      ? (id: string) => {
          const list = lists.find((item) => item.id === id);
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
    products: visibleProducts,
    currency: stash.currency,
    totals,
    selectedListName: selectedList ? formatListLabel(selectedList, lists) : 'All items',
    empty: canManage ? 'Create a wishlist or paste a product URL to add something.' : 'Nothing on these wishlists yet.',
    addItemLabel: 'Add item',
    onAddList: canManage ? () => setAddList(true) : undefined,
    onAddSublist: canManage && selectedListId ? () => setAddSub(true) : undefined,
    onAddProduct: () => setAddProduct(true),
    onOpenProduct: (item: StashProduct) => setProductId(item.id),
    online: stash.online,
  };

  if (stash.loading && stash.products.length === 0 && stash.lists.length === 0) {
    return <LoadingState label="Loading wishlists" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ErrorText message={actionError ?? stash.error} />
      {mode === 'desktop' ? <CatalogDesktop {...layoutProps} /> : <CatalogMobile {...layoutProps} />}
      <AddListSheet
        key={addSub ? `sub-${selectedListId}` : 'list'}
        visible={addList || addSub}
        title={addSub ? 'New sublist' : 'New wishlist'}
        placeholder="Birthday, Christmas, house…"
        people={people}
        showShare
        defaultShare={addSub ? parentShare : FAMILY_SHARE}
        busy={busy}
        error={actionError}
        onClose={() => {
          setAddList(false);
          setAddSub(false);
        }}
        onSave={async (name, nextShare) => {
          if (await run(() => stash.createList(name, nextShare, { kind: 'wishlist', parentListId: addSub ? selectedListId : null }))) {
            setAddList(false);
            setAddSub(false);
          }
        }}
      />
      <AddProductSheet
        visible={addProduct}
        lists={lists}
        defaultListId={selectedListId}
        busy={busy}
        error={actionError}
        onClose={() => setAddProduct(false)}
        onScrape={async (url) => {
          const scraped = await stash.scrapeProduct(url);
          return {
            title: scraped.title ?? '',
            sourceUrl: url,
            currentPrice: scraped.currentPrice != null ? String(scraped.currentPrice) : '',
            originalPrice: scraped.originalPrice != null ? String(scraped.originalPrice) : '',
            imageUrl: scraped.imageUrl ?? '',
            storeName: scraped.storeName ?? '',
            description: scraped.description ?? '',
            sku: scraped.sku ?? '',
            priceSource: 'scraped' as const,
          };
        }}
        onSave={async (draft: ProductDraft) => {
          if (await run(() => stash.createProduct(draft))) setAddProduct(false);
        }}
      />
      <ProductSheet
        product={product}
        lists={lists}
        membershipIds={product ? listIdsForProduct(product.id, stash.memberships) : []}
        currency={stash.currency}
        busy={busy}
        error={actionError}
        onClose={() => setProductId(null)}
        onSave={async (draft) => {
          if (!product) return;
          await run(() => stash.updateProduct(product.id, draft));
        }}
        onToggleList={async (listId, on) => {
          if (!product) return;
          await run(() => (on ? stash.addProductToList(product.id, listId) : stash.removeProductFromList(product.id, listId)));
        }}
        onRefresh={async () => {
          if (!product) return;
          await run(() => stash.refreshProductFromUrl(product.id));
        }}
        onDelete={async () => {
          if (!product) return;
          if (await run(() => stash.deleteProduct(product.id))) setProductId(null);
        }}
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
