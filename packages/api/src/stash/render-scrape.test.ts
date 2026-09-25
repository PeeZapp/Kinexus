import { describe, expect, it } from 'vitest';

import { productFromRenderBody, renderScrapeBase } from './render-scrape';

describe('render scrape mapping', () => {
  it('reads the Stashd product payload', () => {
    expect(
      productFromRenderBody({
        title: 'Air Max',
        current_price: 180,
        original_price: 220,
        image_url: 'https://cdn.example/shoe.jpg',
        store_name: 'Nike',
        description: 'Shoes',
        sku: 'IB1',
      }),
    ).toEqual({
      title: 'Air Max',
      currentPrice: 180,
      originalPrice: 220,
      imageUrl: 'https://cdn.example/shoe.jpg',
      storeName: 'Nike',
      description: 'Shoes',
      sku: 'IB1',
    });
  });

  it('treats a blocked response as no product', () => {
    expect(productFromRenderBody({ error: 'bot_protection', title: 'Nike' })).toBeNull();
    expect(productFromRenderBody(null)).toBeNull();
  });

  it('drops a trailing slash from the Render origin', () => {
    expect(renderScrapeBase({ STASH_RENDER_SCRAPE_URL: 'https://stashd-api.onrender.com/' } as NodeJS.ProcessEnv)).toBe(
      'https://stashd-api.onrender.com',
    );
    expect(renderScrapeBase({} as NodeJS.ProcessEnv)).toBeNull();
  });
});
