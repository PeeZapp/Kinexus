import { describe, expect, it, vi } from 'vitest';

import { fetchReaderDocument } from './reader.js';

const lookup = async () => ['8.8.8.8'];

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mockArchiveToday(fetchImpl: (url: string) => Promise<Response | null> | Response | null) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (/\/timemap\//i.test(url)) {
      return textResponse('');
    }
    const custom = await fetchImpl(url);
    if (custom) return custom;
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe('fetchReaderDocument', () => {
  it('prefers Jina Reader markdown and attaches multiple archive viewers', async () => {
    const fetch = mockArchiveToday(async (url) => {
      if (url.startsWith('https://r.jina.ai/')) {
        return textResponse(`Title: Example Domain

URL Source: https://example.com/

Markdown Content:
# Example Domain

This domain is for use in illustrative examples in documents.
`);
      }
      if (url.startsWith('https://archive.org/wayback/available')) {
        return jsonResponse({
          archived_snapshots: {
            closest: {
              available: true,
              url: 'https://web.archive.org/web/20240101120000/https://example.com/',
              timestamp: '20240101120000',
            },
          },
        });
      }
      if (/\/newest\//i.test(url)) {
        return htmlResponse(
          `<html><head><link rel="canonical" href="https://archive.ph/Ab12Cd" /><title>Example</title></head><body>${'x'.repeat(200)}</body></html>`,
        );
      }
      return null;
    });

    const result = await fetchReaderDocument('https://example.com/', { fetch, lookup });
    expect(result.source).toBe('jina');
    expect(result.title).toBe('Example Domain');
    expect(result.text).toContain('illustrative examples');
    expect(result.sourceUrl).toBe('https://r.jina.ai/https://example.com/');
    expect(result.views.map((view) => view.id)).toEqual([
      'wayback',
      'archive_is',
      'ghostarchive',
      'google_cache',
    ]);
    expect(result.viewUrl).toBe('https://web.archive.org/web/20240101120000/https://example.com/');
    expect(result.views.find((view) => view.id === 'archive_is')?.url).toBe('https://archive.ph/Ab12Cd');
    expect(result.views.find((view) => view.id === 'wayback')?.url).toBe(
      'https://web.archive.org/web/20240101120000/https://example.com/',
    );
  });

  it('falls back to Wayback when Jina fails', async () => {
    const fetch = mockArchiveToday(async (url) => {
      if (url.startsWith('https://r.jina.ai/')) {
        return textResponse('failed to fetch', 502);
      }
      if (url.startsWith('https://archive.org/wayback/available')) {
        return jsonResponse({
          archived_snapshots: {
            closest: {
              available: true,
              url: 'https://web.archive.org/web/20240101120000/https://example.com/',
              timestamp: '20240101120000',
            },
          },
        });
      }
      if (url.includes('web.archive.org/web/') && url.includes('id_')) {
        return htmlResponse(
          `<html><head><title>Cached Example</title></head><body><article><p>${'Archived paragraph. '.repeat(12)}</p></article></body></html>`,
        );
      }
      if (/\/newest\//i.test(url)) {
        return htmlResponse(
          `<html><head><link rel="canonical" href="https://archive.ph/Ab12Cd" /><title>Example</title></head><body>${'x'.repeat(200)}</body></html>`,
        );
      }
      return null;
    });

    const result = await fetchReaderDocument('https://example.com/', { fetch, lookup });
    expect(result.source).toBe('wayback');
    expect(result.title).toBe('Cached Example');
    expect(result.text).toContain('Archived paragraph');
    expect(result.sourceUrl).toContain('web.archive.org');
    expect(result.viewUrl).toBe('https://web.archive.org/web/20240101120000/https://example.com/');
    expect(result.views[0]?.id).toBe('wayback');
  });

  it('falls back to archive.is when Jina and Wayback fail', async () => {
    const fetch = mockArchiveToday(async (url) => {
      if (url.startsWith('https://r.jina.ai/')) return textResponse('failed', 502);
      if (url.startsWith('https://archive.org/wayback/available')) {
        return jsonResponse({ archived_snapshots: {} });
      }
      if (url.includes('web.archive.org/web/latest/')) return htmlResponse('missing', 404);
      if (/\/newest\//i.test(url) || url === 'https://archive.ph/Ab12Cd') {
        return htmlResponse(
          `<html><head><link rel="canonical" href="https://archive.ph/Ab12Cd" /><title>Mirror Copy</title></head><body><article><p>${'Archive.is paragraph. '.repeat(12)}</p></article></body></html>`,
        );
      }
      return null;
    });

    const result = await fetchReaderDocument('https://example.com/', { fetch, lookup });
    expect(result.source).toBe('archive_is');
    expect(result.title).toBe('Mirror Copy');
    expect(result.text).toContain('Archive.is paragraph');
    expect(result.views[0]?.id).toBe('wayback');
    expect(result.viewUrl).toContain('web.archive.org');
  });

  it('rejects Jina bodies that are Cloudflare reCAPTCHA quota walls', async () => {
    const fetch = mockArchiveToday(async (url) => {
      if (url.startsWith('https://r.jina.ai/')) {
        return textResponse(
          'Verifying that you are not a robot...\nThis site is exceeding reCAPTCHA Enterprise free quota.\n',
        );
      }
      if (url.startsWith('https://archive.org/wayback/available')) {
        return jsonResponse({
          archived_snapshots: {
            closest: {
              available: true,
              url: 'https://web.archive.org/web/20240101120000/https://example.com/',
              timestamp: '20240101120000',
            },
          },
        });
      }
      if (url.includes('web.archive.org/web/') && url.includes('id_')) {
        return htmlResponse(
          `<html><head><title>Cached Example</title></head><body><article><p>${'Archived paragraph. '.repeat(12)}</p></article></body></html>`,
        );
      }
      if (/\/newest\//i.test(url)) {
        return htmlResponse(
          `<html><head><link rel="canonical" href="https://archive.ph/Ab12Cd" /><title>Example</title></head><body>${'x'.repeat(200)}</body></html>`,
        );
      }
      return null;
    });

    const result = await fetchReaderDocument('https://example.com/', { fetch, lookup });
    expect(result.source).toBe('wayback');
    expect(result.text).toContain('Archived paragraph');
  });

  it('rejects private targets before contacting archive services', async () => {
    const fetch = vi.fn();
    await expect(fetchReaderDocument('http://127.0.0.1/secret', { fetch, lookup })).rejects.toThrow(
      /not allowed|valid http/i,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
