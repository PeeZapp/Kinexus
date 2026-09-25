import {
  asFiniteMoney,
  convertQuotedMoney,
  isMetalKind,
  metalKindLabel,
  normalizeAsxSymbol,
  normalizeCryptoSymbol,
  yahooAsxSymbol,
  yahooCryptoSymbol,
  yahooMetalTicker,
  type FinanceCryptoQuote,
  type FinanceMetalQuote,
  type FinanceShareQuote,
  type MetalKind,
} from '@kinexus/domain';

const MAX_SYMBOLS = 30;

type YahooChart = {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        shortName?: string;
        longName?: string;
        currency?: string;
        symbol?: string;
      };
    }[];
    error?: { description?: string };
  };
};

async function fetchYahooRaw(ticker: string): Promise<YahooChart | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Kinexus/1.0 (household portfolio quotes)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as YahooChart | null;
}

function chartMeta(raw: YahooChart | null) {
  return raw?.chart?.result?.[0]?.meta ?? null;
}

export function parseYahooChart(symbol: string, raw: unknown): FinanceShareQuote | null {
  const meta = chartMeta(raw as YahooChart);
  if (!meta) return null;
  const price = asFiniteMoney(meta.regularMarketPrice ?? meta.previousClose);
  if (price == null) return null;
  const name = meta.shortName || meta.longName || null;
  return {
    symbol: normalizeAsxSymbol(symbol),
    price,
    currency: typeof meta.currency === 'string' && meta.currency ? meta.currency : 'AUD',
    name,
  };
}

export function parseYahooCryptoChart(
  symbol: string,
  raw: unknown,
  preferredCurrency: string,
): FinanceCryptoQuote | null {
  const meta = chartMeta(raw as YahooChart);
  if (!meta) return null;
  const price = asFiniteMoney(meta.regularMarketPrice ?? meta.previousClose);
  if (price == null) return null;
  const quotedCurrency =
    typeof meta.currency === 'string' && meta.currency ? meta.currency.toUpperCase() : preferredCurrency;
  const local = convertQuotedMoney(price, quotedCurrency, preferredCurrency);
  const name = meta.shortName || meta.longName || null;
  return {
    symbol: normalizeCryptoSymbol(symbol),
    price: local,
    currency: preferredCurrency,
    name,
  };
}

async function fetchYahooChart(symbol: string): Promise<FinanceShareQuote | null> {
  const body = await fetchYahooRaw(yahooAsxSymbol(symbol));
  return parseYahooChart(symbol, body);
}

export function parseYahooMetalChart(
  metal: MetalKind,
  raw: unknown,
  preferredCurrency: string,
): FinanceMetalQuote | null {
  const meta = chartMeta(raw as YahooChart);
  if (!meta) return null;
  const price = asFiniteMoney(meta.regularMarketPrice ?? meta.previousClose);
  if (price == null) return null;
  const quotedCurrency =
    typeof meta.currency === 'string' && meta.currency ? meta.currency.toUpperCase() : 'USD';
  return {
    metal,
    price: convertQuotedMoney(price, quotedCurrency, preferredCurrency),
    currency: preferredCurrency,
    name: metalKindLabel(metal),
  };
}

async function fetchYahooMetal(metal: MetalKind, currency: string): Promise<FinanceMetalQuote | null> {
  const preferred = (currency || 'AUD').toUpperCase();
  const body = await fetchYahooRaw(yahooMetalTicker(metal));
  return parseYahooMetalChart(metal, body, preferred);
}

async function fetchYahooCrypto(
  symbol: string,
  currency: string,
): Promise<FinanceCryptoQuote | null> {
  const preferred = (currency || 'AUD').toUpperCase();
  const primary = await fetchYahooRaw(yahooCryptoSymbol(symbol, preferred));
  const fromPrimary = parseYahooCryptoChart(symbol, primary, preferred);
  if (fromPrimary) return fromPrimary;
  if (preferred === 'USD') return null;
  const fallback = await fetchYahooRaw(yahooCryptoSymbol(symbol, 'USD'));
  return parseYahooCryptoChart(symbol, fallback, preferred);
}

export async function handleShareQuotes(body: { symbols?: unknown }) {
  const raw = Array.isArray(body.symbols) ? body.symbols : [];
  const symbols = [...new Set(raw.map((item) => (typeof item === 'string' ? normalizeAsxSymbol(item) : '')).filter(Boolean))];
  if (symbols.length === 0) {
    return { status: 400 as const, body: { error: 'Pass ASX codes such as CBA or VAS' } };
  }
  if (symbols.length > MAX_SYMBOLS) {
    return { status: 400 as const, body: { error: `Ask for at most ${MAX_SYMBOLS} codes at a time` } };
  }

  const quotes: FinanceShareQuote[] = [];
  const missing: string[] = [];
  for (const symbol of symbols) {
    try {
      const quote = await fetchYahooChart(symbol);
      if (quote) quotes.push(quote);
      else missing.push(symbol);
    } catch {
      missing.push(symbol);
    }
  }

  return {
    status: 200 as const,
    body: { quotes, missing },
  };
}

export async function handleCryptoQuotes(body: { symbols?: unknown; currency?: unknown }) {
  const raw = Array.isArray(body.symbols) ? body.symbols : [];
  const symbols = [
    ...new Set(raw.map((item) => (typeof item === 'string' ? normalizeCryptoSymbol(item) : '')).filter(Boolean)),
  ];
  const currency =
    typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'AUD';
  if (symbols.length === 0) {
    return { status: 400 as const, body: { error: 'Pass crypto codes such as BTC or ETH' } };
  }
  if (symbols.length > MAX_SYMBOLS) {
    return { status: 400 as const, body: { error: `Ask for at most ${MAX_SYMBOLS} codes at a time` } };
  }

  const quotes: FinanceCryptoQuote[] = [];
  const missing: string[] = [];
  for (const symbol of symbols) {
    try {
      const quote = await fetchYahooCrypto(symbol, currency);
      if (quote) quotes.push(quote);
      else missing.push(symbol);
    } catch {
      missing.push(symbol);
    }
  }

  return {
    status: 200 as const,
    body: { quotes, missing },
  };
}

export async function handleMetalQuotes(body: { metals?: unknown; currency?: unknown }) {
  const raw = Array.isArray(body.metals) ? body.metals : [];
  const metals = [
    ...new Set(raw.map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : '')).filter(isMetalKind)),
  ];
  const currency =
    typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'AUD';
  if (metals.length === 0) {
    return { status: 400 as const, body: { error: 'Pass metals such as gold or silver' } };
  }
  if (metals.length > MAX_SYMBOLS) {
    return { status: 400 as const, body: { error: `Ask for at most ${MAX_SYMBOLS} metals at a time` } };
  }

  const quotes: FinanceMetalQuote[] = [];
  const missing: string[] = [];
  for (const metal of metals) {
    try {
      const quote = await fetchYahooMetal(metal, currency);
      if (quote) quotes.push(quote);
      else missing.push(metal);
    } catch {
      missing.push(metal);
    }
  }

  return {
    status: 200 as const,
    body: { quotes, missing },
  };
}
