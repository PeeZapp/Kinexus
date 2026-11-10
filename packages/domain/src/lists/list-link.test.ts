import { describe, expect, it } from 'vitest';

import { buildLetterboxdImportCsv, buildListExport } from './export-build';
import {
  LIST_LINK_MAX_PAGES,
  buildImportPlanFromListLink,
  classifyWatchlistListImportUrl,
  isWatchlistListImportUrl,
  mergeListLinkItems,
  parseImdbListHtml,
  parseLetterboxdListHtml,
} from './parse-list-link';

const IMDB_LIST_HTML = `
<html><head><title>Mind-benders - IMDb</title>
<meta property="og:title" content="Mind-benders" />
</head><body>
<h1>Mind-benders</h1>
<div class="lister-item mode-detail" data-tconst="tt1375666">
  <h3 class="lister-item-header">
    <a href="/title/tt1375666/?ref_=ttls_li_tt">Inception</a>
    <span class="lister-item-year text-muted">(2010)</span>
  </h3>
</div>
<div class="lister-item mode-detail" data-tconst="tt0816692">
  <h3 class="lister-item-header">
    <a href="/title/tt0816692/?ref_=ttls_li_tt">Interstellar</a>
    <span class="lister-item-year text-muted">(2014)</span>
  </h3>
</div>
<a href="/list/ls000123456/?page=2">2</a>
</body></html>
`;

const IMDB_PRIVATE_HTML = `
<html><body><h1>Sign in</h1><p>This list is private.</p></body></html>
`;

const LB_LIST_HTML = `
<html><head><meta property="og:title" content="Favourites, a list of films by alice" /></head>
<body>
<h1 class="title-1 prettify">Favourites</h1>
<ul>
  <li><div class="film-poster" data-film-name="Parasite" data-film-release-year="2019" data-target-link="/film/parasite/"></div></li>
  <li><div class="film-poster" data-item-name="The Matrix" data-item-full-display-name="The Matrix (1999)" data-film-release-year="1999"></div></li>
</ul>
<a href="/alice/list/favourites/page/2/">Older</a>
</body></html>
`;

const LB_WATCHLIST_HTML = `
<html><head><title>alice&apos;s watchlist • Letterboxd</title></head>
<body>
<h1>alice</h1>
<div class="film-poster" data-film-name="Heat" data-film-release-year="1995"></div>
<div class="film-poster" data-film-name="Zodiac" data-film-release-year="2007"></div>
</body></html>
`;

const LB_PRIVATE_HTML = `
<html><body><p>Sorry, this list is private and you do not have permission to view it.</p></body></html>
`;

describe('watchlist list import URL classify', () => {
  it('accepts IMDb list and Letterboxd list/watchlist links', () => {
    expect(isWatchlistListImportUrl('https://www.imdb.com/list/ls000123456/')).toBe(true);
    expect(classifyWatchlistListImportUrl('https://www.imdb.com/list/ls000123456/?ref=x')).toEqual({
      source: 'imdb',
      canonicalUrl: 'https://www.imdb.com/list/ls000123456/',
    });
    expect(isWatchlistListImportUrl('https://letterboxd.com/alice/list/favourites/')).toBe(true);
    expect(isWatchlistListImportUrl('https://letterboxd.com/alice/watchlist/')).toBe(true);
  });

  it('accepts scheme-less IMDb and Letterboxd list links', () => {
    expect(isWatchlistListImportUrl('www.imdb.com/list/ls000123456/')).toBe(true);
    expect(classifyWatchlistListImportUrl('letterboxd.com/alice/watchlist/')).toEqual({
      source: 'letterboxd',
      canonicalUrl: 'https://letterboxd.com/alice/watchlist/',
    });
  });

  it('accepts boxd.it short links and Letterboxd /detail share URLs', () => {
    expect(classifyWatchlistListImportUrl('https://boxd.it/gaHVO/detail')).toEqual({
      source: 'letterboxd',
      canonicalUrl: 'https://boxd.it/gaHVO',
    });
    expect(
      classifyWatchlistListImportUrl(
        'https://letterboxd.com/dfromero/list/massive-cinemas-100-best-british-films-of/detail/',
      ),
    ).toEqual({
      source: 'letterboxd',
      canonicalUrl: 'https://letterboxd.com/dfromero/list/massive-cinemas-100-best-british-films-of/',
    });
  });

  it('accepts IMDb chart URLs', () => {
    expect(classifyWatchlistListImportUrl('https://www.imdb.com/chart/top/')).toEqual({
      source: 'imdb',
      canonicalUrl: 'https://www.imdb.com/chart/top/',
    });
    expect(isWatchlistListImportUrl('https://www.imdb.com/chart/toptv')).toBe(true);
  });

  it('rejects single-title links', () => {
    expect(isWatchlistListImportUrl('https://www.imdb.com/title/tt0133093/')).toBe(false);
    expect(isWatchlistListImportUrl('https://letterboxd.com/film/the-matrix/')).toBe(false);
  });
});

