import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RECIPE_NOT_FOUND_MESSAGE, normalizeRecipeUrl } from '@kinexus/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertPublicHttpUrl, fetchPublicHtml, SsrfError } from '../scrape/index.js';
import { scrapeRecipeSource } from '../scrape/recipe-source.js';
import { extractJsonLdRecipe } from './extract-jsonld.js';
import { extractMicrodataRecipe } from './extract-microdata.js';
import { fetchVideoMetadata, videoMetadataToText, videoTextIsUsable } from './extract-video.js';
import {
  facebookCaptionFileToText,
  facebookCaptionTrackUrl,
  parseFacebookCrawlerHtml,
} from './adapters/facebook-comments.js';
import { handleCreateRecipeImport } from './handlers.js';
import { processRecipeImport } from './pipeline.js';
import { resetRecipeImportRateLimit } from './rate-limit.js';
import { resetRecipeImportStore, saveImport } from './store.js';

const here = dirname(fileURLToPath(import.meta.url));
const jsonLdHtml = readFileSync(join(here, 'fixtures/json-ld-blog.html'), 'utf8');
const fluffHtml = readFileSync(join(here, 'fixtures/fluff-blog.html'), 'utf8');
const videoMeta = JSON.parse(readFileSync(join(here, 'fixtures/non-recipe-video.json'), 'utf8')) as {
  title: string;
  author_name: string;
  thumbnail_url: string;
};
const youtubeChicken = JSON.parse(readFileSync(join(here, 'fixtures/youtube-chicken.json'), 'utf8')) as YoutubeFixture;
const tiktokRecipe = JSON.parse(readFileSync(join(here, 'fixtures/tiktok-recipe.json'), 'utf8')) as {
  id: string;
  oembed: { title: string; author_name: string; thumbnail_url: string };
};
const facebookShareHtml = readFileSync(join(here, 'fixtures/facebook-share.html'), 'utf8');
const facebookCrawlerHtml = readFileSync(join(here, 'fixtures/facebook-crawler.html'), 'utf8');
const facebookTeaserHtml = readFileSync(join(here, 'fixtures/facebook-teaser.html'), 'utf8');

type YoutubeFixture = {
  id: string;
  oembed: { title: string; author_name: string; thumbnail_url: string };
  description: string;
  captions: string;
};

const publicLookup = async () => ['8.8.8.8'];

function htmlResponse(html: string): Response {
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function userAgent(init?: RequestInit): string {
  const headers = init?.headers;
  if (!headers) return '';
  if (headers instanceof Headers) return headers.get('User-Agent') ?? '';
  if (Array.isArray(headers)) {
    const hit = headers.find((entry) => entry[0]?.toLowerCase() === 'user-agent');
    return hit?.[1] ?? '';
  }
  const rec = headers as Record<string, string>;
  return rec['User-Agent'] ?? rec['user-agent'] ?? '';
}

describe('tiktok adapter fixtures', () => {
  it('reads a recipe caption from oEmbed when the watch page is a WAF challenge', async () => {
    const canonical = `https://www.tiktok.com/@cook/video/${tiktokRecipe.id}`;
    const meta = await fetchVideoMetadata('tiktok', canonical, {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('oembed')) return jsonResponse(tiktokRecipe.oembed);
        return htmlResponse(
          `<!DOCTYPE html><html><body>Please wait...<p id="wci" class="_wafchallengeid"></p><script id="slardar-config">{"slardarClient":"SlardarWAF"}</script></body></html>`,
        );
      },
    });
    expect(meta?.title).toContain('Garlic noodles');
    expect(meta?.description).toContain('200g noodles');
    expect(meta?.description).not.toMatch(/Please wait/i);
    expect(videoTextIsUsable(meta!, videoMetadataToText(meta!))).toBe(true);
  });
});

