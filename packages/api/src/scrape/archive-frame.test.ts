import { describe, expect, it, vi } from 'vitest';

import { assertArchiveFrameUrl, fetchArchiveFrameHtml, isAllowedArchiveFrameHost, prepareArchiveFrameHtml } from './archive-frame.js';
import { extractArchiveTodaySnapshotUrl, resolveArchiveTodaySnapshot } from './archive-today.js';
import { SsrfError } from './ssrf.js';

const lookup = async () => ['8.8.8.8'];

describe('archive frame proxy', () => {
  it('allows known archive hosts only', () => {
    expect(isAllowedArchiveFrameHost('archive.ph')).toBe(true);
    expect(isAllowedArchiveFrameHost('web.archive.org')).toBe(true);
    expect(isAllowedArchiveFrameHost('example.com')).toBe(false);
    expect(() => assertArchiveFrameUrl('https://example.com/x')).toThrow(SsrfError);
  });

  it('injects a base tag and strips framing headers', () => {
    const html = prepareArchiveFrameHtml(
      `<html><head><meta http-equiv="X-Frame-Options" content="DENY"><title>Hi</title></head><body><img src="/a.png"></body></html>`,
      'https://archive.ph/Ab12',
    );
    expect(html).toContain('<base href="https://archive.ph/Ab12">');
    expect(html).not.toContain('X-Frame-Options');
  });

  it('extracts concrete archive.is snapshot ids from newest HTML', () => {
    const html = `<html><head><link rel="canonical" href="https://archive.ph/Ab12Cd" /></head><body>ok</body></html>`;
    expect(extractArchiveTodaySnapshotUrl(html, 'https://archive.ph/newest/https://example.com')).toBe(
      'https://archive.ph/Ab12Cd',
    );
  });

  it('resolves /newest/ to a snapshot id before embedding', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (/\/timemap\//i.test(url)) return new Response('', { status: 404 });
      if (/\/newest\//i.test(url)) {
        return new Response(
          `<html><head><link rel="canonical" href="https://archive.ph/Ab12Cd" /></head><body>${'x'.repeat(100)}</body></html>`,
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
      }
      if (url === 'https://archive.ph/Ab12Cd' || url.endsWith('/Ab12Cd')) {
        return new Response('<html><head></head><body><p>Cached article</p></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      return new Response('missing', { status: 404 });
    });

    const resolved = await resolveArchiveTodaySnapshot('https://example.com/', { fetch, lookup });
    expect(resolved).toBe('https://archive.ph/Ab12Cd');

    const framed = await fetchArchiveFrameHtml('https://archive.ph/newest/https://example.com/', {
      fetch,
      lookup,
    });
    expect(framed.html).toContain('Cached article');
    expect(framed.html).toContain('<base href="https://archive.ph/Ab12Cd">');
  });
});
