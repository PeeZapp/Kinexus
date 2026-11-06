export type ParsedCsv = {
  delimiter: string;
  headerRowIndex: number;
  headers: string[] | null;
  /** Data rows only (excludes header when present). */
  rows: string[][];
  /** All non-empty lines split by delimiter, including header. */
  allRows: string[][];
};

export function headerKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[$()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectDelimiter(line: string): string {
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

export function splitDelimited(line: string, delimiter: string): string[] {
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

export function escapeCsvCell(value: string): string {
  if (/[",\n\r\t]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function serializeCsv(rows: readonly (readonly string[])[], delimiter = ','): string {
  return rows.map((row) => row.map((cell) => escapeCsvCell(cell ?? '')).join(delimiter)).join('\n');
}

/**
 * Parse delimited text into rows. When `hasHeader` is true (default auto),
 * the first non-empty row is treated as headers if it looks non-numeric.
 */
export function parseCsv(
  text: string,
  opts?: {
    delimiter?: string;
    /** Force first row as header. Default: treat first row as header when present. */
    hasHeader?: boolean;
    /** Drop lines matching this pattern before parsing. */
    skipLine?: RegExp;
  },
): ParsedCsv {
  const raw = text.replace(/^\uFEFF/, '');
  const rawLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !(opts?.skipLine?.test(line) ?? false));
  if (rawLines.length === 0) {
    return { delimiter: opts?.delimiter ?? ',', headerRowIndex: -1, headers: null, rows: [], allRows: [] };
  }
  const delimiter =
    opts?.delimiter ?? detectDelimiter(rawLines.find((line) => /[,;\t|]/.test(line)) ?? rawLines[0]!);
  const allRows = rawLines.map((line) => splitDelimited(line, delimiter));
  const hasHeader = opts?.hasHeader !== false;
  if (!hasHeader) {
    return { delimiter, headerRowIndex: -1, headers: null, rows: allRows, allRows };
  }
  const headers = allRows[0] ?? null;
  return {
    delimiter,
    headerRowIndex: 0,
    headers,
    rows: allRows.slice(1),
    allRows,
  };
}
