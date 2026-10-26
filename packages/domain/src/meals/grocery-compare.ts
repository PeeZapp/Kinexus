import { parseAmount } from './amounts';
import { shoppingMergeKey } from './ingredient-merge';

/** One sellable product returned by a supermarket catalogue. */
export type CatalogueOffer = {
  productId: string;
  name: string;
  brand: string | null;
  shelfPrice: number;
  packGrams: number | null;
  packMl: number | null;
  packCount: number | null;
  perGram: number | null;
  perMl: number | null;
  perEach: number | null;
  /** Priced by weight at the counter, so the line cost follows the amount needed. */
  weighted: boolean;
  inStock: boolean;
};

export type GroceryLineQuote = {
  chainId: string;
  chainName: string;
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  /** What you pay to cover the list amount. */
  price: number;
  packs: number;
};

export type GroceryShopTotal = {
  chainId: string;
  chainName: string;
  storeId: string;
  storeName: string;
  total: number;
  currency: string;
  pricedCount: number;
  itemCount: number;
};

export type GroceryItemComparison = {
  itemId: string;
  quotes: GroceryLineQuote[];
  cheapestChainId: string | null;
};

export type GroceryComparison = {
  currency: string;
  items: GroceryItemComparison[];
  shops: GroceryShopTotal[];
  /** Fullest basket, then the lower total. */
  cheapestShop: GroceryShopTotal | null;
};

export type GroceryShopOffers = {
  chainId: string;
  chainName: string;
  storeId: string;
  storeName: string;
  offersByItemId: Readonly<Record<string, readonly CatalogueOffer[]>>;
};

const VARIETY_PHRASES = [
  'green onion',
  'spring onion',
  'salad onion',
  'red onion',
  'brown onion',
  'white onion',
  'yellow onion',
  'spanish onion',
  'cherry tomato',
  'roma tomato',
  'grape tomato',
  'green apple',
  'red apple',
  'granny smith',
  'pink lady',
  'red wine',
  'white wine',
].sort((a, b) => b.length - a.length);

const CONFLICTS = new Set([
  'sauce',
  'paste',
  'powder',
  'seasoning',
  'stock',
  'soup',
  'chips',
  'crisps',
  'juice',
  'flavoured',
  'flavored',
  'marinated',
  'crumbed',
  'schnitzel',
  'dried',
  'pie',
  'pizza',
  'noodle',
  'noodles',
  'kit',
  'spread',
  'dip',
  'chocolate',
  'biscuit',
  'cookie',
  'muffin',
  'cake',
  'yoghurt',
  'yogurt',
  'cheese',
  'almond',
  'oat',
  'soy',
  'coconut',
  'shallot',
  'shallots',
  'nugget',
  'nuggets',
  'kiev',
  'kyiv',
  'goujon',
  'popcorn',
  'karaage',
  'parmigiana',
  'parmi',
  'cordon',
  'patty',
  'meatball',
  'tender',
  'dinosaur',
  'bite',
  'sausage',
  'rissole',
  'kebab',
  'skewer',
  'burger',
  'spray',
  'mayonnaise',
  'mayo',
  'dressing',
  'canned',
  'tinned',
]);

const STOP = new Set(['of', 'and', 'the', 'fresh', 'loose', 'approx', 'each', 'pack', 'per']);

export function catalogueQuery(name: string): string {
  const key = shoppingMergeKey(name);
  const cleaned = (key || name).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 60);
}

export function parsePackSize(text: string): { grams: number | null; ml: number | null; count: number | null } {
  const raw = text.toLowerCase().replace(/,/g, '');
  const empty = { grams: null, ml: null, count: null };
  const multi = raw.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (multi) {
    const total = Number(multi[1]) * Number(multi[2]);
    return measure(total, multi[3] ?? '');
  }
  const single = raw.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (single) return measure(Number(single[1]), single[2] ?? '');
  const pack = raw.match(/(\d+)\s*(?:pack|pk|ct)\b/);
  if (pack) return { grams: null, ml: null, count: Number(pack[1]) };
  if (/\beach\b/.test(raw)) return { grams: null, ml: null, count: 1 };
  return empty;
}

