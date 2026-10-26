import { useEffect, useMemo, useRef, useState } from 'react';

import {
  comparisonFromLineQuotes,
  formatMoney,
  lookupChainsForCountry,
  quotesWithPins,
  storedGroceryQuoteMatches,
  type GroceryComparison,
  type StoredGroceryQuote,
} from '@kinexus/domain';

import { compareGroceryPrices } from '@/src/lib/meals-api';

export type ShoppingItemPrice = {
  chainId: string;
  shop: string;
  priceLabel: string;
  product: string;
};

type PriceItem = {
  id: string;
  name: string;
  amount: string | null;
  quote: StoredGroceryQuote | null;
};

function itemSignature(item: { id: string; name: string; amount: string | null }): string {
  return `${item.id}\t${item.name}\t${item.amount ?? ''}`;
}

export function useGroceryPrices(input: {
  country: string | null | undefined;
  online: boolean;
  items: readonly PriceItem[];
  onSave: (rows: { id: string; quote: StoredGroceryQuote }[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const itemsRef = useRef(input.items);
  itemsRef.current = input.items;
  const saveRef = useRef(input.onSave);
  saveRef.current = input.onSave;
  const failedRef = useRef(new Set<string>());

  const chains = lookupChainsForCountry(input.country);
  const chainKey = chains.map((chain) => chain.id).join('|');
  const currency = chains[0]?.currency ?? 'AUD';

  const pending = input.items.filter((item) => {
    if (force) return true;
    if (storedGroceryQuoteMatches(item, item.quote)) return false;
    return !failedRef.current.has(itemSignature(item));
  });
  const pendingKey = pending.map(itemSignature).join('\n');
  const savedKey = input.items
    .filter((item) => storedGroceryQuoteMatches(item, item.quote))
    .map((item) => `${itemSignature(item)}\t${JSON.stringify(item.quote)}`)
    .join('\n');

  const comparison = useMemo(() => {
    const ready = input.items.filter((item) => storedGroceryQuoteMatches(item, item.quote) && item.quote);
    if (ready.length === 0) return null;
    return comparisonFromLineQuotes({
      currency,
      items: ready.map((item) => ({ id: item.id, quotes: item.quote?.quotes ?? [] })),
    });
    // savedKey changes only when a saved quote changes, which is when this result must update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, savedKey]);

  useEffect(() => {
    if (!input.online || chainKey.length === 0 || pendingKey.length === 0) {
      setBusy(false);
      return;
    }
    let cancel = false;
    setBusy(true);
    const fresh = force;
    const timer = setTimeout(() => {
      const targets = itemsRef.current.filter((item) => {
        if (fresh) return true;
        if (storedGroceryQuoteMatches(item, item.quote)) return false;
        return !failedRef.current.has(itemSignature(item));
      });
      if (targets.length === 0) {
        if (!cancel) setBusy(false);
        return;
      }
      void compareGroceryPrices({
        country: input.country ?? null,
        fresh,
        items: targets.map((item) => ({
          id: item.id,
          name: item.name,
          amount: item.amount,
          pins: storedGroceryQuoteMatches(item, item.quote) ? item.quote?.pins : undefined,
        })),
      })
        .then(async (result) => {
          if (cancel) return;
          const latest = itemsRef.current;
          const rows = targets.map((item) => {
            const current = latest.find((row) => row.id === item.id) ?? item;
            const pins = storedGroceryQuoteMatches(current, current.quote) ? current.quote?.pins : undefined;
            const fresh = result.comparison.items.find((row) => row.itemId === item.id)?.quotes ?? [];
            return {
              id: item.id,
              quote: {
                name: item.name,
                amount: item.amount,
                quotes: quotesWithPins(fresh, current.quote?.quotes ?? [], pins),
                pins: pins && pins.length > 0 ? pins : undefined,
              },
            };
          });
          await saveRef.current(rows);
          if (cancel) return;
          for (const item of targets) failedRef.current.delete(itemSignature(item));
          setWarning(result.warnings[0]?.message ?? null);
          setError(null);
          if (fresh) setForce(false);
        })
        .catch((err: unknown) => {
          if (cancel) return;
          for (const item of targets) failedRef.current.add(itemSignature(item));
          const message = err instanceof Error ? err.message : 'Could not check prices.';
          setError(message.includes('grocery_quote') ? 'Saving prices needs the latest database migration.' : message);
          if (fresh) setForce(false);
        })
        .finally(() => {
          if (!cancel) setBusy(false);
        });
    }, 400);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [chainKey, force, input.country, input.online, pendingKey]);

  const itemPrices = useMemo(() => {
    const map: Record<string, ShoppingItemPrice[]> = {};
    if (!comparison) return map;
    for (const item of comparison.items) {
      if (item.quotes.length === 0) continue;
      map[item.itemId] = item.quotes.map((quote) => ({
        chainId: quote.chainId,
        shop: quote.chainName,
        priceLabel: formatMoney(quote.price, comparison.currency),
        product: quote.packs > 1 ? `${quote.packs} × ${quote.productName}` : quote.productName,
      }));
    }
    return map;
  }, [comparison]);

  return {
    comparison,
    busy,
    error,
    warning,
    itemPrices,
    recheck: () => setForce(true),
  };
}