describe('facebook adapter fixtures', () => {
  it('reads the full share caption from mobile HTML, not the truncated og:description', async () => {
    const fetched: string[] = [];
    const canonical = 'https://www.facebook.com/share/r/19gXXsQ2qs';
    const meta = await fetchVideoMetadata('facebook', canonical, {
      lookup: publicLookup,
      fetch: async (input) => {
        fetched.push(String(input));
        return htmlResponse(facebookShareHtml);
      },
    });
    expect(fetched.some((url) => url.startsWith('https://m.facebook.com/share/r/19gXXsQ2qs'))).toBe(true);
    expect(fetched.some((url) => url.includes('www.facebook.com'))).toBe(true);
    expect(meta?.authorName).toBe('The Chocolate Foody');
    expect(meta?.description).toContain('200g dark chocolate');
    expect(meta?.description).toContain('Layer nougat');
    expect(meta?.description).not.toMatch(/\.\.\.\s*$/);
    expect(videoTextIsUsable(meta!, videoMetadataToText(meta!))).toBe(true);
  });

  it('reads a comment recipe link and ignores related-video teasers', async () => {
    const meta = await fetchVideoMetadata('facebook', 'https://www.facebook.com/share/r/1HiLKxaKkN', {
      lookup: publicLookup,
      fetch: async (input, init) => {
        const url = String(input);
        const ua = userAgent(init);
        if (ua.includes('facebookexternalhit') || url.startsWith('https://www.facebook.com')) {
          return htmlResponse(facebookCrawlerHtml);
        }
        return htmlResponse(facebookTeaserHtml);
      },
    });
    expect(meta?.title).toMatch(/Chocolate Orange Pots/i);
    expect(meta?.linkedUrls).toEqual(['https://food.example/pots-de-creme']);
    expect(meta?.extraText).toContain('food.example/pots-de-creme');
    expect(meta?.extraText).not.toMatch(/Lemon Basil Tuna/i);
    expect(videoTextIsUsable(meta!, videoMetadataToText(meta!))).toBe(true);
  });

  it('reads auto-generated captions and ignores recipes from related videos', async () => {
    const track = 'https://scontent-syd2-1.xx.fbcdn.net/v/t39/captions.srt?oh=1';
    const mobile = `<!DOCTYPE html>
      <title>Spicy peanut noodles | Hayden Quinn | Facebook</title>
      <meta property="og:description" content="How good is peanut butter! And these quick and easy spicy noodles are just the spot for it!!" />
      <link rel="alternate" type="application/json+oembed" title="How good is peanut butter! Spicy noodles | Hayden Quinn | Facebook" />`;
    const crawler = `<!DOCTYPE html>
      <script type="application/json">{"captions_url":"https:\\/\\/scontent-syd2-1.xx.fbcdn.net\\/v\\/t39\\/captions.srt?oh=1","message":{"text":"How good is peanut butter spicy noodles"}}</script>
      <script type="application/json">{"play_count":87040,"savable_title":{"text":"Pumpkin Lasagne RECIPE 1/2 medium Kent Pumpkin 1 brown onion 6 tbs butter 1/2 cup plain flour 4 cups milk Preheat and bake until browned."}}</script>`;
    const srt = `1
00:00:00,000 --> 00:00:03,000
Add peanut butter chili oil
garlic soy sauce rice vinegar

2
00:00:03,000 --> 00:00:06,000
mix in cooked noodles and top with an egg yolk`;
    const meta = await fetchVideoMetadata('facebook', 'https://www.facebook.com/share/r/19kyDovGs3', {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.startsWith(track)) return new Response(srt, { status: 200, headers: { 'content-type': 'text/srt' } });
        if (url.startsWith('https://www.facebook.com')) return htmlResponse(crawler);
        return htmlResponse(mobile);
      },
    });
    expect(meta?.captions).toContain('peanut butter chili oil');
    expect(meta?.captions).toContain('egg yolk');
    expect(meta?.extraText ?? '').not.toMatch(/Pumpkin Lasagne/i);
    expect(videoMetadataToText(meta!)).toContain('Captions:');
    expect(videoTextIsUsable(meta!, videoMetadataToText(meta!))).toBe(true);
  });

  it('feeds Facebook speech captions into household /scrape instead of the page chrome', async () => {
    const track = 'https://scontent-syd2-1.xx.fbcdn.net/v/t39/captions.srt?oh=1';
    const result = await scrapeRecipeSource('https://www.facebook.com/share/r/19kyDovGs3/', {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.startsWith(track)) {
          return new Response(
            '1\n00:00:00,000 --> 00:00:04,000\nAdd peanut butter chili oil garlic soy sauce and noodles then top with an egg yolk',
            { status: 200, headers: { 'content-type': 'text/srt' } },
          );
        }
        if (url.startsWith('https://www.facebook.com')) {
          return htmlResponse(
            `<script type="application/json">{"captions_url":"https:\\/\\/scontent-syd2-1.xx.fbcdn.net\\/v\\/t39\\/captions.srt?oh=1"}</script>`,
          );
        }
        return htmlResponse(
          `<!DOCTYPE html><meta property="og:description" content="How good is peanut butter! And these quick and easy spicy noodles are just the spot for it!!" />`,
        );
      },
    });
    expect(result.source).toBe('text');
    if (result.source === 'text') {
      expect(result.content).toContain('peanut butter chili oil');
      expect(result.content).not.toMatch(/Unknown Recipe/i);
    }
  });
});