export function parseUnitPrice(text: string): { perGram: number | null; perMl: number | null; perEach: number | null } {
  const empty = { perGram: null, perMl: null, perEach: null };
  const match = text
    .toLowerCase()
    .match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:\/|per)\s*(\d+(?:\.\d+)?)?\s*(kg|g|ml|l|ea|each)\b/);
  if (!match) return empty;
  const price = Number(match[1]);
  const qty = match[2] ? Number(match[2]) : 1;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0) return empty;
  const unit = match[3];
  if (unit === 'kg') return { perGram: price / (qty * 1000), perMl: null, perEach: null };
  if (unit === 'g') return { perGram: price / qty, perMl: null, perEach: null };
  if (unit === 'l') return { perGram: null, perMl: price / (qty * 1000), perEach: null };
  if (unit === 'ml') return { perGram: null, perMl: price / qty, perEach: null };
  return { perGram: null, perMl: null, perEach: price / qty };
}

function measure(total: number, unit: string): { grams: number | null; ml: number | null; count: number | null } {
  if (!Number.isFinite(total) || total <= 0) return { grams: null, ml: null, count: null };
  if (unit === 'kg') return { grams: total * 1000, ml: null, count: null };
  if (unit === 'g') return { grams: total, ml: null, count: null };
  if (unit === 'l') return { grams: null, ml: total * 1000, count: null };
  if (unit === 'ml') return { grams: null, ml: total, count: null };
  return { grams: null, ml: null, count: null };
}

function singular(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('sses')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1);
  return token;
}

function softenPlurals(value: string): string {
  return value.replace(/\b[a-z]{4,}s\b/g, (word) => singular(word));
}

