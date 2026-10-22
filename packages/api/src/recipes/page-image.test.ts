import { describe, expect, it } from 'vitest';

import { absoluteHttpImage, imageUrlFromRecipeHtml } from './page-image.js';

const page = 'https://example.com/recipes/pie';

describe('imageUrlFromRecipeHtml', () => {
  it('prefers the schema.org recipe image over the social preview', () => {
    const html = `
      <html>
        <meta property="og:image" content="https://cdn.example/logo.png" />
        <script type="application/ld+json">
          { "@type": "Recipe", "name": "Pie", "image": ["https://cdn.example/pie.jpg"] }
        </script>
      </html>
    `;
    expect(imageUrlFromRecipeHtml(html, page)).toBe('https://cdn.example/pie.jpg');
  });

  it('uses the social preview when the page has no recipe image', () => {
    const html = `<meta property="og:image" content="/photos/stew.jpg?w=1200" />`;
    expect(imageUrlFromRecipeHtml(html, page)).toBe('https://example.com/photos/stew.jpg?w=1200');
  });

  it('reads an image nested in @graph', () => {
    const html = `
      <script type="application/ld+json">
        { "@graph": [{ "@type": "Recipe", "image": { "url": "https://cdn.example/graph.webp" } }] }
      </script>
    `;
    expect(imageUrlFromRecipeHtml(html, page)).toBe('https://cdn.example/graph.webp');
  });
});

describe('absoluteHttpImage', () => {
  it('drops data urls and svg files', () => {
    expect(absoluteHttpImage('data:image/png;base64,abc', page)).toBeUndefined();
    expect(absoluteHttpImage('https://cdn.example/icon.svg', page)).toBeUndefined();
  });

  it('skips a site logo when that is the only image', () => {
    const html = `<meta property="og:image" content="https://en.wikibooks.org/static/images/project-logos/enwikibooks.png" />`;
    expect(imageUrlFromRecipeHtml(html, page)).toBeUndefined();
  });
});