describe('facebook crawler comments', () => {
  it('scores the matching comment link above unrelated teasers', () => {
    const parsed = parseFacebookCrawlerHtml(
      facebookCrawlerHtml,
      'Get my recipe for Chocolate Orange Pots de Crème in the comments below',
    );
    expect(parsed.linkedUrls).toEqual(['https://food.example/pots-de-creme']);
    expect(parsed.extraText).toContain('printable recipe');
    expect(parsed.extraText).not.toMatch(/Lemon Basil Tuna/i);
  });

  it('drops other videos from the related-reels section and reads the caption file', () => {
    const html = `${facebookCrawlerHtml}
      <script type="application/json">{"play_count":1,"savable_title":{"text":"Simple Pork Rissoles 500g pork mince 1 egg 1 tbs fennel seeds Preheat and bake."}}</script>`;
    const parsed = parseFacebookCrawlerHtml(html, 'Chocolate Orange Pots de Crème');
    expect(parsed.linkedUrls).toEqual(['https://food.example/pots-de-creme']);
    expect(parsed.extraText ?? '').not.toMatch(/Pork Rissoles/i);
    expect(
      facebookCaptionTrackUrl(
        `<script>{"video_home_www_related_videos_section":true,"captions_url":"https:\\/\\/scontent.xx.fbcdn.net\\/other.srt"}</script>
         <script>{"captions_url":"https:\\/\\/evil.example\\/caption.srt"}</script>
         <script>{"captions_url":"https:\\/\\/scontent-syd2-1.xx.fbcdn.net\\/v\\/captions.srt?oh=1"}</script>`,
      ),
    ).toBe('https://scontent-syd2-1.xx.fbcdn.net/v/captions.srt?oh=1');
    expect(
      facebookCaptionFileToText(`WEBVTT

00:00:00.000 --> 00:00:02.000
Add peanut butter chili oil and soy sauce`),
    ).toBe('Add peanut butter chili oil and soy sauce');
  });
});

describe('youtube adapter fixtures', () => {
  it('reads description and captions from saved player JSON, not oEmbed author_name', async () => {
    const meta = await fetchVideoMetadata('youtube', `https://www.youtube.com/watch?v=${youtubeChicken.id}`, {
      lookup: publicLookup,
      fetch: youtubeFixtureFetch(youtubeChicken),
    });
    expect(meta?.title).toBe('Flavorful Chicken Thighs');
    expect(meta?.description).toContain('4 chicken thighs');
    expect(meta?.description).not.toBe(youtubeChicken.oembed.author_name);
    expect(meta?.captions).toContain('paprika');
    expect(meta?.hasCaptions).toBe(true);
    expect(videoMetadataToText(meta!)).toContain('Description:');
  });
});

