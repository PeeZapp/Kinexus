import { describe, expect, it } from 'vitest';

import { guessShareTarget, shareTargetPrimaryActionLabel } from './share-target';

describe('guessShareTarget', () => {
  it('ranks Hevy share links as workout', () => {
    expect(guessShareTarget({ url: 'https://hevy.com/workout/9zxJ5CLFduN' }).targets[0]).toBe('workout');
    expect(guessShareTarget({ url: 'https://hevy.app/x/abc123' }).targets[0]).toBe('workout');
    expect(guessShareTarget({ url: 'https://www.hevy.com/routine/abc' }).targets[0]).toBe('workout');
  });

  it('ranks watchlist hosts first', () => {
    for (const url of [
      'https://www.imdb.com/title/tt0133093/',
      'https://www.themoviedb.org/movie/603',
      'https://letterboxd.com/film/the-matrix/',
      'https://www.justwatch.com/au/movie/the-matrix',
    ]) {
      const guess = guessShareTarget({ url });
      expect(guess.targets[0]).toBe('watchlist');
      expect(guess.url).toContain('http');
      expect(guess.preview.host).toBeTruthy();
    }
  });

  it('ranks readlist hosts and ISBN text first', () => {
    expect(guessShareTarget({ url: 'https://www.goodreads.com/book/show/5907' }).targets[0]).toBe('readlist');
    expect(guessShareTarget({ url: 'https://openlibrary.org/works/OL45804W' }).targets[0]).toBe('readlist');
    expect(guessShareTarget({ url: 'https://hardcover.app/books/the-hobbit' }).targets[0]).toBe('readlist');
    expect(guessShareTarget({ url: 'https://books.google.com/books?id=abc123' }).targets[0]).toBe('readlist');
    expect(guessShareTarget({ text: '9780306406157' }).targets[0]).toBe('readlist');
    expect(guessShareTarget({ text: 'ISBN 0-306-40615-2' }).targets[0]).toBe('readlist');
  });

  it('ranks Amazon book signals as readlist and other Amazon as wishlist', () => {
    expect(
      guessShareTarget({ url: 'https://www.amazon.com/dp/0306406152' }).targets[0],
    ).toBe('readlist');
    expect(
      guessShareTarget({ url: 'https://www.amazon.com/Some-Book/dp/B00KINDLE1?i=stripbooks' }).targets[0],
    ).toBe('readlist');
    expect(guessShareTarget({ url: 'https://www.amazon.com/dp/B00ABCDE12' }).targets[0]).toBe('wishlist');
  });

  it('ranks known recipe hosts and /recipe paths as recipe', () => {
    expect(guessShareTarget({ url: 'https://www.allrecipes.com/recipe/123/pasta' }).targets[0]).toBe('recipe');
    expect(guessShareTarget({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }).targets[0]).toBe('recipe');
    expect(guessShareTarget({ url: 'https://example.com/recipe/soup' }).targets[0]).toBe('recipe');
  });

  it('ranks shop hosts and product paths as wishlist', () => {
    expect(guessShareTarget({ url: 'https://www.etsy.com/listing/1/mug' }).targets[0]).toBe('wishlist');
    expect(guessShareTarget({ url: 'https://shop.example.com/products/shoes' }).targets[0]).toBe('wishlist');
  });

  it('ranks multi-line text with no URL as shopping', () => {
    const guess = guessShareTarget({ text: 'milk\neggs\nbread' });
    expect(guess.targets[0]).toBe('shopping');
    expect(guess.url).toBeNull();
  });

  it('ranks unknown URLs as recipe then wishlist', () => {
    const guess = guessShareTarget({ url: 'https://obscure.example/page/123', title: 'Notes' });
    expect(guess.targets.slice(0, 2)).toEqual(['recipe', 'wishlist']);
    expect(guess.preview.title).toBe('Notes');
    expect(guess.preview.host).toBe('obscure.example');
  });
});

describe('shareTargetPrimaryActionLabel', () => {
  it('labels the primary picker action', () => {
    expect(shareTargetPrimaryActionLabel('watchlist')).toBe('Add to Watchlist');
    expect(shareTargetPrimaryActionLabel('recipe')).toBe('Import recipe');
  });
});
