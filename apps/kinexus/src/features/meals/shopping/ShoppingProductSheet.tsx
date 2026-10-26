import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  applyCataloguePick,
  catalogueQuery,
  formatMoney,
  lookupChainsForCountry,
  type CatalogueChoice,
  type GroceryLineQuote,
  type StoredGroceryQuote,
} from '@kinexus/domain';

import { ErrorText, Field } from '@/src/features/household/ui';
import type { ShoppingListItem } from '@/src/features/meals/mappers';
import { Sheet } from '@/src/features/meals/meals-kit';
import { searchGroceryCatalog } from '@/src/lib/meals-api';
import { colors, radius } from '@/src/features/shell/theme';

type CatalogChain = {
  chainId: string;
  chainName: string;
  choices: CatalogueChoice[];
  unavailable?: boolean;
};

export function ShoppingProductSheet({
  item,
  country,
  onClose,
  onSave,
}: {
  item: ShoppingListItem | null;
  country: string | null | undefined;
  onClose: () => void;
  onSave: (id: string, quote: StoredGroceryQuote) => Promise<void>;
}) {
  if (!item) return <Sheet visible={false} title="Product" onClose={onClose}>{null}</Sheet>;
  return <OpenCatalog key={item.id} item={item} country={country} onClose={onClose} onSave={onSave} />;
}

function OpenCatalog({
  item,
  country,
  onClose,
  onSave,
}: {
  item: ShoppingListItem;
  country: string | null | undefined;
  onClose: () => void;
  onSave: (id: string, quote: StoredGroceryQuote) => Promise<void>;
}) {
  const [search, setSearch] = useState(catalogueQuery(item.name) || item.name);
  return (
    <Sheet
      visible
      title={item.name}
      onClose={onClose}
      wide
      header={<Field label="Search" value={search} onChangeText={setSearch} placeholder={item.name} autoCapitalize="none" />}>
      <ProductSearch item={item} country={country} search={search} onSave={onSave} />
    </Sheet>
  );
}

function ProductSearch({
  item,
  country,
  search,
  onSave,
}: {
  item: ShoppingListItem;
  country: string | null | undefined;
  search: string;
  onSave: (id: string, quote: StoredGroceryQuote) => Promise<void>;
}) {
  const [chains, setChains] = useState<CatalogChain[]>([]);
  const [busy, setBusy] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currency = lookupChainsForCountry(country)[0]?.currency ?? 'AUD';

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setChains([]);
      setBusy(false);
      return;
    }
    let cancel = false;
    setBusy(true);
    setChains([]);
    const timer = setTimeout(() => {
      void searchGroceryCatalog({
        country: country ?? null,
        name: item.name,
        amount: item.amount,
        query,
      })
        .then((result) => {
          if (cancel) return;
          setChains(result.chains);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancel) return;
          setChains([]);
          setError(err instanceof Error ? err.message : 'Could not search the catalogues.');
        })
        .finally(() => {
          if (!cancel) setBusy(false);
        });
    }, 300);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [country, item.amount, item.name, search]);

  function selectedId(chainId: string): string | null {
    const pin = item.groceryQuote?.pins?.find((row) => row.chainId === chainId);
    if (pin) return pin.productId;
    return item.groceryQuote?.quotes.find((row) => row.chainId === chainId)?.productId ?? null;
  }

  function choose(chain: CatalogChain, choice: CatalogueChoice) {
    if (savingKey) return;
    if (selectedId(chain.chainId) === choice.productId) return;
    const key = `${chain.chainId}:${choice.productId}`;
    const picked: GroceryLineQuote = {
      chainId: chain.chainId,
      chainName: chain.chainName,
      storeId: chain.chainId,
      storeName: chain.chainName,
      productId: choice.productId,
      productName: choice.productName,
      price: choice.price,
      packs: choice.packs,
    };
    setSavingKey(key);
    setError(null);
    const next = applyCataloguePick(item.groceryQuote, item, picked);
    void onSave(item.id, next)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not save that product.');
      })
      .finally(() => setSavingKey(null));
  }

  function rowsFor(chain: CatalogChain): CatalogueChoice[] {
    const current = item.groceryQuote?.quotes.find((row) => row.chainId === chain.chainId);
    if (!current || chain.choices.some((choice) => choice.productId === current.productId)) return chain.choices;
    return [
      ...chain.choices,
      {
        productId: current.productId,
        productName: current.productName,
        brand: null,
        price: current.price,
        packs: current.packs,
        shelfPrice: current.price,
        matches: false,
      },
    ];
  }

  const shown = chains.map((chain) => ({ chain, choices: rowsFor(chain) }));
  const empty =
    !busy &&
    search.trim().length > 0 &&
    shown.every((row) => row.choices.length === 0 && !row.chain.unavailable);

  return (
    <View style={styles.body}>
      <ErrorText message={error} />
      {busy ? <Text style={styles.status}>Checking Coles and Woolworths…</Text> : null}
      {empty ? <Text style={styles.status}>No products for that search.</Text> : null}
      {shown.map(({ chain, choices }) =>
        choices.length === 0 && !chain.unavailable ? null : (
          <View key={chain.chainId} style={styles.chain}>
            <Text style={styles.chainTitle}>{chain.chainName}</Text>
            {chain.unavailable ? <Text style={styles.status}>Unavailable right now.</Text> : null}
            {choices.map((choice) => {
              const selected = selectedId(chain.chainId) === choice.productId;
              const key = `${chain.chainId}:${choice.productId}`;
              return (
                <Pressable
                  key={choice.productId}
                  onPress={() => choose(chain, choice)}
                  disabled={savingKey != null}
                  style={[styles.choice, selected && styles.choiceOn]}>
                  <Text style={[styles.choiceName, !choice.matches && !selected && styles.choiceMuted]} numberOfLines={2}>
                    {choice.packs > 1 ? `${choice.packs} × ` : ''}
                    {choice.productName}
                  </Text>
                  <Text style={styles.choicePrice}>
                    {savingKey === key ? 'Saving…' : formatMoney(choice.price, currency)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingTop: 4 },
  status: { color: colors.textMuted, fontSize: 13 },
  chain: { gap: 6 },
  chainTitle: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  choiceName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  choiceMuted: { color: colors.textMuted, fontWeight: '500' },
  choicePrice: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