describe('JSON-LD blog fixture', () => {
  it('extracts title, scaled ingredients, and HowToSection headings', () => {
    const recipe = extractJsonLdRecipe(jsonLdHtml);
    expect(recipe?.title).toBe('Weeknight tomato pasta');
    expect(recipe?.ingredients.map((line) => line.name)).toContain('spaghetti');
    expect(recipe?.method.some((block) => block.type === 'heading' && block.text === 'Sauce')).toBe(true);
    expect(recipe?.method.filter((block) => block.type === 'step')).toHaveLength(3);
    expect(recipe?.originalServings).toBe(4);
  });
});

describe('fluff blog fixture', () => {
  it('ignores Article JSON-LD and reads the buried microdata recipe', () => {
    expect(extractJsonLdRecipe(fluffHtml)).toBeNull();
    const recipe = extractMicrodataRecipe(fluffHtml);
    expect(recipe?.title).toBe('Lemon herb salad');
    expect(recipe?.ingredients.length).toBe(3);
    expect(recipe?.method.length).toBe(2);
  });
});

describe('bad URL', () => {
  it('rejects non-http input before fetch', async () => {
    const result = await handleCreateRecipeImport(new Request('http://localhost/api/recipes/import', { method: 'POST' }), {
      url: 'not-a-url',
    });
    expect(result.status).toBe(400);
    expect(result.body.errorCode).toBe('invalid_url');
  });
});

describe('private IP', () => {
  it('blocks loopback, RFC1918, and link-local literals', () => {
    expect(() => assertPublicHttpUrl('http://127.0.0.1/recipe')).toThrow(SsrfError);
    expect(() => assertPublicHttpUrl('http://10.0.0.4/recipe')).toThrow(SsrfError);
    expect(() => assertPublicHttpUrl('http://192.168.1.20/secret')).toThrow(SsrfError);
    expect(() => assertPublicHttpUrl('http://169.254.169.254/latest/meta-data')).toThrow(SsrfError);
    expect(() => assertPublicHttpUrl('http://localhost/recipe')).toThrow(SsrfError);
  });

  it('blocks a public hostname that resolves to a private IP', async () => {
    await expect(
      fetchPublicHtml('https://evil.example/recipe', {
        lookup: async () => ['127.0.0.1'],
        fetch: async () => {
          throw new Error('fetch should not run');
        },
      }),
    ).rejects.toBeInstanceOf(SsrfError);
  });
});