function tokens(value: string): string[] {
  return softenPlurals(value.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(singular)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

function phraseIn(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(haystack);
}

/** True when the product is the ingredient, not a sauce, variety, or ready meal. */
export function offerMatchesIngredient(ingredientName: string, productName: string): boolean {
  const query = softenPlurals(catalogueQuery(ingredientName));
  const product = softenPlurals(productName.toLowerCase().replace(/\s+/g, ' ').trim());
  if (!query || !product) return false;
  for (const phrase of VARIETY_PHRASES) {
    const inQuery = phraseIn(query, phrase);
    const inProduct = phraseIn(product, phrase);
    if (inQuery !== inProduct) return false;
  }
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return false;
  const productTokens = tokens(product);
  const productSet = new Set(productTokens);
  if (!queryTokens.every((token) => productSet.has(token))) return false;
  for (const token of productTokens) {
    if ((CONFLICTS.has(token) || CONFLICTS.has(`${token}s`)) && !queryTokens.includes(token)) return false;
  }
  return true;
}

type Need = { grams?: number; ml?: number; count?: number };

function needFor(name: string, amount: string | null | undefined): Need | null {
  const parsed = parseAmount(amount?.trim() || undefined);
  if (!parsed || parsed.value <= 0) return null;
  const unit = parsed.unit;
  if (unit === 'g' || unit === 'kg') return { grams: unit === 'kg' ? parsed.value * 1000 : parsed.value };
  if (unit === 'ml' || unit === 'l') return { ml: unit === 'l' ? parsed.value * 1000 : parsed.value };
  if (unit === 'tsp') return { ml: parsed.value * 5 };
  if (unit === 'tbsp') return { ml: parsed.value * 15 };
  if (unit === 'cup') return { ml: parsed.value * 240 };
  if (unit === 'clove' && catalogueQuery(name) === 'garlic') return { grams: parsed.value * 4 };
  return { count: parsed.value };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function lineCost(offer: CatalogueOffer, need: Need | null): { price: number; packs: number } | null {
  if (!offer.inStock || offer.shelfPrice <= 0) return null;
  if (offer.weighted && need?.grams && offer.perGram && offer.perGram > 0) {
    return { price: roundMoney(need.grams * offer.perGram), packs: 1 };
  }
  if (offer.weighted && need?.ml && offer.perMl && offer.perMl > 0) {
    return { price: roundMoney(need.ml * offer.perMl), packs: 1 };
  }
  const packs = packsToCover(offer, need);
  if (packs == null) return { price: roundMoney(offer.shelfPrice), packs: 1 };
  if (packs > 24) return null;
  return { price: roundMoney(packs * offer.shelfPrice), packs };
}

function packsToCover(offer: CatalogueOffer, need: Need | null): number | null {
  if (!need) return null;
  if (need.grams && offer.packGrams && offer.packGrams > 0) return Math.ceil(need.grams / offer.packGrams);
  if (need.ml && offer.packMl && offer.packMl > 0) return Math.ceil(need.ml / offer.packMl);
  if (need.count && offer.packCount && offer.packCount > 0) return Math.ceil(need.count / offer.packCount);
  if (need.count && !offer.packGrams && !offer.packMl && !offer.packCount) return Math.ceil(need.count);
  return null;
}

function oversized(offer: CatalogueOffer): boolean {
  if (offer.packGrams != null && offer.packGrams > 1500) return true;
  if (offer.packMl != null && offer.packMl > 2000) return true;
  if (offer.packCount != null && offer.packCount > 8) return true;
  return false;
}

export type CatalogueChoice = {
  productId: string;
  productName: string;
  brand: string | null;
  /** What you pay to cover the list amount. */
  price: number;
  packs: number;
  shelfPrice: number;
  /** True when the name looks like the ingredient rather than a ready meal. */
  matches: boolean;
};

/** Every in-stock search hit, with ingredient matches before other products. */
export function catalogueChoices(
  ingredientName: string,
  amount: string | null | undefined,
  offers: readonly CatalogueOffer[],
): CatalogueChoice[] {
  const need = needFor(ingredientName, amount);
  const seen = new Set<string>();
  const rows: CatalogueChoice[] = [];
  for (const offer of offers) {
    if (seen.has(offer.productId)) continue;
    const cost = lineCost(offer, need);
    if (!cost) continue;
    seen.add(offer.productId);
    rows.push({
      productId: offer.productId,
      productName: offer.name,
      brand: offer.brand,
      price: cost.price,
      packs: cost.packs,
      shelfPrice: offer.shelfPrice,
      matches: offerMatchesIngredient(ingredientName, offer.name),
    });
  }
  rows.sort(
    (a, b) =>
      Number(b.matches) - Number(a.matches) || a.price - b.price || a.productName.localeCompare(b.productName),
  );
  return rows;
}

export function pickCatalogueOffer(
  ingredientName: string,
  amount: string | null | undefined,
  offers: readonly CatalogueOffer[],
  preferredProductId?: string | null,
): { offer: CatalogueOffer; price: number; packs: number } | null {
  const need = needFor(ingredientName, amount);
  if (preferredProductId) {
    const chosen = offers.find((offer) => offer.productId === preferredProductId);
    if (chosen) {
      const cost = lineCost(chosen, need);
      if (cost && cost.price > 0) return { offer: chosen, ...cost };
    }
  }
  const matching = offers.filter((offer) => offer.inStock && offerMatchesIngredient(ingredientName, offer.name));
  if (matching.length === 0) return null;
  const pool = !need && matching.some((offer) => !oversized(offer))
    ? matching.filter((offer) => !oversized(offer))
    : matching;
  let best: { offer: CatalogueOffer; price: number; packs: number } | null = null;
  for (const offer of pool) {
    const cost = lineCost(offer, need);
    if (!cost || cost.price <= 0) continue;
    if (!best || cost.price < best.price || (cost.price === best.price && offer.shelfPrice < best.offer.shelfPrice)) {
      best = { offer, ...cost };
    }
  }
  return best;
}

/** Price saved on a shopping row. Valid only for the name and amount it was looked up with. */
export type GroceryProductPin = {
  chainId: string;
  productId: string;
};

export type StoredGroceryQuote = {
  name: string;
  amount: string | null;
  quotes: GroceryLineQuote[];
  /** Product the household chose for a chain. Kept across price re-checks. */
  pins?: GroceryProductPin[];
};

/** Replace one chain's product and remember that choice. */
export function applyCataloguePick(
  quote: StoredGroceryQuote | null | undefined,
  item: { name: string; amount?: string | null },
  picked: GroceryLineQuote,
): StoredGroceryQuote {
  const current = quote && storedGroceryQuoteMatches(item, quote) ? quote : null;
  const quotes = (current?.quotes ?? []).filter((row) => row.chainId !== picked.chainId);
  quotes.push(picked);
  const pins = (current?.pins ?? []).filter((pin) => pin.chainId !== picked.chainId);
  pins.push({ chainId: picked.chainId, productId: picked.productId });
  return { name: item.name, amount: item.amount ?? null, quotes, pins };
}

/**
 * A re-check should refresh prices, but a pinned product stays even when the
 * new search would have auto-picked something else.
 */
export function quotesWithPins(
  fresh: readonly GroceryLineQuote[],
  previous: readonly GroceryLineQuote[],
  pins: readonly GroceryProductPin[] | null | undefined,
): GroceryLineQuote[] {
  if (!pins || pins.length === 0) return [...fresh];
  const merged = [...fresh];
  for (const pin of pins) {
    if (merged.some((row) => row.chainId === pin.chainId && row.productId === pin.productId)) continue;
    const kept = previous.find((row) => row.chainId === pin.chainId && row.productId === pin.productId);
    if (!kept) continue;
    const index = merged.findIndex((row) => row.chainId === pin.chainId);
    if (index >= 0) merged[index] = kept;
    else merged.push(kept);
  }
  return merged;
}

export function storedGroceryQuoteMatches(
  item: { name: string; amount?: string | null },
  quote: StoredGroceryQuote | null | undefined,
): boolean {
  if (!quote || quote.name !== item.name) return false;
  return (quote.amount ?? null) === (item.amount ?? null);
}

export function comparisonFromLineQuotes(input: {
  currency: string;
  items: readonly { id: string; quotes: readonly GroceryLineQuote[] }[];
}): GroceryComparison {
  const items: GroceryItemComparison[] = input.items.map((item) => {
    const quotes = [...item.quotes].sort((a, b) => a.price - b.price || a.chainName.localeCompare(b.chainName));
    return { itemId: item.id, quotes, cheapestChainId: quotes[0]?.chainId ?? null };
  });

  const seen = new Map<string, GroceryLineQuote>();
  for (const item of items) {
    for (const quote of item.quotes) seen.set(`${quote.chainId}|${quote.storeId}`, quote);
  }

  const shops: GroceryShopTotal[] = [...seen.values()].map((shop) => {
    let total = 0;
    let pricedCount = 0;
    for (const item of items) {
      const quote = item.quotes.find((row) => row.chainId === shop.chainId && row.storeId === shop.storeId);
      if (!quote) continue;
      total += quote.price;
      pricedCount += 1;
    }
    return {
      chainId: shop.chainId,
      chainName: shop.chainName,
      storeId: shop.storeId,
      storeName: shop.storeName,
      total: roundMoney(total),
      currency: input.currency,
      pricedCount,
      itemCount: input.items.length,
    };
  });

  const coverage = Math.max(0, ...shops.map((shop) => shop.pricedCount));
  const fullest = shops.filter((shop) => shop.pricedCount === coverage && coverage > 0);
  fullest.sort((a, b) => a.total - b.total || a.chainName.localeCompare(b.chainName));

  return {
    currency: input.currency,
    items,
    shops,
    cheapestShop: fullest[0] ?? null,
  };
}

export function compareShoppingList(input: {
  currency: string;
  items: readonly {
    id: string;
    name: string;
    amount?: string | null;
    pins?: readonly GroceryProductPin[] | null;
  }[];
  shops: readonly GroceryShopOffers[];
}): GroceryComparison {
  return comparisonFromLineQuotes({
    currency: input.currency,
    items: input.items.map((item) => {
      const quotes: GroceryLineQuote[] = [];
      for (const shop of input.shops) {
        const preferred = item.pins?.find((pin) => pin.chainId === shop.chainId)?.productId;
        const picked = pickCatalogueOffer(item.name, item.amount, shop.offersByItemId[item.id] ?? [], preferred);
        if (!picked) continue;
        quotes.push({
          chainId: shop.chainId,
          chainName: shop.chainName,
          storeId: shop.storeId,
          storeName: shop.storeName,
          productId: picked.offer.productId,
          productName: picked.offer.name,
          price: picked.price,
          packs: picked.packs,
        });
      }
      return { id: item.id, quotes };
    }),
  });
}
