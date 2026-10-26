import {
  catalogueChoices,
  catalogueQuery,
  compareShoppingList,
  lookupChainsForCountry,
  type CatalogueChoice,
  type CatalogueOffer,
  type GroceryComparison,
  type GroceryProductPin,
  type GroceryShopOffers,
} from '@kinexus/domain';

import { searchColesProducts } from './coles.js';
import { searchWoolworthsProducts } from './woolworths.js';

const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_ITEMS = 40;

type CacheEntry = { at: number; ttl: number; offers: CatalogueOffer[] };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CatalogueOffer[]>>();

export type GroceryCompareRequest = {
  country?: unknown;
  items?: unknown;
  fresh?: unknown;
};

export type GroceryCatalogRequest = {
  country?: unknown;
  name?: unknown;
  amount?: unknown;
  query?: unknown;
};

export type GroceryCatalogChain = {
  chainId: string;
  chainName: string;
  choices: CatalogueChoice[];
  unavailable?: boolean;
};

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parsePins(value: unknown): GroceryProductPin[] {
  if (!Array.isArray(value)) return [];
  const pins: GroceryProductPin[] = [];
  for (const row of value.slice(0, 6)) {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const chainId = asText(rec.chainId, 40);
    const productId = asText(rec.productId, 80);
    if (!chainId || !productId) continue;
    pins.push({ chainId, productId });
  }
  return pins;
}

function parseCompareInput(body: GroceryCompareRequest): {
  country: string;
  items: { id: string; name: string; amount: string | null; pins: GroceryProductPin[] }[];
} | null {
  if (!Array.isArray(body.items)) return null;
  const country = asText(body.country, 2).toUpperCase();
  const items: { id: string; name: string; amount: string | null; pins: GroceryProductPin[] }[] = [];
  for (const row of body.items.slice(0, MAX_ITEMS)) {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const id = asText(rec.id, 80);
    const name = asText(rec.name, 80);
    const amount = asText(rec.amount, 40);
    if (!id || !name) continue;
    items.push({ id, name, amount: amount || null, pins: parsePins(rec.pins) });
  }
  if (items.length === 0) return null;
  return { country, items };
}

async function searchChain(chainId: string, query: string): Promise<CatalogueOffer[]> {
  if (chainId === 'coles') return searchColesProducts(query);
  if (chainId === 'woolworths') return searchWoolworthsProducts(query);
  return [];
}

async function productsFor(chainId: string, query: string, fresh: boolean): Promise<CatalogueOffer[]> {
  const key = `${chainId}|${query}`;
  const cached = cache.get(key);
  if (!fresh && cached && Date.now() - cached.at < cached.ttl) return cached.offers;
  const running = inflight.get(key);
  if (running) return running;
  const loading = (async () => {
    const offers = await searchChain(chainId, query);
    cache.set(key, { at: Date.now(), ttl: CACHE_MS, offers });
    return offers;
  })().finally(() => inflight.delete(key));
  inflight.set(key, loading);
  return loading;
}

async function mapPool<T, R>(rows: readonly T[], limit: number, run: (row: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(rows.length);
  let next = 0;
  async function worker() {
    while (next < rows.length) {
      const index = next;
      next += 1;
      const row = rows[index];
      if (row === undefined) return;
      out[index] = await run(row);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, () => worker()));
  return out;
}

export async function compareGroceryList(body: GroceryCompareRequest): Promise<
  | { ok: true; comparison: GroceryComparison; warnings: { chainId: string; message: string }[] }
  | { ok: false; error: string }
> {
  const parsed = parseCompareInput(body);
  if (!parsed) return { ok: false, error: 'Add at least one item to compare.' };
  const fresh = body.fresh === true;

  const warnings: { chainId: string; message: string }[] = [];
  const shops: GroceryShopOffers[] = [];
  const chains = lookupChainsForCountry(parsed.country);

  for (const chain of chains) {
    const queries = new Map<string, string[]>();
    for (const item of parsed.items) {
      const query = catalogueQuery(item.name);
      if (!query) continue;
      const ids = queries.get(query) ?? [];
      ids.push(item.id);
      queries.set(query, ids);
    }
    const offersByItemId: Record<string, CatalogueOffer[]> = {};
    let failed = false;
    const entries = [...queries.entries()];
    await mapPool(entries, 4, async ([query, ids]) => {
      try {
        const offers = await productsFor(chain.id, query, fresh);
        for (const id of ids) offersByItemId[id] = offers;
      } catch {
        failed = true;
      }
    });
    if (failed) warnings.push({ chainId: chain.id, message: `${chain.name} prices are unavailable right now.` });
    shops.push({
      chainId: chain.id,
      chainName: chain.name,
      storeId: chain.id,
      storeName: chain.name,
      offersByItemId,
    });
  }

  const currency = chains[0]?.currency ?? 'AUD';
  return {
    ok: true,
    warnings,
    comparison: compareShoppingList({ currency, items: parsed.items, shops }),
  };
}

export async function searchGroceryCatalog(body: GroceryCatalogRequest): Promise<
  | { ok: true; query: string; chains: GroceryCatalogChain[] }
  | { ok: false; error: string }
> {
  const name = asText(body.name, 80);
  const amount = asText(body.amount, 40) || null;
  const query = asText(body.query, 60) || catalogueQuery(name);
  if (!name || !query) return { ok: false, error: 'Name a product to search for.' };
  const country = asText(body.country, 2).toUpperCase();
  const chains = lookupChainsForCountry(country);
  const results = await Promise.all(
    chains.map(async (chain) => {
      try {
        const offers = await productsFor(chain.id, query, false);
        return { chainId: chain.id, chainName: chain.name, choices: catalogueChoices(name, amount, offers) };
      } catch {
        return { chainId: chain.id, chainName: chain.name, choices: [] as CatalogueChoice[], unavailable: true };
      }
    }),
  );
  return { ok: true, query, chains: results };
}
