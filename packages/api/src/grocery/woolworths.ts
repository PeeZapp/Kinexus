import { parsePackSize, parseUnitPrice, type CatalogueOffer } from '@kinexus/domain';

import { catalogueJson } from './catalogue.js';

const ORIGIN = 'https://www.woolworths.com.au';

type SearchResponse = {
  Products?: { Products?: WoolworthsProduct[] }[];
};

type WoolworthsProduct = {
  Stockcode?: number | string;
  DisplayName?: string;
  Name?: string;
  Brand?: string;
  Price?: number;
  InstorePrice?: number;
  IsAvailable?: boolean;
  IsInStock?: boolean;
  PackageSize?: string;
  CupString?: string;
  PricePerKGLabel?: string | null;
  Unit?: string;
  IncrementalPrice?: number;
  IncrementalMinimumQuantity?: number;
  IncrementalMinimumQuantityUnit?: string;
};

function incrementGrams(product: WoolworthsProduct): number | null {
  const qty = Number(product.IncrementalMinimumQuantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = product.IncrementalMinimumQuantityUnit?.toLowerCase();
  if (unit === 'g') return qty;
  if (unit === 'kg') return qty * 1000;
  return null;
}

export function woolworthsOffer(product: WoolworthsProduct): CatalogueOffer | null {
  const name = (product.DisplayName || product.Name || '').trim();
  const shelf = Number(product.InstorePrice ?? product.Price);
  if (!name || !product.Stockcode || !Number.isFinite(shelf) || shelf <= 0) return null;
  const pack = parsePackSize(`${product.PackageSize ?? ''} ${name}`);
  const unit = parseUnitPrice(product.CupString ?? '');
  const soldByWeight = (product.Unit ?? '').toUpperCase() === 'KG';
  const stepGrams = incrementGrams(product);
  const stepPrice = Number(product.IncrementalPrice);
  const soldInSteps = soldByWeight && stepGrams != null && Number.isFinite(stepPrice) && stepPrice > 0;
  const packGrams = soldInSteps ? stepGrams : pack.grams ?? (!soldByWeight && unit.perGram ? shelf / unit.perGram : null);
  const packMl = pack.ml ?? (unit.perMl ? shelf / unit.perMl : null);
  return {
    productId: String(product.Stockcode),
    name,
    brand: product.Brand?.trim() || null,
    shelfPrice: soldInSteps ? stepPrice : shelf,
    packGrams: packGrams && Number.isFinite(packGrams) ? Math.round(packGrams) : null,
    packMl: packMl && Number.isFinite(packMl) ? Math.round(packMl) : null,
    packCount: pack.count,
    perGram: unit.perGram,
    perMl: unit.perMl,
    perEach: unit.perEach,
    weighted: soldByWeight && !soldInSteps,
    inStock: product.IsAvailable !== false && product.IsInStock !== false,
  };
}

export async function searchWoolworthsProducts(query: string): Promise<CatalogueOffer[]> {
  const data = await catalogueJson<SearchResponse>(ORIGIN, `${ORIGIN}/apis/ui/Search/products`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      referer: `${ORIGIN}/shop/search/products?searchTerm=${encodeURIComponent(query)}`,
    },
    body: JSON.stringify({
      Filters: [],
      IsSpecial: false,
      Location: `/shop/search/products?searchTerm=${query}`,
      PageNumber: 1,
      PageSize: 24,
      SearchTerm: query,
      SortType: 'TraderRelevance',
      IsHideEverydayMarketProducts: true,
      ExcludeSearchTypes: ['UntraceableVendors'],
      GroupEdmVariants: false,
    }),
  });
  const offers: CatalogueOffer[] = [];
  for (const group of data.Products ?? []) {
    for (const product of group.Products ?? []) {
      const offer = woolworthsOffer(product);
      if (offer) offers.push(offer);
    }
  }
  return offers;
}
