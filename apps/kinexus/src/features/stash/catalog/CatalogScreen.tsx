import { useMemo, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  canManageLists,
  childLists,
  formatMoney,
  isTopLevelList,
  listIdsForProduct,
  listShareLabel,
  listsOfKind,
  listTotals,
  normalizeListEmoji,
  normalizeListTheme,
  productsForList,
  type StashList,
  type StashListProduct,
  type StashProduct,
} from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { AddListSheet, AddProductSheet, ListSettingsSheet, ProductSheet } from '@/src/features/stash/sheets';
import { CatalogDesktop } from '@/src/features/stash/catalog/CatalogDesktop';
import { CatalogMobile } from '@/src/features/stash/catalog/CatalogMobile';
import type { WishlistListCardModel } from '@/src/features/stash/StashShared';
import { useStashSync, actionErrorMessage, type ListIdentityDraft, type ListShareDraft, type ProductDraft } from '@/src/features/stash/use-stash-sync';
import { LoadingState } from '@/src/features/shell/states';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const FAMILY_SHARE: ListShareDraft = { visibility: 'household', personIds: [] };
const DEFAULT_IDENTITY: ListIdentityDraft = { emoji: normalizeListEmoji(null), theme: normalizeListTheme(null) };

function productsOnListDirect(
  listId: string,
  products: readonly StashProduct[],
  memberships: readonly StashListProduct[],
): StashProduct[] {
  const productIds = new Set(memberships.filter((row) => row.listId === listId).map((row) => row.productId));
  return products.filter((product) => productIds.has(product.id));
}

