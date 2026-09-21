import { describe, expect, it } from 'vitest';

import { RecipeUrlError, classifyRecipeHost, normalizeRecipeUrl } from './recipe-url';

describe('normalizeRecipeUrl', () => {
  it('canonicalizes a blog URL and strips tracking params', () => {
    const result = normalizeRecipeUrl('https://www.allrecipes.com/recipe/123/pasta/?utm_source=x&fbclid=1');
    expect(result.sourceKind).toBe('web');
    expect(result.canonicalUrl).toBe('https://allrecipes.com/recipe/123/pasta');
  });

  it('unwraps the kinexus /https:// prefix form', () => {
    const result = normalizeRecipeUrl('https://kinexus.app/https://www.allrecipes.com/recipe/99/soup');
    expect(result.canonicalUrl).toBe('https://allrecipes.com/recipe/99/soup');
    expect(result.inputUrl).toContain('kinexus.app');
  });

  it('unwraps collapsed /https:/ after a kinexus host', () => {
    const result = normalizeRecipeUrl('https://kinexus.app/https:/www.youtube.com/watch?v=abc123');
    expect(result.sourceKind).toBe('youtube');
    expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('accepts a path-only prefix', () => {
    const result = normalizeRecipeUrl('/https://www.tiktok.com/@cook/video/111');
    expect(result.sourceKind).toBe('tiktok');
    expect(result.canonicalUrl).toBe('https://www.tiktok.com/@cook/video/111');
  });

  it('normalizes youtu.be', () => {
    const result = normalizeRecipeUrl('https://youtu.be/xyz789');
    expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=xyz789');
    expect(result.videoId).toBe('xyz789');
  });

  it('canonicalizes Shorts, watch, and share ?si= URLs to the same watch id', () => {
    const id = 'flav0rChx01';
    const expected = `https://www.youtube.com/watch?v=${id}`;
    const shapes = [
      `https://www.youtube.com/shorts/${id}`,
      `https://youtube.com/shorts/${id}?si=AbCdEfGhIjKlMnop`,
      `https://www.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/watch?v=${id}&si=sharetoken`,
      `https://youtu.be/${id}?si=sharetoken`,
      `https://m.youtube.com/shorts/${id}?feature=share`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
    ];
    for (const raw of shapes) {
      const result = normalizeRecipeUrl(raw);
      expect(result.sourceKind).toBe('youtube');
      expect(result.canonicalUrl).toBe(expected);
      expect(result.videoId).toBe(id);
      expect(result.inputUrl).toBe(raw);
    }
  });

  it('does not require tracking params on a valid video id', () => {
    const withSi = normalizeRecipeUrl('https://youtu.be/flav0rChx01?si=token');
    const withoutSi = normalizeRecipeUrl('https://youtu.be/flav0rChx01');
    expect(withoutSi.canonicalUrl).toBe(withSi.canonicalUrl);
    expect(withoutSi.videoId).toBe('flav0rChx01');
  });

  it('canonicalizes TikTok @user/video ids and strips query params', () => {
    const result = normalizeRecipeUrl(
      'https://www.tiktok.com/@cook/video/7123456789012345678?is_from_webapp=1&sender_device=pc',
    );
    expect(result.sourceKind).toBe('tiktok');
    expect(result.canonicalUrl).toBe('https://www.tiktok.com/@cook/video/7123456789012345678');
    expect(result.videoId).toBe('7123456789012345678');
  });

  it('canonicalizes Instagram reel/p/tv share links', () => {
    const reel = normalizeRecipeUrl('https://www.instagram.com/reel/AbC123xyz/?igsh=token');
    expect(reel.canonicalUrl).toBe('https://www.instagram.com/reel/AbC123xyz');
    expect(reel.videoId).toBe('AbC123xyz');
    const reels = normalizeRecipeUrl('https://www.instagram.com/reels/AbC123xyz');
    expect(reels.canonicalUrl).toBe('https://www.instagram.com/reel/AbC123xyz');
    const post = normalizeRecipeUrl('https://www.instagram.com/p/AbC123xyz/?utm_source=ig_web');
    expect(post.canonicalUrl).toBe('https://www.instagram.com/p/AbC123xyz');
  });

  it('canonicalizes Facebook share, reel, watch, and fb.watch links', () => {
    const share = normalizeRecipeUrl('https://www.facebook.com/share/r/19gXXsQ2qs/?mibextid=wwXIfr');
    expect(share.sourceKind).toBe('facebook');
    expect(share.canonicalUrl).toBe('https://www.facebook.com/share/r/19gXXsQ2qs');
    expect(share.videoId).toBe('19gXXsQ2qs');

    const reel = normalizeRecipeUrl('https://m.facebook.com/reel/1048308180936523/?s=single_unit');
    expect(reel.canonicalUrl).toBe('https://www.facebook.com/reel/1048308180936523');
    expect(reel.videoId).toBe('1048308180936523');

    const watch = normalizeRecipeUrl('https://www.facebook.com/watch/?v=1048308180936523&ref=sharing');
    expect(watch.canonicalUrl).toBe('https://www.facebook.com/watch/?v=1048308180936523');
    expect(watch.videoId).toBe('1048308180936523');

    const pageVideo = normalizeRecipeUrl(
      'https://www.facebook.com/61550868958621/videos/soft-chocolate-nougat/1048308180936523/',
    );
    expect(pageVideo.canonicalUrl).toBe('https://www.facebook.com/reel/1048308180936523');
    expect(pageVideo.videoId).toBe('1048308180936523');

    const fbWatch = normalizeRecipeUrl('https://fb.watch/abcDE12345/?fbclid=IwAR0');
    expect(fbWatch.sourceKind).toBe('facebook');
    expect(fbWatch.canonicalUrl).toBe('https://fb.watch/abcDE12345');
    expect(fbWatch.videoId).toBe('abcDE12345');
  });

  it('rejects a bad URL', () => {
    expect(() => normalizeRecipeUrl('not a url')).toThrow(RecipeUrlError);
    expect(() => normalizeRecipeUrl('javascript:alert(1)')).toThrow(RecipeUrlError);
    try {
      normalizeRecipeUrl('');
    } catch (err) {
      expect(err).toBeInstanceOf(RecipeUrlError);
      expect((err as RecipeUrlError).code).toBe('invalid_url');
    }
  });
});

describe('classifyRecipeHost', () => {
  it('detects video hosts', () => {
    expect(classifyRecipeHost('www.youtube.com')).toBe('youtube');
    expect(classifyRecipeHost('m.youtube.com')).toBe('youtube');
    expect(classifyRecipeHost('vm.tiktok.com')).toBe('tiktok');
    expect(classifyRecipeHost('www.instagram.com')).toBe('instagram');
    expect(classifyRecipeHost('www.facebook.com')).toBe('facebook');
    expect(classifyRecipeHost('m.facebook.com')).toBe('facebook');
    expect(classifyRecipeHost('fb.watch')).toBe('facebook');
    expect(classifyRecipeHost('allrecipes.com')).toBe('web');
  });
});
