import * as XLSX from 'xlsx';

export function parseXlsxMatrix(bytes: ArrayBuffer | Uint8Array): string[][] {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  });
  return matrix.map((row) => row.map((cell) => String(cell ?? '').trim()));
}

export function buildXlsxBytes(matrix: readonly (readonly string[])[], sheetName = 'List'): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(matrix.map((row) => [...row]));
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31) || 'List');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(buffer);
}
