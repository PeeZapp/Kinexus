import { normalizeRecipeUrl } from '@kinexus/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeImportFailure } from './errors.js';
import { handleCreateRecipeImport } from './handlers.js';
import { TIKTOK_LINK_OPEN_FAILED, resolveTiktokRecipeUrl } from './resolve-tiktok.js';
import { resetRecipeImportRateLimit } from './rate-limit.js';
import { resetRecipeImportStore } from './store.js';

const publicLookup = async () => ['8.8.8.8'];

describe('resolveTiktokRecipeUrl', () => {
  it('follows short-link redirects to @user/video/<id>', async () => {
    const normalized = normalizeRecipeUrl('https://vm.tiktok.com/ZMxxxxxxx/');
    expect(normalized.needsResolve).toBe(true);

    const resolved = await resolveTiktokRecipeUrl(normalized, {
      lookup: publicLookup,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('vm.tiktok.com')) {
          return new Response(null, {
            status: 302,
            headers: { location: 'https://www.tiktok.com/@cook/video/7123456789012345678?_r=1' },
          });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    });

    expect(resolved.canonicalUrl).toBe('https://www.tiktok.com/@cook/video/7123456789012345678');
    expect(resolved.videoId).toBe('7123456789012345678');
    expect(resolved.needsResolve).toBeUndefined();
    expect(resolved.inputUrl).toBe(normalized.inputUrl);
  });

  it('accepts a /photo/<id> redirect target', async () => {
    const normalized = normalizeRecipeUrl('https://www.tiktok.com/t/ZTxxxxxxx/');
    const resolved = await resolveTiktokRecipeUrl(normalized, {
      lookup: publicLookup,
      fetch: async () =>
        new Response(null, {
          status: 301,
          headers: { location: 'https://www.tiktok.com/@user/photo/1234567890123456789' },
        }),
    });
    expect(resolved.canonicalUrl).toBe('https://www.tiktok.com/@user/photo/1234567890123456789');
    expect(resolved.videoId).toBe('1234567890123456789');
  });

  it('fails clear when a short link lands on /404', async () => {
    const normalized = normalizeRecipeUrl('https://vt.tiktok.com/ZSxxxxxxx/');
    await expect(
      resolveTiktokRecipeUrl(normalized, {
        lookup: publicLookup,
        fetch: async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'https://www.tiktok.com/404' },
          }),
      }),
    ).rejects.toMatchObject({
      name: 'RecipeImportFailure',
      code: 'fetch_failed',
      message: TIKTOK_LINK_OPEN_FAILED,
    } satisfies Partial<RecipeImportFailure>);
  });

  it('leaves already-canonical TikTok URLs alone', async () => {
    const normalized = normalizeRecipeUrl('https://www.tiktok.com/@user/video/1234567890123456789');
    const fetch = vi.fn();
    const resolved = await resolveTiktokRecipeUrl(normalized, { fetch, lookup: publicLookup });
    expect(resolved).toEqual(normalized);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('TikTok short-link import handler', () => {
  beforeEach(() => {
    resetRecipeImportStore();
    resetRecipeImportRateLimit();
  });
  afterEach(() => {
    resetRecipeImportStore();
    resetRecipeImportRateLimit();
    vi.unstubAllGlobals();
  });

  it('resolves before cache lookup and caches open failures for one minute', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://www.tiktok.com/' },
        }),
    );

    const raw = 'https://vm.tiktok.com/ZMdeadlink/';
    const first = await handleCreateRecipeImport(new Request('http://localhost/api/recipes/import', { method: 'POST' }), {
      url: raw,
    });
    expect(first.status).toBe(422);
    expect(first.body.job?.status).toBe('failed');
    expect(first.body.job?.errorMessage).toBe(TIKTOK_LINK_OPEN_FAILED);
    expect(first.body.job?.canonicalUrl).toBe('https://vm.tiktok.com/ZMdeadlink');

    const second = await handleCreateRecipeImport(new Request('http://localhost/api/recipes/import', { method: 'POST' }), {
      url: raw,
    });
    expect(second.status).toBe(200);
    expect(second.body.job?.id).toBe(first.body.job?.id);
    expect(second.body.job?.errorMessage).toBe(TIKTOK_LINK_OPEN_FAILED);
  });
});
