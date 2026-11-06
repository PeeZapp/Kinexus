import type { ListSourceFormat } from './types';

export type ListSourceInput = {
  fileName?: string | null;
  mimeType?: string | null;
  text?: string | null;
  bytes?: Uint8Array | null;
};

/**
 * Pluggable detector for external list sources (IMDb, Letterboxd, Hevy, Strong…).
 * Return a format override, or null to defer. 5b registers IMDb/Letterboxd; 5c Hevy/Strong.
 */
export type ListSourceDetector = {
  id: string;
  detect: (input: ListSourceInput) => ListSourceFormat | null;
};

const detectors: ListSourceDetector[] = [];

export function registerListSourceDetector(detector: ListSourceDetector): void {
  const index = detectors.findIndex((item) => item.id === detector.id);
  if (index >= 0) detectors[index] = detector;
  else detectors.push(detector);
}

export function clearListSourceDetectors(): void {
  detectors.length = 0;
}

export function listSourceDetectors(): readonly ListSourceDetector[] {
  return detectors;
}

/** @deprecated 5c registered real Hevy/Strong detectors; kept empty for call-site compatibility. */
export const STUB_LIST_SOURCE_DETECTORS: ListSourceDetector[] = [];

function extensionOf(fileName: string | null | undefined): string {
  if (!fileName) return '';
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function looksLikeKinexusJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed) as { kinexusExport?: unknown };
    return typeof parsed.kinexusExport === 'number';
  } catch {
    return false;
  }
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

export function detectListSource(input: ListSourceInput): ListSourceFormat {
  for (const detector of detectors) {
    const hit = detector.detect(input);
    if (hit) return hit;
  }

  const ext = extensionOf(input.fileName);
  const mime = (input.mimeType ?? '').toLowerCase();
  const text = input.text?.replace(/^\uFEFF/, '') ?? null;

  if (ext === 'zip' || mime.includes('zip')) return 'letterboxd-zip';

  if (ext === 'json' || mime.includes('json')) {
    if (text && looksLikeKinexusJson(text)) return 'kinexus-json';
    if (text && looksLikeJson(text)) return 'kinexus-json';
    return 'kinexus-json';
  }
  if (ext === 'csv' || mime === 'text/csv') return 'csv';
  if (ext === 'tsv' || mime === 'text/tab-separated-values') return 'tsv';
  if (ext === 'xlsx' || mime.includes('spreadsheetml')) return 'xlsx';
  if (ext === 'xls' || mime === 'application/vnd.ms-excel') return 'xls';
  if (ext === 'docx' || mime.includes('wordprocessingml')) return 'docx';
  if (ext === 'txt' || mime.startsWith('text/')) {
    if (text && looksLikeKinexusJson(text)) return 'kinexus-json';
    return 'text';
  }

  if (text) {
    if (looksLikeKinexusJson(text)) return 'kinexus-json';
    if (text.includes('\t') && text.split(/\r?\n/).length > 1) return 'tsv';
    if (/^[^,\n]+,[^,\n]+/m.test(text) && text.split(/\r?\n/).length > 1) return 'csv';
    return 'text';
  }

  if (input.bytes && input.bytes.length >= 4) {
    // ZIP local file header — xlsx/docx/letterboxd zip
    if (input.bytes[0] === 0x50 && input.bytes[1] === 0x4b) {
      if (ext === 'docx' || mime.includes('wordprocessingml')) return 'docx';
      if (ext === 'xlsx' || mime.includes('spreadsheetml')) return 'xlsx';
      // Could be xlsx or docx; without filename default xlsx
      return 'xlsx';
    }
    // OLE compound — classic .xls
    if (input.bytes[0] === 0xd0 && input.bytes[1] === 0xcf) return 'xls';
  }

  return 'unknown';
}

export function listFileExtensions(): readonly string[] {
  return ['.csv', '.tsv', '.xlsx', '.xls', '.docx', '.txt', '.json', '.zip'];
}

export function isListImportFileName(fileName: string | null | undefined): boolean {
  const ext = extensionOf(fileName);
  return ['csv', 'tsv', 'xlsx', 'xls', 'docx', 'txt', 'json', 'zip'].includes(ext);
}
