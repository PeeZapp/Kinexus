import { describe, expect, it, vi } from 'vitest';

import { scrapeLinkUrl } from './link.js';

const lookup = async () => ['8.8.8.8'];

function htmlResponse(html: string, status = 200) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('scrapeLinkUrl', () => {
  it('reads Open Graph tags and resolves a relative image', async () => {
    const fetch = vi.fn(async () =>
      htmlResponse(
        `<html><head>
          <meta property="og:title" content="Weeknight pasta">
          <meta property="og:description" content="A fast dinner">
          <meta property="og:image" content="/hero.jpg">
          <meta property="og:site_name" content="Example Eats">
          <meta property="og:type" content="article">
          <link rel="icon" href="/icon.png">
        </head></html>`,
      ),
    );
    const result = await scrapeLinkUrl('https://example.com/blog/pasta', { fetch, lookup });
    expect(result.source).toBe('og');
    if (result.source === 'blocked') throw new Error('blocked');
    expect(result.link.title).toBe('Weeknight pasta');
    expect(result.link.description).toBe('A fast dinner');
    expect(result.link.imageUrl).toBe('https://example.com/hero.jpg');
    expect(result.link.siteName).toBe('Example Eats');
    expect(result.link.faviconUrl).toBe('https://example.com/icon.png');
    expect(result.link.linkType).toBe('article');
  });

  it('shortens a Facebook share title instead of saving the full caption', async () => {
    const fetch = vi.fn(async () =>
      htmlResponse(
        `<html><head>
          <meta property="og:site_name" content="Facebook">
          <meta property="og:title" content="5.5K views · 1.6K reactions | Peanut butter nougat. Thick buttery caramel. Roasted peanuts. All coated in real chocolate. The moment you bite into a homemade Snickers bar. | The Chocolate Foody">
          <meta property="og:image" content="https://scontent.xx.fbcdn.net/v/t15.5256-10/snickers.jpg">
          <meta property="og:type" content="video.other">
        </head></html>`,
      ),
    );
    const result = await scrapeLinkUrl('https://www.facebook.com/reel/1048308180936523', { fetch, lookup });
    if (result.source === 'blocked') throw new Error('blocked');
    expect(result.link.title).toBe('Peanut butter nougat. Thick buttery caramel.');
    expect(result.link.siteName).toBe('The Chocolate Foody');
    expect(result.link.description?.startsWith('Peanut butter nougat.')).toBe(true);
    expect(result.link.title!.length).toBeLessThan(80);
    expect(result.link.linkType).toBe('video');
  });

  it('prefers Open Graph title over a JSON-LD name', async () => {
    const fetch = vi.fn(async () =>
      htmlResponse(
        `<html><head>
          <meta property="og:title" content="Sourdough">
          <meta property="og:site_name" content="Wikipedia">
          <script type="application/ld+json">
            {"@type":"Article","name":"bread made with a sourdough starter","publisher":{"name":"Wikimedia Foundation, Inc."}}
          </script>
        </head></html>`,
      ),
    );
    const result = await scrapeLinkUrl('https://en.wikipedia.org/wiki/Sourdough', { fetch, lookup });
    if (result.source === 'blocked') throw new Error('blocked');
    expect(result.link.title).toBe('Sourdough');
    expect(result.link.siteName).toBe('Wikipedia');
  });

  it('prefers JSON-LD article metadata when OG is missing', async () => {
    const fetch = vi.fn(async () =>
      htmlResponse(
        `<html><head>
          <script type="application/ld+json">
            {"@type":"NewsArticle","headline":"City market update","description":"Prices moved","image":"https://cdn.example/story.jpg","publisher":{"name":"The Herald"}}
          </script>
          <title>Herald</title>
        </head></html>`,
      ),
    );
    const result = await scrapeLinkUrl('https://herald.example/story/1', { fetch, lookup });
    if (result.source === 'blocked') throw new Error('blocked');
    expect(result.link.title).toBe('City market update');
    expect(result.link.description).toBe('Prices moved');
    expect(result.link.imageUrl).toBe('https://cdn.example/story.jpg');
    expect(result.link.siteName).toBe('The Herald');
    expect(result.link.linkType).toBe('article');
  });

  it('uses YouTube oEmbed and canonicalizes shorts to a watch URL', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('oembed')) {
        expect(url).toContain('watch%3Fv%3DdQw4w9wgXcQ');
        return jsonResponse({
          title: 'Never Gonna Give You Up',
          author_name: 'Rick Astley',
          thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9wgXcQ/hqdefault.jpg',
          provider_name: 'YouTube',
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const result = await scrapeLinkUrl('https://www.youtube.com/shorts/dQw4w9wgXcQ', { fetch, lookup });
    expect(result.source).toBe('oembed');
    if (result.source === 'blocked') throw new Error('blocked');
    expect(result.link.title).toBe('Never Gonna Give You Up');
    expect(result.link.imageUrl).toContain('hqdefault.jpg');
    expect(result.link.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9wgXcQ');
    expect(result.link.linkType).toBe('video');
  });

  it('follows a page oEmbed discovery link', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/oembed')) {
        return jsonResponse({
          title: 'Clip title',
          thumbnail_url: 'https://cdn.example/thumb.jpg',
          provider_name: 'Clips',
        });
      }
      return htmlResponse(
        `<html><head>
          <link rel="alternate" type="application/json+oembed" href="https://clips.example/oembed?url=1">
        </head></html>`,
      );
    });
    const result = await scrapeLinkUrl('https://clips.example/watch/1', { fetch, lookup });
    if (result.source === 'blocked') throw new Error('blocked');
    expect(result.link.title).toBe('Clip title');
    expect(result.link.imageUrl).toBe('https://cdn.example/thumb.jpg');
    expect(result.link.siteName).toBe('Clips');
  });

  it('reports blocked challenge pages', async () => {
    const fetch = vi.fn(async () => htmlResponse('<title>Just a moment...</title>', 403));
    const result = await scrapeLinkUrl('https://walled.example/post', { fetch, lookup });
    expect(result).toEqual({ source: 'blocked', blocked: true });
  });
});
