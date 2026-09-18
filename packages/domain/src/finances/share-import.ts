import { parseMoney, roundMoney } from '../stash/money';
import { formatHolderId, holderIdKind, isAsxSymbol, normalizeAsxSymbol } from './shares';
import type { FinanceHolderKind } from './types';

export type ImportedShareHolding = {
  symbol: string;
  name: string | null;
  units: number;
  costPerUnit: number | null;
  lastPrice: number | null;
};

export type ShareImportResult = {
  holdings: ImportedShareHolding[];
  holderId: string | null;
  holderKind: FinanceHolderKind | null;
  skipped: number;
  format: 'csv' | 'chess' | 'lines';
};

const SKIP_SYMBOLS = new Set(['AUD', 'USD', 'CASH', 'N', 'NA', 'TOTAL', 'CODE', 'ASX']);

const SYMBOL_HEADERS = [
  'code',
  'stock code',
  'asx code',
  'asx',
  'ticker',
  'symbol',
  'security code',
  'stock',
  'security',
];
const UNITS_HEADERS = [
  'units',
  'quantity',
  'qty',
  'quantity held',
  'unit balance',
  'units held',
  'holding',
  'available',
  'available quantity',
  'volume',
  'units on register',
];
const NAME_HEADERS = ['name', 'security description', 'security name', 'company', 'description', 'stock name'];
const COST_HEADERS = [
  'average price',
  'average cost',
  'avg cost',
  'avg price',
  'cost per unit',
  'unit cost',
  'cost',
  'average price ($)',
  'avg',
];
const PRICE_HEADERS = ['last price', 'current price', 'market price', 'price', 'last'];
const HIN_HEADERS = ['hin', 'holder identification number', 'holder id', 'srn', 'shareholder reference number'];

function headerKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[$()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitDelimited(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(line: string): string {
  const counts: Array<[string, number]> = [
    [',', (line.match(/,/g) ?? []).length],
    ['\t', (line.match(/\t/g) ?? []).length],
    [';', (line.match(/;/g) ?? []).length],
    ['|', (line.match(/\|/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  const best = counts[0];
  return best && best[1] > 0 ? best[0] : ',';
}

function findHeaderIndex(keys: string[], names: string[]): number {
  return keys.findIndex((key) => names.includes(key));
}

function looksLikeHeader(cells: string[]): boolean {
  const keys = cells.map(headerKey);
  const hits = [SYMBOL_HEADERS, UNITS_HEADERS, NAME_HEADERS, COST_HEADERS, PRICE_HEADERS, HIN_HEADERS].filter(
    (group) => keys.some((key) => group.includes(key)),
  ).length;
  return hits >= 2;
}

function extractHolderFromText(text: string): string | null {
  const upper = text.toUpperCase();
  const labeledHin = upper.match(/\bHIN\b[^A-Z0-9]{0,8}(X?\s*\d{10})/);
  if (labeledHin?.[1]) return formatHolderId(labeledHin[1]);
  const labeledSrn = upper.match(/\bSRN\b[^A-Z0-9]{0,8}(I[A-Z0-9]{8,12})/);
  if (labeledSrn?.[1]) return formatHolderId(labeledSrn[1]);
  const chessHin = upper.match(/\bX\s*\d{10}\b/);
  if (chessHin) return formatHolderId(chessHin[0]);
  return null;
}

function mergeHoldings(rows: ImportedShareHolding[]): ImportedShareHolding[] {
  const map = new Map<string, ImportedShareHolding>();
  for (const row of rows) {
    const prev = map.get(row.symbol);
    if (!prev) {
      map.set(row.symbol, row);
      continue;
    }
    const units = prev.units + row.units;
    const cost =
      prev.costPerUnit != null && row.costPerUnit != null && units > 0
        ? roundMoney((prev.costPerUnit * prev.units + row.costPerUnit * row.units) / units)
        : (prev.costPerUnit ?? row.costPerUnit);
    map.set(row.symbol, {
      symbol: row.symbol,
      name: prev.name || row.name,
      units,
      costPerUnit: cost,
      lastPrice: row.lastPrice ?? prev.lastPrice,
    });
  }
  return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function asHolding(input: {
  symbol: string;
  name?: string | null;
  units: string | number | null;
  costPerUnit?: string | number | null;
  lastPrice?: string | number | null;
}): ImportedShareHolding | null {
  const symbol = normalizeAsxSymbol(input.symbol);
  if (!isAsxSymbol(symbol) || SKIP_SYMBOLS.has(symbol)) return null;
  const units = parseMoney(input.units);
  if (units == null || units <= 0) return null;
  return {
    symbol,
    name: input.name?.trim() || null,
    units,
    costPerUnit: parseMoney(input.costPerUnit),
    lastPrice: parseMoney(input.lastPrice),
  };
}

function parseCsv(text: string): { holdings: ImportedShareHolding[]; skipped: number } | null {
  const rawLines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rawLines.length === 0) return null;
  const delimiter = detectDelimiter(rawLines.find((line) => /[,;\t|]/.test(line)) ?? rawLines[0]!);
  const rows = rawLines.map((line) => splitDelimited(line, delimiter));
  const headerAt = rows.findIndex(looksLikeHeader);
  if (headerAt < 0) return null;
  const keys = rows[headerAt]!.map(headerKey);
  const symbolAt = findHeaderIndex(keys, SYMBOL_HEADERS);
  const unitsAt = findHeaderIndex(keys, UNITS_HEADERS);
  if (symbolAt < 0 || unitsAt < 0) return null;
  const nameAt = findHeaderIndex(keys, NAME_HEADERS);
  const costAt = findHeaderIndex(keys, COST_HEADERS);
  const priceAt = findHeaderIndex(keys, PRICE_HEADERS);
  const hinAt = findHeaderIndex(keys, HIN_HEADERS);
  const parsed: ImportedShareHolding[] = [];
  let skipped = 0;
  for (const cells of rows.slice(headerAt + 1)) {
    if (hinAt >= 0 && !cells[symbolAt]) continue;
    const holding = asHolding({
      symbol: cells[symbolAt] ?? '',
      name: nameAt >= 0 ? cells[nameAt] : null,
      units: cells[unitsAt] ?? '',
      costPerUnit: costAt >= 0 ? cells[costAt] : null,
      lastPrice: priceAt >= 0 ? cells[priceAt] : null,
    });
    if (holding) parsed.push(holding);
    else skipped += 1;
  }
  return { holdings: mergeHoldings(parsed), skipped };
}

function parseChessBlocks(text: string): ImportedShareHolding[] {
  const holdings: ImportedShareHolding[] = [];
  const blocks = text.split(/(?=(?:security code|asx code)\b)/i);
  for (const block of blocks) {
    const symbol =
      block.match(/\b(?:security code|asx code)\s*[:\-–]?\s*([A-Za-z0-9]{1,6})\b/i)?.[1] ??
      block.match(/\b(?:security code|asx code)\s+([A-Za-z0-9]{1,6})\b/i)?.[1];
    const units =
      block.match(/\b(?:unit balance|units held|units|quantity)\s*[:\-–]?\s*([\d,]+(?:\.\d+)?)/i)?.[1];
    const name =
      block.match(/\b(?:security description|security name)\s*[:\-–]?\s*(.+)/i)?.[1];
    const holding = asHolding({
      symbol: symbol ?? '',
      name: name?.split(/\n/)[0] ?? null,
      units: units ?? '',
    });
    if (holding) holdings.push(holding);
  }
  return holdings;
}

function parseLooseLines(text: string): ImportedShareHolding[] {
  const holdings: ImportedShareHolding[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^(hin|srn|chess|holder|statement|page)\b/i.test(trimmed)) continue;
    const cells = splitDelimited(trimmed, detectDelimiter(trimmed));
    const symbolCell = cells[0];
    const unitsCell = cells[1];
    if (symbolCell && unitsCell && isAsxSymbol(symbolCell) && parseMoney(unitsCell) != null) {
      const holding = asHolding({
        symbol: symbolCell,
        units: unitsCell,
        costPerUnit: cells[2] ?? null,
        name: cells[3] ?? (cells[2] != null && Number.isNaN(Number(cells[2])) ? cells[2] : null),
      });
      if (holding) holdings.push(holding);
      continue;
    }
    const spaced = trimmed.match(/^([A-Za-z0-9]{1,6})\s+(.+?)\s+([\d,]+(?:\.\d+)?)\s*$/);
    if (spaced?.[1] && spaced[3]) {
      const holding = asHolding({ symbol: spaced[1], name: spaced[2] ?? null, units: spaced[3] });
      if (holding) holdings.push(holding);
    }
  }
  return holdings;
}

export function parseShareImport(text: string): ShareImportResult {
  const source = text.trim();
  if (!source) {
    return { holdings: [], holderId: null, holderKind: null, skipped: 0, format: 'lines' };
  }
  const holderId = extractHolderFromText(source);
  const holderKind = holderIdKind(holderId);
  const csv = parseCsv(source);
  if (csv && csv.holdings.length > 0) {
    return { ...csv, holderId, holderKind, format: 'csv' };
  }
  const chess = mergeHoldings(parseChessBlocks(source));
  if (chess.length > 0) {
    return { holdings: chess, holderId, holderKind, skipped: 0, format: 'chess' };
  }
  const lines = mergeHoldings(parseLooseLines(source));
  return {
    holdings: lines,
    holderId,
    holderKind,
    skipped: 0,
    format: lines.length > 0 ? 'lines' : 'csv',
  };
}
