import { parsePackSize, parseUnitPrice, type CatalogueOffer } from '@kinexus/domain';

import { catalogueJson } from './catalogue.js';

const ORIGIN = 'https://www.coles.com.au';
/** Public storefront key the Coles website sends with catalogue requests. */
const SUBSCRIPTION_KEY = 'eae83861d1cd4de6bb9cd8a2cd6f041e';
/** Coles' default online catalogue. Product search requires a store id; this is the national online one. */
const ONLINE_STORE_ID = '7674';

type ColesSearch = {
  results?: ColesProduct[];
};

type ColesProduct = {
  _type?: string;
  id?: number | string;
  name?: string;
  brand?: string;
  size?: string;
  availability?: boolean;
  pricing?: {
    now?: number;
    comparable?: string;
    unit?: { isWeighted?: boolean; price?: number };
  };
};

function headers(): Record<string, string> {
  return {
    referer: ORIGIN + '/',
    origin: ORIGIN,
    'ocp-apim-subscription-key': SUBSCRIPTION_KEY,
  };
}

export function colesOffer(product: ColesProduct): CatalogueOffer | null {
  if (product._type && product._type !== 'PRODUCT') return null;
  const name = product.name?.trim() ?? '';
  const shelf = Number(product.pricing?.now);
  if (!name || !Number.isFinite(shelf) || shelf <= 0) return null;
  const pack = parsePackSize(`${product.size ?? ''} ${name}`);
  const unit = parseUnitPrice(product.pricing?.comparable ?? '');
  return {
    productId: String(product.id ?? name),
    name,
    brand: product.brand?.trim() || null,
    shelfPrice: shelf,
    packGrams: pack.grams,
    packMl: pack.ml,
    packCount: pack.count,
    perGram: unit.perGram,
    perMl: unit.perMl,
    perEach: unit.perEach,
    weighted: product.pricing?.unit?.isWeighted === true,
    inStock: product.availability !== false,
  };
}

export async function searchColesProducts(query: string): Promise<CatalogueOffer[]> {
  const params = new URLSearchParams({
    storeId: ONLINE_STORE_ID,
    searchTerm: query,
    start: '0',
    limit: '24',
  });
  const data = await catalogueJson<ColesSearch>(ORIGIN, `${ORIGIN}/api/bff/products/search?${params}`, {
    headers: headers(),
  });
  const offers: CatalogueOffer[] = [];
  for (const product of data.results ?? []) {
    const offer = colesOffer(product);
    if (offer) offers.push(offer);
  }
  return offers;
}
