import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildImportPlan } from './import-plan';
import { buildLetterboxdImportCsv, buildListExport } from './export-build';
import {
  MATCH_AUTO_ACCEPT,
  MATCH_NEEDS_CONFIRM,
  classifyMatchConfidence,
  letterboxdRatingToScore,
  scoreToLetterboxdRating,
  titleYearMatchConfidence,
} from './match-confidence';
import { parseImdbCsv } from './parse-imdb';
import { parseLetterboxdCsv, parseLetterboxdZip } from './parse-letterboxd';
import { detectListSource } from './detect';

const IMDB_WATCHLIST = `Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
1,tt1375666,2020-01-01,2020-01-01,,Inception,https://www.imdb.com/title/tt1375666/,movie,8.8,148,2010,Action,2000000,2010-07-16,Christopher Nolan
2,tt0903747,2020-01-02,2020-01-02,,Breaking Bad,https://www.imdb.com/title/tt0903747/,tvSeries,9.5,45,2008,Crime,2000000,2008-01-20,
`;

const IMDB_RATINGS = `Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
tt0133093,10,2019-05-01,The Matrix,https://www.imdb.com/title/tt0133093/,movie,8.7,136,1999,Action,1800000,1999-03-31,Lana Wachowski
`;

const IMDB_LIST = `Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
1,tt0816692,2021-01-01,2021-01-01,Mind-bending,Interstellar,https://www.imdb.com/title/tt0816692/,movie,8.6,169,2014,Adventure,1700000,2014-11-07,Christopher Nolan
`;

const LB_WATCHLIST = `Date,Name,Year,Letterboxd URI,Rating
2024-01-01,Inception,2010,https://boxd.it/1Skk,
2024-01-02,The Wire,2002,https://boxd.it/2abc,
`;

const LB_WATCHED = `Date,Name,Year,Letterboxd URI,Rating
2023-06-15,The Matrix,1999,https://boxd.it/2a2m,5
`;

const LB_RATINGS = `Date,Name,Year,Letterboxd URI,Rating
2023-06-15,The Matrix,1999,https://boxd.it/2a2m,4.5
`;

const LB_LIST = `Position,Name,Year,Letterboxd URI,Description
1,Parasite,2019,https://boxd.it/hNUu,Favorite
`;

describe('IMDb CSV parsers', () => {
  it('parses watchlist export by tconst', () => {
    const rows = parseImdbCsv(IMDB_WATCHLIST);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: 'Inception',
      year: 2010,
      imdbId: 'tt1375666',
      mediaType: 'movie',
      itemStatus: 'want',
    });
    expect(rows[1]).toMatchObject({
      title: 'Breaking Bad',
      imdbId: 'tt0903747',
      mediaType: 'tv',
    });
  });

  it('parses ratings export with score and watched status', () => {
    const rows = parseImdbCsv(IMDB_RATINGS);
    expect(rows[0]).toMatchObject({
      title: 'The Matrix',
      imdbId: 'tt0133093',
      rating: 10,
      itemStatus: 'watched',
      watchedDate: '2019-05-01',
    });
  });

  it('parses list export', () => {
    const rows = parseImdbCsv(IMDB_LIST);
    expect(rows[0]).toMatchObject({ title: 'Interstellar', imdbId: 'tt0816692', year: 2014 });
  });

  it('detects imdb-csv from text', () => {
    expect(detectListSource({ fileName: 'watchlist.csv', text: IMDB_WATCHLIST })).toBe('imdb-csv');
  });
});

