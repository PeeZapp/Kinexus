import { normalizeCountryCode } from './markets';

/** A supermarket catalogue the shopping list can price against. */
export type GroceryChain = {
  id: string;
  name: string;
  country: string;
  currency: string;
  /** True when a catalogue adapter is implemented. */
  lookup: boolean;
};

/**
 * Online catalogues the shopping list can price against.
 * Flip `lookup` on and add an adapter in `packages/api/src/grocery` to enable a country.
 */
export const GROCERY_CHAINS: readonly GroceryChain[] = [
  { id: 'coles', name: 'Coles', country: 'AU', currency: 'AUD', lookup: true },
  { id: 'woolworths', name: 'Woolworths', country: 'AU', currency: 'AUD', lookup: true },
  { id: 'countdown', name: 'Countdown', country: 'NZ', currency: 'NZD', lookup: false },
  { id: 'paknsave', name: "Pak'nSave", country: 'NZ', currency: 'NZD', lookup: false },
  { id: 'tesco', name: 'Tesco', country: 'GB', currency: 'GBP', lookup: false },
  { id: 'sainsburys', name: "Sainsbury's", country: 'GB', currency: 'GBP', lookup: false },
  { id: 'tesco-ie', name: 'Tesco', country: 'IE', currency: 'EUR', lookup: false },
  { id: 'supervalu', name: 'SuperValu', country: 'IE', currency: 'EUR', lookup: false },
  { id: 'walmart', name: 'Walmart', country: 'US', currency: 'USD', lookup: false },
  { id: 'kroger', name: 'Kroger', country: 'US', currency: 'USD', lookup: false },
  { id: 'loblaws', name: 'Loblaws', country: 'CA', currency: 'CAD', lookup: false },
  { id: 'walmart-ca', name: 'Walmart', country: 'CA', currency: 'CAD', lookup: false },
  { id: 'fairprice', name: 'NTUC FairPrice', country: 'SG', currency: 'SGD', lookup: false },
  { id: 'cold-storage', name: 'Cold Storage', country: 'SG', currency: 'SGD', lookup: false },
  { id: 'checkers', name: 'Checkers', country: 'ZA', currency: 'ZAR', lookup: false },
  { id: 'woolworths-food', name: 'Woolworths Food', country: 'ZA', currency: 'ZAR', lookup: false },
];

const BY_ID = new Map(GROCERY_CHAINS.map((chain) => [chain.id, chain]));

export function groceryChainById(id: string | null | undefined): GroceryChain | null {
  return BY_ID.get(id?.trim().toLowerCase() ?? '') ?? null;
}

/** Chains in this country that can return a live online catalogue price. */
export function lookupChainsForCountry(country: string | null | undefined): GroceryChain[] {
  const code = normalizeCountryCode(country);
  return GROCERY_CHAINS.filter((chain) => chain.country === code && chain.lookup);
}
