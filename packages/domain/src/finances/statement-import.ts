import { parseMoney, roundMoney } from '../stash/money';
import { monthStartIso } from './budget';

export type BankStatementFormat = 'csv' | 'ofx' | 'qif' | 'text';

export type BankStatementTxn = {
  date: string;
  description: string;
  amount: number;
  merchantKey: string;
};

export type BankStatementImport = {
  format: BankStatementFormat;
  transactions: BankStatementTxn[];
  skipped: number;
  dateFrom: string | null;
  dateTo: string | null;
};

const DATE_HEADERS = [
  'date',
  'transaction date',
  'tran date',
  'processed date',
  'value date',
  'posted date',
  'posted',
  'effective date',
  'txn date',
  'trans date',
];
const DESC_HEADERS = [
  'description',
  'narrative',
  'narration',
  'particulars',
  'details',
  'merchant',
  'transaction details',
  'payee',
  'memo',
  'transaction',
  'transaction description',
  'reference',
  'name',
];
const DEBIT_HEADERS = ['debit', 'debit amount', 'withdrawal', 'withdrawals', 'money out', 'spent', 'payments'];
const CREDIT_HEADERS = ['credit', 'credit amount', 'deposit', 'deposits', 'money in', 'received', 'receipts'];
const AMOUNT_HEADERS = ['amount', 'transaction amount', 'value', 'aud', 'nzd', 'usd', 'gbp', 'eur', 'txn amount'];
const TYPE_HEADERS = ['type', 'transaction type', 'trn type', 'debit/credit', 'dr/cr'];
const SKIP_HEADERS = new Set(['balance', 'running balance', 'account', 'account number', 'account name', 'bank account', 'serial', 'categories', 'category']);

const NOISE_LINE =
  /^(account|bsb|opening|closing|balance|available|statement|period|from:|to:|page |generated|printed|total)/i;

export function parseBankStatement(text: string): BankStatementImport {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) return emptyImport('text');
  if (looksLikeOfx(raw)) return finalize('ofx', parseOfx(raw));
  if (looksLikeQif(raw)) return finalize('qif', parseQif(raw));
  const csv = parseCsv(raw);
  if (csv.transactions.length > 0) return finalize('csv', csv);
  const loose = parseLooseText(raw);
  return finalize('text', loose);
}

export function merchantKey(description: string): string {
  const words = normalizeMerchant(description)
    .split(' ')
    .filter((word) => word.length > 1 && !/^\d+$/.test(word));
  return words.slice(0, 3).join(' ') || 'UNKNOWN';
}

export function redactBankDescription(description: string): string {
  return description
    .replace(/\b\d{2,3}-\d{3}\b/g, '[BSB]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD]')
    .replace(/\b\d{8,12}\b/g, '[REF]')
    .replace(/\s+/g, ' ')
    .trim();
}

export function statementMonths(transactions: readonly { date: string }[]): string[] {
  const months = new Set<string>();
  for (const txn of transactions) {
    if (txn.date.length >= 7) months.add(`${txn.date.slice(0, 7)}-01`);
  }
  return [...months].sort();
}

