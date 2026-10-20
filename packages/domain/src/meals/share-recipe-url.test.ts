import { describe, expect, it } from 'vitest';

import { extractRecipeUrlFromShare } from './share-recipe-url';

describe('extractRecipeUrlFromShare', () => {
  it('prefers an explicit url field', () => {
    const result = extractRecipeUrlFromShare({
      url: 'https://www.tiktok.com/@cook/video/1234567890123456789',
      text: 'Check this out https://example.com/not-this',
    });
    expect(result).toBe('https://www.tiktok.com/@cook/video/1234567890123456789');
  });

  it('extracts a buried link from shared caption text', () => {
    const result = extractRecipeUrlFromShare({
      text: 'Garlic pasta 🍝 https://www.instagram.com/reel/AbC123xyz/?igsh=token try it!',
    });
    expect(result).toBe('https://www.instagram.com/reel/AbC123xyz');
  });

  it('uses webUrl from native share intents', () => {
    const result = extractRecipeUrlFromShare({
      webUrl: 'https://youtu.be/flav0rChx01?si=abc',
      text: 'Watch this',
    });
    expect(result).toBe('https://www.youtube.com/watch?v=flav0rChx01');
  });

  it('strips trailing punctuation from text-embedded links', () => {
    const result = extractRecipeUrlFromShare({
      text: 'Recipe here: https://allrecipes.com/recipe/1/soup).',
    });
    expect(result).toBe('https://allrecipes.com/recipe/1/soup');
  });

  it('returns null when nothing looks like a recipe url', () => {
    expect(extractRecipeUrlFromShare({ text: 'Just a caption', title: 'Dinner' })).toBeNull();
  });
});
