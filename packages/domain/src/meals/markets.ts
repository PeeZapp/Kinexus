export type GroceryMarket = {
  country: string;
  currency: string;
  label: string;
  stores: string[];
};

export const DEFAULT_MARKET: GroceryMarket = {
  country: 'AU',
  currency: 'AUD',
  label: 'Australia',
  stores: ['Woolworths', 'Coles'],
};

export const GROCERY_MARKETS: readonly GroceryMarket[] = [
  DEFAULT_MARKET,
  { country: 'NZ', currency: 'NZD', label: 'New Zealand', stores: ['Countdown', "Pak'nSave"] },
  { country: 'GB', currency: 'GBP', label: 'United Kingdom', stores: ['Tesco', "Sainsbury's"] },
  { country: 'IE', currency: 'EUR', label: 'Ireland', stores: ['Tesco', 'SuperValu'] },
  { country: 'US', currency: 'USD', label: 'United States', stores: ['Walmart', 'Kroger'] },
  { country: 'CA', currency: 'CAD', label: 'Canada', stores: ['Loblaws', 'Walmart'] },
  { country: 'SG', currency: 'SGD', label: 'Singapore', stores: ['NTUC FairPrice', 'Cold Storage'] },
  { country: 'ZA', currency: 'ZAR', label: 'South Africa', stores: ['Checkers', 'Woolworths Food'] },
];

const BY_COUNTRY = new Map(GROCERY_MARKETS.map((market) => [market.country, market]));

export function normalizeCountryCode(raw: string | null | undefined): string {
  const code = raw?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : DEFAULT_MARKET.country;
}

export function normalizeCurrencyCode(raw: string | null | undefined, country?: string): string {
  const code = raw?.trim().toUpperCase();
  if (code && /^[A-Z]{3}$/.test(code)) return code;
  return marketForCountry(country).currency;
}

export function marketForCountry(country: string | null | undefined): GroceryMarket {
  const code = normalizeCountryCode(country);
  const known = BY_COUNTRY.get(code);
  if (known) return known;
  return {
    country: code,
    currency: DEFAULT_MARKET.currency,
    label: code,
    stores: [`major supermarkets in ${code}`],
  };
}

export function marketForHousehold(input: {
  country?: string | null;
  currency?: string | null;
}): GroceryMarket {
  const market = marketForCountry(input.country);
  return {
    ...market,
    currency: normalizeCurrencyCode(input.currency, market.country),
  };
}

export function storeListLabel(stores: readonly string[]): string {
  if (stores.length === 0) return 'local supermarkets';
  if (stores.length === 1) return stores[0] ?? 'local supermarkets';
  if (stores.length === 2) return `${stores[0]} and ${stores[1]}`;
  return `${stores.slice(0, -1).join(', ')}, and ${stores[stores.length - 1]}`;
}