export function statementMonthStart(transactions: readonly BankStatementTxn[], preferred?: string | null): string {
  const months = statementMonths(transactions);
  if (preferred && months.includes(preferred)) return preferred;
  const counts = new Map<string, number>();
  for (const txn of transactions) {
    const month = `${txn.date.slice(0, 7)}-01`;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  let best = preferred && /^\d{4}-\d{2}-01$/.test(preferred) ? preferred : months[months.length - 1] ?? monthStartIso();
  let bestCount = 0;
  for (const [month, count] of counts) {
    if (count > bestCount) {
      best = month;
      bestCount = count;
    }
  }
  return best;
}

export function txnsForMonth(transactions: readonly BankStatementTxn[], monthStart: string): BankStatementTxn[] {
  return transactions.filter((txn) => txn.date.startsWith(monthStart.slice(0, 7)));
}

function emptyImport(format: BankStatementFormat): BankStatementImport {
  return { format, transactions: [], skipped: 0, dateFrom: null, dateTo: null };
}

function finalize(
  format: BankStatementFormat,
  parsed: { transactions: BankStatementTxn[]; skipped: number },
): BankStatementImport {
  const transactions = parsed.transactions
    .filter((txn) => txn.amount !== 0 && txn.description)
    .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
  return {
    format,
    transactions,
    skipped: parsed.skipped + (parsed.transactions.length - transactions.length),
    dateFrom: transactions[0]?.date ?? null,
    dateTo: transactions[transactions.length - 1]?.date ?? null,
  };
}

function looksLikeOfx(text: string): boolean {
  return /<(OFX|OFC|STMTTRN|BANKTRANLIST)\b/i.test(text);
}

function looksLikeQif(text: string): boolean {
  return /^\s*!Type:/im.test(text) || /^\s*D\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*$/m.test(text);
}

function parseOfx(text: string): { transactions: BankStatementTxn[]; skipped: number } {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const transactions: BankStatementTxn[] = [];
  let skipped = 0;
  for (const block of blocks) {
    const body = block.split(/<\/STMTTRN>/i)[0] ?? block;
    const date = parseDate(ofxField(body, 'DTPOSTED') ?? ofxField(body, 'DTUSER') ?? '');
    const amount = parseSignedAmount(ofxField(body, 'TRNAMT') ?? '');
    const name = ofxField(body, 'NAME') ?? '';
    const memo = ofxField(body, 'MEMO') ?? '';
    const description = [name, memo].filter(Boolean).join(' ').trim();
    if (!date || amount == null || !description) {
      skipped += 1;
      continue;
    }
    transactions.push(asTxn(date, description, amount));
  }
  return { transactions, skipped };
}

function ofxField(block: string, tag: string): string | null {
  const sgml = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
  if (sgml?.[1]) return sgml[1].trim();
  const xml = block.match(new RegExp(`<${tag}>\\s*([^<]+)\\s*</${tag}>`, 'i'));
  return xml?.[1]?.trim() ?? null;
}

function parseQif(text: string): { transactions: BankStatementTxn[]; skipped: number } {
  const records = text.split(/^\^/m);
  const transactions: BankStatementTxn[] = [];
  let skipped = 0;
  for (const record of records) {
    let date: string | null = null;
    let amount: number | null = null;
    const parts: string[] = [];
    for (const line of record.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const code = trimmed[0];
      const value = trimmed.slice(1).trim();
      if (code === 'D') date = parseDate(value);
      else if (code === 'T' || code === 'U') amount = parseSignedAmount(value);
      else if (code === 'P' || code === 'M' || code === 'N') parts.push(value);
    }
    const description = parts.join(' ').trim();
    if (!date || amount == null || !description) {
      if (date || amount != null || description) skipped += 1;
      continue;
    }
    transactions.push(asTxn(date, description, amount));
  }
  return { transactions, skipped };
}

function parseCsv(text: string): { transactions: BankStatementTxn[]; skipped: number } {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !NOISE_LINE.test(line));
  if (rawLines.length === 0) return { transactions: [], skipped: 0 };
  const delimiter = detectDelimiter(rawLines.find((line) => /[,;\t|]/.test(line)) ?? rawLines[0]!);
  const rows = rawLines.map((line) => splitDelimited(line, delimiter));
  const headerIndex = rows.findIndex((cells) => looksLikeTxnHeader(cells));
  if (headerIndex >= 0) return parseCsvWithHeader(rows.slice(headerIndex));
  return parseCsvWithoutHeader(rows);
}