function toListCard(
  list: StashList,
  lists: readonly StashList[],
  products: readonly StashProduct[],
  memberships: readonly StashListProduct[],
  shareLabel: string,
): WishlistListCardModel {
  const aggregated = productsForList(list.id, products, memberships, lists);
  const totals = listTotals(aggregated);
  return {
    id: list.id,
    name: list.name,
    emoji: normalizeListEmoji(list.emoji),
    theme: normalizeListTheme(list.theme),
    coverUrl: aggregated.find((product) => product.imageUrl)?.imageUrl ?? null,
    itemCount: totals.count,
    totalCost: totals.totalCost,
    hasSale: aggregated.some((product) => product.isOnSale),
    subListCount: childLists(lists, list.id).length,
    shareLabel,
  };
}

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
  const [identity, setIdentity] = useState<ListIdentityDraft>(DEFAULT_IDENTITY);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkingPrices, setCheckingPrices] = useState(false);
  const [priceCheckProgress, setPriceCheckProgress] = useState<string | null>(null);
  const [priceCheckSummary, setPriceCheckSummary] = useState<string | null>(null);
  const [priceCheckAlerts, setPriceCheckAlerts] = useState<string[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const lists = useMemo(() => listsOfKind(stash.lists, 'wishlist'), [stash.lists]);
  const shareLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of lists) map.set(list.id, listShareLabel(list, people));
    return map;
  }, [lists, people]);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const parentList = selectedList?.parentListId
    ? lists.find((list) => list.id === selectedList.parentListId) ?? null
    : null;

  const listCards = useMemo(() => {
    return lists
      .filter(isTopLevelList)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((list) => toListCard(list, lists, stash.products, stash.memberships, shareLabels.get(list.id) ?? 'Family'));
  }, [lists, shareLabels, stash.memberships, stash.products]);

  const subListCards = useMemo(() => {
    if (!selectedListId) return [];
    return childLists(lists, selectedListId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((list) => toListCard(list, lists, stash.products, stash.memberships, shareLabels.get(list.id) ?? 'Family'));
  }, [lists, selectedListId, shareLabels, stash.memberships, stash.products]);

  const aggregateProducts = useMemo(() => {
    if (!selectedListId) return [];
    return productsForList(selectedListId, stash.products, stash.memberships, lists);
  }, [lists, selectedListId, stash.memberships, stash.products]);

  const checkableProducts = useMemo(
    () => aggregateProducts.filter((product) => Boolean(product.sourceUrl?.trim())),
    [aggregateProducts],
  );

  const visibleProducts = useMemo(() => {
    if (!selectedListId) return [];
    const base =
      subListCards.length > 0
        ? productsOnListDirect(selectedListId, stash.products, stash.memberships)
        : aggregateProducts;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((product) => {
      const hay = [product.title, product.storeName, product.notes, product.sourceUrl].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [aggregateProducts, query, selectedListId, stash.memberships, stash.products, subListCards.length]);

  const product = stash.products.find((item) => item.id === productId) ?? null;
  const totals = listTotals(aggregateProducts);
  const hasSale = aggregateProducts.some((item) => item.isOnSale);
  const parentShare: ListShareDraft = selectedList
    ? { visibility: selectedList.visibility, personIds: selectedList.personIds }
    : FAMILY_SHARE;

  function clearPriceCheck() {
    setCheckingPrices(false);
    setPriceCheckProgress(null);
    setPriceCheckSummary(null);
    setPriceCheckAlerts([]);
  }

  function openList(id: string) {
    clearPriceCheck();
    setShareStatus(null);
    setSelectedListId(id);
    setQuery('');
  }

  function goBack() {
    clearPriceCheck();
    setShareStatus(null);
    setQuery('');
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

  async function checkPrices() {
    if (checkingPrices || !stash.online) return;
    const targets = checkableProducts;
    if (targets.length === 0) {
      setPriceCheckSummary('No items with product URLs to check.');
      setPriceCheckAlerts([]);
      return;
    }

    setActionError(null);
    setCheckingPrices(true);
    setPriceCheckSummary(null);
    setPriceCheckAlerts([]);

    const alerts: string[] = [];
    let updated = 0;
    let drops = 0;
    let sales = 0;
    const currency = stash.currency;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]!;
      setPriceCheckProgress(`Checking ${i + 1} of ${targets.length}…`);
      try {
        const result = await stash.refreshProductFromUrl(target.id);
        if (result.updated) updated += 1;
        if (result.priceDropped) {
          drops += 1;
          const amount =
            result.savings != null && result.newPrice != null
              ? `dropped ${formatMoney(result.savings, currency)} — now ${formatMoney(result.newPrice, currency)}`
              : 'price dropped';
          alerts.push(result.onSale ? `"${result.title}" ${amount} (on sale)` : `"${result.title}" ${amount}`);
        } else if (result.onSale) {
          sales += 1;
          alerts.push(
            result.newPrice != null
              ? `"${result.title}" is on special — now ${formatMoney(result.newPrice, currency)}`
              : `"${result.title}" is on special`,
          );
        }
      } catch {
        // Skip failed lookups and keep checking the rest.
      }
    }

    setCheckingPrices(false);
    setPriceCheckProgress(null);
    setPriceCheckAlerts(alerts);

    if (alerts.length > 0) {
      const parts = [`Checked ${targets.length} item${targets.length === 1 ? '' : 's'}`];
      if (drops > 0) parts.push(`${drops} price drop${drops === 1 ? '' : 's'}`);
      if (sales > 0) parts.push(`${sales} on special`);
      setPriceCheckSummary(parts.join(' — '));
    } else if (updated > 0) {
      setPriceCheckSummary(
        `Done — ${updated} item${updated === 1 ? '' : 's'} updated. No price drops or new specials.`,
      );
    } else {
      setPriceCheckSummary('Done — all prices are up to date.');
    }
  }

  async function shareList() {
    if (!selectedListId || shareBusy) return;
    setShareBusy(true);
    setShareStatus(null);
    setActionError(null);
    try {
      const url = await stash.enableListShare(selectedListId);
      await Clipboard.setStringAsync(url);
      setShareStatus(`Share link copied. Anyone with the link can view items and buy links — even if this list is private in your household.`);
    } catch (err) {
      setActionError(actionErrorMessage(err));
    } finally {
      setShareBusy(false);
    }
  }

  const layoutProps = {
    desktop: mode === 'desktop',
    kicker: 'Family',
    title: 'Wishlists',
    query,
    setQuery,
    listCards,
    subListCards,
    selectedListId,
    selectedListName: selectedList
      ? `${normalizeListEmoji(selectedList.emoji)} ${selectedList.name}`
      : 'Wishlists',
    parentListName: parentList ? `${normalizeListEmoji(parentList.emoji)} ${parentList.name}` : null,
    onBack: goBack,
    onOpenList: openList,
    onRenameList: canManage
      ? (id: string) => {
          const list = lists.find((item) => item.id === id);
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
    products: visibleProducts,
    currency: stash.currency,
    totals,
    hasSale,
    emptyLists: canManage ? 'Create a wishlist to start tracking products and prices.' : 'No wishlists shared with you yet.',
    emptyItems: canManage ? 'Paste a product URL to add something to this list.' : 'Nothing on this wishlist yet.',
    addItemLabel: 'Add item',
    onAddList: canManage ? () => setAddList(true) : undefined,
    onAddSublist: canManage && selectedListId && !selectedList?.parentListId ? () => setAddSub(true) : undefined,
    onAddProduct: () => setAddProduct(true),
    onOpenProduct: (item: StashProduct) => setProductId(item.id),
    online: stash.online,
    canCheckPrices: checkableProducts.length > 0 && stash.online,
    checkingPrices,
    priceCheckProgress,
    priceCheckSummary,
    priceCheckAlerts,
    onCheckPrices: () => {
      void checkPrices();
    },
    onDismissPriceCheck: clearPriceCheck,
    onShareList: canManage
      ? () => {
          void shareList();
        }
      : undefined,
    shareBusy,
    shareStatus,
    onDismissShareStatus: () => setShareStatus(null),
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
        onSave={async (name, nextShare, nextIdentity) => {
          if (
            await run(() =>
              stash.createList(name, nextShare, {
                kind: 'wishlist',
                parentListId: addSub ? selectedListId : null,
                emoji: nextIdentity.emoji,
                theme: nextIdentity.theme,
              }),
            )
          ) {
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
            if (selectedListId === renameId) {
              const deleted = lists.find((list) => list.id === renameId);
              setSelectedListId(deleted?.parentListId ?? null);
            }
            setRenameId(null);
          }
        }}
      />
    </View>
  );
}
