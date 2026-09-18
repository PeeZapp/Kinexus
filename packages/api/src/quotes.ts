import { asFiniteMoney, normalizeAsxSymbol, yahooAsxSymbol, type FinanceShareQuote } from '@kinexus/domain';

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

export function parseYahooChart(symbol: string, raw: unknown): FinanceShareQuote | null {
  const rec = raw as YahooChart;
  const meta = rec.chart?.result?.[0]?.meta;
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

async function fetchYahooChart(symbol: string): Promise<FinanceShareQuote | null> {
  const ticker = yahooAsxSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Kinexus/1.0 (household portfolio quotes)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as unknown;
  return parseYahooChart(symbol, body);
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