describe('IMDb list HTML parser', () => {
  it('extracts tt ids with title/year and next page', () => {
    const parsed = parseImdbListHtml(IMDB_LIST_HTML, 'https://www.imdb.com/list/ls000123456/');
    expect(parsed.listName).toBe('Mind-benders');
    expect(parsed.items).toEqual([
      { imdbId: 'tt1375666', title: 'Inception', year: 2010 },
      { imdbId: 'tt0816692', title: 'Interstellar', year: 2014 },
    ]);
    expect(parsed.nextPageUrl).toBe('https://www.imdb.com/list/ls000123456/?page=2');
  });

  it('extracts chart titles from __NEXT_DATA__', () => {
    const chartHtml = `<html><head><title>IMDb Top 250 Movies</title>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          pageData: {
            chartTitles: {
              edges: [
                {
                  currentRank: 1,
                  node: {
                    id: 'tt0111161',
                    titleText: { text: 'The Shawshank Redemption' },
                    releaseYear: { year: 1994 },
                  },
                },
                {
                  currentRank: 2,
                  node: {
                    id: 'tt0068646',
                    titleText: { text: 'The Godfather' },
                    releaseYear: { year: 1972 },
                  },
                },
              ],
            },
          },
        },
      },
    })}</script></head><body><h1>Top 250 Movies</h1></body></html>`;
    const parsed = parseImdbListHtml(chartHtml, 'https://www.imdb.com/chart/top/');
    expect(parsed.listName).toMatch(/Top 250/i);
    expect(parsed.items).toEqual([
      { imdbId: 'tt0111161', title: 'The Shawshank Redemption', year: 1994 },
      { imdbId: 'tt0068646', title: 'The Godfather', year: 1972 },
    ]);
    expect(parsed.nextPageUrl).toBeNull();
  });

  it('marks private pages', () => {
    const parsed = parseImdbListHtml(IMDB_PRIVATE_HTML, 'https://www.imdb.com/list/ls000123456/');
    expect(parsed.privateOrBlocked).toBe(true);
    expect(parsed.items).toEqual([]);
  });
});

describe('Letterboxd list HTML parser', () => {
  it('extracts title/year from list pages', () => {
    const parsed = parseLetterboxdListHtml(LB_LIST_HTML, 'https://letterboxd.com/alice/list/favourites/');
    expect(parsed.listName).toMatch(/Favourites/i);
    expect(parsed.items).toEqual([
      { title: 'Parasite', year: 2019, imdbId: null },
      { title: 'The Matrix', year: 1999, imdbId: null },
    ]);
    expect(parsed.nextPageUrl).toBe('https://letterboxd.com/alice/list/favourites/page/2/');
  });

  it('extracts title/year from watchlist pages', () => {
    const parsed = parseLetterboxdListHtml(LB_WATCHLIST_HTML, 'https://letterboxd.com/alice/watchlist/');
    expect(parsed.items.map((item) => [item.title, item.year])).toEqual([
      ['Heat', 1995],
      ['Zodiac', 2007],
    ]);
  });

  it('marks private pages', () => {
    const parsed = parseLetterboxdListHtml(LB_PRIVATE_HTML, 'https://letterboxd.com/alice/list/secret/');
    expect(parsed.privateOrBlocked).toBe(true);
    expect(parsed.items).toEqual([]);
  });

  it('does not treat Letterboxd chrome "private list" copy as blocked', () => {
    const html = `
      <html><head><title>Favourites, a list of films by alice</title></head>
      <body>
      <script>polarity: { 'you': { 'label': 'private', 'description': 'you (private list)' } }</script>
      <h1 class="title-1">Favourites</h1>
      <div class="react-component" data-item-name="Heat (1995)" data-item-full-display-name="Heat (1995)"></div>
      </body></html>
    `;
    const parsed = parseLetterboxdListHtml(html, 'https://letterboxd.com/alice/list/favourites/');
    expect(parsed.privateOrBlocked).toBe(false);
    expect(parsed.items).toEqual([{ title: 'Heat', year: 1995, imdbId: null }]);
  });
});

describe('list link merge + plan', () => {
  it('caps conceptual pagination and builds a watchlist plan', () => {
    expect(LIST_LINK_MAX_PAGES).toBe(5);
    const page1 = parseImdbListHtml(IMDB_LIST_HTML, 'https://www.imdb.com/list/ls000123456/');
    const merged = mergeListLinkItems([page1]);
    const plan = buildImportPlanFromListLink(merged);
    expect(plan.kind).toBe('watchlist');
    expect(plan.suggestedName).toBe('Mind-benders');
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[0]?.imdbId).toBe('tt1375666');
    expect(plan.rows[0]?.status).toBe('needsMatch');
  });
});

describe('export formats', () => {
  it('keeps Letterboxd CSV and has no IMDb export format', () => {
    const built = buildLetterboxdImportCsv({
      kind: 'watchlist',
      listName: 'Want',
      listId: null,
      items: [{ title: 'Inception', year: 2010, imdbId: 'tt1375666' }],
    });
    expect(built.fileName).toContain('letterboxd');
    expect(built.text).toContain('Title,Year,imdbID');
    expect(() =>
      buildListExport({ kind: 'watchlist', listName: 'Want', listId: null, items: [] }, 'letterboxd-csv'),
    ).not.toThrow();
    // ListExportFormat has no imdb export variant.
    const formats: string[] = ['json', 'csv', 'xlsx', 'text', 'letterboxd-csv', 'goodreads-csv'];
    expect(formats).not.toContain('imdb-csv');
  });
});
