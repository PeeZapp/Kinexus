import { groceryChainById } from './grocery-chains';
import { storedGroceryQuoteMatches, type StoredGroceryQuote } from './grocery-compare';

export type TrolleyLine = {
  itemId: string;
  name: string;
  amount: string | null;
  chainId: string;
  productId: string;
  productName: string;
  packs: number;
};

export type TrolleySkip = {
  itemId: string;
  name: string;
};

export type TrolleyOrder = {
  chainId: string;
  chainName: string;
  lines: TrolleyLine[];
  skipped: TrolleySkip[];
};

type OrderItem = {
  id: string;
  name: string;
  amount?: string | null;
  checked?: boolean;
  quote?: StoredGroceryQuote | null;
};

/** Unchecked rows that already have a catalogue product for this shop. */
export function trolleyOrder(items: readonly OrderItem[], chainId: string): TrolleyOrder | null {
  const chain = groceryChainById(chainId);
  if (!chain?.lookup) return null;
  const lines: TrolleyLine[] = [];
  const skipped: TrolleySkip[] = [];
  for (const item of items) {
    if (item.checked) continue;
    const quote = item.quote && storedGroceryQuoteMatches(item, item.quote) ? item.quote : null;
    const picked = quote?.quotes.find((row) => row.chainId === chain.id && row.productId && row.packs > 0);
    if (!picked) {
      skipped.push({ itemId: item.id, name: item.name });
      continue;
    }
    lines.push({
      itemId: item.id,
      name: item.name,
      amount: item.amount ?? null,
      chainId: chain.id,
      productId: picked.productId,
      productName: picked.productName,
      packs: picked.packs,
    });
  }
  return { chainId: chain.id, chainName: chain.name, lines, skipped };
}

/** Opens the shop with a handoff the browser helper can read. The hash stays in the browser. */
export function trolleyShopUrl(chainId: string, token: string, apiOrigin: string): string {
  const page = chainId === 'coles' ? 'https://www.coles.com.au/checkout' : 'https://www.woolworths.com.au/shop/cart';
  const hash = new URLSearchParams({
    kinexus_handoff: token,
    kinexus_api: apiOrigin.replace(/\/$/, ''),
  });
  return `${page}#${hash.toString()}`;
}
