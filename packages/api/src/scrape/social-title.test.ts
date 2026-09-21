import { describe, expect, it } from 'vitest';

import { parseFacebookShareTitle, polishSharePreview, shortSocialTitle } from './social-title.js';

const facebookBlob =
  '5.5K views · 1.6K reactions | Peanut butter nougat. Thick buttery caramel. Roasted peanuts. All coated in real chocolate. The moment you bite into a homemade Snickers bar made with real ingredients you will never look at the store bought version the same way again. | The Chocolate Foody';

describe('facebook share titles', () => {
  it('splits views chrome, caption, and page name', () => {
    const parsed = parseFacebookShareTitle(facebookBlob);
    expect(parsed.authorName).toBe('The Chocolate Foody');
    expect(parsed.caption?.startsWith('Peanut butter nougat.')).toBe(true);
    expect(parsed.caption).not.toMatch(/views/i);
  });

  it('uses the first sentences as the saved title', () => {
    expect(shortSocialTitle(parseFacebookShareTitle(facebookBlob).caption ?? '')).toBe(
      'Peanut butter nougat. Thick buttery caramel.',
    );
  });

  it('polishes a Facebook OG title into a short card title', () => {
    const next = polishSharePreview(
      { title: facebookBlob, description: null, siteName: 'Facebook' },
      'https://www.facebook.com/reel/123',
    );
    expect(next.title).toBe('Peanut butter nougat. Thick buttery caramel.');
    expect(next.siteName).toBe('The Chocolate Foody');
    expect(next.description?.startsWith('Peanut butter nougat.')).toBe(true);
    expect(next.description).not.toMatch(/5\.5K views/i);
    expect(next.title!.length).toBeLessThan(80);
  });
});
