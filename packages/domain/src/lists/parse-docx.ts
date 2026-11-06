import mammoth from 'mammoth';

import { parsePlainTextList } from './parse-text';
import type { ImportRow } from './types';

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

/** Pull list items, table cells (row joined), and paragraph lines from HTML. */
export function linesFromDocxHtml(html: string): string[] {
  const lines: string[] = [];
  const listItems = html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi);
  for (const match of listItems) {
    const text = stripTags(match[1] ?? '');
    if (text) lines.push(text);
  }
  if (lines.length > 0) return lines;

  const rows = html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const row of rows) {
    const cells = [...(row[1] ?? '').matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
      stripTags(cell[1] ?? ''),
    );
    const joined = cells.filter(Boolean).join('\t');
    if (joined) lines.push(joined);
  }
  if (lines.length > 0) return lines;

  const paragraphs = html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
  for (const match of paragraphs) {
    const text = stripTags(match[1] ?? '');
    if (text) lines.push(text);
  }
  return lines;
}

function toArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function parseDocxBytes(bytes: ArrayBuffer | Uint8Array): Promise<ImportRow[]> {
  // mammoth's runtime accepts `buffer` as ArrayBuffer (not only Node Buffer).
  const buffer = toArrayBuffer(bytes) as unknown as Buffer;
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const lines = linesFromDocxHtml(htmlResult.value ?? '');
  if (lines.length > 0) return parsePlainTextList(lines.join('\n'));
  const textResult = await mammoth.extractRawText({ buffer });
  return parsePlainTextList(textResult.value ?? '');
}