describe('Letterboxd CSV parsers', () => {
  it('parses watchlist.csv as want', () => {
    const rows = parseLetterboxdCsv(LB_WATCHLIST, 'watchlist.csv');
    expect(rows.map((row) => [row.title, row.itemStatus])).toEqual([
      ['Inception', 'want'],
      ['The Wire', 'want'],
    ]);
  });

  it('parses watched.csv as watched with rating', () => {
    const rows = parseLetterboxdCsv(LB_WATCHED, 'watched.csv');
    expect(rows[0]).toMatchObject({
      title: 'The Matrix',
      year: 1999,
      itemStatus: 'watched',
      rating: 10,
      watchedDate: '2023-06-15',
    });
  });

  it('parses ratings.csv', () => {
    const rows = parseLetterboxdCsv(LB_RATINGS, 'ratings.csv');
    expect(rows[0]?.rating).toBe(9);
    expect(rows[0]?.itemStatus).toBe('watched');
  });

  it('parses lists/*.csv', () => {
    const rows = parseLetterboxdCsv(LB_LIST, 'lists/favorites.csv');
    expect(rows[0]).toMatchObject({ title: 'Parasite', year: 2019 });
  });

  it('unzips Letterboxd export and merges files', async () => {
    const zip = new JSZip();
    zip.file('watchlist.csv', LB_WATCHLIST);
    zip.file('watched.csv', LB_WATCHED);
    zip.file('ratings.csv', LB_RATINGS);
    zip.file('lists/favorites.csv', LB_LIST);
    zip.file('profile.csv', 'Name,Value\nFoo,Bar\n');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const parsed = await parseLetterboxdZip(bytes);
    expect(parsed.filesUsed).toEqual(
      expect.arrayContaining(['watchlist.csv', 'watched.csv', 'ratings.csv', 'lists/favorites.csv']),
    );
    expect(parsed.filesUsed).not.toContain('profile.csv');
    const matrix = parsed.rows.find((row) => row.title === 'The Matrix');
    expect(matrix?.itemStatus).toBe('watched');
    expect(matrix?.rating).toBe(9);
    expect(parsed.rows.some((row) => row.title === 'Parasite')).toBe(true);
  });

  it('buildImportPlan handles letterboxd zip', async () => {
    const zip = new JSZip();
    zip.file('watchlist.csv', LB_WATCHLIST);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const plan = await buildImportPlan({
      fileName: 'letterboxd-2024-01-01.zip',
      bytes,
      kindHint: 'watchlist',
    });
    expect(plan.format).toBe('letterboxd-zip');
    expect(plan.kind).toBe('watchlist');
    expect(plan.rows.every((row) => row.status === 'needsMatch')).toBe(true);
  });
});

describe('match confidence', () => {
  it('auto-accepts exact title+year', () => {
    const score = titleYearMatchConfidence(
      { title: 'Inception', year: 2010 },
      { title: 'Inception', year: 2010 },
    );
    expect(score).toBeGreaterThanOrEqual(MATCH_AUTO_ACCEPT);
    expect(classifyMatchConfidence(score)).toBe('auto');
  });

  it('needs confirmation for year off-by-one', () => {
    const score = titleYearMatchConfidence(
      { title: 'Inception', year: 2010 },
      { title: 'Inception', year: 2011 },
    );
    expect(classifyMatchConfidence(score)).toBe('confirm');
    expect(score).toBeGreaterThanOrEqual(MATCH_NEEDS_CONFIRM);
    expect(score).toBeLessThan(MATCH_AUTO_ACCEPT);
  });

  it('converts Letterboxd ratings', () => {
    expect(letterboxdRatingToScore(4.5)).toBe(9);
    expect(scoreToLetterboxdRating(9)).toBe(4.5);
  });
});

describe('Letterboxd export format', () => {
  it('emits Title,Year,imdbID,Rating,WatchedDate', () => {
    const built = buildLetterboxdImportCsv({
      kind: 'watchlist',
      listName: 'Mine',
      items: [
        {
          title: 'Inception',
          year: 2010,
          imdbId: 'tt1375666',
          rating: 10,
          watchedDate: '2024-01-02',
          itemStatus: 'watched',
        },
        { title: 'The Wire', year: 2002, imdbId: null, rating: null },
      ],
    });
    expect(built.fileName).toContain('letterboxd');
    expect(built.text).toContain('Title,Year,imdbID,Rating,WatchedDate');
    expect(built.text).toContain('Inception,2010,tt1375666,5,2024-01-02');
    expect(built.text).toContain('The Wire,2002,,,');
  });

  it('is available via buildListExport', () => {
    const built = buildListExport(
      { kind: 'watchlist', listName: 'Q', items: [{ title: 'Heat', year: 1995, imdbId: 'tt0113277' }] },
      'letterboxd-csv',
    );
    expect(built.text?.split('\n')[0]).toBe('Title,Year,imdbID,Rating,WatchedDate');
  });
});
