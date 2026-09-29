import { normalizeRecipeUrl } from '@kinexus/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { dishNameFromCaption, recipeIdFromProvechoHub, recipeUrlFromYoutubeResults } from './adapters/recipe-links.js';
import { encodeProvechoRecipe, extractProvechoRecipe } from './extract-provecho.js';
import { fetchVideoMetadata, videoMetadataToText, videoTextIsUsable } from './extract-video.js';
import { processRecipeImport } from './pipeline.js';
import { scrapeRecipeSource } from '../scrape/recipe-source.js';
import { resetRecipeImportStore, saveImport, getImportById } from './store.js';
import { recipeIsGrounded } from './structure-llm.js';

const publicLookup = async () => ['8.8.8.8'];

const steak = {
  name: 'Steak Alfredo',
  yieldAmount: 3,
  timeToCook: 4500,
  authorUsername: 'cookingwithkian',
  images: ['https://images.example/steak.jpg'],
  subRecipes: [
    {
      tabname: 'Alfredo',
      directions: [
        {
          text: 'For the fresh pasta:',
          ingredients: [
            { text: 'flour', qty: 330, unit: 'g' },
            { text: 'large egg yolks', qty: 7, unit: '' },
          ],
        },
        {
          text: 'Knead the dough until smooth, rest it, then roll and cut fettuccine.',
          ingredients: [],
        },
        {
          text: 'Sear the ribeye, slice it, and toss the pasta with parmesan and pasta water.',
          ingredients: [
            { text: 'ribeye', qty: 2, unit: '' },
            { text: 'parmesan', qty: 1, unit: 'cup' },
          ],
        },
      ],
    },
  ],
};

describe('tiktok recipe targeting', () => {
  beforeEach(() => {
    resetRecipeImportStore();
  });
  afterEach(() => {
    resetRecipeImportStore();
  });

  it('does not treat a recipe-in-bio caption as a cookable recipe', async () => {
    const meta = await fetchVideoMetadata('tiktok', 'https://www.tiktok.com/@cooking_with.kian/video/7657597245906373901', {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('oembed')) {
          return json({
            title: 'Steak Alfredo:) recipe in bio!',
            author_name: 'Kian Hiatt',
            thumbnail_url: 'https://example.com/steak.jpg',
          });
        }
        if (url.includes('youtube.com/results')) {
          return html(
            `"title":{"runs":[{"text":"Steak Alfredo:) recipe in bio!"}]},"descriptionSnippet":{"runs":[{"text":"Recipe: https://provecho.co/platform/recipe/CLtf0xFPLMMEQiJmVNzb"}]}`,
          );
        }
        return html('<html>Please wait</html>');
      },
    });
    expect(meta?.title).toContain('Steak Alfredo');
    expect(meta?.linkedUrls).toEqual(['https://provecho.co/platform/recipe/CLtf0xFPLMMEQiJmVNzb']);
    expect(videoTextIsUsable(meta!, videoMetadataToText(meta!))).toBe(false);
    expect(
      recipeIsGrounded('Title: Steak Alfredo:) recipe in bio!', {
        title: 'Crispy Garlic Butter Pasta',
        ingredients: [{ name: 'garlic' }, { name: 'butter' }, { name: 'pasta' }],
      }),
    ).toBe(false);
  });

  it('uses the requested video, not the first recommended one', async () => {
    const target = '7657597245906373901';
    const page = `<script id="SIGI_STATE" type="application/json">${JSON.stringify({
      ItemModule: {
        '111': { id: '111', desc: 'Crispy garlic butter pasta. 200g pasta, 4 tbsp butter, 6 garlic cloves. Boil, fry the garlic, toss.' },
        [target]: { id: target, desc: 'Steak Alfredo:) recipe in bio!', author: { nickname: 'Kian Hiatt' } },
      },
    })}</script>`;
    const meta = await fetchVideoMetadata('tiktok', `https://www.tiktok.com/@cooking_with.kian/video/${target}`, {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('oembed')) return new Response('nope', { status: 429 });
        if (url.includes('youtube.com/results')) return html('');
        return html(page);
      },
    });
    expect(meta?.description).toBe('Steak Alfredo:) recipe in bio!');
    expect(meta?.description).not.toMatch(/garlic/i);
  });

  it('imports the linked written recipe instead of inventing another pasta', async () => {
    const normalized = normalizeRecipeUrl('https://www.tiktok.com/@cooking_with.kian/video/7657597245906373901');
    await saveImport({
      id: 'job-steak',
      status: 'queued',
      sourceKind: normalized.sourceKind,
      inputUrl: normalized.inputUrl,
      canonicalUrl: normalized.canonicalUrl,
      progress: 0,
      phaseLabel: 'Fetching…',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    });
    let structured = 0;
    await processRecipeImport('job-steak', normalized, {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('oembed')) {
          return json({ title: 'Steak Alfredo:) recipe in bio!', author_name: 'Kian Hiatt' });
        }
        if (url.includes('youtube.com/results')) {
          return html(youtubeResult);
        }
        if (url.includes('provecho.co/platform/recipe')) {
          return html(
            `<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"encodedRecipe":"${encodeProvechoRecipe(steak)}"}}}</script>`,
          );
        }
        return html('<html>Please wait</html>');
      },
      structure: async () => {
        structured += 1;
        return {
          ok: true,
          provider: 'deepseek',
          core: {
            title: 'Crispy Garlic Butter Pasta',
            ingredients: [{ id: 'ing-1', name: 'garlic' }],
            method: [{ id: 'step-1', type: 'step', text: 'Fry the garlic in butter.' }],
          },
        };
      },
    });
    const job = await getImportById('job-steak');
    expect(structured).toBe(0);
    expect(job?.status).toBe('succeeded');
    expect(job?.recipe?.title).toBe('Steak Alfredo');
    expect(job?.recipe?.ingredients.some((line) => /ribeye/i.test(line.name))).toBe(true);
    expect(job?.recipe?.ingredients.some((line) => /garlic/i.test(line.name))).toBe(false);
  });

  it('gives household import the steak alfredo recipe instead of a guessed dish', async () => {
    const result = await scrapeRecipeSource(
      'https://www.tiktok.com/@cooking_with.kian/video/7657597245906373901',
      {
        lookup: publicLookup,
        fetch: async (input) => {
          const url = String(input);
          if (url.includes('oembed')) {
            return json({ title: 'Steak Alfredo:) recipe in bio!', author_name: 'Kian Hiatt' });
          }
          if (url.startsWith('https://provecho.co/cookingwithkian')) {
            return html('{"id":"CLtf0xFPLMMEQiJmVNzb","name":"Steak Alfredo"}');
          }
          if (url.includes('/platform/recipe/')) {
            return html(
              `<script>{"props":{"pageProps":{"encodedRecipe":"${encodeProvechoRecipe(steak)}"}}}</script>`,
            );
          }
          return html('<html>Please wait</html>');
        },
      },
    );
    expect(result.source).toBe('json-ld');
    if (result.source !== 'json-ld') return;
    expect(result.recipe.name).toBe('Steak Alfredo');
    expect(result.recipe.ingredients.some((line) => /ribeye/i.test(line.name))).toBe(true);
    expect(result.recipe.name).not.toMatch(/shrimp|garlic butter/i);
  });

  it('says the recipe was not found instead of guessing another dish', async () => {
    const result = await scrapeRecipeSource(
      'https://www.tiktok.com/@cooking_with.kian/video/7657597245906373901',
      {
        lookup: publicLookup,
        fetch: async (input) => {
          const url = String(input);
          if (url.includes('oembed')) {
            return json({ title: 'Steak Alfredo:) recipe in bio!', author_name: 'Kian Hiatt' });
          }
          return html('<html>no recipe here</html>');
        },
      },
    );
    expect(result.source).toBe('not-found');
    if (result.source !== 'not-found') return;
    expect(result.dishName).toBe('Steak Alfredo');
    expect(result.recipeUrl).toContain('7657597245906373901');
    expect(dishNameFromCaption('Steak Alfredo:) recipe in bio!')).toBe('Steak Alfredo');
  });
});

