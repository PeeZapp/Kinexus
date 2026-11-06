import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { parseCsv } from '../csv';
import { buildKinexusExport, buildListExport } from './export-build';
import {
  applyDedupeStatus,
  buildImportPlan,
  parseKinexusJson,
  summarizeImportRows,
} from './import-plan';
import { guessColumnMapping, rowsFromMatrix } from './map-columns';
import { linesFromDocxHtml, parseDocxBytes } from './parse-docx';
import { parsePlainTextList, parseQuantityLine } from './parse-text';
import { buildXlsxBytes, parseXlsxMatrix } from './parse-xlsx';
import type { ImportRow, KinexusExportItem, KinexusListKind } from './types';

const WATCHLIST_ITEMS: KinexusExportItem[] = [
  { title: 'Inception', year: 2010, tmdbId: 27205, mediaType: 'movie', notes: 'Mind' },
  { title: 'The Wire', year: 2002, tmdbId: 1438, mediaType: 'tv' },
];

const WISHLIST_ITEMS: KinexusExportItem[] = [
  { title: 'Kettle', url: 'https://shop.example/kettle', price: '49.00', notes: 'Steel' },
  { title: 'Socks', url: '', price: '12' },
];

const CHECKLIST_ITEMS: KinexusExportItem[] = [
  { title: 'Pack bags', notes: 'Night before' },
  { title: 'Charge devices' },
];

const SHOPPING_ITEMS: KinexusExportItem[] = [
  { title: 'milk', quantity: '2' },
  { title: 'eggs', quantity: '12' },
];

const WORKOUT_ITEMS: KinexusExportItem[] = [
  { title: 'Back Squat', sets: 3, reps: '5', weight: 100, notes: 'Belt' },
  { title: 'Bench Press', sets: 3, reps: '8', weight: 60 },
];

function readyRows(items: KinexusExportItem[]): ImportRow[] {
  return items.map((item) => ({
    title: item.title,
    year: item.year ?? null,
    quantity: item.quantity ?? null,
    notes: item.notes ?? null,
    url: item.url ?? null,
    price: item.price ?? null,
    sets: item.sets ?? null,
    reps: item.reps ?? null,
    weight: item.weight ?? null,
    tmdbId: item.tmdbId ?? null,
    mediaType: item.mediaType ?? null,
    imdbId: item.imdbId ?? null,
    itemStatus: item.itemStatus ?? null,
    rating: item.rating ?? null,
    watchedDate: item.watchedDate ?? null,
    status: 'ready' as const,
    note: null,
    matchConfidence: null,
    candidates: null,
  }));
}