describe('pipeline', () => {
  beforeEach(() => {
    resetRecipeImportStore();
    resetRecipeImportRateLimit();
  });
  afterEach(() => {
    resetRecipeImportStore();
  });

  it('persists JSON-LD without calling the LLM', async () => {
    const normalized = normalizeRecipeUrl('https://food.example/pasta');
    await saveImport({
      id: 'job-jsonld',
      status: 'queued',
      sourceKind: 'web',
      inputUrl: normalized.inputUrl,
      canonicalUrl: normalized.canonicalUrl,
      progress: 0,
      phaseLabel: 'Fetching…',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    let structured = 0;
    await processRecipeImport('job-jsonld', normalized, {
      lookup: publicLookup,
      fetch: async () => htmlResponse(jsonLdHtml),
      structure: async () => {
        structured += 1;
        return { ok: false, reason: 'not_a_recipe' };
      },
    });

    const { getImportById } = await import('./store.js');
    const job = await getImportById('job-jsonld');
    expect(structured).toBe(0);
    expect(job?.status).toBe('succeeded');
    expect(job?.recipe?.title).toBe('Weeknight tomato pasta');
    expect(job?.recipe?.attribution.sourceUrl).toBe(normalized.canonicalUrl);
    expect(job?.recipe?.extraction.method).toBe('json-ld');
    expect(job?.recipe?.extraction.confidence).toBeGreaterThan(0.9);
    expect(job?.recipe?.method.some((block) => block.type === 'heading')).toBe(true);
  });

  it('uses microdata on a fluff blog when JSON-LD is not a Recipe', async () => {
    const normalized = normalizeRecipeUrl('https://food.example/sunday');
    await saveImport({
      id: 'job-fluff',
      status: 'queued',
      sourceKind: 'web',
      inputUrl: normalized.inputUrl,
      canonicalUrl: normalized.canonicalUrl,
      progress: 0,
      phaseLabel: 'Fetching…',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await processRecipeImport('job-fluff', normalized, {
      lookup: publicLookup,
      fetch: async () => htmlResponse(fluffHtml),
      structure: async () => ({ ok: false, reason: 'not_a_recipe' }),
    });

    const { getImportById } = await import('./store.js');
    const job = await getImportById('job-fluff');
    expect(job?.status).toBe('succeeded');
    expect(job?.recipe?.title).toBe('Lemon herb salad');
    expect(job?.recipe?.extraction.method).toBe('microdata');
  });

  it('returns Recipe not found for non-recipe video metadata', async () => {
    const normalized = normalizeRecipeUrl('https://www.youtube.com/watch?v=dQw4w9wg');
    await saveImport({
      id: 'job-video',
      status: 'queued',
      sourceKind: 'youtube',
      inputUrl: normalized.inputUrl,
      canonicalUrl: normalized.canonicalUrl,
      progress: 0,
      phaseLabel: 'Fetching…',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    });

    await processRecipeImport('job-video', normalized, {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('oembed')) {
          return new Response(JSON.stringify(videoMeta), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return htmlResponse('<html><body>Official Music Video</body></html>');
      },
      structure: async () => ({ ok: false, reason: 'not_a_recipe' }),
    });

    const { getImportById } = await import('./store.js');
    const job = await getImportById('job-video');
    expect(job?.status).toBe('failed');
    expect(job?.errorCode).toBe('not_a_recipe');
    expect(job?.errorMessage).toBe(RECIPE_NOT_FOUND_MESSAGE);
  });

  it('imports a YouTube Short, watch URL, and ?si= share URL from the same fixture (no live network)', async () => {
    const shapes = [
      `https://www.youtube.com/shorts/${youtubeChicken.id}`,
      `https://www.youtube.com/watch?v=${youtubeChicken.id}`,
      `https://youtu.be/${youtubeChicken.id}?si=AbCdEfShareToken`,
    ];
    const canonical = `https://www.youtube.com/watch?v=${youtubeChicken.id}`;

    for (const [index, raw] of shapes.entries()) {
      const normalized = normalizeRecipeUrl(raw);
      expect(normalized.canonicalUrl).toBe(canonical);
      expect(normalized.videoId).toBe(youtubeChicken.id);

      const jobId = `job-yt-${index}`;
      await saveImport(queuedJob(jobId, normalized));
      await processRecipeImport(jobId, normalized, {
        lookup: publicLookup,
        fetch: youtubeFixtureFetch(youtubeChicken),
        structure: async (content) => {
          expect(content).toContain('chicken thighs');
          expect(content).toContain('paprika');
          return chickenStructure('deepseek');
        },
      });

      const { getImportById } = await import('./store.js');
      const job = await getImportById(jobId);
      expect(job?.status).toBe('succeeded');
      expect(job?.recipe?.title).toBe('Flavorful Chicken Thighs');
      expect(job?.recipe?.originalServings).toBe(2);
      expect(job?.recipe?.ingredients.some((line) => line.name.includes('chicken') && line.quantity)).toBe(true);
      expect(job?.recipe?.method.filter((block) => block.type === 'step').length).toBeGreaterThanOrEqual(2);
      expect(job?.recipe?.attribution.sourceUrl).toBe(canonical);
      expect(job?.recipe?.attribution.inputUrl).toBe(raw);
      expect(job?.recipe?.extraction.provider).toBe('deepseek');
    }
  });

  it('imports a TikTok caption fixture', async () => {
    const normalized = normalizeRecipeUrl(
      `https://www.tiktok.com/@cook/video/${tiktokRecipe.id}?is_from_webapp=1`,
    );
    await saveImport(queuedJob('job-tiktok', normalized));
    await processRecipeImport('job-tiktok', normalized, {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('oembed')) {
          return jsonResponse(tiktokRecipe.oembed);
        }
        return htmlResponse(
          `<html><head><meta property="og:title" content="${tiktokRecipe.oembed.title}"><meta property="og:description" content="${tiktokRecipe.oembed.title}"></head></html>`,
        );
      },
      structure: async (content) => {
        expect(content.toLowerCase()).toContain('noodles');
        return {
          ok: true,
          provider: 'deepseek',
          core: {
            title: 'Garlic noodles',
            ingredients: [
              { id: 'ing-1', name: 'noodles', quantity: { value: 200, unit: 'g', raw: '200g' } },
              { id: 'ing-2', name: 'butter', quantity: { value: 3, unit: 'tbsp', raw: '3 tbsp' } },
            ],
            method: [
              { id: 's-1', type: 'step', text: 'Boil the noodles.' },
              { id: 's-2', type: 'step', text: 'Melt butter, toast garlic, and toss.' },
            ],
          },
        };
      },
    });

    const { getImportById } = await import('./store.js');
    const job = await getImportById('job-tiktok');
    expect(job?.status).toBe('succeeded');
    expect(job?.recipe?.title).toBe('Garlic noodles');
    expect(job?.recipe?.attribution.sourceUrl).toBe(normalized.canonicalUrl);
  });

  it('imports a Facebook share/r fixture via the mobile caption', async () => {
    const raw = 'https://www.facebook.com/share/r/19gXXsQ2qs/';
    const normalized = normalizeRecipeUrl(raw);
    expect(normalized.sourceKind).toBe('facebook');
    expect(normalized.canonicalUrl).toBe('https://www.facebook.com/share/r/19gXXsQ2qs');
    await saveImport(queuedJob('job-facebook', normalized));
    const fetched: string[] = [];
    await processRecipeImport('job-facebook', normalized, {
      lookup: publicLookup,
      fetch: async (input) => {
        fetched.push(String(input));
        return htmlResponse(facebookShareHtml);
      },
      structure: async (content) => {
        expect(content).toContain('200g dark chocolate');
        expect(content).toContain('Layer nougat');
        return {
          ok: true,
          provider: 'deepseek',
          core: {
            title: 'Homemade Mars bars',
            ingredients: [
              { id: 'ing-1', name: 'dark chocolate', quantity: { value: 200, unit: 'g', raw: '200g' } },
              { id: 'ing-2', name: 'sugar', quantity: { value: 150, unit: 'g', raw: '150g' } },
              { id: 'ing-3', name: 'condensed milk', quantity: { value: 1, unit: 'can', raw: '1 can' } },
              { id: 'ing-4', name: 'nougat', quantity: { value: 100, unit: 'g', raw: '100g' } },
            ],
            method: [
              { id: 's-1', type: 'step', text: 'Melt the chocolate.' },
              { id: 's-2', type: 'step', text: 'Layer nougat, caramel, and chocolate, then chill.' },
            ],
          },
        };
      },
    });

    const { getImportById } = await import('./store.js');
    const job = await getImportById('job-facebook');
    expect(fetched.some((url) => url.includes('m.facebook.com'))).toBe(true);
    expect(job?.status).toBe('succeeded');
    expect(job?.recipe?.title).toBe('Homemade Mars bars');
    expect(job?.recipe?.extraction.method).toBe('caption-llm');
    expect(job?.recipe?.attribution.sourceUrl).toBe(normalized.canonicalUrl);
    expect(job?.recipe?.attribution.inputUrl).toBe(raw);
  });

  it('follows a Facebook comment recipe URL to JSON-LD instead of treating the teaser as not a recipe', async () => {
    const raw = 'https://www.facebook.com/share/r/1HiLKxaKkN/';
    const normalized = normalizeRecipeUrl(raw);
    await saveImport(queuedJob('job-facebook-link', normalized));
    let structured = 0;
    await processRecipeImport('job-facebook-link', normalized, {
      lookup: publicLookup,
      fetch: async (input, init) => {
        const url = String(input);
        const ua = userAgent(init);
        if (url.includes('food.example/pots-de-creme')) return htmlResponse(jsonLdHtml);
        if (ua.includes('facebookexternalhit') || url.startsWith('https://www.facebook.com')) {
          return htmlResponse(facebookCrawlerHtml);
        }
        return htmlResponse(facebookTeaserHtml);
      },
      structure: async () => {
        structured += 1;
        return { ok: false, reason: 'not_a_recipe' };
      },
    });

    const { getImportById } = await import('./store.js');
    const job = await getImportById('job-facebook-link');
    expect(structured).toBe(0);
    expect(job?.status).toBe('succeeded');
    expect(job?.recipe?.title).toBe('Weeknight tomato pasta');
    expect(job?.recipe?.extraction.method).toBe('json-ld');
    expect(job?.recipe?.attribution.sourceUrl).toBe(normalized.canonicalUrl);
    expect(job?.recipe?.attribution.inputUrl).toBe(raw);
  });
});

function queuedJob(id: string, normalized: ReturnType<typeof normalizeRecipeUrl>) {
  return {
    id,
    status: 'queued' as const,
    sourceKind: normalized.sourceKind,
    inputUrl: normalized.inputUrl,
    canonicalUrl: normalized.canonicalUrl,
    progress: 0,
    phaseLabel: 'Fetching…',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 180_000).toISOString(),
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function youtubeFixtureFetch(fixture: YoutubeFixture): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('oembed')) return jsonResponse(fixture.oembed);
    if (url.includes('timedtext')) {
      return new Response(`<transcript><text>${fixture.captions}</text></transcript>`, {
        status: 200,
        headers: { 'content-type': 'text/xml' },
      });
    }
    const player = {
      videoDetails: {
        title: fixture.oembed.title,
        shortDescription: fixture.description,
        author: fixture.oembed.author_name,
      },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: `https://www.youtube.com/api/timedtext?v=${fixture.id}`,
              languageCode: 'en',
            },
          ],
        },
      },
    };
    return htmlResponse(`<html><script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script></html>`);
  };
}

function chickenStructure(provider: string) {
  return {
    ok: true as const,
    provider,
    core: {
      title: 'Flavorful Chicken Thighs',
      originalServings: 2,
      ingredients: [
        { id: 'ing-1', name: 'chicken thighs', quantity: { value: 4, raw: '4' } },
        { id: 'ing-2', name: 'paprika', quantity: { value: 1, unit: 'tbsp', raw: '1 tbsp' } },
        { id: 'ing-3', name: 'salt', quantity: { value: 1, unit: 'tsp', raw: '1 tsp' } },
        { id: 'ing-4', name: 'olive oil', quantity: { value: 2, unit: 'tbsp', raw: '2 tbsp' } },
      ],
      method: [
        { id: 's-1', type: 'step' as const, text: 'Season the thighs with paprika and salt.' },
        { id: 's-2', type: 'step' as const, text: 'Sear in olive oil, then finish in the oven.' },
      ],
    },
  };
}