describe('provecho page decode', () => {
  it('reads ingredients from the encoded recipe embedded in the page', () => {
    const core = extractProvechoRecipe(
      `<html><script id="__NEXT_DATA__">{"props":{"pageProps":{"encodedRecipe":"${encodeProvechoRecipe(steak)}"}}}</script></html>`,
    );
    expect(core?.title).toBe('Steak Alfredo');
    expect(core?.originalServings).toBe(3);
    expect(core?.cookTimeMinutes).toBe(75);
    expect(core?.ingredients.map((line) => line.name)).toEqual(
      expect.arrayContaining([expect.stringMatching(/flour/i), expect.stringMatching(/ribeye/i)]),
    );
    expect(core?.method.some((block) => block.type === 'heading')).toBe(true);
  });
});

describe('youtube result recipe links', () => {
  it('keeps the link only when the result title matches the caption', () => {
    const html = [
      `"title":{"runs":[{"text":"Crispy garlic butter pasta"}]},"descriptionSnippet":{"runs":[{"text":"Recipe: https://food.example/garlic"}]}`,
      `"title":{"runs":[{"text":"Steak Alfredo:) recipe in bio!"}]},"descriptionSnippet":{"runs":[{"text":"Recipe: https://provecho.co/platform/recipe/abc"}]}`,
    ].join('\n');
    expect(recipeUrlFromYoutubeResults(html, 'Steak Alfredo:) recipe in bio!')).toBe(
      'https://provecho.co/platform/recipe/abc',
    );
    const nearMiss = `"title":{"runs":[{"text":"How to Make Delicious Steak Alfredo"}]},"descriptionSnippet":{"runs":[{"text":"Recipe: https://food.example/other"}]}`;
    expect(recipeUrlFromYoutubeResults(nearMiss, 'Steak Alfredo:) recipe in bio!')).toBeUndefined();
  });

  it('picks the matching dish on a multi-recipe bio page', () => {
    const hub = [
      '{"id":"111","name":"Crispy garlic butter pasta"}',
      '{"id":"CLtf0xFPLMMEQiJmVNzb","name":"Steak Alfredo"}',
    ].join(',');
    expect(recipeIdFromProvechoHub(hub, 'Steak Alfredo:) recipe in bio!')).toBe('CLtf0xFPLMMEQiJmVNzb');
  });
});

const youtubeResult = `"title":{"runs":[{"text":"Steak Alfredo:) recipe in bio!"}]},"descriptionSnippet":{"runs":[{"text":"Recipe: https://provecho.co/platform/recipe/CLtf0xFPLMMEQiJmVNzb"}]}`;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function html(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
}