function parseCsvWithHeader(rows: string[][]): { transactions: BankStatementTxn[]; skipped: number } {
  const header = rows[0] ?? [];
  const keys = header.map(headerKey);
  const dateIdx = findHeaderIndex(keys, DATE_HEADERS);
  const descIdx = findBestDescIndex(keys);
  const amountIdx = findHeaderIndex(keys, AMOUNT_HEADERS);
  const debitIdx = findHeaderIndex(keys, DEBIT_HEADERS);
  const creditIdx = findHeaderIndex(keys, CREDIT_HEADERS);
  const typeIdx = findHeaderIndex(keys, TYPE_HEADERS);
  if (dateIdx < 0 || (amountIdx < 0 && debitIdx < 0 && creditIdx < 0)) {
    return parseCsvWithoutHeader(rows.slice(1));
  }
  const transactions: BankStatementTxn[] = [];
  let skipped = 0;
  for (const cells of rows.slice(1)) {
    const date = parseDate(cells[dateIdx] ?? '');
    const description = pickDescription(cells, descIdx, dateIdx);
    const amount = amountFromCells(cells, { amountIdx, debitIdx, creditIdx, typeIdx });
    if (!date || amount == null || !description) {
      skipped += 1;
      continue;
    }
    transactions.push(asTxn(date, description, amount));
  }
  return { transactions, skipped };
}

function parseCsvWithoutHeader(rows: string[][]): { transactions: BankStatementTxn[]; skipped: number } {
  const transactions: BankStatementTxn[] = [];
  let skipped = 0;
  for (const cells of rows) {
    const txn = txnFromCells(cells);
    if (!txn) {
      skipped += 1;
      continue;
    }
    transactions.push(txn);
  }
  return { transactions, skipped };
}

function parseLooseText(text: string): { transactions: BankStatementTxn[]; skipped: number } {
  const transactions: BankStatementTxn[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || NOISE_LINE.test(trimmed)) continue;
    const txn = txnFromLooseLine(trimmed) ?? txnFromCells(splitDelimited(trimmed, detectDelimiter(trimmed)));
    if (!txn) {
      skipped += 1;
      continue;
    }
    transactions.push(txn);
  }
  return { transactions, skipped };
}

function txnFromLooseLine(line: string): BankStatementTxn | null {
  const dateMatch = line.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/);
  if (!dateMatch) return null;
  const date = parseDate(dateMatch[1] ?? '');
  if (!date) return null;
  const rest = line.slice(dateMatch[0].length).trim();
  const moneyMatch = rest.match(/([+-]?\$?\d[\d,]*(?:\.\d{1,2})?)\s*(CR|DR)?$/i);
  if (!moneyMatch) return null;
  const amount = applyDrCr(parseSignedAmount(moneyMatch[1] ?? ''), moneyMatch[2] ?? '');
  const description = rest.slice(0, rest.length - moneyMatch[0].length).trim();
  if (amount == null || !description) return null;
  return asTxn(date, description, amount);
}

function txnFromCells(cells: string[]): BankStatementTxn | null {
  if (cells.length < 2) return null;
  let dateIdx = cells.findIndex((cell) => parseDate(cell));
  if (dateIdx < 0) return null;
  const date = parseDate(cells[dateIdx] ?? '');
  if (!date) return null;
  let amountIdx = -1;
  let amount: number | null = null;
  for (let i = cells.length - 1; i >= 0; i--) {
    if (i === dateIdx) continue;
    const value = parseSignedAmount(cells[i] ?? '');
    if (value == null) continue;
    amountIdx = i;
    amount = value;
    break;
  }
  if (amount == null || amountIdx < 0) return null;
  const description = cells
    .filter((_, index) => index !== dateIdx && index !== amountIdx)
    .join(' ')
    .trim();
  if (!description) return null;
  return asTxn(date, description, amount);
}

function amountFromCells(
  cells: string[],
  cols: { amountIdx: number; debitIdx: number; creditIdx: number; typeIdx: number },
): number | null {
  const debit = cols.debitIdx >= 0 ? parseMoney(cells[cols.debitIdx]) : null;
  const credit = cols.creditIdx >= 0 ? parseMoney(cells[cols.creditIdx]) : null;
  if (debit && debit > 0 && (!credit || credit === 0)) return roundMoney(-Math.abs(debit));
  if (credit && credit > 0 && (!debit || debit === 0)) return roundMoney(Math.abs(credit));
  if (cols.amountIdx >= 0) {
    const amount = parseSignedAmount(cells[cols.amountIdx] ?? '');
    if (amount == null) return null;
    return applyTypeSign(amount, cells[cols.typeIdx] ?? '');
  }
  if (debit && credit && debit > 0 && credit > 0) return roundMoney(Math.abs(credit) - Math.abs(debit));
  return null;
}