async function minimalDocx(paragraphs: string[]): Promise<Uint8Array> {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');
  const listBody = paragraphs
    .map(
      (p) =>
        `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${p}</w:t></w:r></w:p>`,
    )
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${listBody || body}<w:sectPr/></w:body>
</w:document>`;
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder('_rels')!.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder('word')!.file('document.xml', documentXml);
  const buffer = await zip.generateAsync({ type: 'uint8array' });
  return buffer;
}

describe('parseQuantityLine / plain text', () => {
  it('parses 2x milk style quantities', () => {
    expect(parseQuantityLine('2x milk')).toEqual({ title: 'milk', quantity: '2' });
    expect(parseQuantityLine('2 x milk')).toEqual({ title: 'milk', quantity: '2' });
    expect(parseQuantityLine('milk x 2')).toEqual({ title: 'milk', quantity: '2' });
  });

  it('parses bullet lists', () => {
    const rows = parsePlainTextList('- 2x milk\n* eggs\n3. bread');
    expect(rows.map((row) => [row.title, row.quantity])).toEqual([
      ['milk', '2'],
      ['eggs', null],
      ['bread', null],
    ]);
  });
});

describe('column mapping', () => {
  it('guesses common headers', () => {
    const mapping = guessColumnMapping(['Name', 'Year', 'TMDB ID', 'Notes', 'URL', 'Price', 'Sets', 'Reps', 'Weight']);
    expect(mapping[0]).toBe('title');
    expect(mapping[1]).toBe('year');
    expect(mapping[2]).toBe('tmdbId');
    expect(mapping[3]).toBe('notes');
    expect(mapping[4]).toBe('url');
    expect(mapping[5]).toBe('price');
    expect(mapping[6]).toBe('sets');
    expect(mapping[7]).toBe('reps');
    expect(mapping[8]).toBe('weight');
  });
});

describe('xlsx', () => {
  it('round-trips a matrix', () => {
    const matrix = [
      ['title', 'quantity'],
      ['milk', '2'],
      ['eggs', '12'],
    ];
    const bytes = buildXlsxBytes(matrix);
    expect(parseXlsxMatrix(bytes)).toEqual(matrix);
  });
});

describe('docx', () => {
  it('extracts list items and table rows from HTML', () => {
    expect(linesFromDocxHtml('<ul><li>2x milk</li><li>eggs</li></ul>')).toEqual(['2x milk', 'eggs']);
    expect(
      linesFromDocxHtml('<table><tr><td>Title</td><td>Qty</td></tr><tr><td>milk</td><td>2</td></tr></table>'),
    ).toEqual(['Title\tQty', 'milk\t2']);
  });

  it('parses a minimal docx', async () => {
    const bytes = await minimalDocx(['2x milk', 'eggs']);
    const rows = await parseDocxBytes(bytes);
    expect(rows.map((row) => row.title)).toEqual(expect.arrayContaining(['milk', 'eggs']));
  });
});

describe('Kinexus JSON', () => {
  it('parses versioned export', () => {
    const payload = buildKinexusExport({
      kind: 'checklist',
      listName: 'Trip',
      items: CHECKLIST_ITEMS,
    });
    const { export: parsed, rows } = parseKinexusJson(JSON.stringify(payload));
    expect(parsed.kinexusExport).toBe(1);
    expect(parsed.kind).toBe('checklist');
    expect(rows.map((row) => row.title)).toEqual(['Pack bags', 'Charge devices']);
  });
});

describe('dedupe + needsMatch', () => {
  it('marks watchlist rows without tmdb as needsMatch', () => {
    const rows = applyDedupeStatus(
      'watchlist',
      readyRows([{ title: 'Mystery', year: 1999 }]),
      [],
    );
    expect(rows[0]?.status).toBe('needsMatch');
  });

  it('dedupes watchlists by tmdbId', () => {
    const rows = applyDedupeStatus('watchlist', readyRows(WATCHLIST_ITEMS), [{ title: 'Inception', tmdbId: 27205 }]);
    expect(rows.map((row) => row.status)).toEqual(['duplicate', 'ready']);
  });

  it('dedupes wishlists by name + url', () => {
    const rows = applyDedupeStatus('wishlist', readyRows(WISHLIST_ITEMS), [
      { title: 'Kettle', url: 'https://shop.example/kettle' },
    ]);
    expect(rows[0]?.status).toBe('duplicate');
    expect(rows[1]?.status).toBe('ready');
  });

  it('dedupes other kinds by name', () => {
    const rows = applyDedupeStatus('checklist', readyRows(CHECKLIST_ITEMS), [{ title: 'Pack bags' }]);
    expect(rows[0]?.status).toBe('duplicate');
    expect(rows[1]?.status).toBe('ready');
  });
});

async function expectRoundTrip(kind: KinexusListKind, listName: string, items: KinexusExportItem[]) {
  const built = buildListExport(
    {
      kind,
      listName,
      items,
      weightUnit: kind === 'workout' ? 'kg' : undefined,
      storedWeightIsKg: kind === 'workout',
    },
    'json',
  );
  const plan = await buildImportPlan({ text: built.text!, fileName: built.fileName, kindHint: kind });
  expect(plan.kind).toBe(kind);
  const titles = plan.rows.filter((row) => row.status === 'ready' || row.status === 'needsMatch').map((row) => row.title);
  expect(titles).toEqual(items.map((item) => item.title));

  const csv = buildListExport({ kind, listName, items, weightUnit: kind === 'workout' ? 'kg' : undefined, storedWeightIsKg: true }, 'csv');
  const csvPlan = await buildImportPlan({ text: csv.text!, fileName: csv.fileName, kindHint: kind });
  expect(csvPlan.rows.map((row) => row.title)).toEqual(items.map((item) => item.title));
}

describe('export → re-import round-trip', () => {
  it('watchlist', async () => {
    await expectRoundTrip('watchlist', 'Movies', WATCHLIST_ITEMS);
  });
  it('wishlist', async () => {
    await expectRoundTrip('wishlist', 'Gifts', WISHLIST_ITEMS);
  });
  it('checklist', async () => {
    await expectRoundTrip('checklist', 'Trip', CHECKLIST_ITEMS);
  });
  it('shopping', async () => {
    await expectRoundTrip('shopping', 'Shopping', SHOPPING_ITEMS);
  });
  it('workout', async () => {
    await expectRoundTrip('workout', 'Leg day', WORKOUT_ITEMS);
  });

  it('xlsx export re-imports', async () => {
    const built = buildListExport({ kind: 'shopping', listName: 'Shop', items: SHOPPING_ITEMS }, 'xlsx');
    const plan = await buildImportPlan({
      bytes: built.bytes!,
      fileName: built.fileName,
      kindHint: 'shopping',
    });
    expect(plan.rows.map((row) => [row.title, row.quantity])).toEqual([
      ['milk', '2'],
      ['eggs', '12'],
    ]);
  });

  it('csv parse via shared parseCsv feeds mapping', () => {
    const text = 'title,url,price\nMug,https://a.test,9\n';
    const parsed = parseCsv(text);
    const mapping = guessColumnMapping(parsed.headers);
    const rows = rowsFromMatrix(parsed.allRows, mapping);
    expect(rows[0]).toMatchObject({ title: 'Mug', url: 'https://a.test', price: '9' });
  });
});

describe('summarizeImportRows', () => {
  it('counts statuses', () => {
    const summary = summarizeImportRows([
      { ...readyRows(CHECKLIST_ITEMS)[0]!, status: 'ready' },
      { ...readyRows(CHECKLIST_ITEMS)[0]!, status: 'duplicate' },
      { ...readyRows(WATCHLIST_ITEMS)[0]!, status: 'needsMatch', tmdbId: null },
      {
        title: '',
        year: null,
        quantity: null,
        notes: null,
        url: null,
        price: null,
        sets: null,
        reps: null,
        weight: null,
        tmdbId: null,
        mediaType: null,
        imdbId: null,
        itemStatus: null,
        rating: null,
        watchedDate: null,
        status: 'invalid',
        note: 'Missing title',
        matchConfidence: null,
        candidates: null,
      },
    ]);
    expect(summary).toEqual({
      imported: 1,
      skippedDuplicate: 1,
      skippedNeedsMatch: 1,
      skippedInvalid: 1,
    });
  });
});
