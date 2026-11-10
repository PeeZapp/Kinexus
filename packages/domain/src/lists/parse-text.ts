import { emptyImportRow, type ImportRow } from './types';

const QTY_PREFIX = /^(\d+(?:\.\d+)?)\s*[x×]\s+(.+)$/i;
const QTY_SUFFIX = /^(.+?)\s+[x×]\s*(\d+(?:\.\d+)?)$/i;
const QTY_PAREN = /^(.+?)\s*\((\d+(?:\.\d+)?)\s*[x×]?\)$/i;

export function parseQuantityLine(line: string): { title: string; quantity: string | null } {
  const trimmed = line.trim();
  if (!trimmed) return { title: '', quantity: null };
  const prefix = trimmed.match(QTY_PREFIX);
  if (prefix) return { title: (prefix[2] ?? '').trim(), quantity: prefix[1] ?? null };
  const suffix = trimmed.match(QTY_SUFFIX);
  if (suffix) return { title: (suffix[1] ?? '').trim(), quantity: suffix[2] ?? null };
  const paren = trimmed.match(QTY_PAREN);
  if (paren) return { title: (paren[1] ?? '').trim(), quantity: paren[2] ?? null };
  return { title: trimmed, quantity: null };
}

function bulletStrip(line: string): string {
  return line
    .replace(/^\s*(?:[-*•◦▪▫☐☑✓✔]|\[\s*[xX ]?\s*\]|\d+[.)])\s+/, '')
    .trim();
}

export function parsePlainTextList(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = bulletStrip(raw);
    if (!line) continue;
    const { title, quantity } = parseQuantityLine(line);
    if (!title) continue;
    rows.push(emptyImportRow({ title, quantity, status: 'ready', note: null }));
  }
  return rows;
}