function applyTypeSign(amount: number, type: string): number {
  const upper = type.trim().toUpperCase();
  if (/^(DR|DEBIT|WD|WITHDRAWAL|PAYMENT|PURCHASE|POS|SPEND)$/.test(upper)) return roundMoney(-Math.abs(amount));
  if (/^(CR|CREDIT|DEP|DEPOSIT|SALARY|PAY)$/.test(upper)) return roundMoney(Math.abs(amount));
  return amount;
}

function applyDrCr(amount: number | null, suffix: string): number | null {
  if (amount == null) return null;
  const upper = suffix.trim().toUpperCase();
  if (upper === 'DR') return roundMoney(-Math.abs(amount));
  if (upper === 'CR') return roundMoney(Math.abs(amount));
  return amount;
}

function parseSignedAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cr = /\s*CR\s*$/i.test(trimmed);
  const dr = /\s*DR\s*$/i.test(trimmed);
  const parenNeg = /^\(.*\)$/.test(trimmed);
  const value = parseMoney(trimmed.replace(/\((.*)\)/, '$1'));
  if (value == null) return null;
  if (dr || parenNeg) return roundMoney(-Math.abs(value));
  if (cr) return roundMoney(Math.abs(value));
  return value;
}

export function parseStatementDate(raw: string): string | null {
  return parseDate(raw);
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const named = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (named) {
    const month = monthFromName(named[2] ?? '');
    if (month) return toIso(Number(named[3]), month, Number(named[1]));
  }
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (month > 12 && day <= 12) return toIso(year, day, month);
  return toIso(year, month, day);
}

function monthFromName(name: string): number | null {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const index = months.findIndex((month) => name.toLowerCase().startsWith(month));
  return index >= 0 ? index + 1 : null;
}

function toIso(yearRaw: number, month: number, day: number): string | null {
  const year = yearRaw < 100 ? (yearRaw >= 70 ? 1900 + yearRaw : 2000 + yearRaw) : yearRaw;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function asTxn(date: string, description: string, amount: number): BankStatementTxn {
  const clean = redactBankDescription(description.replace(/\s+/g, ' ').trim());
  return {
    date,
    description: clean,
    amount: roundMoney(amount),
    merchantKey: merchantKey(clean),
  };
}

function normalizeMerchant(description: string): string {
  return description
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/\b(EFTPOS|VISA|MASTERCARD|DEBIT CARD|CREDIT CARD|CARD PURCHASE|PURCHASE|POS|OSKO|NPP|BPAY|DIRECT DEBIT|AUSPOST|APPLE PAY|GOOGLE PAY|TAP AND PAY)\b/g, ' ')
    .replace(/\b(PTY LTD|PTY|LTD|LIMITED|AUSTRALIA|AUST)\b/g, ' ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headerKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[$()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findHeaderIndex(keys: string[], names: string[]): number {
  return keys.findIndex((key) => names.includes(key));
}

function findBestDescIndex(keys: string[]): number {
  for (const name of DESC_HEADERS) {
    const index = keys.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

function looksLikeTxnHeader(cells: string[]): boolean {
  const keys = cells.map(headerKey);
  const hasDate = keys.some((key) => DATE_HEADERS.includes(key));
  const hasAmount = keys.some((key) => [...AMOUNT_HEADERS, ...DEBIT_HEADERS, ...CREDIT_HEADERS].includes(key));
  return hasDate && hasAmount;
}

function pickDescription(cells: string[], descIdx: number, dateIdx: number): string {
  if (descIdx >= 0 && cells[descIdx]?.trim()) return cells[descIdx]!.trim();
  return cells
    .filter((cell, index) => index !== dateIdx && cell.trim() && !SKIP_HEADERS.has(headerKey(cell)))
    .filter((cell) => parseSignedAmount(cell) == null && !parseDate(cell))
    .join(' ')
    .trim();
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
