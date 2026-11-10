import { describe, expect, it, vi } from 'vitest';

import { LIST_LINK_PUBLIC_ERROR } from '@kinexus/domain';

import { handleListsImportLink, importWatchlistFromListLink } from './import-link.js';
import { SsrfError, isPrivateIp } from '../scrape/ssrf.js';

const IMDB_PAGE = (page: number, hasNext: boolean) => `
<html><head><title>Sci-Fi - IMDb</title></head><body>
<h1>Sci-Fi</h1>
<div class="lister-item mode-detail" data-tconst="tt000000${page}">
  <h3 class="lister-item-header">
    <a href="/title/tt000000${page}/">Title ${page}</a>
    <span class="lister-item-year text-muted">(200${page})</span>
  </h3>
</div>
${hasNext ? `<a href="/list/ls000123456/?page=${page + 1}">Next</a>` : ''}
</body></html>
`;

describe('lists import link', () => {
  it('rejects private IPs via SSRF guard', async () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    const result = await handleListsImportLink(
      { url: 'https://www.imdb.com/list/ls000123456/' },
      {
        lookup: async () => ['127.0.0.1'],
        fetch: vi.fn(async () => new Response('nope', { status: 200 })),
      },
    );
    expect(result.status).toBe(400);
    expect('error' in result.body && result.body.error).toMatch(/not allowed/i);
  });

  it('returns friendly error for non-public pages', async () => {
    const result = await handleListsImportLink(
      { url: 'https://www.imdb.com/list/ls000123456/' },
      {
        lookup: async () => ['93.184.216.34'],
        fetch: vi.fn(async () => new Response('<html><body>This list is private.</body></html>', { status: 200 })),
      },
    );
    expect(result.status).toBe(422);
    expect(result.body).toEqual({ error: LIST_LINK_PUBLIC_ERROR });
  });

  it('fetches at most 5 paginated pages', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const page = Number(new URL(url).searchParams.get('page') || '1');
      return new Response(IMDB_PAGE(page, page < 8), {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    });

    const result = await importWatchlistFromListLink('https://www.imdb.com/list/ls000123456/', {
      lookup: async () => ['93.184.216.34'],
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.pageCount).toBe(5);
    expect(result.rows).toHaveLength(5);
    expect(result.suggestedName).toBe('Sci-Fi');
    expect(result.rows[0]?.imdbId).toBe('tt0000001');
  });

  it('parses Letterboxd list HTML via the handler', async () => {
    const html = `
      <html><body><h1>Favourites</h1>
      <div class="film-poster" data-film-name="Heat" data-film-release-year="1995"></div>
      </body></html>
    `;
    const result = await handleListsImportLink(
      { url: 'https://letterboxd.com/alice/list/favourites/' },
      {
        lookup: async () => ['93.184.216.34'],
        fetch: vi.fn(async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })),
      },
    );
    expect(result.status).toBe(200);
    if ('error' in result.body) throw new Error(result.body.error);
    expect(result.body.rows).toEqual([{ key: '0', title: 'Heat', year: 1995, imdbId: null }]);
  });

  it('maps SsrfError from lookup to 400', async () => {
    const result = await handleListsImportLink(
      { url: 'https://www.imdb.com/list/ls000123456/' },
      {
        lookup: async () => {
          throw new SsrfError();
        },
      },
    );
    expect(result.status).toBe(400);
  });
});
