import { describe, expect, it } from 'vitest';

import { detectDelimiter, parseCsv, serializeCsv, splitDelimited } from './csv';

describe('csv', () => {
  it('detects common delimiters', () => {
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('a;b;c')).toBe(';');
  });

  it('splits quoted cells', () => {
    expect(splitDelimited('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
    expect(splitDelimited('a,"say ""hi""",b', ',')).toEqual(['a', 'say "hi"', 'b']);
  });

  it('parses header + rows', () => {
    const parsed = parseCsv('Title,Notes\nMilk,2%\nEggs,');
    expect(parsed.headers).toEqual(['Title', 'Notes']);
    expect(parsed.rows).toEqual([
      ['Milk', '2%'],
      ['Eggs', ''],
    ]);
  });

  it('round-trips serialize → parse', () => {
    const matrix = [
      ['title', 'url'],
      ['Widget', 'https://example.com'],
      ['Gadget, large', ''],
    ];
    const text = serializeCsv(matrix);
    const parsed = parseCsv(text);
    expect(parsed.headers).toEqual(['title', 'url']);
    expect(parsed.rows).toEqual([
      ['Widget', 'https://example.com'],
      ['Gadget, large', ''],
    ]);
  });
});
